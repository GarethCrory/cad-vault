const BASE = "http://localhost:4000";

async function jpost(path, body){
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body||{})
  });
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function listProjects(){
  return jpost("/api/projects/list", {});
}

export async function scanProject(projectNumber, projectName){
  return jpost("/api/project/scan", { projectNumber, projectName });
}

export async function history(p){
  return jpost("/api/part/history", p);
}

export async function editPart(p){
  const r = await fetch(BASE + "/api/part/edit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p)
  });
  if(!r.ok) throw new Error(await r.text());
  return r.json();
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
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}
