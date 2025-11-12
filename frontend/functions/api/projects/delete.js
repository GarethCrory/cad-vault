/**
 * Delete a project and purge any R2 objects under projects/<projectNumber>__*
 * Body: { projectNumber, projectName? }
 */
export const onRequestPost = async ({ request, env }) => {
  try {
    const { projectNumber, projectName } = await request.json();

    if (!projectNumber) {
      return new Response(JSON.stringify({ error: "projectNumber required" }), {
        status: 400, headers: { "content-type": "application/json" }
      });
    }

    const bucket = env.UPLOADS_BUCKET;
    const listKey = "data/projects.json";

    // Load projects list
    let db = { projects: [] };
    const obj = await bucket.get(listKey);
    if (obj) {
      try { db = JSON.parse(await obj.text() || "{}"); } catch { db = { projects: [] }; }
    }

    const idx = (db.projects || []).findIndex(
      p => String(p.projectNumber) === String(projectNumber)
    );
    if (idx === -1) {
      return new Response(JSON.stringify({ error: "project not found" }), {
        status: 404, headers: { "content-type": "application/json" }
      });
    }

    const removed = db.projects.splice(idx, 1)[0];

    // Save updated list
    await bucket.put(listKey, JSON.stringify(db, null, 2), {
      httpMetadata: { contentType: "application/json" }
    });

    // Best-effort clean-up of project files in R2
    const safeName = (projectName || removed?.projectName || "").toString();
    const prefA = `projects/${projectNumber}__`;         // typical prefix
    const prefB = `projects/${projectNumber}/`;          // fallback shape
    const prefC = removed?.projectDir ? `projects/${removed.projectDir}` : null;

    async function deleteByPrefix(prefix){
      if (!prefix) return;
      let cursor;
      do {
        const res = await bucket.list({ prefix, cursor });
        for (const o of res.objects || []) {
          await bucket.delete(o.key);
        }
        cursor = res.truncated ? res.cursor : undefined;
      } while (cursor);
    }

    await deleteByPrefix(prefC);
    await deleteByPrefix(prefA);
    await deleteByPrefix(prefB);

    return new Response(JSON.stringify({ ok: true, removed: { projectNumber, projectName: removed?.projectName } }), {
      status: 200, headers: { "content-type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || "server error" }), {
      status: 500, headers: { "content-type": "application/json" }
    });
  }
};
