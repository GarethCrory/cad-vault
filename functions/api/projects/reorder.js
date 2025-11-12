import { readProjects, writeProjects, projectId, j } from "../../_db.js";
export async function onRequestPost({ env, request }){
  const { order } = await request.json().catch(()=> ({}));
  if(!Array.isArray(order)) return j({ error:"order array required" }, 400);
  const list = await readProjects(env);
  const map = new Map(order.map((o,i)=>[projectId(o), i]));
  const updated = list.map(p => ({ ...p, displayOrder: map.has(projectId(p)) ? map.get(projectId(p)) : p.displayOrder }));
  updated.sort((a,b)=> (a.displayOrder??0) - (b.displayOrder??0));
  await writeProjects(env, updated);
  return j({ ok:true });
}
