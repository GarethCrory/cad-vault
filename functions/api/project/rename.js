import { readProjects, writeProjects, projectId, j } from "../../_db.js";
export async function onRequestPost({ env, request }){
  const { projectNumber, oldProjectName, newProjectName } = await request.json().catch(()=> ({}));
  if(!projectNumber || !oldProjectName || !newProjectName) return j({ error:"projectNumber, oldProjectName, newProjectName required" }, 400);
  const list = await readProjects(env);
  const idx = list.findIndex(p => projectId({ projectNumber, projectName: oldProjectName }) === projectId(p));
  if(idx < 0) return j({ error:"not found" }, 404);
  list[idx].projectName = String(newProjectName).trim();
  await writeProjects(env, list);
  return j({ ok:true, project:list[idx] });
}
