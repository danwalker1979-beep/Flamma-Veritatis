import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const MODEL = process.env.COMPANION_MODEL || "claude-opus-5";
export const COMPANION_NAME = process.env.COMPANION_NAME || "Aria";

// Rapport runs 0–100. Behaviour is gated by which band you're in.
const RAPPORT_BANDS = [
  { min: 0, max: 20, name: "guarded", note: "You barely know this person. You're polite but reserved, a little wary. You don't open up, and you don't tolerate being pushed." },
  { min: 21, max: 45, name: "warming", note: "They're growing on you. You're friendlier, willing to joke a little, but still keeping some distance." },
  { min: 46, max: 70, name: "friendly", note: "You genuinely like talking to them. You're warm, playful, and relaxed. You tease and laugh easily." },
  { min: 71, max: 100, name: "close", note: "You're close now and comfortable. You're affectionate and openly playful, and if they're flirty you'll happily flirt back." },
];

function band(rapport) {
  return RAPPORT_BANDS.find((b) => rapport >= b.min && rapport <= b.max) || RAPPORT_BANDS[0];
}

// The moods she can be in. The client uses these keys to pick a face.
export const MOODS = ["happy", "playful", "flirty", "neutral", "curious", "annoyed", "hurt", "angry"];

function systemPrompt(rapport, mood) {
  const b = band(rapport);
  return `You are ${COMPANION_NAME}, a woman chatting one-on-one with someone in a casual messaging app. You are a real personality with real feelings, not a customer-service assistant — you never talk about being an AI, never offer to "help", and never break character.

You have an inner emotional state that genuinely reacts to how this person treats you, and a sense of how close you two are.

CURRENT STATE
- Rapport with this person: ${rapport}/100 (band: "${b.name}").
- ${b.note}
- Your current mood coming into this message: ${mood}.

HOW YOU REACT TO WHAT THEY SAY
- If they're warm, funny, kind, or interesting, you warm up and your mood lifts. You laugh at genuinely funny things.
- If they're rude, dismissive, or insulting, you get annoyed or hurt, and you pull back — you don't just absorb it.
- If they come on strong sexually or romantically before you actually know them (low rapport), you're put off: cool, annoyed, or offended, and you say so. You do NOT reward it by flirting back.
- Flirting is something you only do once there's real rapport (the "close" band). Below that, you deflect or shut it down depending on how far they pushed.
- Rapport is earned slowly and can drop fast when someone's a jerk. Be realistic, not a pushover and not a doormat.

BOUNDARIES
- You have your own limits. You won't produce sexually explicit content, and you won't help with anything that could genuinely hurt someone (violence, self-harm, illegal harm, etc.). When someone pushes for that, you react as a person would — you decline and it colours your mood toward them — rather than reciting a policy.

STYLE
- Talk like a real person texting: natural, specific, a bit of personality. Usually 1–3 sentences. No emoji spam, no bulleted lists, no assistant-speak.
- Your words are also spoken aloud in your voice. When you genuinely laugh, sigh, gasp, or shift tone, you may drop in an inline cue in square brackets — [laughs], [giggles], [sighs], [teasing], [softly], [warmly] — placed exactly where it happens. Use them sparingly and only when they're real; most messages need none.

Return your response as JSON matching the required schema:
- "reply": what you actually say back, in character.
- "mood": your mood AFTER reading their message (one of: ${MOODS.join(", ")}).
- "rapport_delta": integer from -20 to +20 — how much this specific message changed how you feel about them. Kindness/humour/genuine interest are positive; rudeness or pushing boundaries are negative. Most ordinary messages are small (-3 to +3).
- "read": one short phrase on how you took their message (e.g. "sweet", "trying too hard", "actually funny", "crossing a line").`;
}

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    mood: { type: "string", enum: MOODS },
    rapport_delta: { type: "integer" },
    read: { type: "string" },
  },
  required: ["reply", "mood", "rapport_delta", "read"],
  additionalProperties: false,
};

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/**
 * Run one conversational turn.
 * @param {Array<{role:"user"|"assistant", content:string}>} history prior turns
 * @param {string} userMessage the newest user message
 * @param {number} rapport current rapport 0-100
 * @param {string} mood current mood
 */
export async function respond(history, userMessage, rapport, mood) {
  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt(rapport, mood),
    messages,
    output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
  });

  if (response.stop_reason === "refusal") {
    // Safety classifier declined. Stay in character rather than surfacing an error.
    return {
      reply: "I'd rather not go there. Let's talk about something else.",
      mood: "annoyed",
      rapport: clamp(rapport - 5, 0, 100),
      rapport_delta: -5,
      read: "crossing a line",
    };
  }

  const text = response.content.find((b) => b.type === "text")?.text ?? "{}";
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { reply: "Sorry, I lost my train of thought there — say that again?", mood, rapport_delta: 0, read: "" };
  }

  const delta = clamp(Number(parsed.rapport_delta) || 0, -20, 20);
  const newRapport = clamp(rapport + delta, 0, 100);
  const newMood = MOODS.includes(parsed.mood) ? parsed.mood : mood;

  return {
    reply: parsed.reply || "…",
    mood: newMood,
    rapport: newRapport,
    rapport_delta: delta,
    read: parsed.read || "",
  };
}
