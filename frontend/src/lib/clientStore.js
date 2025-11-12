import { listClients, saveClient, deleteClientRemote } from "../api";

let cache = [];

export async function fetchClients(){
  try{
    const res = await listClients();
    cache = res.clients || [];
  }catch{
    cache = [];
  }
  return cache;
}

export async function upsertClient(record, options = {}){
  await saveClient({ client: record, originalName: options.originalName });
  return fetchClients();
}

export async function removeClient(name){
  await deleteClientRemote({ name });
  return fetchClients();
}

export function mergeClientRecords(projects = [], savedClients = []){
  const map = new Map();
  projects.forEach(p => {
    const key = (p.client || "Personal Projects").trim() || "Personal Projects";
    if (!map.has(key)){
      map.set(key, {
        name: key,
        contactPerson: p.contactPerson || "",
        email: p.email || "",
        phone: p.phone || "",
        notes: p.notes || "",
        projects: [],
        updatedAt: p.clientUpdatedAt || null,
        source: "project"
      });
    }
    map.get(key).projects.push(p);
  });
  savedClients.forEach(c => {
    const name = c.name?.trim();
    if (!name) return;
    const existing = map.get(name) || { projects: [], source: "remote" };
    map.set(name, {
      ...existing,
      ...c,
      name,
      projects: existing.projects || [],
      source: "remote"
    });
  });
  return Array.from(map.values()).sort((a,b) => a.name.localeCompare(b.name));
}
