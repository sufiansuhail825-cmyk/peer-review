import { sessionsStore, generateCode, json, badRequest } from "./_shared.js";

export default async (req) => {
  if (req.method !== "POST") return badRequest("POST only");

  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const { teacherEmail, topic, roster, rubric } = body;

  if (!teacherEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teacherEmail)) {
    return badRequest("Valid teacher email is required");
  }
  if (!topic || !topic.trim()) {
    return badRequest("Presentation topic is required");
  }
  if (!Array.isArray(roster) || roster.length < 2) {
    return badRequest("At least 2 students are required in the roster");
  }
  const cleanRoster = roster.map((n) => String(n).trim()).filter(Boolean);
  const uniqueRoster = new Set(cleanRoster);
  if (uniqueRoster.size !== cleanRoster.length) {
    return badRequest("Roster has duplicate names");
  }
  if (!Array.isArray(rubric) || rubric.length < 1) {
    return badRequest("At least one rubric criterion is required");
  }
  for (const c of rubric) {
    if (!c.criterion || !String(c.criterion).trim()) {
      return badRequest("Every rubric criterion needs a name");
    }
    if (!Number.isFinite(c.maxPoints) || c.maxPoints <= 0) {
      return badRequest("Every rubric criterion needs positive max points");
    }
  }

  const store = sessionsStore();
  const totalMax = rubric.reduce((sum, c) => sum + c.maxPoints, 0);

  // Retry on the rare code collision.
  let code;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateCode();
    const existing = await store.get(candidate, { type: "json" });
    if (!existing) {
      code = candidate;
      break;
    }
  }
  if (!code) return json(500, { error: "Could not generate a unique session code, try again" });

  const session = {
    code,
    teacherEmail: teacherEmail.trim(),
    topic: topic.trim(),
    roster: cleanRoster,
    claimedNames: [],
    rubric: rubric.map((c) => ({ criterion: String(c.criterion).trim(), maxPoints: c.maxPoints })),
    totalMax,
    status: "setup", // setup -> active -> ended
    createdAt: Date.now(),
    startedAt: null,
    durationMs: null,
    endsAt: null,
  };

  await store.setJSON(code, session);
  return json(200, { session });
};
