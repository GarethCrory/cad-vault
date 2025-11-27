const JSON_HEADERS = { "Content-Type": "application/json" };

const isBrowser = typeof window !== "undefined";
const devDefault = isBrowser && window.location?.port === "5173"
  ? "http://localhost:4000"
  : "";
const sameOrigin = isBrowser ? window.location.origin : "";
const API_BASE = import.meta?.env?.VITE_API_BASE || sameOrigin || devDefault;

async function post(path, payload = {}) {
  const res = await fetch(`${API_BASE}/api/tasks/${path}`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); if (j?.message) msg = j.message; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export async function listTasks(userId = "user-123") {
  const payload = userId ? { userId } : {};
  const { tasks, etag } = await post("list", payload);
  return { tasks, etag };
}

export async function addTask(data) {
  // data: { userId, title, status, priority, clientId, clientName, projectNumber, projectName, dueDate }
  const out = await post("add", data);
  return out.task;
}

export async function updateTask(data) {
  // data must include id; userId optional
  const out = await post("update", data);
  return out.task;
}

export async function reorderTasks(userId, order) {
  const payload = { order };
  if (userId) payload.userId = userId;
  const out = await post("reorder", payload);
  return !!out.ok;
}

export async function deleteTask(userId, id) {
  const payload = { id };
  if (userId) payload.userId = userId;
  const out = await post("delete", payload);
  return !!out.ok;
}
