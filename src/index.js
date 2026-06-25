/**
 * Sigap Chat - Halaman web chatbot sendiri, tanpa platform pihak ketiga.
 * Jalan di Cloudflare Workers. Satu file ini ngerjain DUA hal:
 * 1. Menyajikan halaman HTML (tampilan chat) waktu dibuka di browser.
 * 2. Jadi backend API (/api/chat) yang manggil Gemini API -- supaya
 *    GEMINI_API_KEY tetap aman di server, nggak pernah kelihatan di browser.
 */

const GEMINI_MODEL = "gemini-2.5-flash-lite";

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
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text || "Maaf, aku nggak berhasil menjawab pertanyaan itu. Coba tanya dengan cara lain?";
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
<title>Sigap Chat</title>
<style>
  :root {
    --bg: #161b22;
    --card: #1f2630;
    --accent: #e8a33d;
    --text: #e6eaf0;
    --border: #30394a;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: var(--bg);
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
  }
  header {
    padding: 20px;
    border-bottom: 1px solid var(--border);
  }
  header h1 { margin: 0; font-size: 22px; }
  header p { margin: 4px 0 0; color: #9aa4b2; font-size: 14px; }
  #chat {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .msg {
    max-width: 80%;
    padding: 10px 14px;
    border-radius: 10px;
    line-height: 1.5;
    white-space: pre-wrap;
  }
  .msg.user {
    background: var(--accent);
    color: #1a1208;
    align-self: flex-end;
  }
  .msg.model {
    background: var(--card);
    border: 1px solid var(--border);
    align-self: flex-start;
  }
  .msg.loading { opacity: 0.6; font-style: italic; }
  form {
    display: flex;
    gap: 8px;
    padding: 16px;
    border-top: 1px solid var(--border);
  }
  input {
    flex: 1;
    padding: 12px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    font-size: 15px;
  }
  input:focus { outline: 1px solid var(--accent); }
  button {
    padding: 12px 20px;
    border-radius: 8px;
    border: none;
    background: var(--accent);
    color: #1a1208;
    font-weight: 600;
    cursor: pointer;
  }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
</head>
<body>
  <div class="app">
    <header>
      <h1>🛠️ Sigap Chat</h1>
      <p>Halaman web sendiri, bertenaga Gemini API, jalan di Cloudflare Workers.</p>
    </header>
    <div id="chat"></div>
    <form id="form">
      <input id="input" type="text" placeholder="Tulis sesuatu..." autocomplete="off" />
      <button type="submit">Kirim</button>
    </form>
  </div>

  <script>
    const chatEl = document.getElementById("chat");
    const formEl = document.getElementById("form");
    const inputEl = document.getElementById("input");
    let history = [];

    function addMessage(role, text, isLoading) {
      const div = document.createElement("div");
      div.className = "msg " + role + (isLoading ? " loading" : "");
      div.textContent = text;
      chatEl.appendChild(div);
      chatEl.scrollTop = chatEl.scrollHeight;
      return div;
    }

    formEl.addEventListener("submit", async function (e) {
      e.preventDefault();
      const message = inputEl.value.trim();
      if (!message) return;

      inputEl.value = "";
      addMessage("user", message);
      const loadingDiv = addMessage("model", "Sigap sedang berpikir...", true);
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
          loadingDiv.textContent = "⚠️ " + data.error;
        } else {
          loadingDiv.textContent = data.reply;
          loadingDiv.classList.remove("loading");
          history.push({ role: "user", content: message });
          history.push({ role: "model", content: data.reply });
        }
      } catch (err) {
        loadingDiv.textContent = "⚠️ Gagal terhubung ke server: " + err.message;
      } finally {
        button.disabled = false;
        inputEl.focus();
      }
    });
  </script>
</body>
</html>`;
