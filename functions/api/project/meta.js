import { readProjects, writeProjects, projectId, j } from "../../_db.js";
export async function onRequestPost({ env, request }){
  const body = await request.json().catch(()=> ({}));
  const id = projectId(body);
  if(!id || id === "__") return j({ error:"projectNumber and projectName required" }, 400);
  const list = await readProjects(env);
  const idx = list.findIndex(p => projectId(p) === id);
  if(idx < 0) return j({ error:"not found" }, 404);
  list[idx] = { ...list[idx],
    client: body.client ?? list[idx].client,
    contactPerson: body.contactPerson ?? list[idx].contactPerson,
    email: body.email ?? list[idx].email,
    phone: body.phone ?? list[idx].phone,
    notes: body.notes ?? list[idx].notes
  };
  await writeProjects(env, list);
  return j({ ok:true, project:list[idx] });
}
