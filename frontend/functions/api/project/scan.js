import { projectKey, paths, readJSON } from "../../_store.js";

export const onRequestPost = async ({ request, env }) => {
  const { projectNumber, projectName } = await request.json().catch(() => ({}));
  if (!projectNumber || !projectName) {
    return new Response(JSON.stringify({ ok:false, error:"projectNumber and projectName required" }), { status:400 });
  }
  const pk = projectKey(projectNumber, projectName);

  const partsDoc = await readJSON(env, paths.parts(pk), { parts: [] });
  const revsDoc  = await readJSON(env, paths.revs(pk),  { revs:  [] });

  const parts = Array.isArray(partsDoc.parts) ? partsDoc.parts : [];
  const revs  = Array.isArray(revsDoc.revs)   ? revsDoc.revs   : [];

  return new Response(JSON.stringify({
    ok: true,
    partsCount: parts.length,
    revCount: revs.length,
    parts
  }), { headers:{ "content-type":"application/json" }});
};
