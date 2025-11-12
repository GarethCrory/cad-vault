import { projectKey, paths, readJSON } from "../_store.js";
export const onRequestPost = async ({ request, env }) => {
  const { projectNumber, projectName } = await request.json().catch(()=> ({}));
  const pk = projectKey(projectNumber, projectName);
  const bom = await readJSON(env, paths.bom(pk), { links: [] });
  return new Response(JSON.stringify({ links: bom.links||[] }), { headers:{ "content-type":"application/json" }});
};
