import { projectKey, paths, readJSON, writeJSON } from "../_store.js";

export const onRequestPost = async ({ request, env }) => {
  const { projectNumber, projectName } = await request.json().catch(() => ({}));
  if (!projectNumber || !projectName) {
    return new Response(JSON.stringify({ ok:false, error:"projectNumber and projectName required" }), { status:400 });
  }

  const pk = projectKey(projectNumber, projectName);

  // load current docs
  const partsDoc = await readJSON(env, paths.parts(pk), { parts: [] });
  const revsDoc  = await readJSON(env, paths.revs(pk),  { revs:  [] });

  const parts = Array.isArray(partsDoc.parts) ? partsDoc.parts : [];
  const revs  = Array.isArray(revsDoc.revs)   ? revsDoc.revs   : [];

  // persist latest count to meta so list shows correctly
  try {
    const metaPath = paths.meta(pk);
    const meta = await readJSON(env, metaPath, {});
    meta.partCount = parts.length;
    meta.updatedAt = new Date().toISOString();
    await writeJSON(env, metaPath, meta);
  } catch (e) {
    // non-fatal — still return the scan result
    console.warn("scan: unable to update meta", e);
  }

  return new Response(JSON.stringify({
    ok: true,
    partsCount: parts.length,
    revCount: revs.length,
    parts
  }), { headers:{ "content-type":"application/json" }});
};
