const json = (obj, status=200) => new Response(JSON.stringify(obj), { status, headers:{ "content-type":"application/json" }});

function projId(n, name){
  const num = String(n||"000").padStart(3,"0");
  const safe = String(name||"Project").replace(/[^\w.-]+/g,"_");
  return `${num}__${safe}`;
}

export const onRequestPost = async ({ request, env }) => {
  const { projectNumber, projectName } = await request.json();
  const prefix = `projects/${projId(projectNumber, projectName)}/parts/`;
  const list = await env.UPLOADS_BUCKET.list({ prefix });

  const parts = list.objects.map(o => {
    const key = o.key;
    const seg = key.split("/");
    // projects/<id>/parts/<type>/<part>/.../<filename>
    const typePrefix = seg[3] || "Part";
    const partNumber = seg[4] || "001";
    const filename = seg[seg.length-1];
    return { typePrefix, partNumber, filename, key, size:o.size, uploaded:o.uploaded?.toISOString?.() };
  });

  return json({ success:true, parts });
};
