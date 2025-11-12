export const PROJECTS_DOC = "data/projects.json";

function j(body, status = 200){
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type":"application/json", "cache-control":"no-store" }
  });
}

export async function readProjects(env){
  const obj = await env.UPLOADS_BUCKET.get(PROJECTS_DOC);
  if(!obj) return [];
  try{
    const text = await obj.text();
    const parsed = JSON.parse(text);
    return Array.isArray(parsed?.projects) ? parsed.projects
         : Array.isArray(parsed) ? parsed
         : [];
  }catch{ return []; }
}

export async function writeProjects(env, list){
  const body = JSON.stringify({ projects: list }, null, 2);
  await env.UPLOADS_BUCKET.put(PROJECTS_DOC, body, { httpMetadata:{ contentType:"application/json" }});
}

export function projectId(p){
  const num = String(p.projectNumber||"").trim();
  const name = String(p.projectName||"").trim();
  return `${num}__${name}`.replace(/\s+/g,"_");
}

export async function ensureProjectPrefix(env, p){
  const key = `projects/${projectId(p)}/.keep`;
  await env.UPLOADS_BUCKET.put(key, new Uint8Array(0));
}

export { j };
