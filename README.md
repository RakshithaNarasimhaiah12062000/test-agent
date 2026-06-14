# Autonomous Test Agent for FireFlink

AI-powered autonomous test case generation. Give it a URL and a plain-English goal, and it opens a real browser, completes the flow on its own, and outputs test steps in FireFlink's NLP format ready for execution.

## What it does

The agent takes natural language goals like "Log in with username X and password Y, add product to cart, verify the cart shows the product" and autonomously:

1. Opens a real Chromium browser using Playwright
2. Snapshots the page's interactive elements
3. Uses Claude to decide the next action based on the goal and current page
4. Executes the action (click, type, select dropdown)
5. Repeats until the goal is achieved
6. Outputs a complete FireFlink NLP test case from the captured journey

## Architecture

- **Frontend**: React (Vite) interface for goal input and live agent log
- **Backend**: Node.js + Express, streams agent decisions to the UI in real time
- **Browser automation**: Playwright
- **Agent reasoning**: Anthropic Claude Sonnet 4.5
- **Output**: FireFlink NLP step format

Pipeline: snapshot to reason to execute to verify, looped with safety bounds (max 15 steps, duplicate-action loop detection).

## Tech stack

- React 19, Vite 8
- Node.js, Express, Playwright
- Anthropic SDK
- Server-Sent Events for live streaming

## Running locally

Requirements: Node.js 18+, an Anthropic API key.

Install dependencies, install the Chromium browser, then add your API key to a local .env file. Run the backend with node server.js and the frontend with npm run dev. Open http://localhost:5173

## Example goals

- E-commerce: Log in to saucedemo, add Sauce Labs Backpack to cart, verify product and price on cart page
- Banking: Log in to ParaBank, go to Transfer Funds, transfer money between accounts, verify success

## How it differs from existing tools

Tools like Mabl, Applitools, and Katalon generate tests for their own platforms. This agent emits FireFlink-native NLP steps that map directly to the existing Java NLP class library, so generated tests integrate without translation or import middleware.
