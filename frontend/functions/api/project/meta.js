export const onRequestPost = async ({ request, env }) => {
  try {
    const {
      projectNumber,
      projectName,     // current name (not changing here)
      client,
      contactPerson,
      email,
      phone,
      notes
    } = await request.json();

    if (!projectNumber) {
      return new Response(JSON.stringify({ error: "projectNumber required" }), { status: 400 });
    }

    const bucket = env.UPLOADS_BUCKET;             // R2 binding
    const key = "data/projects.json";

    // Load existing projects
    let list = { projects: [] };
    const obj = await bucket.get(key);
    if (obj) {
      const text = await obj.text();
      try { list = JSON.parse(text || "{}"); } catch { list = { projects: [] }; }
    }

    // Find by projectNumber
    const idx = (list.projects || []).findIndex(p => String(p.projectNumber) === String(projectNumber));
    if (idx === -1) {
      return new Response(JSON.stringify({ error: "project not found" }), { status: 404 });
    }

    const prev = list.projects[idx] || {};
    const updated = {
      ...prev,
      projectNumber: prev.projectNumber ?? projectNumber,
      projectName: projectName ?? prev.projectName,
      client: typeof client === "string" ? client : prev.client,
      contactPerson: typeof contactPerson === "string" ? contactPerson : prev.contactPerson,
      email: typeof email === "string" ? email : prev.email,
      phone: typeof phone === "string" ? phone : prev.phone,
      notes: typeof notes === "string" ? notes : prev.notes,
      updatedAt: new Date().toISOString()
    };

    list.projects[idx] = updated;

    await bucket.put(key, JSON.stringify(list, null, 2), {
      httpMetadata: { contentType: "application/json" }
    });

    return new Response(JSON.stringify({ ok: true, project: updated }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || "server error" }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
};
