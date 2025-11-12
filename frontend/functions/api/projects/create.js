export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const required = ["projectNumber", "projectName"];
    for (const k of required) {
      if (!String(body[k] || "").trim()) {
        return json({ ok: false, error: `Missing ${k}` }, { status: 400 });
      }
    }

    const projectNumber = String(body.projectNumber).trim();
    const projectName = String(body.projectName).trim();
    const client = String(body.client || "Personal Projects").trim();
    const contactPerson = String(body.contactPerson || "");
    const email = String(body.email || "");
    const phone = String(body.phone || "");
    const notes = String(body.notes || "");

    const projectDir = `${projectNumber}__${slug(projectName)}`;

    // Load current list
    const listObj = await env.UPLOADS_BUCKET.get("data/projects.json");
    let projects = [];
    if (listObj) {
      try { projects = JSON.parse(await listObj.text()).projects || []; } catch {}
    }

    // Duplicate guard
    if (projects.some(p => p.projectNumber === projectNumber)) {
      return json({ ok: false, error: "Project number already exists" }, { status: 409 });
    }

    const meta = {
      projectNumber,
      projectName,
      client,
      contactPerson,
      email,
      phone,
      notes,
      active: true,
      partCount: 0,
      displayOrder: projects.length, // append at end
      created: new Date().toISOString(),
      projectDir
    };

    // Persist meta under the project folder
    await env.UPLOADS_BUCKET.put(
      `projects/${projectDir}/meta.json`,
      JSON.stringify(meta, null, 2),
      { httpMetadata: { contentType: "application/json" } }
    );

    // Update the aggregated list
    const next = { projects: [...projects, meta] };
    await env.UPLOADS_BUCKET.put(
      "data/projects.json",
      JSON.stringify(next, null, 2),
      { httpMetadata: { contentType: "application/json" } }
    );

    return json({ ok: true, project: meta });
  } catch (err) {
    return json({ ok: false, error: String(err) }, { status: 500 });
  }
}

function slug(s) {
  return s
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" },
    ...init
  });
}
