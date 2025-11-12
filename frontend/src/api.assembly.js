import { API_BASE } from "./api.js";

const BASE = API_BASE || "";

async function postJSON(path, payload) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {})
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Assembly request failed");
  }
  return res.json();
}

export function listAssembly({ projectNumber, projectName, typePrefix, partNumber }) {
  return postJSON("/api/assembly/list", { projectNumber, projectName, typePrefix, partNumber });
}

export function linkAssembly({ projectNumber, projectName, parent, child, qty }) {
  return postJSON("/api/assembly/link", { projectNumber, projectName, parent, child, qty });
}

export function unlinkAssembly({ projectNumber, projectName, parent, child }) {
  return postJSON("/api/assembly/unlink", { projectNumber, projectName, parent, child });
}

export function updateAssemblyQty({ projectNumber, projectName, parent, child, qty }) {
  return postJSON("/api/assembly/updateQty", { projectNumber, projectName, parent, child, qty });
}
