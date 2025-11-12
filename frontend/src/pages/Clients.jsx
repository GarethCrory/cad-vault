import React, { useCallback, useEffect, useMemo, useState } from "react";
import { listProjects, updateProjectMeta } from "../api.js";
import { BuildingOfficeIcon, EnvelopeIcon, PhoneIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { fetchClients, mergeClientRecords, removeClient, upsertClient } from "../lib/clientStore.js";

const CLIENT_ORDER_STORE = "cadVault.clientOrder.v1";

function readClientOrder(){
  if (typeof window === "undefined") return [];
  try{
    const raw = window.localStorage.getItem(CLIENT_ORDER_STORE);
    return raw ? JSON.parse(raw) : [];
  }catch{
    return [];
  }
}

function writeClientOrder(order = []){
  if (typeof window === "undefined") return;
  try{
    window.localStorage.setItem(CLIENT_ORDER_STORE, JSON.stringify(order));
  }catch{
    /* noop */
  }
}

export default function Clients(){
  const [projects, setProjects] = useState([]);
  const [savedClients, setSavedClients] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [clientOrder, setClientOrder] = useState(() => readClientOrder());
  const [draggingClient, setDraggingClient] = useState(null);

  const loadProjects = useCallback(async () => {
    try{
      const res = await listProjects();
      setProjects(res.projects || []);
    }catch{
      setProjects([]);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const loadClients = useCallback(async () => {
    const list = await fetchClients().catch(() => []);
    setSavedClients(list);
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  useEffect(() => {
    writeClientOrder(clientOrder);
  }, [clientOrder]);

  const baseClients = useMemo(() => mergeClientRecords(projects, savedClients), [projects, savedClients]);

  const clientCards = useMemo(() => {
    let arr = baseClients;
    if(search.trim()){
      const needle = search.toLowerCase();
      arr = arr.filter(c => `${c.name} ${c.contactPerson} ${c.email}`.toLowerCase().includes(needle));
    }
    return arr;
  }, [baseClients, search]);

  useEffect(() => {
    setClientOrder(prev => {
      const incoming = baseClients.map(c => c.name);
      const incomingSet = new Set(incoming);
      const filtered = prev.filter(name => incomingSet.has(name));
      let changed = filtered.length !== prev.length;
      incoming.forEach(name => {
        if (!filtered.includes(name)) {
          filtered.push(name);
          changed = true;
        }
      });
      return changed ? filtered : prev;
    });
  }, [baseClients]);

  const orderedClients = useMemo(() => {
    if (!clientCards.length) return clientCards;
    const orderIndex = new Map(clientOrder.map((name, idx) => [name, idx]));
    return [...clientCards].sort((a, b) => {
      const aIdx = orderIndex.has(a.name) ? orderIndex.get(a.name) : Number.MAX_SAFE_INTEGER;
      const bIdx = orderIndex.has(b.name) ? orderIndex.get(b.name) : Number.MAX_SAFE_INTEGER;
      if (aIdx !== bIdx) return aIdx - bIdx;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [clientCards, clientOrder]);

  const totalClients = clientCards.length;
  const activeProjects = projects.length;

  async function handleAddClient(data){
    await upsertClient(data);
    loadClients();
  }

  const handleEditClient = useCallback(async (data, originalName) => {
    const targetOriginal = originalName || editingClient?.name || "";
    await upsertClient(data, { originalName: targetOriginal });
    await loadClients();
    const newName = data?.name?.trim();
    if (targetOriginal && newName && newName !== targetOriginal) {
      const affected = projects.filter(
        (p) => (p.client || "Personal Projects").trim() === targetOriginal
      );
      if (affected.length) {
        await Promise.all(
          affected.map((proj) =>
            updateProjectMeta({
              projectNumber: proj.projectNumber,
              projectName: proj.projectName,
              client: newName,
              contactPerson: data.contactPerson || proj.contactPerson || "",
              email: data.email || proj.email || "",
              phone: data.phone || proj.phone || "",
              notes: data.notes || proj.notes || "",
            })
          )
        );
        await loadProjects();
      }
      setClientOrder((prev) =>
        prev.map((name) => (name === targetOriginal ? newName : name))
      );
    }
  }, [editingClient?.name, projects, loadProjects]);

  async function handleDeleteClient(name){
    if(!window.confirm(`Delete ${name}? This only removes your local note.`)) return;
    await removeClient(name);
    loadClients();
  }

  function handleClientDragStart(e, name){
    setDraggingClient(name);
    if (e?.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", name); } catch {}
    }
  }

  function handleClientDragOver(e){
    if (e?.preventDefault) e.preventDefault();
    if (e?.dataTransfer) e.dataTransfer.dropEffect = "move";
  }

  function handleClientDragEnter(targetName){
    if (!draggingClient || draggingClient === targetName) return;
    setClientOrder(prev => {
      const fromIndex = prev.indexOf(draggingClient);
      const toIndex = prev.indexOf(targetName);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function handleClientDrop(e){
    if (e?.preventDefault) e.preventDefault();
    setDraggingClient(null);
  }

  function handleClientDragEnd(){
    setDraggingClient(null);
  }

  return (
    <div className="page-container compact">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold">Clients</h1>
            <div className="text-sm text-slate-500 mt-1">Manage your client relationships</div>
          </div>
          <button className="btn btn-primary" onClick={()=>setShowModal(true)}>+ New Client</button>
        </div>

        <div className="card p-6 flex flex-wrap items-center justify-between gap-6">
          <div className="flex-1 min-w-[240px]">
            <input
              className="input w-full"
              placeholder="Search clients by name, contact, or email..."
              value={search}
              onChange={e=>setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-8 text-sm text-slate-500">
            <div><span className="text-2xl font-bold text-slate-900">{totalClients}</span><br/>Total Clients</div>
            <div><span className="text-2xl font-bold text-orange-500">{activeProjects}</span><br/>Active Projects</div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Drag cards to reorder clients.</span>
          {draggingClient && <span className="text-indigo-600">Moving {draggingClient}</span>}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" onDragOver={handleClientDragOver} onDrop={handleClientDrop}>
          {orderedClients.map(client => (
            <ClientCard
              key={client.name}
              client={client}
              onEdit={() => setEditingClient(client)}
              onDelete={() => handleDeleteClient(client.name)}
              canDelete={client.source !== "project"}
              isDragging={draggingClient === client.name}
              dragHandlers={{
                draggable: true,
                onDragStart: (e) => handleClientDragStart(e, client.name),
                onDragOver: handleClientDragOver,
                onDragEnter: () => handleClientDragEnter(client.name),
                onDrop: handleClientDrop,
                onDragEnd: handleClientDragEnd
              }}
            />
          ))}
          {orderedClients.length === 0 && (
            <div className="card p-6 text-sm text-slate-500">No clients yet. Use the New Client button to add one.</div>
          )}
        </div>
      </div>

      {showModal && (
        <NewClientModal onClose={()=>setShowModal(false)} onSave={handleAddClient} />
      )}
      {editingClient && (
        <NewClientModal
          onClose={()=>setEditingClient(null)}
          onSave={handleEditClient}
          initialClient={editingClient}
          mode="edit"
        />
      )}
    </div>
  );
}

function ClientCard({ client, onEdit, onDelete, canDelete, dragHandlers = {}, isDragging = false }){
  const projectCount = client.projects?.length || 0;
  const updatedText = client.updatedAt ? new Date(client.updatedAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }) : "";
  return (
    <div
      className={`card p-6 flex flex-col h-full relative group cursor-grab transition-opacity ${isDragging ? "ring-2 ring-indigo-300 bg-slate-50 opacity-0" : "opacity-100"}`}
      draggable={dragHandlers.draggable}
      onDragStart={dragHandlers.onDragStart}
      onDragOver={dragHandlers.onDragOver}
      onDragEnter={dragHandlers.onDragEnter}
      onDrop={dragHandlers.onDrop}
      onDragEnd={dragHandlers.onDragEnd}
      aria-grabbed={isDragging}
    >
      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition">
        <button type="button" className="btn-ghost p-2 rounded-full" title="Edit client" onClick={onEdit}>
          <PencilSquareIcon className="h-5 w-5" />
        </button>
        {canDelete && (
          <button type="button" className="btn-ghost p-2 rounded-full text-red-500" title="Delete client" onClick={onDelete}>
            <TrashIcon className="h-5 w-5" />
          </button>
        )}
      </div>
      <div className="flex items-start gap-4 flex-1">
        <div className="h-12 w-12 rounded-2xl bg-blue-100 text-blue-700 grid place-items-center">
          <BuildingOfficeIcon className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <div>
            <div className="text-lg font-semibold">{client.name}</div>
            {client.contactPerson && <div className="text-sm text-slate-500">{client.contactPerson}</div>}
          </div>
          <div className="space-y-1 text-sm text-slate-600">
            {client.email && <div className="flex items-center gap-2"><EnvelopeIcon className="h-4 w-4" />{client.email}</div>}
            {client.phone && <div className="flex items-center gap-2"><PhoneIcon className="h-4 w-4" />{client.phone}</div>}
          </div>
          {client.notes && <div className="text-xs text-slate-500 mt-2">{client.notes}</div>}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <div><strong>{projectCount}</strong> projects</div>
        {updatedText && <div className="text-xs">Updated {updatedText}</div>}
      </div>
    </div>
  );
}

function NewClientModal({ onClose, onSave, initialClient = null, mode = "add" }){
  const isEdit = mode === "edit" || Boolean(initialClient);
  const [name, setName] = useState(initialClient?.name || "");
  const [contactPerson, setContactPerson] = useState(initialClient?.contactPerson || "");
  const [email, setEmail] = useState(initialClient?.email || "");
  const [phone, setPhone] = useState(initialClient?.phone || "");
  const [notes, setNotes] = useState(initialClient?.notes || "");
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialClient) {
      setName(initialClient.name || "");
      setContactPerson(initialClient.contactPerson || "");
      setEmail(initialClient.email || "");
      setPhone(initialClient.phone || "");
      setNotes(initialClient.notes || "");
    }
  }, [initialClient]);

  async function handleSubmit(e){
    e.preventDefault();
    if(!name.trim()){
      setError("Client name is required");
      return;
    }
    await onSave({ ...initialClient, name: name.trim(), contactPerson, email, phone, notes }, initialClient?.name);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 grid place-items-center px-4">
      <div className="card w-full max-w-lg p-6 relative">
        <button className="btn-ghost absolute right-4 top-4 text-sm" onClick={onClose}>✕</button>
        <h2 className="text-2xl font-extrabold mb-4 flex items-center gap-2">
          <UserIcon />
          {isEdit ? "Edit Client" : "Add New Client"}
        </h2>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-xs font-semibold text-slate-500">Client Name *</label>
            <input className="input mt-1" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Acme Corporation" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Contact Person</label>
            <input className="input mt-1" value={contactPerson} onChange={e=>setContactPerson(e.target.value)} placeholder="e.g. John Smith" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500">Email</label>
              <input className="input mt-1" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Phone</label>
              <input className="input mt-1" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+44 20 1234 5678" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Notes</label>
            <textarea className="input mt-1 h-24" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Additional information about this client..." />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex items-center gap-3 justify-end">
            <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" type="submit">{isEdit ? "Save Changes" : "Add Client"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UserIcon(){
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0115 0"/>
    </svg>
  );
}
