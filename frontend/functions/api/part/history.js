import { projectKey, paths, readJSON, partKey } from "../_store.js";

export const onRequestPost = async ({ request, env }) => {
  const { projectNumber, projectName, typePrefix="P", partNumber } = await request.json().catch(()=> ({}));
  const pk = projectKey(projectNumber, projectName);
  const parts = await readJSON(env, paths.parts(pk), { items: [] });
  const id = partKey(typePrefix, partNumber);
  const found = parts.items.find(p => p.id === id);
  return new Response(JSON.stringify({ history: (found?.history)||[] }), { headers:{ "content-type":"application/json" }});
};
