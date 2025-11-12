import { projectKey, paths, readJSON } from "../_store.js";

export const onRequestPost = async ({ request, env }) => {
  const { projectNumber, projectName, typePrefix, partNumber } = await request.json().catch(()=> ({}));
  const pk = projectKey(projectNumber, projectName);

  if (partNumber != null && typePrefix){
    const parts = await readJSON(env, paths.parts(pk), { items: [] });
    const id = `${(typePrefix||"P").toUpperCase()}_${String(partNumber).padStart(3,"0")}`;
    const p = parts.items.find(x => x.id === id);
    return new Response(JSON.stringify({ items: p?.attachments || [] }), { headers:{ "content-type":"application/json" }});
  } else {
    const projAtt = await readJSON(env, paths.attachments(pk), { items: [] });
    return new Response(JSON.stringify({ items: projAtt.items || [] }), { headers:{ "content-type":"application/json" }});
  }
};
