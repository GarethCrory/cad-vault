import { projectKey, paths, readJSON, writeJSON } from "../_store.js";

export const onRequestPost = async ({ request, env }) => {
  const { projectNumber, projectName, typePrefix, partNumber, key } = await request.json().catch(()=> ({}));
  if(!key) return new Response(JSON.stringify({ error:"key required"}), { status:400, headers:{ "content-type":"application/json" }});
  const pk = projectKey(projectNumber, projectName);

  await env.UPLOADS_BUCKET.delete(key);

  if (partNumber != null && typePrefix){
    const parts = await readJSON(env, paths.parts(pk), { items: [] });
    const id = `${(typePrefix||"P").toUpperCase()}_${String(partNumber).padStart(3,"0")}`;
    const p = parts.items.find(x => x.id === id);
    if (p?.attachments){
      p.attachments = p.attachments.filter(a => a.key !== key);
      await writeJSON(env, paths.parts(pk), parts);
    }
  } else {
    const projAtt = await readJSON(env, paths.attachments(pk), { items: [] });
    projAtt.items = (projAtt.items||[]).filter(a => a.key !== key);
    await writeJSON(env, paths.attachments(pk), projAtt);
  }

  return new Response(JSON.stringify({ ok:true, key }), { headers:{ "content-type":"application/json" }});
};
