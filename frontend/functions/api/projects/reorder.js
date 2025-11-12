import { loadProjects, saveProjects } from '../_projectsUtil.js';

export async function onRequestPost(context){
  try{
    const { env, request } = context;
    const { order } = await request.json();
    if(!Array.isArray(order)) return new Response(JSON.stringify({ error:'order array required' }), { status: 400 });

    const db = await loadProjects(env);
    const byNumber = new Map((db.projects||[]).map(p => [String(p.projectNumber), p]));

    for(const item of order){
      const num = String(item.projectNumber);
      const p = byNumber.get(num);
      if(p) p.displayOrder = Number(item.displayOrder)||0;
    }

    // sort and save snapshot order for consistency
    db.projects.sort((a,b) => (a.displayOrder||0) - (b.displayOrder||0));

    await saveProjects(env, db);
    return Response.json({ ok:true });
  }catch(err){
    return new Response(JSON.stringify({ error: String(err?.message||err) }), { status: 500 });
  }
}
