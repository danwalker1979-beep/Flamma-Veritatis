const MOOD_FACES = {
  happy: "😊",
  playful: "😄",
  flirty: "😏",
  neutral: "🙂",
  curious: "🤔",
  annoyed: "😒",
  hurt: "😞",
  angry: "😠",
};

const els = {
  messages: document.getElementById("messages"),
  form: document.getElementById("composer"),
  input: document.getElementById("input"),
  send: document.getElementById("send"),
  avatar: document.getElementById("avatar"),
  name: document.getElementById("name"),
  moodLabel: document.getElementById("moodLabel"),
  readLabel: document.getElementById("readLabel"),
  rapportNum: document.getElementById("rapportNum"),
  meterFill: document.getElementById("meterFill"),
  voiceToggle: document.getElementById("voiceToggle"),
  settingsToggle: document.getElementById("settingsToggle"),
  settings: document.getElementById("settings"),
  temperamentRow: document.getElementById("temperamentRow"),
  deflectionRow: document.getElementById("deflectionRow"),
};

// Conversation state lives in the browser; the server is stateless.
const state = {
  name: "Companion",
  history: [], // {role, content}
  rapport: 10,
  mood: "neutral",
  voiceOn: true,
  expressiveVoice: false, // server has an expressive TTS provider configured
  temperament: "chill",
  deflection: "balanced",
  temperaments: [],
};

// Build a segmented control; onPick(key) fires on selection.
function buildSegmented(row, options, selectedKey, onPick) {
  row.innerHTML = "";
  for (const opt of options) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = opt.label;
    btn.dataset.key = opt.key;
    if (opt.key === selectedKey) btn.classList.add("active");
    btn.addEventListener("click", () => {
      row.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      onPick(opt.key);
    });
    row.appendChild(btn);
  }
}

// Inline cues like [laughs] are for the voice, not the screen.
function displayText(text) {
  return text.replace(/\[[^\]]*\]/g, "").replace(/\s{2,}/g, " ").trim();
}

// Browser speech fallback — no laughs, but mood nudges pitch and rate.
const BROWSER_VOICE = {
  happy: { pitch: 1.15, rate: 1.05 },
  playful: { pitch: 1.25, rate: 1.1 },
  flirty: { pitch: 1.1, rate: 0.95 },
  neutral: { pitch: 1.0, rate: 1.0 },
  curious: { pitch: 1.1, rate: 1.0 },
  annoyed: { pitch: 0.95, rate: 1.05 },
  hurt: { pitch: 0.9, rate: 0.92 },
  angry: { pitch: 0.9, rate: 1.15 },
};

async function speak(text, mood) {
  if (!state.voiceOn) return;
  const clean = displayText(text);
  if (!clean) return;

  if (state.expressiveVoice) {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mood }), // full text incl. cues
      });
      if (res.ok) {
        const blob = await res.blob();
        const audio = new Audio(URL.createObjectURL(blob));
        audio.play().catch(() => {});
        return;
      }
    } catch {
      /* fall through to browser speech */
    }
  }

  if ("speechSynthesis" in window) {
    const u = new SpeechSynthesisUtterance(clean);
    const v = BROWSER_VOICE[mood] || BROWSER_VOICE.neutral;
    u.pitch = v.pitch;
    u.rate = v.rate;
    const female = speechSynthesis.getVoices().find((x) => /female|woman|zira|samantha|aria/i.test(x.name));
    if (female) u.voice = female;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }
}

function render() {
  els.name.textContent = state.name;
  els.avatar.textContent = MOOD_FACES[state.mood] || "🙂";
  els.moodLabel.textContent = state.mood;
  els.rapportNum.textContent = state.rapport;
  els.meterFill.style.width = `${state.rapport}%`;
}

function addBubble(role, text, extraClass = "") {
  const div = document.createElement("div");
  div.className = `msg ${role === "user" ? "me" : "them"} ${extraClass}`.trim();
  // Assistant lines may carry voice cues; show the cleaned text.
  div.textContent = role === "assistant" && !extraClass ? displayText(text) : text;
  els.messages.appendChild(div);
  els.messages.scrollTop = els.messages.scrollHeight;
  return div;
}

els.voiceToggle.addEventListener("click", () => {
  state.voiceOn = !state.voiceOn;
  els.voiceToggle.setAttribute("aria-pressed", String(state.voiceOn));
  els.voiceToggle.textContent = state.voiceOn ? "🔊" : "🔇";
  if (!state.voiceOn && "speechSynthesis" in window) speechSynthesis.cancel();
});

els.settingsToggle.addEventListener("click", () => {
  const showing = els.settings.hidden;
  els.settings.hidden = !showing;
  els.settingsToggle.setAttribute("aria-pressed", String(showing));
});

async function init() {
  try {
    const cfg = await (await fetch("/api/config")).json();
    state.name = cfg.name || state.name;
    state.expressiveVoice = Boolean(cfg.expressiveVoice);
    state.temperaments = cfg.temperaments || [];

    buildSegmented(els.temperamentRow, state.temperaments, state.temperament, (key) => {
      state.temperament = key;
      // Reflect the new starting disposition on the face right away.
      const t = state.temperaments.find((x) => x.key === key);
      if (t && t.startMood) {
        state.mood = t.startMood;
        render();
      }
    });
    buildSegmented(els.deflectionRow, cfg.deflectionStyles || [], state.deflection, (key) => {
      state.deflection = key;
    });
  } catch {}
  render();
  const greeting = `Hey. I'm ${state.name}. Who are you?`;
  addBubble("assistant", greeting);
  state.history.push({ role: "assistant", content: greeting });
}

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = els.input.value.trim();
  if (!message) return;

  els.input.value = "";
  els.send.disabled = true;
  addBubble("user", message);
  state.history.push({ role: "user", content: message });

  const typing = addBubble("assistant", `${state.name} is typing…`, "typing");

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        history: state.history.slice(0, -1), // everything before this user turn
        message,
        rapport: state.rapport,
        mood: state.mood,
        temperament: state.temperament,
        deflection: state.deflection,
      }),
    });
    const data = await res.json();
    typing.remove();

    if (!res.ok) {
      addBubble("assistant", data.error || "Something went wrong.", "typing");
      return;
    }

    state.rapport = data.rapport;
    state.mood = data.mood;
    els.readLabel.textContent = data.read || "";
    render();

    addBubble("assistant", data.reply);
    state.history.push({ role: "assistant", content: displayText(data.reply) });
    speak(data.reply, data.mood);
  } catch (err) {
    typing.remove();
    addBubble("assistant", "Connection dropped. Try again?", "typing");
  } finally {
    els.send.disabled = false;
    els.input.focus();
  }
});

init();
