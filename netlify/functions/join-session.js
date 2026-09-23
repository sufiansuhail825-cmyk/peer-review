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
  const name = String(body.name || "").trim();

  if (!code) return badRequest("Session code is required");
  if (!name) return badRequest("Please select your name");

  const store = sessionsStore();

  // Small retry loop to reduce (not eliminate) the race where two students
  // claim the same name within the same read-modify-write window. Blobs has
  // no transactions, so this is best-effort, not a guarantee.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: session, etag } = (await store.getWithMetadata(code, { type: "json" })) || {};
    if (!session) return json(404, { error: "Session not found. Check the code." });
    if (session.status === "ended") return json(409, { error: "This session has ended." });
    if (!session.roster.includes(name)) return json(400, { error: "That name is not on the roster." });
    if (session.claimedNames.includes(name)) {
      return json(409, { error: "That name has already been claimed by another device." });
    }

    const updated = { ...session, claimedNames: [...session.claimedNames, name] };
    await store.setJSON(code, updated);

    // Re-read to see if our write actually stuck (best-effort race check).
    const check = await store.get(code, { type: "json" });
    if (check.claimedNames.includes(name)) {
      return json(200, { session: check, name });
    }
    // otherwise retry
  }

  return json(409, { error: "Could not claim that name right now, please try again." });
};
