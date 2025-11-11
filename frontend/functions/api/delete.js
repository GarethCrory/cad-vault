export async function onRequestPost({ request, env }) {
  const { key } = await request.json().catch(() => ({}));
  if (!key) return new Response("Missing key", { status: 400 });

  await env.UPLOADS_BUCKET.delete(key);
  return new Response(JSON.stringify({ success: true, key }), {
    headers: { "Content-Type": "application/json" }
  });
}
