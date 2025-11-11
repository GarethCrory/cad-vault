import { json, bad } from "../../_utils.js";

export const onRequestPost = async ({ request, env }) => {
  let body = {};
  try { body = await request.json(); } catch {}
  const { projectNumber, projectName } = body || {};
  if (!projectNumber || !projectName) return bad("missing projectNumber/projectName");

  const cleanName = encodeURIComponent(projectName);
  const idxKey = `data/${projectNumber}/${cleanName}/parts.json`;

  let parts = [];
  const obj = await env.UPLOADS_BUCKET.get(idxKey);
  if (obj) {
    try {
      const t = await obj.text();
      const j = JSON.parse(t);
      parts = Array.isArray(j) ? j : (j.parts || []);
    } catch {}
  }

  return json({ ok: true, project: { projectNumber, projectName }, parts });
};
