import { sessionsStore, scoresStore, json, badRequest, nameKey } from "./_shared.js";

export default async (req) => {
  const url = new URL(req.url);
  const code = (url.searchParams.get("code") || "").trim().toUpperCase();
  const includeScores = url.searchParams.get("includeScores") === "1";

  if (!code) return badRequest("Session code is required");

  const store = sessionsStore();
  const session = await store.get(code, { type: "json" });
  if (!session) return json(404, { error: "Session not found" });

  let scores = null;
  if (includeScores) {
    const sstore = scoresStore();
    const { blobs } = await sstore.list({ prefix: `${code}/` });
    scores = [];
    for (const b of blobs) {
      const doc = await sstore.get(b.key, { type: "json" });
      if (doc) scores.push(doc);
    }
  }

  return json(200, { session, scores });
};
