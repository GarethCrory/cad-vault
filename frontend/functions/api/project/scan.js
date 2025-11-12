import { projectKey, paths, readJSON, writeJSON } from "../_store.js";

export const onRequestPost = async ({ request, env }) => {
  const { projectNumber, projectName } = await request.json().catch(() => ({}));
  if (!projectNumber || !projectName) {
    return new Response(JSON.stringify({ ok:false, error:"projectNumber and projectName required" }), { status:400 });
  }

  const pk = projectKey(projectNumber, projectName);

  // load current docs
  const partsDoc = await readJSON(env, paths.parts(pk), { items: [] });
  const items = Array.isArray(partsDoc.items)
    ? partsDoc.items
    : Array.isArray(partsDoc.parts)
      ? partsDoc.parts
      : [];
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
  const latestRevEntry = revs[revs.length - 1];
  const latestRev = latestRevEntry?.rev || latestRevEntry?.label || inferRevFromName(latestRevEntry?.name || latestRevEntry?.key);
  const latestFile = latestRevEntry?.name || latestRevEntry?.key || null;

  return {
    typePrefix: type,
    partNumber,
    description: raw.description || "",
    notes: raw.notes || "",
    latestRev,
    latestFile,
    revs,
    attachments: raw.attachments || [],
    history: raw.history || [],
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt
  };
}

function inferRevFromName(name = "") {
  const match = /_Rev([A-Z])/i.exec(name);
  return match ? match[1].toUpperCase() : null;
}
