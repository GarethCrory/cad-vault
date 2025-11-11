import { readJSON, writeJSON } from "../../_utils.js";
const KEY = "data/projects.json";
const EMPTY = { projects: [], order: [], nextNumber: "001" };

export async function onRequestPost({ request, env }) {
  const { projectNumber } = await request.json().catch(()=>({}));
  if (!projectNumber) return new Response("Missing projectNumber", { status: 400 });

  const db = await readJSON(env, KEY, EMPTY);
  db.projects = db.projects.filter(p => p.projectNumber !== projectNumber);
  db.order = (db.order || []).filter(n => n !== projectNumber);

  await writeJSON(env, KEY, db);
  return new Response(JSON.stringify({ ok:true }), { headers: { "Content-Type":"application/json" } });
}
