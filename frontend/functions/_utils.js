export async function readJSON(env, key, fallback) {
  const obj = await env.UPLOADS_BUCKET.get(key);
  if (!obj) return fallback;
  try { return JSON.parse(await obj.text()); } catch { return fallback; }
}
export async function writeJSON(env, key, data) {
  await env.UPLOADS_BUCKET.put(key, JSON.stringify(data, null, 2), {
    httpMetadata: { contentType: "application/json" },
  });
}
