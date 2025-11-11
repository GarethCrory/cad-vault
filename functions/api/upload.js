export async function onRequestPost(context) {
  const { request, env } = context;
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file) {
    return new Response("No file uploaded", { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const key = `uploads/${Date.now()}_${file.name}`;
  await env.UPLOADS_BUCKET.put(key, arrayBuffer);

  return new Response(JSON.stringify({ success: true, key }), {
    headers: { "Content-Type": "application/json" },
  });
}
