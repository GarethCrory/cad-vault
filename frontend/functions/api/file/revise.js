export const onRequestPost = async ({ request, env }) => {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const projRaw = form.get("project");
    const project = projRaw ? JSON.parse(projRaw) : {};
    if (!file || typeof file.stream !== "function") {
      return new Response(JSON.stringify({ ok: false, error: "no file" }), { status: 400 });
    }

    const safeName = (file.name || "part.step").replace(/\s+/g, "_");
    const key = [
      "projects",
      project.projectNumber || "unknown",
      "parts",
      `${Date.now()}_${safeName}`
    ].join("/");

    await env.UPLOADS_BUCKET.put(key, file.stream(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" }
    });

    return new Response(JSON.stringify({ ok: true, key }), {
      headers: { "content-type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
};
