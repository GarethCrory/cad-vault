const ORDER_KEY = "data/clientOrder.json";

export async function onRequestGet({ env }) {
  try {
    const obj = await env.UPLOADS_BUCKET.get(ORDER_KEY);
    if (!obj) return json({ order: [] });
    const data = await obj.json().catch(() => ({}));
    const order = Array.isArray(data?.order) ? data.order : Array.isArray(data) ? data : [];
    return json({ order: order.map((name) => String(name || "")).filter(Boolean) });
  } catch (err) {
    return json({ order: [], error: String(err?.message || err) }, { status: 500 });
  }
}

export async function onRequestPost({ env, request }) {
  try {
    const body = await request.json().catch(() => ({}));
    const incoming = Array.isArray(body?.order) ? body.order : [];
    const order = incoming.map((name) => String(name || "")).filter(Boolean);
    await env.UPLOADS_BUCKET.put(
      ORDER_KEY,
      JSON.stringify({ order }, null, 2),
      { httpMetadata: { contentType: "application/json" } }
    );
    return json({ ok: true, order });
  } catch (err) {
    return json({ error: String(err?.message || err) }, { status: 500 });
  }
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" },
    ...init
  });
}
