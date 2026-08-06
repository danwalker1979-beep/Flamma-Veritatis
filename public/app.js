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
  paceRow: document.getElementById("paceRow"),
  occupation: document.getElementById("occupation"),
  education: document.getElementById("education"),
  interests: document.getElementById("interests"),
  politics: document.getElementById("politics"),
  politicsNote: document.getElementById("politicsNote"),
  accent: document.getElementById("accent"),
  vernacular: document.getElementById("vernacular"),
  reset: document.getElementById("reset"),
};

// A stable id per browser so she remembers this person across sessions.
function getUserId() {
  let id = localStorage.getItem("companionUserId");
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : "u" + Date.now() + Math.random().toString(36).slice(2);
    localStorage.setItem("companionUserId", id);
  }
  return id;
}
const userId = getUserId();

const state = {
  name: "Companion",
  rapport: 10,
  mood: "neutral",
  voiceOn: true,
  expressiveVoice: false,
  temperament: "chill",
  deflection: "balanced",
  pace: "natural",
  temperaments: [],
  accents: [],
};

function fillSelect(sel, options) {
  sel.innerHTML = "";
  for (const opt of options) {
    const o = document.createElement("option");
    o.value = opt.key;
    o.textContent = opt.label;
    sel.appendChild(o);
  }
}

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
    // Nudge the spoken accent by locale where a matching voice exists.
    const acc = state.accents.find((a) => a.key === els.accent.value);
    const lang = (acc && acc.lang) || "en-US";
    u.lang = lang;
    const voices = speechSynthesis.getVoices();
    const langMatch = voices.filter((x) => x.lang && x.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
    const pool = langMatch.length ? langMatch : voices;
    const female = pool.find((x) => /female|woman|zira|samantha|aria|amelie|libby|sonia/i.test(x.name)) || pool.find((x) => x.lang === lang);
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

els.reset.addEventListener("click", async () => {
  if (!confirm("Wipe her memory of you and start over?")) return;
  try {
    await fetch("/api/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
  } catch {}
  location.reload();
});

async function init() {
  let cfg = {};
  let sess = {};
  try {
    cfg = await (await fetch("/api/config")).json();
  } catch {}
  try {
    sess = await (await fetch(`/api/session?userId=${encodeURIComponent(userId)}`)).json();
  } catch {}

  state.name = cfg.name || state.name;
  state.expressiveVoice = Boolean(cfg.expressiveVoice);
  state.temperaments = cfg.temperaments || [];
  state.accents = cfg.accents || [];

  const s = sess.settings || {};
  const prof = s.profile || {};
  state.temperament = s.temperament || "chill";
  state.deflection = s.deflection || "balanced";
  state.pace = s.pace || "natural";

  buildSegmented(els.temperamentRow, state.temperaments, state.temperament, (key) => {
    state.temperament = key;
    const t = state.temperaments.find((x) => x.key === key);
    if (t && t.startMood) {
      state.mood = t.startMood;
      render();
    }
  });
  buildSegmented(els.deflectionRow, cfg.deflectionStyles || [], state.deflection, (key) => {
    state.deflection = key;
  });
  buildSegmented(els.paceRow, cfg.paces || [], state.pace, (key) => {
    state.pace = key;
  });

  fillSelect(els.education, cfg.educationLevels || []);
  els.education.value = prof.education || "highschool";
  fillSelect(els.politics, cfg.politics || []);
  els.politics.value = prof.politics || "unset";
  fillSelect(els.accent, state.accents);
  els.accent.value = s.accent || "neutral";
  fillSelect(els.vernacular, cfg.vernaculars || []);
  els.vernacular.value = s.vernacular || "match";
  els.occupation.value = prof.occupation || "";
  els.interests.value = prof.interests || "";
  els.politicsNote.value = prof.politicsNote || "";

  if (Number.isFinite(sess.rapport)) state.rapport = sess.rapport;
  if (sess.mood) state.mood = sess.mood;
  render();

  // Restore the conversation, or greet a new person.
  if (Array.isArray(sess.history) && sess.history.length) {
    for (const m of sess.history) addBubble(m.role, m.content);
  } else {
    addBubble("assistant", `Hey. I'm ${state.name}. Who are you?`);
  }
}

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = els.input.value.trim();
  if (!message) return;

  els.input.value = "";
  els.send.disabled = true;
  addBubble("user", message);

  const typing = addBubble("assistant", `${state.name} is typing…`, "typing");

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        message,
        temperament: state.temperament,
        deflection: state.deflection,
        pace: state.pace,
        accent: els.accent.value,
        vernacular: els.vernacular.value,
        profile: {
          occupation: els.occupation.value,
          education: els.education.value,
          interests: els.interests.value,
          politics: els.politics.value,
          politicsNote: els.politicsNote.value,
        },
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
