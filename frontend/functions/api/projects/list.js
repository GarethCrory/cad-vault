export async function onRequestGet(ctx) { return handle(ctx); }
export async function onRequestPost(ctx) { return handle(ctx); }

async function handle({ env }) {
  try {
    const obj = await env.UPLOADS_BUCKET.get("data/projects.json");
    let projects = [];
    if (obj) {
      const txt = await obj.text();
      try {
        const parsed = JSON.parse(txt);
        projects = Array.isArray(parsed?.projects) ? parsed.projects : (parsed || []);
      } catch {
        projects = [];
      }
    }
    return json({ projects });
  } catch (err) {
    // Never block the UI — return an empty list with the error for visibility
    return json({ projects: [], error: String(err) });
  }
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" },
    ...init
  });
}
