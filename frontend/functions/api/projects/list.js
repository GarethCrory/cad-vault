import { projectKey } from "../_store.js";

export async function onRequestGet(ctx) { return handle(ctx); }
export async function onRequestPost(ctx) { return handle(ctx); }

async function handle({ env }) {
  try {
    const obj = await env.UPLOADS_BUCKET.get("data/projects.json");
    let projects = [];
    if (obj) {
      const txt = await obj.text();
      try {
        const parsed = JSON.parse(txt);
        projects = Array.isArray(parsed?.projects) ? parsed.projects : (parsed || []);
      } catch {
        projects = [];
      }
    }

    const enhanced = await Promise.all(projects.map(project => enhanceProject(env, project)));
    return json({ projects: enhanced });
  } catch (err) {
    // Never block the UI — return an empty list with the error for visibility
    return json({ projects: [], error: String(err) });
  }
}

async function enhanceProject(env, project) {
  const partCount = await resolvePartCount(env, project).catch(() => project.partCount || 0);
  let nextPartNumber = project.nextPartNumber || "001";
  if (!nextPartNumber) {
    nextPartNumber = await resolveNextPartNumber(env, project).catch(() => "001");
  }
  return { ...project, partCount, nextPartNumber };
}

async function resolvePartCount(env, project) {
  const candidates = [];
  if (project?.projectDir) candidates.push(String(project.projectDir).trim());
  candidates.push(projectKey(project?.projectNumber, project?.projectName));

  for (const key of candidates) {
    if (!key) continue;
    const count = await readPartsCount(env, key);
    if (typeof count === "number") return count;
  }

  return project?.partCount || 0;
}

async function readPartsCount(env, dirKey) {
  const path = `data/projects/${dirKey}/parts.json`;
  const obj = await env.UPLOADS_BUCKET.get(path);
  if (!obj) return null;
  try {
    const text = await obj.text();
    const data = JSON.parse(text || "{}");
    if (Array.isArray(data.items)) return data.items.length;
    if (Array.isArray(data.parts)) return data.parts.length;
    if (typeof data.partCount === "number") return data.partCount;
    return 0;
  } catch {
    return 0;
  }
}

async function resolveNextPartNumber(env, project) {
  const pk = projectKey(project?.projectNumber, project?.projectName);
  const path = `data/projects/${pk}/parts.json`;
  const obj = await env.UPLOADS_BUCKET.get(path);
  if (!obj) return "001";
  try {
    const text = await obj.text();
    const data = JSON.parse(text || "{}");
    const parts = Array.isArray(data.items) ? data.items : Array.isArray(data.parts) ? data.parts : [];
    const max = parts.reduce((acc, part) => Math.max(acc, Number(part?.n ?? part?.partNumber) || 0), 0);
    return String(max + 1).padStart(3, "0");
  } catch {
    return "001";
  }
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" },
    ...init
  });
}
