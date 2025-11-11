import { readJSON } from "../../_utils.js";
const KEY = "data/projects.json";
const EMPTY = { projects: [], order: [], nextNumber: "001" };

export async function onRequestPost({ env }) {
  const db = await readJSON(env, KEY, EMPTY);
  const order = db.order || [];
  const projects = [...(db.projects || [])];

  // sort by displayOrder first, then by order array if present
  projects.sort((a,b) => {
    const ad = a.displayOrder ?? 1e9;
    const bd = b.displayOrder ?? 1e9;
    if (ad !== bd) return ad - bd;
    const ai = order.indexOf(a.projectNumber);
    const bi = order.indexOf(b.projectNumber);
    return (ai === -1 ? 1e9 : ai) - (bi === -1 ? 1e9 : bi);
  });

  return new Response(JSON.stringify({ projects, order, nextNumber: db.nextNumber || "001" }), {
    headers: { "Content-Type": "application/json" }
  });
}
