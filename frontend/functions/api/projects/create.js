import { readJSON, writeJSON } from "../../_utils.js";

const KEY = "data/projects.json";
const EMPTY = { projects: [], order: [], nextNumber: "001" };

function inc(n){ const i = parseInt(n,10)||1; return String(i+1).padStart(3,"0"); }

export async function onRequestPost({ request, env }) {
  const payload = await request.json().catch(()=>({}));
  const db = await readJSON(env, KEY, EMPTY);

  const projectNumber = payload.projectNumber || db.nextNumber || "001";
  const project = {
    projectNumber,
    projectName: payload.projectName || "Untitled",
    client: payload.client || "Personal Projects",
    contact: payload.contact || "",
    email: payload.email || "",
    phone: payload.phone || "",
    notes: payload.notes || "",
    totalParts: 0,
    createdAt: new Date().toISOString(),
  };

  // upsert
  db.projects = db.projects.filter(p => p.projectNumber !== projectNumber).concat(project);
  if (!db.order.includes(projectNumber)) db.order.push(projectNumber);
  db.nextNumber = inc(projectNumber);

  await writeJSON(env, KEY, db);

  return new Response(JSON.stringify({ ok:true, project, nextNumber: db.nextNumber }), {
    headers: { "Content-Type": "application/json" }
  });
}
