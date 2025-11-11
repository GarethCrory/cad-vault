import { readJSON } from "../../_utils.js";

const KEY = "data/projects.json";
const EMPTY = { projects: [], order: [], nextNumber: "001" };

export async function onRequestPost({ env }) {
  const db = await readJSON(env, KEY, EMPTY);
  return new Response(JSON.stringify(db), { headers: { "Content-Type": "application/json" }});
}
