# ToxiRate AI integration notes

This repository now includes an improved AI companion for ToxiRate and an example server proxy to call OpenAI securely.

Files added/updated:
- index.html: improved UI, accessibility, chat history, fixed markup.
- ai-companion.js: (already updated) catalogue-aware assistant with optional OpenAI usage via sessionStorage.
- server.js: example Node/Express proxy to call OpenAI using server-side API key (recommended).
- .gitignore: ignores .env and node_modules.

How to use the server proxy (recommended):
1. Create a file named `.env` with `OPENAI_KEY=sk-...` (DO NOT COMMIT this file).
2. Install dependencies: `npm install express node-fetch express-rate-limit helmet cors`
3. Run: `node server.js`
4. Update the frontend to POST to `/api/ai` instead of calling OpenAI directly. I can add that change if you want.

Security notes:
- Never store API keys in client-side code or commit them to the repo.
- Use rate limiting, authentication, and monitoring in production.
