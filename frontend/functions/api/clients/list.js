import { readJSON } from "../_store.js";

const KEY = "data/clients.json";

export async function onRequestGet(ctx) { return handle(ctx); }
export async function onRequestPost(ctx) { return handle(ctx); }

async function handle({ env }) {
  const data = await readJSON(env, KEY, { clients: [] });
  const clients = Array.isArray(data.clients) ? data.clients : [];
  return json({ clients });
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" },
    ...init
  });
}
