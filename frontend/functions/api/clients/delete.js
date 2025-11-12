import { readJSON, writeJSON } from "../_store.js";

const KEY = "data/clients.json";

export async function onRequestPost({ request, env }) {
  try {
    const { name } = await request.json().catch(() => ({}));
    if (!name) {
      return json({ ok: false, error: "Client name required" }, { status: 400 });
    }
    const data = await readJSON(env, KEY, { clients: [] });
    const list = Array.isArray(data.clients) ? data.clients : [];
    const next = list.filter(c => (c.name || "").toLowerCase() !== String(name).toLowerCase());
    await writeJSON(env, KEY, { clients: next });
    return json({ ok: true, clients: next });
  } catch (err) {
    return json({ ok: false, error: String(err) }, { status: 500 });
  }
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" },
    ...init
  });
}
