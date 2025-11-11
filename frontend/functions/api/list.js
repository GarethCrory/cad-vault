export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const prefix = url.searchParams.get("prefix") || "uploads/";

  const res = await env.UPLOADS_BUCKET.list({ prefix });

  const objects = (res.objects || []).map(o => ({
    key: o.key,
    size: o.size,
    uploaded: o.uploaded,
    etag: o.httpEtag || o.etag
  }));

  return new Response(JSON.stringify({ prefix, objects }), {
    headers: { "Content-Type": "application/json" }
  });
}
