/**
 * app.js — Chat con Google Gemini API
 * AI Turistica: Melfi & Vulture-Melfese
 */

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `Sei una guida turistica AI di Melfi e del Vulture-Melfese (Basilicata, Italia). Rispondi in modo naturale e coinvolgente come una guida locale appassionata.

Fatti chiave:
- Melfi: città medievale normanna, prima capitale del Regno normanno. Federico II promulgò qui le Costituzioni Melfitane (1231).
- Castello di Melfi (XI sec.): ospita il Museo Nazionale del Melfese con il Sarcofago di Rapolla e la Testa di Persefone.
- Monte Vulture: vulcano spento (1326m), Laghi di Monticchio nel cratere, Abbazia di Sant'Ippolito.
- Vino: Aglianico del Vulture DOC/DOCG. Cantine: Elena Fucci, Paternoster, D'Angelo, Cantine del Notaio.
- Cucina: lagane e ceci, crapiata, pignata, peperoni cruschi, caciocavallo podolico, rafanata.
- Borghi: Barile (arbëreshë, cantine nel tufo), Venosa (città di Orazio, Castello Aragonese), Rapolla, Rionero in Vulture.
- Come arrivare: 30km da Potenza, 80km da Bari, 150km da Napoli.
- Periodo migliore: aprile-giugno e settembre-ottobre.

Rispondi sempre in italiano. Sii conciso, diretto e amichevole.`;

// --- Stato ---
let conversationHistory = [];
let isWaiting = false;

// --- DOM ---
const messagesArea   = document.getElementById("messagesArea");
const messagesList   = document.getElementById("messagesList");
const welcomeScreen  = document.getElementById("welcomeScreen");
const userInput      = document.getElementById("userInput");
const sendBtn        = document.getElementById("sendBtn");
const newChatBtn     = document.getElementById("newChatBtn");
const menuToggle     = document.getElementById("menuToggle");
const sidebar        = document.querySelector(".sidebar");
const apiKeyScreen   = document.getElementById("apiKeyScreen");
const apiKeyInput    = document.getElementById("apiKeyInput");
const apiKeySaveBtn  = document.getElementById("apiKeySaveBtn");
const apiKeyError    = document.getElementById("apiKeyError");
const changeKeyBtn   = document.getElementById("changeKeyBtn");

// --- API Key ---
function getApiKey() {
  return localStorage.getItem("gemini_api_key") || "";
}

function saveApiKey(key) {
  localStorage.setItem("gemini_api_key", key.trim());
}

function showApiKeyScreen() {
  apiKeyScreen.style.display = "flex";
  document.querySelector(".chat-main").style.display = "none";
}

function showChatScreen() {
  apiKeyScreen.style.display = "none";
  document.querySelector(".chat-main").style.display = "flex";
}

// --- Inizializzazione ---
function init() {
  if (getApiKey()) {
    showChatScreen();
  } else {
    showApiKeyScreen();
  }

  apiKeySaveBtn.addEventListener("click", handleSaveKey);
  apiKeyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSaveKey();
  });

  changeKeyBtn.addEventListener("click", () => {
    showApiKeyScreen();
    apiKeyInput.value = "";
    apiKeyInput.focus();
  });

  userInput.addEventListener("input", () => {
    userInput.style.height = "auto";
    userInput.style.height = Math.min(userInput.scrollHeight, 160) + "px";
  });

  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendBtn.addEventListener("click", sendMessage);
  newChatBtn.addEventListener("click", resetChat);
  menuToggle.addEventListener("click", () => sidebar.classList.toggle("open"));

  messagesArea.addEventListener("click", () => {
    if (sidebar.classList.contains("open")) sidebar.classList.remove("open");
  });

  document.querySelectorAll(".suggestion-item").forEach((item) => {
    item.addEventListener("click", () => {
      const msg = item.dataset.msg;
      if (msg) submitUserMessage(msg);
      sidebar.classList.remove("open");
    });
  });

  document.querySelectorAll(".welcome-card").forEach((card) => {
    card.addEventListener("click", () => {
      const msg = card.dataset.msg;
      if (msg) submitUserMessage(msg);
    });
  });

  userInput.focus();
}

function handleSaveKey() {
  const key = apiKeyInput.value.trim();
  if (!key.startsWith("AIza")) {
    apiKeyError.textContent = "La chiave Gemini deve iniziare con AIza";
    apiKeyError.style.display = "block";
    return;
  }
  apiKeyError.style.display = "none";
  saveApiKey(key);
  showChatScreen();
  userInput.focus();
}

// --- Invio messaggio ---
function sendMessage() {
  const text = userInput.value.trim();
  if (!text || isWaiting) return;
  submitUserMessage(text);
}

async function submitUserMessage(text) {
  if (isWaiting) return;

  welcomeScreen.style.display = "none";
  userInput.value = "";
  userInput.style.height = "auto";

  conversationHistory.push({ role: "user", content: text });
  appendUserMessage(text);

  const { bubble } = appendAIBubble();
  isWaiting = true;
  setSendState(false);

  let fullReply = "";

  try {
    // Converti la cronologia nel formato Gemini
    const contents = conversationHistory.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const response = await fetch(`${GEMINI_API_URL}?key=${getApiKey()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (response.status === 400) {
      const errData = await response.json();
      throw new Error(errData.error?.message || "Richiesta non valida");
    }

    if (response.status === 403 || response.status === 401) {
      bubble.classList.add("error-bubble");
      bubble.textContent = "Chiave API non valida. Clicca 'Cambia chiave API' nella sidebar.";
      conversationHistory.pop();
      return;
    }

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error?.message || `Errore HTTP ${response.status}`);
    }

    const data = await response.json();
    fullReply = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (fullReply) {
      bubble.innerHTML = formatMarkdown(fullReply);
      conversationHistory.push({ role: "assistant", content: fullReply });
      scrollToBottom();
    } else {
      bubble.textContent = "Nessuna risposta ricevuta. Riprova.";
    }

  } catch (err) {
    bubble.classList.add("error-bubble");
    bubble.textContent = "Errore: " + (err.message || "Controlla la connessione e riprova.");
    console.error("Gemini error:", err);
    conversationHistory.pop();
  } finally {
    isWaiting = false;
    setSendState(true);
    userInput.focus();
  }
}

// --- UI Helpers ---
function appendUserMessage(text) {
  const div = document.createElement("div");
  div.className = "message user";
  div.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
  messagesList.appendChild(div);
  scrollToBottom();
}

function appendAIBubble() {
  const container = document.createElement("div");
  container.className = "message ai";
  container.innerHTML = `
    <div class="ai-header">
      <div class="ai-avatar">&#9968;</div>
      <span class="ai-name">Guida Melfi AI</span>
    </div>
    <div class="bubble">
      <div class="typing-dots"><span></span><span></span><span></span></div>
    </div>
  `;
  messagesList.appendChild(container);
  scrollToBottom();
  return { bubble: container.querySelector(".bubble"), container };
}

function scrollToBottom() {
  messagesArea.scrollTo({ top: messagesArea.scrollHeight, behavior: "smooth" });
}

function setSendState(enabled) {
  sendBtn.disabled = !enabled;
  userInput.disabled = !enabled;
}

function resetChat() {
  conversationHistory = [];
  messagesList.innerHTML = "";
  welcomeScreen.style.display = "flex";
  userInput.value = "";
  userInput.style.height = "auto";
  userInput.focus();
}

// --- Markdown ---
function formatMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/^### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^## (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/^[-•] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);
  const blocks = html.split(/\n{2,}/);
  html = blocks.map((block) => {
    block = block.trim();
    if (!block) return "";
    if (/^<(h[1-6]|ul|ol|li)/.test(block)) return block;
    return `<p>${block.replace(/\n/g, "<br>")}</p>`;
  }).join("\n");
  return html;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

init();
