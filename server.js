import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { chromium } from "playwright";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3001;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ---- helpers to extract visible interactive elements from the live page ----
async function snapshotPage(page) {
    const elements = await page.evaluate(() => {
        const visible = (el) => {
            const r = el.getBoundingClientRect();
            const s = window.getComputedStyle(el);
            return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
        };
        const all = [...document.querySelectorAll('input, textarea, select, button, a, [role=button], [type=submit], [data-test], [class*="cart"], [class*="shopping"]')];
        const filtered = all.filter(visible).slice(0, 40);
        filtered.forEach((el, i) => el.setAttribute("data-agent-ref", String(i)));
        return filtered.map((el, i) => ({
            ref: i,
            tag: el.tagName.toLowerCase(),
            type: el.getAttribute("type") || "",
            id: el.id || "",
            name: el.getAttribute("name") || "",
            placeholder: el.getAttribute("placeholder") || "",
            ariaLabel: el.getAttribute("aria-label") || "",
            text: (el.innerText || el.value || "").trim().slice(0, 60),
            href: el.getAttribute("href") || "",
            dataTest: el.getAttribute("data-test") || "",
            className: (el.className || "").toString().slice(0, 80),
        }));
    });
    const title = await page.title();
    const url = page.url();
    return { title, url, elements };
}

function snapshotToText(snap) {
    const lines = snap.elements.map((e) => {
        const bits = [`ref=${e.ref}`, `<${e.tag}>`];
        if (e.type) bits.push(`type=${e.type}`);
        if (e.text) bits.push(`text="${e.text}"`);
        if (e.placeholder) bits.push(`placeholder="${e.placeholder}"`);
        if (e.ariaLabel) bits.push(`aria-label="${e.ariaLabel}"`);
        if (e.id) bits.push(`id=${e.id}`);
        if (e.name) bits.push(`name=${e.name}`);
        if (e.dataTest) bits.push(`data-test=${e.dataTest}`);
        if (e.href) bits.push(`href="${e.href}"`);
        if (e.className) bits.push(`class="${e.className}"`);
        return "  " + bits.join(" ");
    });
    return `URL: ${snap.url}\nTitle: ${snap.title}\nVisible elements:\n${lines.join("\n")}`;
}

// ---- the agent loop ----
async function runAgent(startUrl, goal, onLog) {
    const browser = await chromium.launch({ headless: false, slowMo: 300 });
    const context = await browser.newContext();
    const page = await context.newPage();

    const actionsTaken = [];
    const MAX_STEPS = 15;

    try {
        onLog({ type: "info", text: `Opening ${startUrl}` });
        await page.goto(startUrl, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1500);

        for (let step = 1; step <= MAX_STEPS; step++) {
            const snap = await snapshotPage(page);
            onLog({ type: "snapshot", text: `Step ${step}: ${snap.elements.length} elements on ${snap.url}` });
            // DEBUG: dump full snapshot to log
            snap.elements.forEach(e => {
                const tag = `<${e.tag}>`;
                const attrs = [
                    e.text ? `text="${e.text}"` : "",
                    e.dataTest ? `data-test=${e.dataTest}` : "",
                    e.id ? `id=${e.id}` : "",
                    e.ariaLabel ? `aria=${e.ariaLabel}` : "",
                    e.className ? `class=${e.className.slice(0, 40)}` : "",
                    e.href ? `href=${e.href}` : "",
                ].filter(Boolean).join(" ");
                onLog({ type: "info", text: `  ref=${e.ref} ${tag} ${attrs}` });
            });

            const system = `You are a QA test automation agent. At each step pick ONE next action.

CRITICAL: Respond with ONLY a single JSON object. No prose, no explanation, no markdown. Just the JSON.

Actions:
  {"action":"click","ref":<number>,"name":"<short element name>","reason":"..."}
  {"action":"type","ref":<number>,"name":"<short element name>","value":"<text to type>","reason":"..."}
  {"action":"done","reason":"goal achieved"}
  {"action":"fail","reason":"cannot proceed because ..."}

Tips for identifying elements:
- Use text, data-test, id, aria-label, href, and CLASS NAME to identify purpose.
- An <a> with class containing "cart" is the shopping cart link.
- An <a> with class containing "menu" or id containing "burger" is the hamburger menu (avoid unless needed).
- Do NOT click "Open Menu" to access the cart; the cart icon is a separate link, look for class "shopping_cart_link" or similar.
- If you don't see the element you need, try "fail" with a clear reason.

Use the element name to describe its purpose (e.g. "Username Input Field", "Login Button", "Shopping Cart Link"). Be decisive. Stop with "done" the moment the goal is visibly achieved. Stop with "fail" if stuck.

Reminder: respond with ONLY the JSON object, nothing else.`;

            const user = `GOAL: ${goal}

ACTIONS SO FAR:
${actionsTaken.length === 0 ? "(none)" : actionsTaken.map((a, i) => `${i + 1}. ${a.summary}`).join("\n")}

CURRENT PAGE:
${snapshotToText(snap)}

Pick the next single action as JSON.`;

            const response = await anthropic.messages.create({
                model: "claude-sonnet-4-5",
                max_tokens: 500,
                system,
                messages: [{ role: "user", content: user }],
            });

            const raw = response.content.filter(b => b.type === "text").map(b => b.text).join("").replace(/```json|```/g, "").trim();
            let decision;
            try { decision = JSON.parse(raw); }
            catch { onLog({ type: "warn", text: `Could not parse agent decision, stopping. Raw: ${raw.slice(0, 200)}` }); break; }

            onLog({ type: "decision", text: `Step ${step}: ${decision.action} ${decision.name || ""} ${decision.value ? `("${decision.value}")` : ""} - ${decision.reason || ""}` });

            if (decision.action === "done") {
                actionsTaken.push({ summary: `DONE: ${decision.reason}`, fireflink: null });
                break;
            }
            if (decision.action === "fail") {
                actionsTaken.push({ summary: `FAIL: ${decision.reason}`, fireflink: null });
                break;
            }

            const target = snap.elements.find(e => e.ref === decision.ref);
            if (!target) {
                onLog({ type: "warn", text: `Element ref ${decision.ref} not found, stopping.` });
                break;
            }

            onLog({ type: "info", text: `  -> target ref=${target.ref} tag=${target.tag} data-test=${target.dataTest || "(none)"} class=${(target.className || "(none)").slice(0, 50)} text="${target.text}"` });
            const locator = page.locator(`[data-agent-ref="${decision.ref}"]`);

            try {
                if (decision.action === "click") {
                    await locator.first().click({ timeout: 5000 });
                    actionsTaken.push({
                        summary: `Clicked ${decision.name}`,
                        fireflink: `Click on the WebElement "${decision.name}"`,
                    });
                } else if (decision.action === "type") {
                    await locator.first().fill(decision.value);
                    actionsTaken.push({
                        summary: `Typed "${decision.value}" into ${decision.name}`,
                        fireflink: `Enter "${decision.value}" into the WebElement "${decision.name}"`,
                    });
                }
                await page.waitForTimeout(1500);
                onLog({ type: "info", text: `  -> URL after action: ${page.url()}` });
            } catch (e) {
                onLog({ type: "warn", text: `Action failed: ${e.message.slice(0, 120)}` });
                actionsTaken.push({ summary: `(failed) ${decision.action} ${decision.name}`, fireflink: null });
            }
        }

        // assemble the FireFlink test case
        const fireflinkSteps = [`Navigate to the URL "${startUrl}"`, ...actionsTaken.filter(a => a.fireflink).map(a => a.fireflink)];
        onLog({ type: "info", text: `Agent finished. ${fireflinkSteps.length} test steps captured.` });

        return {
            goal,
            startUrl,
            steps: fireflinkSteps,
            trace: actionsTaken.map(a => a.summary),
        };
    } finally {
        await browser.close();
    }
}

// ---- streaming endpoint: sends agent logs to the frontend live ----
app.post("/api/agent", async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

    try {
        const { url, goal } = req.body;
        if (!url || !goal) { send({ type: "error", text: "url and goal required" }); return res.end(); }

        const result = await runAgent(url, goal, send);
        send({ type: "result", result });
        res.end();
    } catch (e) {
        console.error(e);
        send({ type: "error", text: e.message });
        res.end();
    }
});

app.listen(PORT, () => console.log(`Agent backend running on http://localhost:${PORT}`));