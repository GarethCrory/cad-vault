import { readJSON } from "../_store.js";
import { ensureProjectDir, updateProjectMeta } from "../_projectsUtil.js";

export const onRequestPost = async ({ request, env }) => {
  const { projectNumber, projectName } = await request.json().catch(() => ({}));
  if (!projectNumber || !projectName) {
    return new Response(JSON.stringify({ ok:false, error:"projectNumber and projectName required" }), { status:400 });
  }

  const projectRef = { projectNumber, projectName };
  const projectDir = ensureProjectDir(projectRef);

  // load current docs
  const partsDoc = await readJSON(env, `data/projects/${projectDir}/parts.json`, { items: [] });
  const normalizeCollection = (value, weight = 0) => {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map((entry) => ({ ...entry, __weight: weight }));
    }
    if (typeof value === "object") {
      const keys = Object.keys(value);
      return keys.map((key) => {
        const entry = value[key];
        if (entry && typeof entry === "object") {
          return { id: entry.id || key, ...entry, __weight: weight };
        }
        return { id: key, value: entry, n: Number(entry) || 0, __weight: weight };
      });
    }
    if (typeof value === "number" || typeof value === "string") {
      return [{ value, n: Number(value) || 0, __weight: weight }];
    }
    return [];
  };

  const sources = [
    normalizeCollection(partsDoc.items, 3),
    normalizeCollection(partsDoc.parts, 2),
    normalizeCollection(partsDoc, 1)
  ].flat();

  const keyed = new Map();
  const resolveKey = (raw = {}) => {
    if (raw.id) return raw.id;
    if (raw.key) return raw.key;
    if (raw.code) return raw.code;
    const type = String(raw.t || raw.typePrefix || raw.type || "P").toUpperCase();
    const partNum = String(raw.partNumber ?? raw.n ?? raw.number ?? "").padStart(3, "0");
    return `${type}_${partNum}`;
  };

  for (const entry of sources) {
    const key = resolveKey(entry);
    const existing = keyed.get(key);
    if (!existing || (entry.__weight || 0) >= (existing.__weight || 0)) {
      keyed.set(key, { ...(existing || {}), ...entry });
    }
  }

  const parts = Array.from(keyed.values()).map((entry) => {
    const { __weight, ...rest } = entry;
    return normalizePart(rest);
  }).filter((part) => part && part.partNumber);
  const partCount = parts.length;

  try {
    await updateProjectMeta(env, projectNumber, projectName, {
      partCount,
      updatedAt: new Date().toISOString()
    });
  } catch (e) {
    console.warn("scan: unable to update meta", e);
  }

  return new Response(JSON.stringify({
    ok: true,
    partCount,
    partsCount: partCount,
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
