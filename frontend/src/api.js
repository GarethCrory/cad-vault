import { getStoredToken } from "./utils/authStorage.js";

export const API_BASE = ""; const BASE = API_BASE;

function authHeaders(base = {}) {
  const token = getStoredToken();
  const headers = { ...base };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

function notifyUnauthorised(status) {
  if (status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("cv:unauthorised"));
  }
}

async function readJsonResponse(response) {
  if (!response.ok) {
    notifyUnauthorised(response.status);
    let text = await response.text().catch(() => "");
    if (text) {
      try {
        const data = JSON.parse(text);
        if (data && data.error) {
          text = data.error;
        }
      } catch {
        // plain text fallback
      }
    }
    throw new Error(text || "request failed");
  }
  return response.json();
}

async function jpost(path, body){
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body || {})
  });
  return readJsonResponse(r);
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
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ projectNumber, projectName, typePrefix, partNumber })
  });
  return readJsonResponse(r);
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
  const r = await fetch(BASE + "/api/file/revise", { method:"POST", body: fd, headers: authHeaders() });
  return readJsonResponse(r);
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
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ ...(body || {}), action: "delete" })
      });
      if (!res.ok) {
        notifyUnauthorised(res.status);
        const text = await res.text().catch(() => "");
        throw new Error(text || "request failed");
      }
      return res.json();
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
  const res = await fetch(`${API_BASE}/api/attachment/upload`, { method: "POST", body: form, headers: authHeaders() });
  return readJsonResponse(res);
}

export async function listClients(){
  return jpost("/api/clients/list", {});
}

export async function saveClient(payload){
  return jpost("/api/clients/save", payload);
}

export async function deleteClientRemote(payload){
  return jpost("/api/clients/delete", payload);
}

export async function getClientOrder(){
  const res = await fetch(BASE + "/api/clients/order", { method: "GET", headers: authHeaders() });
  return readJsonResponse(res);
}

export async function saveClientOrderRemote(order = []){
  return jpost("/api/clients/order", { order });
}

export async function loginRequest(payload){
  return jpost("/api/auth/login", payload);
}

export async function logoutRequest(){
  return jpost("/api/auth/logout", {});
}

export async function fetchCurrentUser(){
  const res = await fetch(BASE + "/api/auth/me", { method: "GET", headers: authHeaders() });
  return readJsonResponse(res);
}
