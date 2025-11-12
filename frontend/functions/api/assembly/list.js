import { projectKey, paths, readJSON } from "../_store.js";
export const onRequestPost = async ({ request, env }) => {
  const { projectNumber, projectName, typePrefix="P", partNumber } = await request.json().catch(()=> ({}));
  const pk = projectKey(projectNumber, projectName);
  const bom = await readJSON(env, paths.bom(pk), { links: [] });
  const id = `${(typePrefix||"P").toUpperCase()}_${String(partNumber).padStart(3,"0")}`;
  const usedIn = (bom.links||[]).filter(l => l.child === id);
  const children = (bom.links||[]).filter(l => l.parent === id);
  return new Response(JSON.stringify({ usedIn, children }), { headers:{ "content-type":"application/json" }});
};
