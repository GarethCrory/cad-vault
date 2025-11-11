const KEY = "cadVault.savedClients";

export function getSavedClients(){
  if (typeof window === "undefined") return [];
  try{
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  }catch{
    return [];
  }
}

export function setSavedClients(list){
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function upsertClient(record, { originalName } = {}){
  const list = getSavedClients();
  let idx = -1;
  if (record.id) {
    idx = list.findIndex(c => c.id === record.id);
  }
  if (idx === -1 && originalName) {
    idx = list.findIndex(c => (c.name || "").toLowerCase() === originalName.toLowerCase());
  }
  if (idx === -1 && record.name) {
    idx = list.findIndex(c => (c.name || "").toLowerCase() === record.name.toLowerCase());
  }
  const payload = {
    ...list[idx],
    ...record,
    id: record.id || (idx >= 0 ? list[idx].id : Date.now()),
    updatedAt: new Date().toISOString(),
    source: "local"
  };
  if (idx >= 0){
    list[idx] = payload;
  }else{
    list.push(payload);
  }
  setSavedClients(list);
  return list;
}

export function deleteClient(name){
  const list = getSavedClients().filter(c => c.name?.toLowerCase() !== name?.toLowerCase());
  setSavedClients(list);
  return list;
}

export const CLIENTS_KEY = KEY;

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
    const existing = map.get(name) || { projects: [], source: "local" };
    map.set(name, {
      ...existing,
      ...c,
      name,
      projects: existing.projects || [],
      source: "local"
    });
  });
  return Array.from(map.values()).sort((a,b) => a.name.localeCompare(b.name));
}
