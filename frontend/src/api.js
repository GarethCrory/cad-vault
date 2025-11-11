const BASE = ""; // same-origin for Cloudflare Pages Functions
export const API_BASE = ""; const BASE = API_BASE;

async function jpost(path, body){
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  if(!r.ok){
    const t = await r.text().catch(()=> "");
    throw new Error(t || "request failed");
  }
  return r.json();
}

export async function listProjects(){
  return jpost("/api/projects/list", {});
}

export async function createProject(payload){
  try{
    return await jpost("/api/projects/create", payload);
  }catch(err){
    const msg = String(err?.message || err || "");
    if (msg.includes("Cannot POST") || msg.includes("404")) {
      return jpost("/api/project/create", payload);
    }
    throw err;
  }
}

export async function updateProjectMeta(payload){
  return jpost("/api/project/meta", payload);
}

export async function deleteProject(payload){
  try{
    return await jpost("/api/project/delete", payload);
  }catch(err){
    const msg = String(err?.message || err || "");
    if (msg.includes("Cannot POST") || msg.includes("404")) {
      return jpost("/api/projects/delete", payload);
    }
    throw err;
  }
}

export async function renameProject(payload){
  return jpost("/api/project/rename", payload);
}

export async function reorderProjects(order){
  return jpost("/api/projects/reorder", { order });
}

export async function scanProject(projectNumber, projectName){
  return jpost("/api/project/scan", { projectNumber, projectName });
}

export async function history({ projectNumber, projectName, typePrefix, partNumber }) {
  const r = await fetch(`${BASE}/api/part/history`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectNumber, projectName, typePrefix, partNumber })
  });
  if (!r.ok) throw new Error(await r.text());
  return await r.json();
}

export async function editPart(p){
  return jpost("/api/part/edit", p);
}

export async function generateRelease(p){
  return jpost("/api/release/generate", p);
}

export async function reviseUpload({ file, projectNumber, projectName, typePrefix, partNumber, description, notes }){
  const fd = new FormData();
  fd.append("file", file);
  fd.append("project", JSON.stringify({ projectNumber, projectName }));
  fd.append("typePrefix", typePrefix);
  fd.append("partNumber", partNumber);
  fd.append("description", description||"");
  fd.append("notes", notes||"");
  const r = await fetch(BASE + "/api/file/revise", { method:"POST", body: fd });
  if(!r.ok){
    const t = await r.text().catch(()=> "");
    throw new Error(t || "upload failed");
  }
  return r.json();
}

export async function bomGet(body){ return jpost("/api/bom/get", body); }
export async function bomUpsert(body){ return jpost("/api/bom/upsert", body); }
export async function bomTree(body){ return jpost("/api/bom/tree", body); }

export async function deletePart(body){
  try{
    return await jpost("/api/part/edit", { ...(body || {}), action: "delete" });
  }catch(err){
    const message = err?.message || "";
    if (typeof window !== "undefined" && (message.includes("Cannot POST") || message.includes("404"))) {
      const res = await fetch(`${BASE}/api/part/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(body || {}), action: "delete" })
      });
      if (res.ok) return res.json();
    }
    throw err;
  }
}

export async function listAttachments(payload){ return jpost("/api/attachment/list", payload); }
export async function deleteAttachment(payload){ return jpost("/api/attachment/delete", payload); }

export async function uploadAttachments({ projectNumber, projectName, typePrefix, partNumber, files, autoDetect = false }) {
  const form = new FormData();
  form.append("projectNumber", projectNumber);
  form.append("projectName", projectName);
  if (typePrefix) form.append("typePrefix", typePrefix);
  if (typeof partNumber !== "undefined" && partNumber !== null) form.append("partNumber", partNumber);
  form.append("autoDetect", autoDetect ? "true" : "false");
  (files || []).forEach(file => form.append("files", file));
  const res = await fetch(`${API_BASE}/api/attachment/upload`, { method: "POST", body: form });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Attachment upload failed");
  }
  return res.json();
}
