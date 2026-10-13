// IntelliAI - LLM Chat Platform (backend)
// The API key lives ONLY here, read from an environment variable.
// The browser never sees it.

require("dotenv").config();

const path = require("path");
const express = require("express");
const rateLimit = require("express-rate-limit");
const OpenAI = require("openai");

const app = express();

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const MAX_MESSAGES = 30;       // max messages accepted per request
const MAX_CONTENT_LENGTH = 4000; // max characters per message

const SYSTEM_PROMPT =
  "You are IntelliAI, a friendly and knowledgeable AI assistant inside an educational " +
  "web application that demonstrates Large Language Models. Give clear, accurate, " +
  "well-structured answers. Use simple language for beginners, and short code examples " +
  "in fenced code blocks when helpful. If you are unsure, say so honestly.";

// Create the OpenAI client only if a real key is configured.
function isKeyConfigured() {
  const key = process.env.OPENAI_API_KEY;
  return Boolean(key && key.trim() && key !== "your_openai_api_key_here");
}

let client = null;
function getClient() {
  if (!client && isKeyConfigured()) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY.trim() });
  }
  return client;
}

// ---------- Middleware ----------
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

// Basic abuse protection: 30 chat requests per minute per IP
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a minute and try again." },
});

// ---------- Routes ----------

// Lets the frontend know whether the server is configured (never returns the key).
app.get("/api/status", (req, res) => {
  res.json({ configured: isKeyConfigured(), model: MODEL });
});

app.post("/api/chat", chatLimiter, async (req, res) => {
  // 1. Is the API key set?
  if (!isKeyConfigured()) {
    return res.status(503).json({
      error:
        "The server is not configured yet. Add your OPENAI_API_KEY to the .env file " +
        "(or to your Vercel environment variables) and restart the server.",
      code: "MISSING_API_KEY",
    });
  }

  // 2. Validate input
  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Please send at least one message." });
  }
  if (messages.length > MAX_MESSAGES) {
    return res.status(400).json({ error: "Conversation is too long. Please start a new chat." });
  }

  const cleaned = [];
  for (const m of messages) {
    const validRole = m && (m.role === "user" || m.role === "assistant");
    const validContent = m && typeof m.content === "string" && m.content.trim().length > 0;
    if (!validRole || !validContent) {
      return res.status(400).json({ error: "Invalid message format." });
    }
    if (m.content.length > MAX_CONTENT_LENGTH) {
      return res.status(400).json({
        error: `Messages must be under ${MAX_CONTENT_LENGTH} characters.`,
      });
    }
    cleaned.push({ role: m.role, content: m.content.trim() });
  }
  if (cleaned[cleaned.length - 1].role !== "user") {
    return res.status(400).json({ error: "The last message must be from the user." });
  }

  // 3. Call the LLM
  try {
    const response = await getClient().responses.create({
      model: MODEL,
      instructions: SYSTEM_PROMPT,
      input: cleaned,
    });

    const reply = (response.output_text || "").trim();
    if (!reply) {
      return res.status(502).json({ error: "The AI returned an empty response. Please try again." });
    }
    res.json({ reply });
  } catch (err) {
    console.error("LLM error:", err.status || "", err.message);
    const status = err.status;
    let message = "Something went wrong while contacting the AI. Please try again.";
    if (status === 401) message = "The API key was rejected. Please check OPENAI_API_KEY.";
    else if (status === 429) message = "The AI service is busy or your quota is exhausted. Please try again shortly.";
    else if (status === 404) message = `The model "${MODEL}" was not found. Check OPENAI_MODEL.`;
    res.status(status && status >= 400 && status < 600 ? status : 500).json({ error: message });
  }
});

// Unknown API routes
app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));

// Malformed JSON and other errors
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON in request." });
  }
  console.error(err);
  res.status(500).json({ error: "Unexpected server error." });
});

// Run locally; on Vercel the exported app is used instead.
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`IntelliAI running at http://localhost:${port}`);
    if (!isKeyConfigured()) {
      console.warn("WARNING: OPENAI_API_KEY is not set. Copy .env.example to .env and add your key.");
    }
  });
}

module.exports = app;
