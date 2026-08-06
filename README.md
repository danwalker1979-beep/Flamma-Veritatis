# Companion Chat

An emotionally responsive AI chat companion. She has a **mood** and a **rapport**
level with you, and both react to how you actually talk to her. Say something
funny and she laughs; be rude and she gets annoyed and pulls back; come on too
strong before she knows you and she's put off. Once you've built real rapport,
she'll warm up and flirt back. The mood face and rapport meter at the top update
live so you can watch the relationship shift.

## How it works

Each turn is a single call to Claude that returns structured JSON: her in-character
reply **plus** her updated emotional state (mood + how much this message changed
her feelings about you). The server clamps and applies that to a 0–100 rapport
score, which feeds back into the next turn's system prompt. Flirtatious behaviour
is *gated* behind rapport bands — it isn't a switch you flip, it's something you
earn, which is what makes it feel real rather than a chatbot that flirts with
anyone instantly.

- `companion.js` — the persona, the rapport bands, and the model call.
- `tts.js` — expressive voice synthesis (optional).
- `server.js` — a thin Express API (`/api/chat`, `/api/tts`, `/api/config`) serving the UI.
- `public/` — the chat interface (mood face + rapport meter + voice).

## Tuning her (the ⚙️ panel)

Two dials, both live — change them any time and they apply to the next message:

- **Temperament** — her baseline disposition, from `Sweet` → `Playful` → `Chill` →
  `Dramatic` → `Serious` → `Fiery`. This is where she *starts*; the mood engine
  still branches her into any emotion as the conversation steers her.
- **When you push a boundary** — how she deflects: `Gentle` (soft redirect),
  `Balanced` (playful "behave"), or `Firm` (shuts it down, goes cold if you keep
  pushing).

Add temperaments or reword them in `TEMPERAMENTS` / `DEFLECTION_STYLES` in
`companion.js`.

### Accent vs. vernacular

Two *separate* dials, because how someone **sounds** and the **words** they reach
for are different things:

- **Accent** — how she sounds (Southern drawl, Boston, British, French…), carried
  in how she spells words phonetically, and used as a locale hint for the spoken
  voice.
- **Vernacular** — the slang and idiom she chooses (casual American, British,
  Gen-Z, refined…), defaulting to "matches accent."

Mix them to get things like *a British accent with casual American vernacular* —
an Englishman raised in the States who sounds English but says "hell yeah that's
awesome." She'll also **pick up an accent on the fly**: call her "Hillbilly Jim"
and she does her best country for the bit, then eases back.

> Note on the *spoken* accent: the written dialect always comes through, but a
> true vocal accent depends on the voice. The browser fallback switches locale
> where one exists (British, French); for full vocal accents on the expressive
> path, point `ELEVENLABS_VOICE_ID` at a voice that has the accent you want.

You can also fill in a **character sheet** — her work/background, education level
(which shapes how she talks and what she references, from "left school early" to
"doctorate"), her passions, and her political lean. Politics here is a
*personality trait*: she holds the view naturally, agrees with a like-minded
partner, and never breaks character to moralize, disclaim, or fact-check. She'll
engage with any topic as a person with opinions — the one thing she won't do is
assert something plainly false as established fact (she can still explore it and
take your side of the conversation). Edit `EDUCATION_LEVELS` / `POLITICS` in
`companion.js` to extend these.

## Voice

She speaks her replies out loud, and her delivery follows her mood.

- **Expressive voice (laughter, real inflection, tone shifts):** set `ELEVENLABS_API_KEY`.
  Her mood maps to voice settings, and she can drop inline cues like `[laughs]` or
  `[softly]` that the voice renders (they're stripped from the on-screen text). This
  is the only path that genuinely laughs and emotes.
- **No key:** falls back to the browser's built-in speech. It talks and nudges pitch
  and rate by mood, but it can't laugh or truly emote.
- The 🔊 button toggles voice on/off.

State lives in the browser and is sent with each request, so the server is
stateless and holds no conversation data.

## Run it

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...   # or copy .env.example and load it
npm start
```

Then open http://localhost:3000.

## Configuration

Environment variables (see `.env.example`):

| Variable            | Default          | Purpose                          |
| ------------------- | ---------------- | -------------------------------- |
| `ANTHROPIC_API_KEY` | —                | Required.                        |
| `COMPANION_NAME`    | `Aria`           | Her name.                        |
| `COMPANION_MODEL`   | `claude-opus-5`  | Any current Claude model.        |
| `PORT`              | `3000`           | Server port.                     |

## On limits

She's an uninhibited, warm, flirt-capable personality — but she is a *person* with
her own boundaries, not a content generator with none. She won't produce sexually
explicit material or help with anything that could genuinely harm someone, and she
reacts to being pushed there the way a real person would. If you're using a hosted
API, those provider-side limits also can't be prompted away. Within that, the
persona, warmth, and flirtiness are all yours to tune in `companion.js`.
