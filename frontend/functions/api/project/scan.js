import { projectKey, paths, readJSON } from "../_store.js";

export const onRequestPost = async ({ request, env }) => {
  const { projectNumber, projectName } = await request.json().catch(()=> ({}));
  const pk = projectKey(projectNumber, projectName);
  const parts = await readJSON(env, paths.parts(pk), { items: [] });
  const partsCount = parts.items.length;
  const revCount = parts.items.reduce((s,p)=> s + (p.revs?.length||0), 0);
  return new Response(JSON.stringify({ partsCount, revCount }), { headers:{ "content-type":"application/json" }});
};
