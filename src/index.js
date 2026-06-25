/**
 * Sigap Chat - Halaman web chatbot sendiri, tanpa platform pihak ketiga.
 * Jalan di Cloudflare Workers. Satu file ini ngerjain DUA hal:
 * 1. Menyajikan halaman HTML (tampilan chat) waktu dibuka di browser.
 * 2. Jadi backend API (/api/chat) yang manggil Gemini API -- supaya
 *    GEMINI_API_KEY tetap aman di server, nggak pernah kelihatan di browser.
 */

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const SYSTEM_INSTRUCTION =
  "Kamu adalah Sigap, asisten AI yang energik, ramah, dan ekspresif. Gunakan emoji yang relevan " +
  "secukupnya di balasanmu (jangan berlebihan), gunakan format **tebal** untuk penekanan kalau perlu, " +
  "dan jawab dengan nada bersemangat serta personal -- jangan kaku atau formal. Selalu jawab dalam Bahasa Indonesia.";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChat(request, env);
    }

    return new Response(HTML_PAGE, {
      headers: { "Content-Type": "text/html; charset=UTF-8" },
    });
  },
};

async function handleChat(request, env) {
  try {
    if (!env.GEMINI_API_KEY) {
      return jsonResponse({ error: "GEMINI_API_KEY belum diset di Secrets." }, 500);
    }

    const { message, history } = await request.json();
    if (!message || typeof message !== "string") {
      return jsonResponse({ error: "Pesan kosong." }, 400);
    }

    const contents = (Array.isArray(history) ? history : []).map((m) => ({
      role: m.role,
      parts: [{ text: m.content }],
    }));
    contents.push({ role: "user", parts: [{ text: message }] });

    const reply = await askGemini(contents, env.GEMINI_API_KEY);
    return jsonResponse({ reply });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

async function askGemini(contents, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents,
      generationConfig: { temperature: 0.8, maxOutputTokens: 500 },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(friendlyErrorMessage(response.status, errorText));
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text || "Maaf, aku nggak berhasil menjawab pertanyaan itu. Coba tanya dengan cara lain?";
}

function friendlyErrorMessage(status, rawErrorText) {
  const lower = rawErrorText.toLowerCase();

  if (status === 503 || lower.includes("unavailable")) {
    return "Server Gemini sedang sibuk (overload sementara). Coba kirim lagi sebentar.";
  }
  if (status === 429 || lower.includes("resource_exhausted") || lower.includes("quota")) {
    return "Kuota API habis untuk saat ini. Coba lagi setelah beberapa menit.";
  }
  if (status === 401 || status === 403 || lower.includes("api_key_invalid")) {
    return "API Key Gemini tidak valid. Cek lagi nilai GEMINI_API_KEY di Secrets.";
  }
  return `Terjadi kesalahan (${status}): ${rawErrorText}`;
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const HTML_PAGE = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Sigap</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Manrope:wght@400;500;700&display=swap');

  :root {
    --bg: #0a1612;
    --panel: #0f231c;
    --grid: #16332689;
    --signal: #4ade9c;
    --signal-dim: rgba(74, 222, 156, 0.14);
    --text: #d8f3e6;
    --muted: #6b8c7e;
    --border: #1f4536;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: 'Manrope', sans-serif;
    background-color: var(--bg);
    background-image:
      linear-gradient(var(--grid) 1px, transparent 1px),
      linear-gradient(90deg, var(--grid) 1px, transparent 1px);
    background-size: 28px 28px;
    color: var(--text);
    display: flex;
    justify-content: center;
    min-height: 100vh;
  }
  .app {
    width: 100%;
    max-width: 640px;
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: rgba(10, 22, 18, 0.88);
  }
  header {
    padding: 22px 20px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .radar {
    position: relative;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    border: 1px solid var(--border);
    flex-shrink: 0;
    overflow: hidden;
    background: radial-gradient(circle, var(--signal-dim) 0%, transparent 70%);
  }
  .radar::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: 50%;
    height: 2px;
    background: linear-gradient(90deg, var(--signal), transparent);
    transform-origin: left center;
    animation: sweep 3s linear infinite;
  }
  @keyframes sweep {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .brand h1 {
    margin: 0;
    font-family: 'Space Mono', monospace;
    font-size: 19px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .brand p {
    margin: 3px 0 0;
    color: var(--muted);
    font-size: 13px;
  }
  #chat {
    flex: 1;
    overflow-y: auto;
    padding: 22px 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }
  #chat::-webkit-scrollbar { width: 8px; }
  #chat::-webkit-scrollbar-track { background: transparent; }
  #chat::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
  #chat::-webkit-scrollbar-thumb:hover { background: var(--signal); }
  .msg {
    max-width: 78%;
    padding: 11px 15px;
    border-radius: 4px;
    line-height: 1.55;
    font-size: 15px;
  }
  .msg.user { align-self: flex-end; background: var(--signal-dim); border: 1px solid var(--signal); }
  .msg.model { align-self: flex-start; background: var(--panel); border: 1px solid var(--border); }
  .msg .tag {
    display: block;
    font-family: 'Space Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.1em;
    color: var(--muted);
    margin-bottom: 4px;
    text-transform: uppercase;
  }
  .msg .body { white-space: pre-wrap; }
  .dots { display: inline-flex; gap: 4px; vertical-align: middle; }
  .dots span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--signal);
    animation: blink 1.2s infinite ease-in-out;
  }
  .dots span:nth-child(2) { animation-delay: 0.2s; }
  .dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes blink {
    0%, 80%, 100% { opacity: 0.2; }
    40% { opacity: 1; }
  }
  form {
    display: flex;
    gap: 10px;
    padding: 16px 20px;
    border-top: 1px solid var(--border);
  }
  input {
    flex: 1;
    padding: 13px 14px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--panel);
    color: var(--text);
    font-family: 'Manrope', sans-serif;
    font-size: 15px;
  }
  input::placeholder { color: var(--muted); }
  input:focus-visible { outline: 2px solid var(--signal); outline-offset: 1px; }
  button {
    padding: 13px 22px;
    border-radius: 4px;
    border: 1px solid var(--signal);
    background: var(--signal);
    color: #06120d;
    font-family: 'Space Mono', monospace;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    font-size: 13px;
    cursor: pointer;
    transition: filter 0.15s ease;
  }
  button:hover:not(:disabled) { filter: brightness(1.12); }
  button:disabled { opacity: 0.4; cursor: not-allowed; }
  button:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) {
    .radar::before, .dots span { animation: none; }
  }
  @media (max-width: 480px) {
    .msg { max-width: 88%; }
  }
</style>
</head>
<body>
  <div class="app">
    <header>
      <div class="radar"></div>
      <div class="brand">
        <h1>Sigap</h1>
        <p>Sistem respons instan -- kirim sinyal, terima jawaban.</p>
      </div>
    </header>
    <div id="chat"></div>
    <form id="form">
      <input id="input" type="text" placeholder="Kirim sinyal..." autocomplete="off" />
      <button type="submit">Kirim</button>
    </form>
  </div>

  <script>
    const chatEl = document.getElementById("chat");
    const formEl = document.getElementById("form");
    const inputEl = document.getElementById("input");
    let history = [];

    function escapeHtml(str) {
      const div = document.createElement("div");
      div.textContent = str;
      return div.innerHTML;
    }

    function formatReply(text) {
      let safe = escapeHtml(text);
      safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      safe = safe.replace(/^[*-] (.+)$/gm, "• $1");
      return safe;
    }

    function addMessage(role, text, isLoading) {
      const wrap = document.createElement("div");
      wrap.className = "msg " + role;

      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = role === "user" ? "Kamu" : "Sigap";
      wrap.appendChild(tag);

      const body = document.createElement("div");
      body.className = "body";
      if (isLoading) {
        body.innerHTML = 'Memproses sinyal <span class="dots"><span></span><span></span><span></span></span>';
      } else if (role === "model") {
        body.innerHTML = formatReply(text);
      } else {
        body.textContent = text;
      }
      wrap.appendChild(body);

      chatEl.appendChild(wrap);
      chatEl.scrollTop = chatEl.scrollHeight;
      return body;
    }

    formEl.addEventListener("submit", async function (e) {
      e.preventDefault();
      const message = inputEl.value.trim();
      if (!message) return;

      inputEl.value = "";
      addMessage("user", message);
      const loadingBody = addMessage("model", "", true);
      const button = formEl.querySelector("button");
      button.disabled = true;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: message, history: history }),
        });
        const data = await res.json();

        if (data.error) {
          loadingBody.textContent = "Sinyal gagal terkirim: " + data.error;
        } else {
          loadingBody.innerHTML = formatReply(data.reply);
          history.push({ role: "user", content: message });
          history.push({ role: "model", content: data.reply });
        }
      } catch (err) {
        loadingBody.textContent = "Sinyal gagal terkirim: " + err.message;
      } finally {
        button.disabled = false;
        inputEl.focus();
      }
    });
  </script>
</body>
</html>`;
