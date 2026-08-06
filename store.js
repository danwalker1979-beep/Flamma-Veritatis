// Per-user persistent state: rapport, mood, learned memory, and history.
// Stored as one JSON file per user id so she remembers people across sessions
// and server restarts.
import { promises as fs } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const here = dirname(fileURLToPath(import.meta.url));
const DIR = process.env.DATA_DIR || join(here, "data");

// Keep history and memory bounded so files don't grow without limit.
const MAX_HISTORY = 200; // messages (user + assistant)
const MAX_MEMORY = 80; // durable facts

const safeId = (id) => (typeof id === "string" && /^[A-Za-z0-9_-]{6,64}$/.test(id) ? id : null);
const fileFor = (id) => join(DIR, `${id}.json`);

export function defaultState() {
  return { rapport: 10, mood: "neutral", memory: [], history: [], settings: {} };
}

export async function loadState(id) {
  const sid = safeId(id);
  if (!sid) return defaultState();
  try {
    const raw = await fs.readFile(fileFor(sid), "utf8");
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return defaultState();
  }
}

export async function saveState(id, state) {
  const sid = safeId(id);
  if (!sid) return;
  const trimmed = {
    ...state,
    history: state.history.slice(-MAX_HISTORY),
    memory: state.memory.slice(-MAX_MEMORY),
  };
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(fileFor(sid), JSON.stringify(trimmed), "utf8");
}

export async function clearState(id) {
  const sid = safeId(id);
  if (!sid) return;
  try {
    await fs.unlink(fileFor(sid));
  } catch {
    /* already gone */
  }
}

// Merge new facts in, case-insensitively de-duplicated against what's known.
export function mergeMemory(existing, incoming) {
  const seen = new Set(existing.map((m) => m.toLowerCase()));
  const out = [...existing];
  for (const fact of incoming) {
    const key = fact.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(fact);
    }
  }
  return out;
}
