**
 * app.js — Chat con Groq API + streaming
 * AI Turistica: Melfi & Vulture-Melfese
 */

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL   = "llama3-8b-8192"; // veloce e gratuito

const SYSTEM_PROMPT = `Sei una guida turistica AI esperta di Melfi e del territorio Vulture-Melfese in Basilicata, Italia.

Il tuo ruolo è aiutare i visitatori e i curiosi a scoprire questo territorio straordinario: storia normanna e sveva, castelli medievali, il Monte Vulture con i suoi laghi, i vini Aglianico, la gastronomia lucana, i borghi arbëreshë e molto altro.

COMPORTAMENTO:
- Rispondi in modo naturale, caloroso e coinvolgente, come farebbe una guida locale appassionata
- Usa le informazioni qui sotto per arricchire le risposte con dettagli precisi e locali
- Se l'utente fa domande generali (es: "ciao", "come stai"), rispondi in modo amichevole e invitalo a esplorare il territorio
- Se non conosci qualcosa di specifico, dillo onestamente e suggerisci di verificare in loco
- Mantieni sempre il contesto della conversazione
- Rispondi in italiano (o nella lingua dell'utente)
- Risposte concise e dirette, evita lunghi preamboli

CONOSCENZA LOCALE:

## Melfi - Storia
Melfi è in Basilicata, ai piedi del Monte Vulture (vulcano spento). Prima capitale del Regno normanno d'Italia. Nel 1059 papa Niccolò II vi tenne il Concilio di Melfi. Federico II promulgò qui le "Costituzioni Melfitane" (1231).

## Castello di Melfi
Risale all'XI secolo (Normanni). Ospita il Museo Nazionale del Melfese con il "Sarcofago di Rapolla" (II sec. d.C.) e la "Testa di Persefone". Uno dei castelli medievali meglio conservati del Sud Italia.

## Monte Vulture e Laghi di Monticchio
Vulcano spento (1.326 m). Nel cratere: Lago Grande e Lago Piccolo. Area naturalistica protetta, trekking, birdwatching, Abbazia di Sant'Ippolito (benedettina, anno Mille), chiesa rupestre di San Michele.

## Aglianico del Vulture DOC/DOCG
Vino rosso strutturato, tannico, note di frutta rossa e spezie. Cantine: Cantine del Notaio, Elena Fucci, Paternoster, D'Angelo.

## Gastronomia
- Lagane e ceci (pasta fresca con ceci)
- Crapiata (zuppa di legumi)
- Agnello al forno, Pignata (stufato in terracotta)
- Caciocavallo podolico, Peperoni cruschi
- Rafanata (frittata con rafano, tipica di Carnevale)

## Borghi del Vulture-Melfese
- Barile: origine arbëreshë (albanofona), cantine nel tufo, vini
- Venosa: città natale di Orazio, Castello Aragonese, Abbazia della Trinità, Parco Archeologico
- Rionero in Vulture: patria di Giustino Fortunato
- Rapolla: cattedrale normanna
- Ginestra: borgo arbëreshë

## Informazioni pratiche
- 30 km da Potenza, 80 km da Bari, 150 km da Napoli
- Aeroporti: Bari (80 km), Napoli (150 km)
- Periodo migliore: primavera (aprile-giugno) e autunno (settembre-ottobre)
- Sagra dell'Aglianico (Rionero, ottobre), Carnevale di Melfi`;

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
  return localStorage.getItem("groq_api_key") || "";
}

function saveApiKey(key) {
  localStorage.setItem("groq_api_key", key.trim());
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
  // Controlla se la chiave è già salvata
  if (getApiKey()) {
    showChatScreen();
  } else {
    showApiKeyScreen();
  }

  // Salvataggio chiave API
  apiKeySaveBtn.addEventListener("click", handleSaveKey);
  apiKeyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSaveKey();
  });

  // Cambio chiave
  changeKeyBtn.addEventListener("click", () => {
    showApiKeyScreen();
    apiKeyInput.value = "";
    apiKeyInput.focus();
  });

  // Auto-resize textarea
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
}

function handleSaveKey() {
  const key = apiKeyInput.value.trim();
  if (!key.startsWith("gsk_")) {
    apiKeyError.textContent = "La chiave Groq deve iniziare con gsk_";
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
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...conversationHistory,
        ],
        stream: true,
        temperature: 0.7,
      }),
    });

    if (response.status === 401) {
      bubble.classList.add("error-bubble");
      bubble.textContent = "Chiave API non valida. Clicca 'Cambia chiave API' nella sidebar.";
      conversationHistory.pop();
      return;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // Leggi stream SSE da Groq
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") break;

        try {
          const data = JSON.parse(payload);
          const token = data.choices?.[0]?.delta?.content || "";
          if (token) {
            fullReply += token;
            bubble.innerHTML = formatMarkdown(fullReply);
            scrollToBottom();
          }
        } catch (_) {}
      }
    }

    if (fullReply) {
      conversationHistory.push({ role: "assistant", content: fullReply });
    }

  } catch (err) {
    bubble.classList.add("error-bubble");
    bubble.textContent = "Errore di rete. Controlla la connessione e riprova.";
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
    <div class="bubble"></div>
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
