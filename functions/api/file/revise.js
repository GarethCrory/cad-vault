const json = (obj, status=200) => new Response(JSON.stringify(obj), { status, headers:{ "content-type":"application/json" }});

function projId(n, name){
  const num = String(n||"000").padStart(3,"0");
  const safe = String(name||"Project").replace(/[^\w.-]+/g,"_");
  return `${num}__${safe}`;
}

export const onRequestPost = async ({ request, env }) => {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return json({ success:false, error:"file missing" }, 400);

  let project = {};
  try { project = JSON.parse(form.get("project") || "{}"); } catch {}

  const typePrefix = String(form.get("typePrefix") || "Part");
  const partNumber = String(form.get("partNumber") || "001");
  const description = String(form.get("description") || "");
  const notes = String(form.get("notes") || "");
  const filename = file.name || "file.step";

  const id = projId(project.projectNumber, project.projectName);
  const key = `projects/${id}/parts/${typePrefix}/${partNumber}/${Date.now()}_${filename}`;

  await env.UPLOADS_BUCKET.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" }
  });

  return json({
    success:true,
    key,
    part: { typePrefix, partNumber, description, notes, filename }
  });
};
