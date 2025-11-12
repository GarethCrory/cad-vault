import { projectKey, paths, readJSON, writeJSON } from "../_store.js";
export const onRequestPost = async ({ request, env }) => {
  const { projectNumber, projectName, links=[] } = await request.json().catch(()=> ({}));
  const pk = projectKey(projectNumber, projectName);
  const bom = await readJSON(env, paths.bom(pk), { links: [] });
  // naive replace for now
  bom.links = Array.isArray(links) ? links : (bom.links||[]);
  await writeJSON(env, paths.bom(pk), bom);
  return new Response(JSON.stringify({ ok:true }), { headers:{ "content-type":"application/json" }});
};
