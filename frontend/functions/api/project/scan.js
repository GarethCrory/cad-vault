import { projectKey, paths, readJSON, writeJSON } from "../_store.js";

export const onRequestPost = async ({ request, env }) => {
  const { projectNumber, projectName } = await request.json().catch(() => ({}));
  if (!projectNumber || !projectName) {
    return new Response(JSON.stringify({ ok:false, error:"projectNumber and projectName required" }), { status:400 });
  }

  const pk = projectKey(projectNumber, projectName);

  // load current docs
  const partsDoc = await readJSON(env, paths.parts(pk), { items: [] });
  const normalizeCollection = (value) => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      const arr = Object.values(value);
      if (arr.every((entry) => typeof entry === "number")) {
        return arr.map((num, idx) => ({
          id: Object.keys(value)[idx],
          n: num
        }));
      }
      return arr;
    }
    if (typeof value === "number" || typeof value === "string") {
      return [{ n: Number(value) || 0, raw: value }];
    }
    return [];
  };
  const itemsCandidates = [
    normalizeCollection(partsDoc.items),
    normalizeCollection(partsDoc.parts),
    normalizeCollection(partsDoc)
  ].find((collection) => collection.length) || [];
  const parts = items.map(normalizePart);

  // persist latest count to meta so list shows correctly
  try {
    const meta = await readJSON(env, paths.meta(pk), {});
    meta.partCount = parts.length;
    meta.updatedAt = new Date().toISOString();
    await writeJSON(env, paths.meta(pk), meta);
  } catch (e) {
    // non-fatal — still return the scan result
    console.warn("scan: unable to update meta", e);
  }

  return new Response(JSON.stringify({
    ok: true,
    partsCount: parts.length,
    parts
  }), { headers:{ "content-type":"application/json" }});
};

function normalizePart(raw = {}) {
  const type = String(raw.t || raw.typePrefix || raw.type || "P").toUpperCase();
  const numValue = typeof raw.n === "number" ? raw.n : Number(raw.partNumber);
  const partNumber = Number.isFinite(numValue)
    ? String(numValue).padStart(3, "0")
    : String(raw.partNumber || 0).padStart(3, "0");

  const revs = Array.isArray(raw.revs) ? raw.revs : [];
  const history = Array.isArray(raw.history) ? raw.history : [];
  const latestRevEntry = revs[revs.length - 1];
  const latestHistoryEntry = [...history].reverse().find(item => item && (item.rev || item.file || item.description)) || null;

  const latestRev =
    raw.latestRev
    || raw.rev
    || latestRevEntry?.rev
    || latestRevEntry?.label
    || inferRevFromName(latestRevEntry?.name || latestRevEntry?.key)
    || latestHistoryEntry?.rev
    || inferRevFromName(latestHistoryEntry?.file);

  const latestFile =
    raw.latestFile
    || raw.file
    || latestRevEntry?.name
    || latestRevEntry?.key
    || latestHistoryEntry?.file
    || null;

  const description = (raw.description
    ?? raw.meta?.description
    ?? latestHistoryEntry?.description
    ?? raw.desc
    ?? "").toString().trim();

  const notes = (raw.notes
    ?? raw.meta?.notes
    ?? latestHistoryEntry?.notes
    ?? "").toString();

  return {
    typePrefix: type,
    partNumber,
    description,
    notes,
    latestRev: latestRev || "",
    latestFile,
    revs,
    attachments: raw.attachments || [],
    history,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt
  };
}

function inferRevFromName(name = "") {
  const match = /_Rev([A-Z])/i.exec(name);
  return match ? match[1].toUpperCase() : null;
}
