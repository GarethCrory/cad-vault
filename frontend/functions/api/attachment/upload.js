import { projectKey, paths, readJSON, writeJSON, partKey } from "../_store.js";

export const onRequestPost = async ({ request, env }) => {
  try {
    const form = await request.formData();
    const pn = form.get("projectNumber");
    const pn2 = form.get("projectName");
    if(!pn || !pn2) return new Response(JSON.stringify({ error:"project required"}), { status:400, headers:{ "content-type":"application/json" }});

    const t = form.get("typePrefix");
    const n = form.get("partNumber");
    const autoDetect = (form.get("autoDetect")==="true");
    const pk = projectKey(pn, pn2);

    const files = form.getAll("files");
    const out = [];
    for (const f of files) {
      if (!f || !f.name) continue;
      const folder = paths.attachmentsFolder(pk);
      const key = `${folder}${Date.now()}_${f.name}`;
      await env.UPLOADS_BUCKET.put(key, await f.arrayBuffer(), { httpMetadata:{ contentType: f.type || "application/octet-stream" } });
      out.push({ key, name:f.name, size:f.size||null });
    }

    // persist references
    if (n != null && t){
      const parts = await readJSON(env, paths.parts(pk), { items: [] });
      const id = partKey(t, n);
      let p = parts.items.find(x => x.id === id);
      const now = new Date().toISOString();
      if (!p){
        p = { id, t:(t||"P").toUpperCase(), n:Number(n)||0, description:"", notes:"", createdAt:now, updatedAt:now, revs:[], attachments:[], history:[] };
        parts.items.push(p);
      }
      p.attachments = p.attachments || [];
      p.attachments.push(...out);
      p.updatedAt = now;
      p.history = p.history || [];
      p.history.push({ ts: now, event:"attachment:upload", count: out.length });
      await writeJSON(env, paths.parts(pk), parts);
    } else {
      const projAtt = await readJSON(env, paths.attachments(pk), { items: [] });
      projAtt.items.push(...out);
      await writeJSON(env, paths.attachments(pk), projAtt);
    }

    return new Response(JSON.stringify({ ok:true, files: out }), { headers:{ "content-type":"application/json" }});
  } catch (e) {
    return new Response(JSON.stringify({ error:e.message }), { status:500, headers:{ "content-type":"application/json" }});
  }
};
