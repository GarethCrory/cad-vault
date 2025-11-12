import { projectKey, paths, readJSON } from "../_store.js";
export const onRequestPost = async ({ request, env }) => {
  const { projectNumber, projectName, root } = await request.json().catch(()=> ({}));
  const pk = projectKey(projectNumber, projectName);
  const bom = await readJSON(env, paths.bom(pk), { links: [] });
  // very simple 1-level tree
  const children = (bom.links||[]).filter(l => l.parent === root);
  return new Response(JSON.stringify({ root, children }), { headers:{ "content-type":"application/json" }});
};
