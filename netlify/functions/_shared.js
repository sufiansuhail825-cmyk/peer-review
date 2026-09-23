import { getStore } from "@netlify/blobs";

// One global store for sessions, one for scores. Global (not deploy-scoped)
// so a session survives redeploys during the school term.
export function sessionsStore() {
  return getStore({ name: "peer-review-sessions", consistency: "strong" });
}

export function scoresStore() {
  return getStore({ name: "peer-review-scores", consistency: "strong" });
}

// 6-char alphanumeric join code, uppercase, excludes ambiguous chars (0/O, 1/I).
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateCode(len = 6) {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}

export function json(status, body) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function badRequest(message) {
  return json(400, { error: message });
}

// Sanitize a display name into a safe blob-key segment.
// Keeps the mapping stable and collision-free for reasonable name sets.
export function nameKey(name) {
  return encodeURIComponent(name.trim());
}

export function scoreDocKey(sessionCode, graderName, targetName) {
  return `${sessionCode}/${nameKey(graderName)}__${nameKey(targetName)}`;
}
