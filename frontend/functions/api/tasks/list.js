export const onRequestPost = async ({ request, env }) => {
  try {
    const { userId = "user-123" } = await request.json().catch(() => ({}));
    const key = `tasks/${userId}.json`;
    const obj = await env.UPLOADS_BUCKET.get(key);
    if (!obj) return new Response(JSON.stringify({ tasks: [], etag: null }), { headers: { "Content-Type": "application/json" } });
    const text = await obj.text();
    let data; try { data = JSON.parse(text); } catch { data = { tasks: [] }; }
    const tasks = Array.isArray(data?.tasks) ? data.tasks : [];
    return new Response(JSON.stringify({ tasks, etag: obj.httpEtag || null }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ message: e.message || "Failed to load tasks" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
