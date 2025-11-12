import { loadProjects, saveProjects, writeProjectMeta } from '../_projectsUtil.js';

export async function onRequestPost(context){
  try{
    const { env, request } = context;
    const { projectNumber, oldProjectName, newProjectName } = await request.json();

    if(!projectNumber || !newProjectName){
      return new Response(JSON.stringify({ error: 'projectNumber and newProjectName required' }), { status: 400 });
    }

    const db = await loadProjects(env);
    const proj = (db.projects||[]).find(p => String(p.projectNumber) === String(projectNumber));
    if(!proj){
      return new Response(JSON.stringify({ error: 'project not found' }), { status: 404 });
    }

    // Update name, keep projectDir as-is for speed
    proj.projectName = newProjectName;

    await writeProjectMeta(env, proj);
    await saveProjects(env, db);

    return Response.json({ ok: true, project: proj });
  }catch(err){
    return new Response(JSON.stringify({ error: String(err?.message||err) }), { status: 500 });
  }
}
