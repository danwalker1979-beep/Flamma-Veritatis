// Expressive text-to-speech via ElevenLabs (optional).
// If ELEVENLABS_API_KEY is unset, the client falls back to browser speech.

const API_KEY = process.env.ELEVENLABS_API_KEY;
// A default expressive female voice ("Rachel"); override with your own voice id.
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
// v3 renders inline audio tags like [laughs] and shifts tone with `style`.
const VOICE_MODEL = process.env.ELEVENLABS_MODEL || "eleven_v3";

export const voiceEnabled = Boolean(API_KEY);

// Map her mood onto delivery. Higher style = more expressive/emotive;
// stability trades consistency for expressive range.
const MOOD_VOICE = {
  happy: { stability: 0.4, style: 0.6 },
  playful: { stability: 0.3, style: 0.75 },
  flirty: { stability: 0.35, style: 0.8 },
  neutral: { stability: 0.5, style: 0.3 },
  curious: { stability: 0.45, style: 0.45 },
  annoyed: { stability: 0.55, style: 0.4 },
  hurt: { stability: 0.6, style: 0.35 },
  angry: { stability: 0.6, style: 0.6 },
};

/**
 * Synthesize speech. Returns { audio: Buffer, contentType } or null if disabled.
 * `text` may contain inline emotion tags (e.g. [laughs]) which v3 voices render.
 */
export async function synthesize(text, mood = "neutral") {
  if (!API_KEY) return null;

  const settings = MOOD_VOICE[mood] || MOOD_VOICE.neutral;
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: VOICE_MODEL,
        voice_settings: {
          stability: settings.stability,
          similarity_boost: 0.75,
          style: settings.style,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`TTS failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const audio = Buffer.from(await res.arrayBuffer());
  return { audio, contentType: "audio/mpeg" };
}
