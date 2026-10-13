// IntelliAI - frontend logic
// No API keys here. All LLM calls go through our backend at /api/chat.

(function () {
  "use strict";

  const STORAGE_KEY = "intelliai_chats_v1";
  const THEME_KEY = "intelliai_theme";
  const MAX_INPUT = 2000;
  const MAX_CONTEXT_MESSAGES = 20; // how many past messages we send for context

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const app = $("app");
  const messagesEl = $("messages");
  const inputEl = $("input");
  const sendBtn = $("sendBtn");
  const historyEl = $("historyList");
  const titleEl = $("chatTitle");
  const noticeEl = $("setupNotice");
  const charCountEl = $("charCount");

  // ---------- State ----------
  let chats = loadChats();
  let activeId = chats.length ? chats[0].id : null;
  let isLoading = false;

  const SUGGESTIONS = [
    "Explain what a Large Language Model is in simple words",
    "How does an API key keep my app secure?",
    "Write a JavaScript function to reverse a string",
    "Give me 3 ideas for a college AI project",
  ];

  // ---------- Storage ----------
  function loadChats() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }
  function saveChats() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    } catch (e) { /* storage full or disabled: ignore */ }
  }

  // ---------- Helpers ----------
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function getActive() {
    return chats.find((c) => c.id === activeId) || null;
  }
  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  // Safe mini-markdown: escape FIRST, then add formatting.
  function formatMessage(text) {
    const parts = text.split(/```/);
    return parts
      .map((part, i) => {
        if (i % 2 === 1) {
          // code block: drop optional language line
          const code = part.replace(/^[a-zA-Z0-9+#-]*\n/, "");
          return "<pre><code>" + escapeHtml(code.replace(/\n$/, "")) + "</code></pre>";
        }
        let html = escapeHtml(part);
        html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");
        html = html.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
        return html
          .split(/\n{2,}/)
          .filter((p) => p.trim())
          .map((p) => "<p>" + p.replace(/\n/g, "<br>") + "</p>")
          .join("");
      })
      .join("");
  }
  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ---------- Rendering ----------
  function renderHistory() {
    historyEl.innerHTML = "";
    if (!chats.length) {
      const li = document.createElement("li");
      li.className = "history-empty";
      li.textContent = "No chats yet";
      historyEl.appendChild(li);
      return;
    }
    chats.forEach((chat) => {
      const li = document.createElement("li");
      if (chat.id === activeId) li.classList.add("active");

      const title = document.createElement("span");
      title.className = "title";
      title.textContent = chat.title;

      const del = document.createElement("button");
      del.className = "del";
      del.title = "Delete chat";
      del.setAttribute("aria-label", "Delete chat");
      del.textContent = "✕";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteChat(chat.id);
      });

      li.append(title, del);
      li.addEventListener("click", () => {
        activeId = chat.id;
        closeMenu();
        render();
      });
      historyEl.appendChild(li);
    });
  }

  function buildMessage(msg) {
    const wrap = document.createElement("div");
    wrap.className = "msg " + (msg.role === "user" ? "user" : "ai") + (msg.isError ? " error" : "");

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = msg.role === "user" ? "🧑" : "✦";

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.innerHTML = formatMessage(msg.content);

    wrap.append(avatar, bubble);
    return wrap;
  }

  function renderWelcome() {
    const div = document.createElement("div");
    div.className = "welcome";
    div.innerHTML =
      '<div class="logo">✦</div>' +
      "<h2>Welcome to IntelliAI 👋</h2>" +
      "<p>I'm an AI assistant powered by a Large Language Model. Ask me anything, or try one of these:</p>";
    const grid = document.createElement("div");
    grid.className = "suggestions";
    SUGGESTIONS.forEach((s) => {
      const b = document.createElement("button");
      b.className = "suggestion";
      b.textContent = s;
      b.addEventListener("click", () => {
        inputEl.value = s;
        updateCount();
        sendMessage();
      });
      grid.appendChild(b);
    });
    div.appendChild(grid);
    messagesEl.appendChild(div);
  }

  function renderMessages() {
    messagesEl.innerHTML = "";
    const chat = getActive();
    titleEl.textContent = chat ? chat.title : "New chat";
    if (!chat || chat.messages.length === 0) {
      renderWelcome();
      return;
    }
    const inner = document.createElement("div");
    inner.className = "messages-inner";
    chat.messages.forEach((m) => inner.appendChild(buildMessage(m)));
    messagesEl.appendChild(inner);
    scrollToBottom();
  }

  function render() {
    renderHistory();
    renderMessages();
  }

  function showTyping() {
    let inner = messagesEl.querySelector(".messages-inner");
    if (!inner) {
      messagesEl.innerHTML = "";
      inner = document.createElement("div");
      inner.className = "messages-inner";
      messagesEl.appendChild(inner);
    }
    const wrap = document.createElement("div");
    wrap.className = "msg ai";
    wrap.id = "typingRow";
    wrap.innerHTML =
      '<div class="avatar">✦</div><div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>';
    inner.appendChild(wrap);
    scrollToBottom();
  }
  function hideTyping() {
    const t = $("typingRow");
    if (t) t.remove();
  }

  // ---------- Chat actions ----------
  function newChat() {
    // Reuse an existing empty chat instead of piling up blank ones
    const empty = chats.find((c) => c.messages.length === 0);
    if (empty) {
      activeId = empty.id;
    } else {
      const chat = { id: uid(), title: "New chat", messages: [], createdAt: Date.now() };
      chats.unshift(chat);
      activeId = chat.id;
      saveChats();
    }
    closeMenu();
    render();
    inputEl.focus();
  }

  function deleteChat(id) {
    chats = chats.filter((c) => c.id !== id);
    if (activeId === id) activeId = chats.length ? chats[0].id : null;
    saveChats();
    render();
  }

  function clearChat() {
    const chat = getActive();
    if (!chat || chat.messages.length === 0) return;
    if (!confirm("Clear all messages in this chat?")) return;
    chat.messages = [];
    chat.title = "New chat";
    saveChats();
    render();
  }

  async function sendMessage() {
    if (isLoading) return;
    const text = inputEl.value.trim();
    if (!text) return;
    if (text.length > MAX_INPUT) {
      alert("Your message is too long (max " + MAX_INPUT + " characters).");
      return;
    }

    let chat = getActive();
    if (!chat) {
      chat = { id: uid(), title: "New chat", messages: [], createdAt: Date.now() };
      chats.unshift(chat);
      activeId = chat.id;
    }

    chat.messages.push({ role: "user", content: text });
    if (chat.title === "New chat") {
      chat.title = text.length > 36 ? text.slice(0, 36) + "…" : text;
    }
    saveChats();

    inputEl.value = "";
    updateCount();
    autoResize();
    render();

    setLoading(true);
    showTyping();

    // Send recent context (skip error bubbles)
    const payload = chat.messages
      .filter((m) => !m.isError)
      .slice(-MAX_CONTEXT_MESSAGES)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload }),
      });

      let data = {};
      try { data = await res.json(); } catch (e) { /* non-JSON response */ }

      if (!res.ok) {
        throw new Error(data.error || "Server error (" + res.status + "). Please try again.");
      }
      chat.messages.push({ role: "assistant", content: data.reply });
    } catch (err) {
      const offline = err instanceof TypeError;
      chat.messages.push({
        role: "assistant",
        isError: true,
        content: "⚠️ " + (offline
          ? "Could not reach the server. Check your internet connection and make sure the server is running."
          : err.message),
      });
    } finally {
      saveChats();
      setLoading(false);
      hideTyping();
      render();
      inputEl.focus();
    }
  }

  function setLoading(state) {
    isLoading = state;
    sendBtn.disabled = state;
    inputEl.disabled = state;
  }

  // ---------- Input handling ----------
  function updateCount() {
    charCountEl.textContent = inputEl.value.length;
  }
  function autoResize() {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + "px";
  }
  inputEl.addEventListener("input", () => { updateCount(); autoResize(); });
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  sendBtn.addEventListener("click", sendMessage);
  $("newChatBtn").addEventListener("click", newChat);
  $("clearBtn").addEventListener("click", clearChat);

  // ---------- Mobile menu ----------
  function closeMenu() { app.classList.remove("menu-open"); }
  $("menuBtn").addEventListener("click", () => app.classList.add("menu-open"));
  $("backdrop").addEventListener("click", closeMenu);

  // ---------- About modal ----------
  const aboutModal = $("aboutModal");
  $("aboutBtn").addEventListener("click", () => { aboutModal.hidden = false; closeMenu(); });
  $("aboutClose").addEventListener("click", () => (aboutModal.hidden = true));
  aboutModal.addEventListener("click", (e) => { if (e.target === aboutModal) aboutModal.hidden = true; });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") aboutModal.hidden = true; });

  // ---------- Theme ----------
  const themeBtn = $("themeBtn");
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    themeBtn.textContent = theme === "dark" ? "☀️ Light mode" : "🌙 Dark mode";
  }
  let savedTheme = "light";
  try { savedTheme = localStorage.getItem(THEME_KEY) || "light"; } catch (e) {}
  applyTheme(savedTheme);
  themeBtn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
  });

  // ---------- Setup check ----------
  async function checkStatus() {
    try {
      const res = await fetch("/api/status");
      const data = await res.json();
      if (!data.configured) {
        noticeEl.hidden = false;
        noticeEl.innerHTML =
          "<strong>Setup required:</strong> no API key found. Copy <code>.env.example</code> to " +
          "<code>.env</code>, set <code>OPENAI_API_KEY</code>, then restart the server (<code>npm start</code>).";
      }
    } catch (e) {
      noticeEl.hidden = false;
      noticeEl.textContent = "⚠️ Cannot reach the backend. Start it with “npm start” and open http://localhost:3000.";
    }
  }

  // ---------- Init ----------
  render();
  checkStatus();
})();
