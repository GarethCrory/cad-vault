import { readJSON, writeJSON } from "../../_utils.js";
const KEY = "data/projects.json";
const EMPTY = { projects: [], order: [], nextNumber: "001" };

export async function onRequestPost({ request, env }) {
  const { order } = await request.json().catch(()=>({ order: [] }));
  const db = await readJSON(env, KEY, EMPTY);

  // order is [{ projectNumber, projectName, displayOrder }]
  const byNumber = new Map(db.projects.map(p => [p.projectNumber, p]));
  (order || []).forEach((o, idx) => {
    const p = byNumber.get(o.projectNumber);
    if (p) p.displayOrder = Number.isFinite(o.displayOrder) ? o.displayOrder : idx;
  });

  // rebuild projects array sorted, and the order list by projectNumber
  db.projects.sort((a,b) => (a.displayOrder ?? 1e9) - (b.displayOrder ?? 1e9));
  db.order = db.projects.map(p => p.projectNumber);

  await writeJSON(env, KEY, db);
  return new Response(JSON.stringify({ ok:true }), { headers: { "Content-Type":"application/json" }});
}
