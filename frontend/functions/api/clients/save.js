import { readJSON, writeJSON } from "../_store.js";

const KEY = "data/clients.json";

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const record = body?.client || body;
    const originalName = body?.originalName;
    const name = String(record?.name || "").trim();
    if (!name) {
      return json({ ok: false, error: "Client name required" }, { status: 400 });
    }

    const payload = {
      name,
      contactPerson: record.contactPerson || "",
      email: record.email || "",
      phone: record.phone || "",
      notes: record.notes || "",
      updatedAt: new Date().toISOString()
    };

    const data = await readJSON(env, KEY, { clients: [] });
    const list = Array.isArray(data.clients) ? data.clients : [];
    const targetName = originalName ? String(originalName).trim() : name;
    const idx = list.findIndex(c => (c.name || "").toLowerCase() === targetName.toLowerCase());
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...payload };
    } else {
      list.push(payload);
    }
    await writeJSON(env, KEY, { clients: list });
    return json({ ok: true, clients: list });
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
