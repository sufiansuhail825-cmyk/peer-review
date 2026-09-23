import { sessionsStore, scoresStore, scoreDocKey, json, badRequest } from "./_shared.js";

export default async (req) => {
  if (req.method !== "POST") return badRequest("POST only");

  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const code = String(body.code || "").trim().toUpperCase();
  const graderName = String(body.graderName || "").trim();
  const targetName = String(body.targetName || "").trim();
  const criteriaScores = body.criteriaScores;

  if (!code) return badRequest("Session code is required");
  if (!graderName) return badRequest("Grader name is required");
  if (!targetName) return badRequest("Target name is required");
  if (graderName === targetName) return badRequest("You cannot grade yourself");
  if (!Array.isArray(criteriaScores) || criteriaScores.length === 0) {
    return badRequest("Scores are required");
  }

  const sstore = sessionsStore();
  const session = await sstore.get(code, { type: "json" });
  if (!session) return json(404, { error: "Session not found" });
  if (session.status !== "active") return json(409, { error: "This session is not currently active for grading" });
  if (!session.claimedNames.includes(graderName)) {
    return json(403, { error: "You have not joined this session with that name" });
  }
  if (!session.roster.includes(targetName)) return badRequest("Target is not on the roster");
  if (session.rubric.length !== criteriaScores.length) {
    return badRequest("Score count does not match rubric criteria count");
  }
  for (let i = 0; i < session.rubric.length; i++) {
    const max = session.rubric[i].maxPoints;
    const val = Number(criteriaScores[i]);
    if (!Number.isFinite(val) || val < 0 || val > max) {
      return badRequest(`Score for "${session.rubric[i].criterion}" must be between 0 and ${max}`);
    }
  }

  const store = scoresStore();
  const key = scoreDocKey(code, graderName, targetName);

  // Each (grader, target) pair owns exactly one doc. A resubmit overwrites
  // their own prior score for that peer (allowed: correcting a mis-click),
  // but can never collide with another student's submission, since the key
  // is unique per pair. No read-modify-write race here.
  const total = criteriaScores.reduce((s, v) => s + Number(v), 0);
  const doc = {
    sessionCode: code,
    graderName,
    targetName,
    criteriaScores: criteriaScores.map(Number),
    total,
    submittedAt: Date.now(),
  };
  await store.setJSON(key, doc);

  return json(200, { ok: true, doc });
};
