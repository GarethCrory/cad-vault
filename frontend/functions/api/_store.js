/** R2 storage helpers and paths */
export const projectKey = (n, name="Untitled") =>
  `${String(n||"000").padStart(3,"0")}__${encodeURIComponent(name||"Untitled")}`;

const jsonHeaders = { "content-type": "application/json" };

export async function readJSON(env, key, fallback){
  const obj = await env.UPLOADS_BUCKET.get(key);
  if(!obj) return structuredClone(fallback);
  const txt = await obj.text();
  try { return JSON.parse(txt); } catch { return structuredClone(fallback); }
}

export async function writeJSON(env, key, value){
  await env.UPLOADS_BUCKET.put(key, JSON.stringify(value, null, 2), { httpMetadata:{ contentType: "application/json" }});
}

export const paths = {
  projects: () => `data/projects.json`,
  parts: (pk) => `data/projects/${pk}/parts.json`,
  bom: (pk) => `data/projects/${pk}/bom.json`,
  attachments: (pk) => `data/projects/${pk}/attachments.json`,
  partFolder: (pk, t, p) => `projects/${pk}/parts/${t||"P"}_${String(p).padStart(3,"0")}/`,
  projectRoot: (pk) => `projects/${pk}/`,
  attachmentsFolder: (pk) => `projects/${pk}/attachments/`,
};

export function partKey(t, p){
  return `${(t||"P").toUpperCase()}_${String(p||0).padStart(3,"0")}`;
}
