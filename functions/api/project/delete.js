import { readProjects, writeProjects, projectId, j } from "../../_db.js";
export async function onRequestPost({ env, request }){
  const { projectNumber, projectName } = await request.json().catch(()=> ({}));
  if(!projectNumber || !projectName) return j({ error:"projectNumber and projectName required" }, 400);
  const id = projectId({ projectNumber, projectName });
  const list = await readProjects(env);
  const next = list.filter(p => projectId(p) !== id);
  await writeProjects(env, next);
  // optional: you can later add a prefix delete for projects/<id>/*
  return j({ ok:true });
}
