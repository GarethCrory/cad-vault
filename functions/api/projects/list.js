import { readProjects, j } from "../../_db.js";
export async function onRequestPost({ env }){
  const projects = await readProjects(env);
  return j({ projects });
}
