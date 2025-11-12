import { projectKey, paths, readJSON, writeJSON, partKey } from "../_store.js";

export const onRequestPost = async ({ request, env }) => {
  const body = await request.json().catch(()=> ({}));
  const { projectNumber, projectName, typePrefix="P", partNumber, description="", notes="", action="update" } = body||{};
  if(!projectNumber || !projectName) return new Response(JSON.stringify({ error:"project required"}), { status:400, headers:{ "content-type":"application/json" }});

  const pk = projectKey(projectNumber, projectName);
  const partsKey = paths.parts(pk);
  const now = new Date().toISOString();

  const parts = await readJSON(env, partsKey, { items: [] });
  const id = partKey(typePrefix, partNumber);
  const idx = parts.items.findIndex(x => x.id === id);

  if(action === "delete"){
    if(idx >= 0){
      parts.items.splice(idx,1);
      await writeJSON(env, partsKey, parts);
    }
    return new Response(JSON.stringify({ ok:true }), { headers:{ "content-type":"application/json" }});
  }

  const base = {
    id,
    t: (typePrefix||"P").toUpperCase(),
    n: Number(partNumber)||0,
    description,
    notes,
    createdAt: now,
    updatedAt: now,
    revs: [],          // uploaded STEP/PDF revisions
    attachments: [],   // ancillary files
    history: []
  };

  if(idx >= 0){
    const cur = parts.items[idx];
    cur.description = description ?? cur.description;
    cur.notes = notes ?? cur.notes;
    cur.updatedAt = now;
    cur.history = cur.history || [];
    cur.history.push({ ts: now, event: "meta:update", by: "ui" });
    parts.items[idx] = cur;
  }else{
    base.history.push({ ts: now, event: "meta:create", by: "ui" });
    parts.items.push(base);
  }

  await writeJSON(env, partsKey, parts);
  return new Response(JSON.stringify({ ok:true, part: parts.items.find(x=>x.id===id) }), { headers:{ "content-type":"application/json" }});
};
