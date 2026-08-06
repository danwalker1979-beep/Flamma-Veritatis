import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { respond, COMPANION_NAME, MOODS, TEMPERAMENTS, DEFLECTION_STYLES } from "./companion.js";
import { synthesize, voiceEnabled } from "./tts.js";

const here = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(join(here, "public")));

app.get("/api/config", (_req, res) => {
  res.json({
    name: COMPANION_NAME,
    moods: MOODS,
    expressiveVoice: voiceEnabled,
    temperaments: TEMPERAMENTS.map(({ key, label, startMood }) => ({ key, label, startMood })),
    deflectionStyles: DEFLECTION_STYLES.map(({ key, label }) => ({ key, label })),
  });
});

// Speak a line in her voice. Body: { text, mood }.
app.post("/api/tts", async (req, res) => {
  const { text, mood } = req.body || {};
  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text is required" });
  }
  try {
    const out = await synthesize(text.trim(), typeof mood === "string" ? mood : "neutral");
    if (!out) return res.status(204).end(); // expressive voice not configured
    res.setHeader("Content-Type", out.contentType);
    res.send(out.audio);
  } catch (err) {
    console.error("tts error:", err);
    res.status(500).json({ error: "Voice synthesis failed." });
  }
});

app.post("/api/chat", async (req, res) => {
  const { history, message, rapport, mood } = req.body || {};
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }
  const safeHistory = Array.isArray(history)
    ? history
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .slice(-40)
    : [];
  const r = Number.isFinite(rapport) ? rapport : 10;
  const m = typeof mood === "string" ? mood : "neutral";
  const opts = {
    temperament: typeof req.body?.temperament === "string" ? req.body.temperament : "chill",
    deflection: typeof req.body?.deflection === "string" ? req.body.deflection : "balanced",
  };

  try {
    const result = await respond(safeHistory, message.trim(), r, m, opts);
    res.json(result);
  } catch (err) {
    console.error("chat error:", err);
    res.status(500).json({ error: "Something went wrong talking to the model." });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`${COMPANION_NAME} is listening on http://localhost:${port}`);
});
