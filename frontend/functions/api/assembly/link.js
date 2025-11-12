import { projectKey, paths, readJSON, writeJSON } from "../_store.js";
export const onRequestPost = async ({ request, env }) => {
  const { projectNumber, projectName, parent, child, qty=1 } = await request.json().catch(()=> ({}));
  const pk = projectKey(projectNumber, projectName);
  const bom = await readJSON(env, paths.bom(pk), { links: [] });
  const i = (bom.links||[]).findIndex(l => l.parent===parent && l.child===child);
  if(i>=0) bom.links[i].qty = Number(qty)||1; else (bom.links||[]).push({ parent, child, qty:Number(qty)||1 });
  await writeJSON(env, paths.bom(pk), bom);
  return new Response(JSON.stringify({ ok:true }), { headers:{ "content-type":"application/json" }});
};
