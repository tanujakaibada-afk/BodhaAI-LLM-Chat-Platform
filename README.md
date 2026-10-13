# IntelliAI – LLM Chat Platform

An educational chatbot web app that shows how a **Large Language Model (LLM)** can be integrated into a web application through a **secure backend**.

- **Frontend:** HTML, CSS, vanilla JavaScript
- **Backend:** Node.js + Express
- **LLM:** OpenAI API (Responses API) – the key stays on the server

## Features

- Sidebar with **New Chat** and **chat history** (saved in your browser)
- Separate user / AI chat bubbles, welcome screen, suggestion buttons
- Send button, **Enter to send** (Shift+Enter for a new line), **Clear Chat**
- Loading animation and friendly error messages
- Clear **setup message** if the API key is missing
- Input validation and rate limiting on the server
- Responsive layout (mobile, tablet, desktop) and dark mode
- Built-in **About** section explaining LLMs and the project

## Project structure

```
intelliai/
├── public/
│   ├── index.html     # page layout + About modal
│   ├── style.css      # responsive styling
│   └── script.js      # chat logic (no secrets here)
├── server.js          # Express backend, talks to the LLM
├── package.json       # dependencies and scripts
├── vercel.json        # Vercel deployment settings
├── .env.example       # template for your secrets
├── .gitignore         # keeps .env and node_modules out of GitHub
└── README.md
```

## 1. Installation (Visual Studio Code)

1. Install **Node.js 18 or newer** from https://nodejs.org (LTS version).
2. Open the `intelliai` folder in VS Code (**File → Open Folder**).
3. Open the terminal (**Terminal → New Terminal**) and run:

```bash
npm install
```

## 2. Configuration

1. Create an API key at https://platform.openai.com/api-keys
2. Copy `.env.example` to a new file named `.env`:

   - Windows (PowerShell): `copy .env.example .env`
   - Mac/Linux: `cp .env.example .env`

3. Open `.env` and paste your key:

```
OPENAI_API_KEY=sk-your-real-key
OPENAI_MODEL=gpt-4o-mini
PORT=3000
```

> Never share `.env` or upload it to GitHub. `.gitignore` already excludes it.

## 3. Run the app

```bash
npm start
```

Open **http://localhost:3000** in your browser.

If you see a yellow "Setup required" banner, your `.env` file is missing or the key is not set. Fix it and restart the server (`Ctrl + C`, then `npm start`).

## 4. Upload to GitHub

1. Install Git (https://git-scm.com) and create an empty repository on https://github.com (do **not** add a README there).
2. In the VS Code terminal:

```bash
git init
git add .
git commit -m "Initial commit: IntelliAI LLM Chat Platform"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/intelliai.git
git push -u origin main
```

3. Check on GitHub that `.env` is **not** in the repository (only `.env.example` should be).

## 5. Deploy to Vercel

1. Sign in at https://vercel.com with your GitHub account.
2. Click **Add New → Project** and import your `intelliai` repository.
3. Leave the build settings as they are (`vercel.json` handles it).
4. Open **Environment Variables** and add:
   - `OPENAI_API_KEY` = your real key
   - `OPENAI_MODEL` = `gpt-4o-mini` (optional)
5. Click **Deploy**. Vercel gives you a public URL.
6. If you add or change variables later, **redeploy** so they take effect.

## How it works

1. You type a message; `script.js` sends it to `POST /api/chat`.
2. `server.js` validates it (roles, length, count), then calls the LLM using the key from `process.env.OPENAI_API_KEY`.
3. The reply is returned as JSON and shown as a chat bubble.

## Security notes

- The API key exists only on the server. The frontend never sees it.
- The server validates every request and limits it to 30 per minute per IP.
- Messages are HTML-escaped before display (protects against XSS).
- Chat history is stored in your browser's `localStorage`, not on the server.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Setup required" banner | Create `.env` with a valid `OPENAI_API_KEY`, restart |
| "API key was rejected" | The key is wrong or revoked; create a new one |
| "Quota exhausted / busy" | Check billing and usage on your OpenAI account |
| "Model not found" | Change `OPENAI_MODEL` to a model your account can use |
| `npm` not recognised | Reinstall Node.js and restart VS Code |
| Port already in use | Change `PORT` in `.env` |

## Future improvements

Streaming responses, user login, saving chats in a database, file uploads, and multi-model selection.

## License

MIT – free for learning and college projects.
