import { readProjects, writeProjects, ensureProjectPrefix, projectId, j } from "../../_db.js";
export async function onRequestPost({ env, request }){
  const body = await request.json().catch(()=> ({}));
  if(!body.projectNumber || !body.projectName) return j({ error:"projectNumber and projectName required" }, 400);
  const now = new Date().toISOString();
  const list = await readProjects(env);
  const id = projectId(body);
  const existsIdx = list.findIndex(p => projectId(p) === id);
  const base = {
    projectNumber: String(body.projectNumber).trim(),
    projectName: String(body.projectName).trim(),
    client: String(body.client||"Personal Projects"),
    contactPerson: String(body.contactPerson||""),
    email: String(body.email||""),
    phone: String(body.phone||""),
    notes: String(body.notes||""),
    created: now,
    displayOrder: existsIdx >= 0 ? list[existsIdx].displayOrder : list.length,
    partCount: 0
  };
  if(existsIdx >= 0) list[existsIdx] = { ...list[existsIdx], ...base };
  else list.push(base);
  await writeProjects(env, list);
  await ensureProjectPrefix(env, base);
  return j({ ok:true, project: base });
}
