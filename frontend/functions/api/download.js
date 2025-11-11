export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key) return new Response("Missing key", { status: 400 });

  const obj = await env.UPLOADS_BUCKET.get(key);
  if (!obj) return new Response("Not found", { status: 404 });

  const name = key.split("/").pop() || "file";
  const asAttachment = url.searchParams.get("download") === "1";
  const meta = obj.httpMetadata || {};

  return new Response(obj.body, {
    headers: {
      "Content-Type": meta.contentType || "application/octet-stream",
      "Content-Disposition": `${asAttachment ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": "private, max-age=3600"
    }
  });
}
