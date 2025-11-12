import { projectKey, paths, readJSON, writeJSON, partKey } from "../_store.js";

export const onRequestPost = async ({ request, env }) => {
  try{
    const form = await request.formData();
    const file = form.get("file");
    if(!file || !file.name) return new Response(JSON.stringify({ error:"file required"}), { status:400, headers:{ "content-type":"application/json" }});

    const metaProject = form.get("project");
    let proj = {};
    if (metaProject) {
      try { proj = JSON.parse(metaProject); } catch { proj = {}; }
    }
    const projectNumber = proj.projectNumber || form.get("projectNumber") || form.get("project_number");
    const projectName = proj.projectName || form.get("projectName") || form.get("project_name");
    const typePrefix = form.get("typePrefix") || "P";
    const partNumber = form.get("partNumber");
    const description = form.get("description") || "";
    const notes = form.get("notes") || "";
    const revTag = form.get("rev") || "RevA";

    if(!projectNumber || !projectName || !partNumber){
      return new Response(JSON.stringify({ error:"projectNumber, projectName and partNumber required"}), { status:400, headers:{ "content-type":"application/json" }});
    }

    const pk = projectKey(projectNumber, projectName);
    const id = partKey(typePrefix, partNumber);
    const folder = paths.partFolder(pk, typePrefix, partNumber);
    const ts = Date.now();
    const key = `${folder}${ts}_${file.name}`;

    await env.UPLOADS_BUCKET.put(key, await file.arrayBuffer(), { httpMetadata:{ contentType: file.type || "application/octet-stream" }});

    // update parts store with the new revision
    const partsKey = paths.parts(pk);
    const parts = await readJSON(env, partsKey, { items: [] });
    let part = parts.items.find(p => p.id === id);
    const now = new Date().toISOString();

    if(!part){
      part = { id, t:(typePrefix||"P").toUpperCase(), n:Number(partNumber)||0, description:"", notes:"", createdAt:now, updatedAt:now, revs:[], attachments:[], history:[] };
      parts.items.push(part);
    }
    if (description) part.description = description;
    if (notes) part.notes = notes;
    part.revs = part.revs || [];
    part.revs.push({ key, name:file.name, size:file.size||null, uploadedAt: now, rev: revTag });
    part.updatedAt = now;
    part.history = part.history || [];
    part.history.push({ ts: now, event:"revise:upload", file:file.name, rev: revTag, description });

    await writeJSON(env, partsKey, parts);

    return new Response(JSON.stringify({ ok:true, key, rev: revTag }), { headers:{ "content-type":"application/json" }});
  }catch(e){
    return new Response(JSON.stringify({ error:String(e?.message||e) }), { status:500, headers:{ "content-type":"application/json" }});
  }
};
