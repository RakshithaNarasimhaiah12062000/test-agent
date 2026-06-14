# Autonomous Test Agent

An AI agent that takes a URL and a plain-English goal, opens a real browser, completes the flow autonomously, and outputs test steps in FireFlink NLP format ready for execution.

Built as a proposal prototype for AI-native test generation inside FireFlink.

---

## What it does

Give it a goal like:

> "Log in with username 'standard_user' and password 'secret_sauce', add the Sauce Labs Backpack to the cart, and verify the product and price on the cart page."

The agent then:

1. Opens a real Chromium browser via Playwright
2. Snapshots the page's interactive elements
3. Asks Claude what to do next given the goal and current page
4. Executes the action (click, type, select dropdown)
5. Repeats until the goal is achieved or it hits a safety bound
6. Outputs a complete FireFlink NLP test case from the captured journey

## Architecture

- **Frontend**: React 19 + Vite. Dark UI with live agent log streamed from the backend.
- **Backend**: Node.js + Express. Streams agent decisions to the UI via Server-Sent Events.
- **Browser automation**: Playwright (industry standard, Selenium successor).
- **Agent reasoning**: Anthropic Claude Sonnet 4.5.
- **Output**: FireFlink NLP step format that maps 1-to-1 with the existing Java NLP class library.

Pipeline: snapshot → reason → execute → verify, looped with safety bounds (max 15 steps, duplicate-action loop detection).

## Tech stack

React 19, Vite 8, Node.js, Express, Playwright, Anthropic SDK, Server-Sent Events.

## Running locally

Requirements: Node.js 18+, an Anthropic API key.

1. `npm install`
2. `npx playwright install chromium`
3. Create a `.env` file with `ANTHROPIC_API_KEY=your-key-here` and `PORT=3001`
4. Backend: `node server.js`
5. Frontend (new terminal): `npm run dev`
6. Open `http://localhost:5173`

## Example flows tested

- **E-commerce (saucedemo.com)**: Login → add to cart → navigate to cart → verify product and price ✅
- **Banking (parabank.parasoft.com)**: Login → transfer funds (form filling + dropdown selection)
- More to come

## How it differs from existing tools

Tools like Mabl, Applitools, and Katalon generate tests for their own platforms. This agent emits FireFlink-native NLP steps that map directly to the existing Java NLP class library, so generated tests integrate without translation middleware.

## V1 limitations (honest)

- Custom dropdowns built from `<div>` elements (non-native) need V2
- Shadow DOM and iframe-based widgets need V2
- Vision-based interactions (canvas, image UI) need V2
- Multi-tab and popup handling need V2

## V2 roadmap

- Vision-based element recognition (screenshot input alongside DOM snapshot)
- Multi-agent split: Planner → Locator → Verifier specialists
- Self-healing selectors with fallback strategies
- Model routing: Gemini Flash for simple steps (~20x cheaper), Claude for complex reasoning
- Direct FireFlink platform integration: save generated tests into project files

## Approximate cost

| Setup | Cost per agent run |
|---|---|
| V1 (Claude Sonnet only) | ~$0.04 per run |
| V2 (model routing) | ~$0.005 per run |
| Production blended | ~$0.01 per generated test case |

## Author

Rakshitha Narasimhaiah  
Solution Consultant (Test Automation), TestYantra Global  
M.S. Data Science and Analytics, Georgia State University

[LinkedIn](https://www.linkedin.com/in/rakshitha-narasimhaiah/)
