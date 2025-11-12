import { projectKey, paths, readJSON, writeJSON } from "../_store.js";
export const onRequestPost = async ({ request, env }) => {
  const { projectNumber, projectName, parent, child } = await request.json().catch(()=> ({}));
  const pk = projectKey(projectNumber, projectName);
  const bom = await readJSON(env, paths.bom(pk), { links: [] });
  bom.links = (bom.links||[]).filter(l => !(l.parent===parent && l.child===child));
  await writeJSON(env, paths.bom(pk), bom);
  return new Response(JSON.stringify({ ok:true }), { headers:{ "content-type":"application/json" }});
};
