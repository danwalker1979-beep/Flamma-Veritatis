import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { respond, COMPANION_NAME, MOODS, TEMPERAMENTS, DEFLECTION_STYLES, EDUCATION_LEVELS, POLITICS, ACCENTS, VERNACULARS, PACES } from "./companion.js";
import { synthesize, voiceEnabled, voicePresets } from "./tts.js";
import { loadState, saveState, clearState, mergeMemory } from "./store.js";

const here = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(join(here, "public")));

app.get("/api/config", (_req, res) => {
  res.json({
    name: COMPANION_NAME,
    moods: MOODS,
    expressiveVoice: voiceEnabled,
    voices: voicePresets.map(({ key, label }) => ({ key, label })),
    temperaments: TEMPERAMENTS.map(({ key, label, startMood }) => ({ key, label, startMood })),
    deflectionStyles: DEFLECTION_STYLES.map(({ key, label }) => ({ key, label })),
    educationLevels: EDUCATION_LEVELS.map(({ key, label }) => ({ key, label })),
    politics: POLITICS.map(({ key, label }) => ({ key, label })),
    accents: ACCENTS.map(({ key, label, lang }) => ({ key, label, lang })),
    vernaculars: VERNACULARS.map(({ key, label }) => ({ key, label })),
    paces: PACES.map(({ key, label }) => ({ key, label })),
  });
});

// Speak a line in her voice. Body: { text, mood }.
app.post("/api/tts", async (req, res) => {
  const { text, mood, voice } = req.body || {};
  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text is required" });
  }
  try {
    const out = await synthesize(
      text.trim(),
      typeof mood === "string" ? mood : "neutral",
      typeof voice === "string" ? voice : "default"
    );
    if (!out) return res.status(204).end(); // expressive voice not configured
    res.setHeader("Content-Type", out.contentType);
    res.send(out.audio);
  } catch (err) {
    console.error("tts error:", err);
    res.status(500).json({ error: "Voice synthesis failed." });
  }
});

const str = (v, max = 400) => (typeof v === "string" ? v.slice(0, max) : "");

function readSettings(body) {
  const p = body?.profile && typeof body.profile === "object" ? body.profile : {};
  return {
    temperament: typeof body?.temperament === "string" ? body.temperament : "chill",
    deflection: typeof body?.deflection === "string" ? body.deflection : "balanced",
    accent: typeof body?.accent === "string" ? body.accent : "neutral",
    vernacular: typeof body?.vernacular === "string" ? body.vernacular : "match",
    pace: typeof body?.pace === "string" ? body.pace : "natural",
    profile: {
      occupation: str(p.occupation),
      education: str(p.education, 40),
      interests: str(p.interests),
      politics: str(p.politics, 40),
      politicsNote: str(p.politicsNote),
    },
  };
}

// Restore an existing relationship on page load: her mood, rapport, saved
// settings, and the recent conversation so it picks up where it left off.
app.get("/api/session", async (req, res) => {
  const state = await loadState(req.query.userId);
  res.json({
    rapport: state.rapport,
    mood: state.mood,
    settings: state.settings,
    memoryCount: state.memory.length,
    history: state.history.slice(-60),
  });
});

// Wipe a user's memory and start over.
app.post("/api/reset", async (req, res) => {
  await clearState(req.body?.userId);
  res.json({ ok: true });
});

app.post("/api/chat", async (req, res) => {
  const { userId, message } = req.body || {};
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  const state = await loadState(userId);
  const settings = readSettings(req.body);
  const opts = { ...settings, memory: state.memory };

  try {
    const result = await respond(state.history, message.trim(), state.rapport, state.mood, opts);

    // Persist the turn, the emotional state, the freshly-learned facts, and
    // the settings so everything is there next time.
    state.history.push({ role: "user", content: message.trim() });
    state.history.push({ role: "assistant", content: result.reply });
    state.rapport = result.rapport;
    state.mood = result.mood;
    state.memory = mergeMemory(state.memory, result.newMemory || []);
    state.settings = settings;
    await saveState(userId, state);

    res.json({
      reply: result.reply,
      mood: result.mood,
      rapport: result.rapport,
      read: result.read,
      memoryCount: state.memory.length,
    });
  } catch (err) {
    console.error("chat error:", err);
    res.status(500).json({ error: "Something went wrong talking to the model." });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`${COMPANION_NAME} is listening on http://localhost:${port}`);
});
