import { sessionsStore, json, badRequest } from "./_shared.js";

export default async (req) => {
  if (req.method !== "POST") return badRequest("POST only");

  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const code = String(body.code || "").trim().toUpperCase();
  const durationMinutes = Number(body.durationMinutes) || 10;

  if (!code) return badRequest("Session code is required");
  if (durationMinutes < 1 || durationMinutes > 60) return badRequest("Duration must be 1-60 minutes");

  const store = sessionsStore();
  const session = await store.get(code, { type: "json" });
  if (!session) return json(404, { error: "Session not found" });
  if (session.status === "ended") return badRequest("Session has already ended");

  const now = Date.now();
  const durationMs = durationMinutes * 60 * 1000;
  const updated = {
    ...session,
    status: "active",
    startedAt: now,
    durationMs,
    endsAt: now + durationMs,
  };
  await store.setJSON(code, updated);
  return json(200, { session: updated });
};
