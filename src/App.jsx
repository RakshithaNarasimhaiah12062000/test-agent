import React, { useState, useRef } from "react";

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=JetBrains+Mono:wght@400;500;700&family=Outfit:wght@300;400;500;600&display=swap');
`;

const ACCENT = "#c6f24e";

export default function App() {
  const [url, setUrl] = useState("https://www.saucedemo.com/");
  const [goal, setGoal] = useState("Log in with username 'standard_user' and password 'secret_sauce' and verify the products page loads");
  const [logs, setLogs] = useState([]);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const logEndRef = useRef(null);

  function appendLog(entry) {
    setLogs((l) => [...l, entry]);
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  async function runAgent() {
    setError(""); setLogs([]); setResult(null); setRunning(true);
    try {
      const response = await fetch("http://localhost:3001/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, goal }),
      });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          try {
            const msg = JSON.parse(part.slice(6));
            if (msg.type === "result") setResult(msg.result);
            else if (msg.type === "error") setError(msg.text);
            else appendLog(msg);
          } catch { }
        }
      }
    } catch (e) {
      setError(e.message || "Agent run failed.");
    } finally {
      setRunning(false);
    }
  }

  function copyAll() {
    if (!result) return;
    const text = `${result.goal}\n\n${result.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
    navigator.clipboard?.writeText(text);
  }

  const logColor = { info: "#9aa091", snapshot: "#8fd3ff", decision: ACCENT, warn: "#ffb86b", error: "#ff7a5c" };

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(1200px 600px at 80% -10%, #1c2b1a 0%, transparent 60%), #0c0e0b", color: "#e8eadf", fontFamily: "'Outfit', sans-serif" }}>
      <style>{FONT_IMPORT}</style>
      <header style={{ padding: "28px 30px 22px", borderBottom: "1px solid #23271d" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: 2, color: ACCENT, textTransform: "uppercase", marginBottom: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: 9, background: ACCENT, boxShadow: running ? `0 0 12px ${ACCENT}` : "none", animation: running ? "pulse 1.2s infinite" : "none" }} />
          FireFlink  /  Agent v0.1 {running && "  /  RUNNING"}
        </div>
        <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 30, lineHeight: 1.05, margin: 0, letterSpacing: -0.5 }}>Autonomous Test Agent</h1>
        <p style={{ margin: "8px 0 0", color: "#9aa091", fontSize: 14, maxWidth: 640 }}>Opens a real browser, explores the page toward a goal you describe, and emits FireFlink NLP test steps from the actions it actually performed.</p>
        <style>{`@keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}`}</style>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(340px, 460px) 1fr" }}>
        <section style={{ padding: "26px 28px", borderRight: "1px solid #23271d" }}>
          <label style={labelStyle}>1  /  Target URL</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} style={inputStyle} disabled={running} />

          <label style={{ ...labelStyle, marginTop: 22 }}>2  /  Goal (plain English)</label>
          <textarea value={goal} onChange={(e) => setGoal(e.target.value)} style={{ ...inputStyle, minHeight: 130, resize: "vertical", lineHeight: 1.5 }} disabled={running} />

          <button onClick={runAgent} disabled={running || !url || !goal} style={{ ...primaryBtn, marginTop: 18, width: "100%", opacity: (running || !url || !goal) ? 0.4 : 1, cursor: (running || !url || !goal) ? "not-allowed" : "pointer" }}>
            {running ? "Agent running..." : "Run agent"}
          </button>

          {error && <div style={{ marginTop: 16, padding: "12px 14px", background: "#2a1714", border: "1px solid #4a261f", borderRadius: 10, color: "#ff9d86", fontSize: 13 }}>{error}</div>}

          <div style={{ marginTop: 22, padding: "14px 16px", background: "#11140f", border: "1px solid #23271d", borderRadius: 10, fontSize: 12, color: "#8a9079", lineHeight: 1.6 }}>
            <div style={{ color: ACCENT, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1, fontSize: 10, marginBottom: 6 }}>HOW IT WORKS</div>
            A real Chrome window opens. The agent snapshots the page, asks Claude what to do next, executes the action, and repeats. The captured journey becomes a FireFlink NLP test case.
          </div>
        </section>

        <section style={{ padding: "26px 30px", minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 600, fontSize: 18, margin: 0, marginBottom: 12 }}>Agent live log</h2>
            <div style={{ background: "#0a0c08", border: "1px solid #23271d", borderRadius: 12, padding: 16, minHeight: 220, maxHeight: 360, overflowY: "auto", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.7 }}>
              {logs.length === 0 && <div style={{ color: "#6f7566" }}>Waiting for agent...</div>}
              {logs.map((l, i) => (
                <div key={i} style={{ color: logColor[l.type] || "#cfd4c2", marginBottom: 4 }}>
                  <span style={{ color: "#6f7566" }}>[{l.type}]</span> {l.text}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 600, fontSize: 18, margin: 0 }}>FireFlink test case</h2>
              {result && <button onClick={copyAll} style={ghostBtn}>Copy</button>}
            </div>
            {!result && <div style={{ border: "1px dashed #2b3024", borderRadius: 12, padding: "32px 20px", textAlign: "center", color: "#6f7566", fontSize: 13 }}>Run the agent to see the generated test case.</div>}
            {result && (
              <div style={{ background: "#101309", border: "1px solid #23271d", borderRadius: 12, padding: "18px 20px" }}>
                <div style={{ color: ACCENT, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: 1, marginBottom: 6 }}>GOAL</div>
                <div style={{ fontSize: 14, color: "#d6dac9", marginBottom: 16 }}>{result.goal}</div>
                <div style={{ color: ACCENT, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: 1, marginBottom: 8 }}>STEPS</div>
                <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
                  {result.steps.map((s, i) => (
                    <li key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: i === 0 ? "none" : "1px solid #1a1e14" }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#6f7566", width: 22, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#d6dac9", lineHeight: 1.5 }}>{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#8a9079", marginBottom: 8 };
const inputStyle = { width: "100%", background: "#11140f", border: "1px solid #2b3024", borderRadius: 10, padding: "11px 13px", color: "#e8eadf", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, outline: "none", boxSizing: "border-box" };
const primaryBtn = { background: ACCENT, color: "#0c0e0b", border: "none", borderRadius: 10, padding: "13px 16px", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 14, cursor: "pointer" };
const ghostBtn = { background: "transparent", color: "#cfd4c2", border: "1px solid #2b3024", borderRadius: 8, padding: "6px 12px", fontFamily: "'Outfit', sans-serif", fontWeight: 500, fontSize: 12, cursor: "pointer" };