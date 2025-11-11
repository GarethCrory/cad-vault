import { readJSON, writeJSON } from "../../_utils.js";
const KEY = "data/projects.json";
const EMPTY = { projects: [], order: [], nextNumber: "001" };

export async function onRequestPost({ request, env }) {
  const payload = await request.json().catch(()=>({}));
  const { projectNumber } = payload || {};
  if (!projectNumber) return new Response("Missing projectNumber", { status: 400 });

  const db = await readJSON(env, KEY, EMPTY);
  const idx = db.projects.findIndex(p => p.projectNumber === projectNumber);
  if (idx === -1) return new Response("Not found", { status: 404 });

  db.projects[idx] = { ...db.projects[idx], ...payload, projectNumber }; // keep number stable
  await writeJSON(env, KEY, db);

  return new Response(JSON.stringify({ ok:true, project: db.projects[idx] }), {
    headers: { "Content-Type": "application/json" }
  });
}
