export const PROJECTS_KEY = 'data/projects.json';

function slugify(s=''){
  return String(s).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,64);
}

export async function loadProjects(env){
  const obj = await env.UPLOADS_BUCKET.get(PROJECTS_KEY);
  if(!obj) return { projects: [] };
  try { return await obj.json(); } catch { return { projects: [] }; }
}

export async function saveProjects(env, data){
  await env.UPLOADS_BUCKET.put(
    PROJECTS_KEY,
    JSON.stringify(data, null, 2),
    { httpMetadata: { contentType: 'application/json' } }
  );
}

export function ensureProjectDir(p){
  if (p.projectDir && p.projectDir.length) return p.projectDir;
  const dir = `${p.projectNumber}__${slugify(p.projectName||'project')}`;
  p.projectDir = dir;
  return dir;
}

export async function writeProjectMeta(env, proj){
  const dir = ensureProjectDir(proj);
  const key = `projects/${dir}/meta.json`;
  await env.UPLOADS_BUCKET.put(
    key,
    JSON.stringify(proj, null, 2),
    { httpMetadata: { contentType: 'application/json' } }
  );
}
