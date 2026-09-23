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
  if (!code) return badRequest("Session code is required");

  const store = sessionsStore();
  const session = await store.get(code, { type: "json" });
  if (!session) return json(404, { error: "Session not found" });

  const updated = { ...session, status: "ended", endedAt: Date.now() };
  await store.setJSON(code, updated);
  return json(200, { session: updated });
};
