import { json, bad } from "../../_utils.js";

export const onRequestPost = async ({ request, env }) => {
  const form = await request.formData();

  const file = form.get("file");
  if (!file || typeof file.stream !== "function") return bad("missing file");

  // project can arrive as JSON string OR discrete fields
  let project = {};
  try { project = JSON.parse(form.get("project") || "{}"); } catch {}
  const projectNumber = form.get("projectNumber") || project.projectNumber;
  const projectName  = form.get("projectName")  || project.projectName;
  if (!projectNumber || !projectName) return bad("missing projectNumber/projectName");

  const typePrefix = form.get("typePrefix") || "P";
  const partNumber = form.get("partNumber") || "001";
  const description = form.get("description") || "";
  const notes = form.get("notes") || "";

  const cleanName = encodeURIComponent(projectName);
  const ts = Date.now();

  // store STEP
  const stepKey = `parts/${projectNumber}/${cleanName}/${typePrefix}-${partNumber}-${ts}.step`;
  await env.UPLOADS_BUCKET.put(stepKey, file.stream(), {
    httpMetadata: { contentType: "model/step" }
  });

  // load/update parts index
  const idxKey = `data/${projectNumber}/${cleanName}/parts.json`;
  let parts = [];
  const existing = await env.UPLOADS_BUCKET.get(idxKey);
  if (existing) {
    try {
      const t = await existing.text();
      const j = JSON.parse(t);
      parts = Array.isArray(j) ? j : (j.parts || []);
    } catch {}
  }

  const part = {
    id: `${typePrefix}-${partNumber}`,
    typePrefix,
    partNumber,
    description,
    notes,
    size: file.size ?? null,
    key: stepKey,
    uploadedAt: new Date(ts).toISOString()
  };
  parts.push(part);

  await env.UPLOADS_BUCKET.put(
    idxKey,
    JSON.stringify({ parts }, null, 2),
    { httpMetadata: { contentType: "application/json" } }
  );

  return json({ ok: true, part });
};
