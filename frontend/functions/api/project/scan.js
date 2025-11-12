import { ensureProjectDir, updateProjectMeta } from "../_projectsUtil.js";

function sanitizeLegacy(name = "") {
  return String(name)
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, "-") || "project";
}

function legacyProjectDir(projectNumber, projectName) {
  const num = String(projectNumber || "").padStart(3, "0");
  return `${num}_${sanitizeLegacy(projectName || "project")}`;
}

const FILE_NAME_RE = /^(\d+)_([A-Z])(\d{3})_Rev([A-Z])_(.+)\.step$/i;

async function readPartsDocument(env, primaryDir, legacyDir) {
  const attempt = async (dir) => {
    if (!dir) return null;
    const key = `data/projects/${dir}/parts.json`;
    const obj = await env.UPLOADS_BUCKET.get(key);
    if (!obj) return null;
    try {
      const txt = await obj.text();
      return JSON.parse(txt || "{}");
    } catch {
      return null;
    }
  };
  return (await attempt(primaryDir)) || (await attempt(legacyDir)) || { items: [] };
}

async function scanLegacyParts(env, projectNumber, projectName) {
  const dir = legacyProjectDir(projectNumber, projectName);
  const prefix = `projects/${dir}/parts/`;
  const results = [];
  try{
    let cursor;
    const prefixes = new Set();
    do{
      const listing = await env.UPLOADS_BUCKET.list({ prefix, delimiter: "/", cursor });
      (listing.delimitedPrefixes || []).forEach((p) => prefixes.add(p));
      cursor = listing.truncated ? listing.cursor : null;
    }while(cursor);

    for (const partPrefix of prefixes){
      const match = /parts\/([A-Z])_(\d{3})\//i.exec(partPrefix);
      if (!match) continue;
      const typePrefix = match[1].toUpperCase();
      const partNumber = match[2];
      let cursorChild;
      let latest = null;
      const score = (rev) => (rev ? rev.charCodeAt(0) : 0);
      do{
        const listing = await env.UPLOADS_BUCKET.list({ prefix: partPrefix, cursor: cursorChild });
        (listing.objects || []).forEach((obj) => {
          const base = obj.key.split("/").pop();
          if (!base || base.endsWith(".json")) return;
          const fileMatch = FILE_NAME_RE.exec(base);
          if (!fileMatch) return;
          const rev = fileMatch[4].toUpperCase();
          const description = fileMatch[5].replace(/[-_]/g, " ").trim();
          if (!latest || score(rev) > score(latest.rev)) {
            latest = { rev, file: base, description };
          }
        });
        cursorChild = listing.truncated ? listing.cursor : null;
      }while(cursorChild);
      results.push({
        typePrefix,
        partNumber,
        description: latest?.description || "",
        latestRev: latest?.rev || "",
        latestFile: latest?.file || null,
        notes: "",
        revs: [],
        attachments: [],
        history: [],
        __weight: -1
      });
    }
  }catch(err){
    console.warn("scan: legacy part listing failed", err);
  }
  return results;
}

export const onRequestPost = async ({ request, env }) => {
  const { projectNumber, projectName } = await request.json().catch(() => ({}));
  if (!projectNumber || !projectName) {
    return new Response(JSON.stringify({ ok:false, error:"projectNumber and projectName required" }), { status:400 });
  }

  const projectRef = { projectNumber, projectName };
  const projectDir = ensureProjectDir(projectRef);
  const legacyDir = legacyProjectDir(projectNumber, projectName);

  // load current docs (modern or legacy path)
  const partsDoc = await readPartsDocument(env, projectDir, legacyDir);

  const looksLikePart = (entry = {}) => {
    if (!entry || typeof entry !== "object") return false;
    return ["typePrefix", "t", "type", "partNumber", "n", "latestFile", "latestRev", "code"].some((key) =>
      Object.prototype.hasOwnProperty.call(entry, key)
    );
  };

  const extractParts = (node, weight = 0) => {
    if (!node) return [];
    if (Array.isArray(node)) {
      return node.flatMap((item) => extractParts(item, weight));
    }
    if (typeof node === "object") {
      if (looksLikePart(node)) {
        return [{ ...node, __weight: weight }];
      }
      let results = [];
      if (node.items) results = results.concat(extractParts(node.items, weight + 1));
      if (node.parts) results = results.concat(extractParts(node.parts, weight + 1));
      Object.entries(node).forEach(([key, value]) => {
        if (key === "items" || key === "parts") return;
        results = results.concat(extractParts(value, weight + 1));
      });
      return results;
    }
    return [];
  };

  const sources = extractParts(partsDoc);

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

  const legacyParts = await scanLegacyParts(env, projectNumber, projectName);
  for (const entry of legacyParts) {
    const key = resolveKey(entry);
    if (keyed.has(key)) continue;
    keyed.set(key, entry);
  }

  const parts = Array.from(keyed.values()).map((entry) => {
    const { __weight, ...rest } = entry;
    return normalizePart(rest);
  }).filter((part) => part && part.partNumber);
  const partCount = parts.length;

  const meta = await updateProjectMeta(env, projectNumber, projectName, {
    partCount,
    updatedAt: new Date().toISOString()
  });

  return new Response(JSON.stringify({
    ok: true,
    partCount,
    partsCount: partCount,
    meta,
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
