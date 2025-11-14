import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createProject, deleteProject as apiDeleteProject, listProjects, updateProjectMeta, renameProject, reorderProjects } from "../api.js";
import { fetchClients, mergeClientRecords, upsertClient } from "../lib/clientStore.js";
import { FolderIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";

function projectKey(project, fallbackIndex = 0){
  if (project?.projectDir) return project.projectDir;
  const number = project?.projectNumber ?? "unknown";
  const name = project?.projectName ?? "untitled";
  return `${number}__${name}__${fallbackIndex}`;
}

function reorderById(list, fromId, toId, keyFn){
  if (fromId === toId) return list;
  const items = [...list];
  const fromIndex = items.findIndex(item => keyFn(item) === fromId);
  const toIndex = items.findIndex(item => keyFn(item) === toId);
  if (fromIndex === -1 || toIndex === -1) return list;
  const [moved] = items.splice(fromIndex, 1);
  items.splice(toIndex, 0, moved);
  return items;
}

function formatDate(d){
  if(!d) return "";
  const dt = new Date(d);
  if(isNaN(dt)) return d;
  return dt.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

export default function Projects(){
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [overrideNext, setOverrideNext] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("cadVault.nextProjectNumber") || "";
  });
  const [savedClientsState, setSavedClientsState] = useState([]);
  const [draggingProjectId, setDraggingProjectId] = useState(null);
  const [orderSaving, setOrderSaving] = useState(false);
  const [orderStatus, setOrderStatus] = useState("");
  const orderSnapshotRef = useRef([]);
  const orderStatusTimer = useRef(null);
  const projectsRef = useRef(projects);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError("");
    try{
      const res = await listProjects();
      const nextProjects = res.projects || [];
      setProjects(nextProjects);
      orderSnapshotRef.current = nextProjects.map(projectKey);
      setOrderStatus("");
    }catch(e){
      setError("Could not load projects");
    }finally{
      setLoading(false);
    }
  },[]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  useEffect(() => {
    function syncOverride(){
      setOverrideNext(localStorage.getItem("cadVault.nextProjectNumber") || "");
    }
    window.addEventListener("storage", syncOverride);
    return () => window.removeEventListener("storage", syncOverride);
  }, []);

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  useEffect(() => {
    return () => {
      if (orderStatusTimer.current) {
        clearTimeout(orderStatusTimer.current);
      }
    };
  }, []);

  const loadClients = useCallback(async () => {
    const list = await fetchClients().catch(() => []);
    setSavedClientsState(list);
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  const filtered = projects.filter(p => {
    const hay = `${p.projectName||""} ${p.projectNumber||""} ${p.client||""}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  const computedNext = useMemo(() => {
    if (overrideNext && overrideNext.trim()) return overrideNext.trim();
    const numbers = projects.map(p => parseInt(String(p.projectNumber).replace(/\D/g,""), 10))
      .filter(n => !Number.isNaN(n));
    if (numbers.length === 0) return "001";
    const next = Math.max(...numbers) + 1;
    return String(next).padStart(3,"0");
  }, [projects, overrideNext]);

  const clientDirectory = useMemo(() => mergeClientRecords(projects, savedClientsState), [projects, savedClientsState]);

  const totalPartsAcrossProjects = useMemo(() => {
    return projects.reduce((sum, proj) => {
      const count = proj.partCount ?? proj.count ?? proj.partsCount ?? proj.totalParts ?? 0;
      return sum + (Number(count) || 0);
    }, 0);
  }, [projects]);

  const persistProjectOrder = useCallback(async (nextList) => {
    if (!Array.isArray(nextList) || !nextList.length) return;
    const nextKeys = nextList.map(projectKey);
    const prevKeys = orderSnapshotRef.current;
    const changed = nextKeys.length !== prevKeys.length || nextKeys.some((key, idx) => key !== prevKeys[idx]);
    if (!changed) return;
    setOrderSaving(true);
    setOrderStatus("");
    try{
      await reorderProjects(nextList.map((proj, index) => ({
        projectNumber: proj.projectNumber,
        projectName: proj.projectName,
        displayOrder: index
      })));
      orderSnapshotRef.current = nextKeys;
      if (orderStatusTimer.current) clearTimeout(orderStatusTimer.current);
      setOrderStatus("Order saved");
      orderStatusTimer.current = setTimeout(() => setOrderStatus(""), 2000);
    }catch(err){
      console.error("Unable to save project order", err);
      setOrderStatus("Unable to save order");
      await loadProjects();
    }finally{
      setOrderSaving(false);
    }
  }, [loadProjects]);

  const handleClientUpsert = useCallback(async (data, options) => {
    await upsertClient(data, options);
    await loadClients();
  }, [loadClients]);

  function handleProjectDragStart(e, id){
    setDraggingProjectId(id);
    if (e?.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", id); } catch {}
    }
  }

  function handleProjectDragOver(e){
    if (e?.preventDefault) e.preventDefault();
    if (e?.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
  }

  function handleProjectDragEnter(targetId){
    if (!draggingProjectId || draggingProjectId === targetId) return;
    setProjects(prev => {
      const next = reorderById(prev, draggingProjectId, targetId, projectKey);
      projectsRef.current = next;
      return next;
    });
  }

  function handleProjectDrop(e, targetId){
    if (e?.preventDefault) e.preventDefault();
    if (!draggingProjectId) return;
    persistProjectOrder(projectsRef.current);
    setDraggingProjectId(null);
  }

  function handleProjectDragEnd(){
    if (draggingProjectId) {
      persistProjectOrder(projectsRef.current);
    }
    setDraggingProjectId(null);
  }

  async function handleDeleteProject(project){
    if(!window.confirm(`Delete project ${project.projectNumber}? This removes its folder.`)) return;
    await apiDeleteProject({ projectNumber: project.projectNumber, projectName: project.projectName });
    await loadProjects();
  }

  return (
    <div className="page-container">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold">Projects</h1>
            <div className="text-sm text-slate-500 mt-1">Manage your CAD projects and deliverables</div>
          </div>
          <div className="flex items-center gap-3">
            <input
              value={q}
              onChange={e=>setQ(e.target.value)}
              placeholder="Search projects by name, number or client..."
              className="input mr-2"
              style={{ minWidth: 360 }}
            />
            <button className="btn btn-outline-cta" onClick={()=>navigate("/clients")}>
              + New Client
            </button>
            <button className="btn btn-cta" onClick={()=>setShowNewProject(true)}>
              + New Project
            </button>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4 text-sm text-slate-500 flex-wrap gap-4">
            <div className="flex items-center gap-6">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Total Projects</div>
                <strong className="text-2xl text-slate-900">{projects.length}</strong>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Total Parts</div>
                <strong className="text-2xl text-orange-500">{totalPartsAcrossProjects}</strong>
              </div>
            </div>
            <div className="text-xs text-slate-400">Updated {new Date().toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })}</div>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 mb-4 flex-wrap gap-2">
            <span>Drag cards to reorder projects.</span>
            {(orderSaving || orderStatus) && (
              <span className={orderSaving ? "text-orange-600" : "text-slate-400"}>
                {orderSaving ? "Saving order…" : orderStatus}
              </span>
            )}
          </div>

          {loading && <div className="text-sm text-slate-500 p-6">Loading projects…</div>}
          {error && <div className="text-sm text-red-600 p-6">{error}</div>}

          {!loading && !error && (
            <div className="tile-grid" onDragOver={handleProjectDragOver} onDrop={(e) => handleProjectDrop(e, null)}>
              {filtered.map(p => {
                const partsCount = p.partCount ?? p.count ?? p.partsCount ?? p.totalParts ?? 0;
                const created = formatDate(p.created || p.createdAt || p.createdOn);
                const link = `/p/${p.projectNumber}/${encodeURIComponent(p.projectName||"")}`;
                const cardId = projectKey(p);
                const isDragging = draggingProjectId === cardId;
                return (
                  <div
                    key={cardId}
                    className={`tile relative group cursor-grab transition-all ${isDragging ? "ring-2 ring-orange-300 bg-slate-50 opacity-70" : "opacity-100"}`}
                    draggable
                    onDragStart={(e) => handleProjectDragStart(e, cardId)}
                    onDragOver={handleProjectDragOver}
                    onDragEnter={() => handleProjectDragEnter(cardId)}
                    onDrop={(e) => handleProjectDrop(e, cardId)}
                    onDragEnd={handleProjectDragEnd}
                    aria-grabbed={isDragging}
                  >
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                      <button
                        type="button"
                        className="btn-ghost p-2 rounded-full"
                        title="Edit project"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingProject(p); }}
                      >
                        <PencilSquareIcon className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost p-2 rounded-full text-red-500"
                        title="Delete project"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteProject(p); }}
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                    <Link to={link} className="block" style={draggingProjectId ? { pointerEvents: "none" } : undefined}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="h-12 w-12 rounded-lg bg-slate-100 grid place-items-center">
                          <FolderIcon className="h-6 w-6 text-slate-500" aria-hidden="true" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-xs text-slate-500">{p.projectNumber}</div>
                            {p.active && <div className="badge-green text-xs">active</div>}
                          </div>
                          <div className="text-lg font-semibold mt-1">{p.projectName}</div>
                          <div className="text-xs text-slate-500 mt-1">{p.client || "Personal Projects"}</div>
                          {created && <div className="text-xs text-slate-400 mt-1">Created {created}</div>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-500">Total Parts</div>
                        <div className="text-2xl font-bold">{partsCount}</div>
                      </div>
                    </div>

                      <div className="mt-4 flex items-center justify-between">
                        <div className="text-xs text-slate-500">{partsCount} parts</div>
                        <div className="chip chip-step">STEP</div>
                      </div>
                    </Link>
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <div className="p-6 text-sm text-slate-500">No projects match your search.</div>
              )}
            </div>
          )}
        </div>

        {showNewProject && (
          <NewProjectModal
            defaultNumber={computedNext}
            clientDirectory={clientDirectory}
            onClose={() => setShowNewProject(false)}
            onCreated={async () => {
              setShowNewProject(false);
              await loadProjects();
            }}
            onClientUpsert={handleClientUpsert}
          />
        )}
        {editingProject && (
          <NewProjectModal
            mode="edit"
            initialProject={editingProject}
            defaultNumber={editingProject.projectNumber}
            clientDirectory={clientDirectory}
            onClose={() => setEditingProject(null)}
            onCreated={async () => {
              setEditingProject(null);
              await loadProjects();
            }}
            onClientUpsert={handleClientUpsert}
          />
        )}
      </div>
    </div>
  );
}

function NewProjectModal({ defaultNumber, onClose, onCreated, mode = "create", initialProject = null, clientDirectory = [], onClientUpsert }){
  const isEdit = mode === "edit" && initialProject;
  const [projectNumber, setProjectNumber] = useState(isEdit ? initialProject.projectNumber : (defaultNumber || ""));
  const [projectName, setProjectName] = useState(isEdit ? initialProject.projectName : "");
  const clientOptions = useMemo(() => {
    const names = Array.from(new Set(clientDirectory.map(c => c.name).filter(Boolean)));
    return names.length ? names : ["Personal Projects"];
  }, [clientDirectory]);
  const [selectedClient, setSelectedClient] = useState(() => {
    if (isEdit) return initialProject.client || clientOptions[0] || "__new";
    return clientOptions[0] || "__new";
  });
  const [newClientName, setNewClientName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isNewClient = selectedClient === "__new";
  const clientNameValue = (isNewClient ? newClientName : selectedClient) || "";

  useEffect(() => {
    if (isEdit && initialProject) {
      setProjectNumber(initialProject.projectNumber);
      setProjectName(initialProject.projectName);
      const initialClient = initialProject.client || clientOptions[0] || "__new";
      setSelectedClient(initialClient);
      if (!clientOptions.includes(initialClient)) {
        setSelectedClient("__new");
        setNewClientName(initialClient);
      } else {
        setNewClientName("");
      }
      setContactPerson(initialProject.contactPerson || "");
      setEmail(initialProject.email || "");
      setPhone(initialProject.phone || "");
      setNotes(initialProject.notes || "");
    }
  }, [isEdit, initialProject, clientOptions]);

  useEffect(() => {
    if (selectedClient !== "__new" && clientOptions.length && !clientOptions.includes(selectedClient)) {
      setSelectedClient(clientOptions[0]);
    }
  }, [clientOptions, selectedClient]);

  useEffect(() => {
    if (selectedClient === "__new") {
      setContactPerson("");
      setEmail("");
      setPhone("");
      setNotes("");
      return;
    }
    const match = clientDirectory.find(c => c.name === selectedClient);
    if (match) {
      setContactPerson(match.contactPerson || "");
      setEmail(match.email || "");
      setPhone(match.phone || "");
      setNotes(match.notes || "");
    }
  }, [selectedClient, clientDirectory]);

  async function handleCreate(e){
    e.preventDefault();
    if(!projectNumber.trim() || !projectName.trim()){
      setError("Project number and name are required");
      return;
    }
    if(!clientNameValue.trim()){
      setError("Client name is required");
      return;
    }
    setBusy(true);
    setError("");
    try{
      if (isEdit) {
        const nameChanged = projectName.trim() !== initialProject.projectName;
        if (nameChanged) {
          await renameProject({
            projectNumber: initialProject.projectNumber,
            oldProjectName: initialProject.projectName,
            newProjectName: projectName.trim()
          });
        }
        await updateProjectMeta({
          projectNumber: initialProject.projectNumber,
          projectName: projectName.trim(),
          client: clientNameValue.trim(),
          contactPerson,
          email,
          phone,
          notes
        });
        if (isNewClient && onClientUpsert) {
          onClientUpsert({ name: clientNameValue.trim(), contactPerson, email, phone, notes }, { originalName: clientNameValue.trim() });
        }
      } else {
        await createProject({
          projectNumber: projectNumber.trim(),
          projectName: projectName.trim(),
          client: clientNameValue.trim(),
          contactPerson,
          email,
          phone,
          notes
        });
        if (isNewClient && onClientUpsert) {
          onClientUpsert({ name: clientNameValue.trim(), contactPerson, email, phone, notes }, { originalName: clientNameValue.trim() });
        }
      }
      onCreated && (await onCreated());
    }catch(err){
      setError(err.message || "Could not create project");
    }finally{
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 grid place-items-center px-4">
      <div className="card w-full max-w-4xl p-6 relative">
        <button className="btn-ghost absolute right-4 top-4 text-sm" onClick={onClose}>Close</button>
        <h2 className="text-2xl font-extrabold mb-2 flex items-center gap-2">
          <FolderIcon className="h-6 w-6 text-slate-500" aria-hidden="true" />
          {isEdit ? "Edit Project" : "Add New Project"}
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          {isEdit ? "Update client details for this project." : "Provide project details and we will scaffold the folders instantly."}
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          <form className="space-y-4" onSubmit={handleCreate}>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Project Number *</label>
              <input
                className="input mt-1"
                value={projectNumber}
                onChange={e=>setProjectNumber(e.target.value)}
                disabled={isEdit}
              />
              {!isEdit && <div className="text-xs text-slate-400 mt-1">Suggested next number: {defaultNumber}</div>}
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Project Name *</label>
              <input
                className="input mt-1"
                value={projectName}
                onChange={e=>setProjectName(e.target.value)}
                placeholder="e.g. TestProject"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Client</label>
              <select
                className="input mt-1"
                value={selectedClient}
                onChange={e=>setSelectedClient(e.target.value)}
              >
                {clientOptions.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
                <option value="__new">+ Create new client</option>
              </select>
            </div>
            {isNewClient && (
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">New Client Name *</label>
                <input className="input mt-1" value={newClientName} onChange={e=>setNewClientName(e.target.value)} placeholder="e.g. Acme Corporation" />
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact Person</label>
              <input className="input mt-1" value={contactPerson} onChange={e=>setContactPerson(e.target.value)} placeholder="e.g. John Smith" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</label>
                <input className="input mt-1" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@example.com" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Phone</label>
                <input className="input mt-1" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+44 20 1234 5678" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes</label>
              <textarea className="input mt-1 h-24" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Additional information…" />
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <div className="flex items-center gap-3">
              <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save Changes" : "Create Project")}</button>
              <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
            </div>
          </form>
                <div className="card bg-slate-50 border-slate-200 h-fit">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-2xl bg-slate-200 grid place-items-center">
                        <FolderIcon className="h-6 w-6 text-slate-500" aria-hidden="true" />
                      </div>
                <div>
                  <div className="text-xs text-slate-500">{projectNumber || defaultNumber}</div>
                  <div className="text-xl font-semibold">{projectName || "Project name"}</div>
                  <div className="text-xs text-slate-500 mt-1">{clientNameValue || "Client"}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-500">Total Parts</div>
                <div className="text-2xl font-bold">0</div>
              </div>
            </div>
            <div className="mt-6 space-y-2 text-sm text-slate-600">
              <div className="flex items-center gap-2"><span className="font-semibold w-20">Contact</span><span>{contactPerson || "—"}</span></div>
              <div className="flex items-center gap-2"><span className="font-semibold w-20">Email</span><span>{email || "—"}</span></div>
              <div className="flex items-center gap-2"><span className="font-semibold w-20">Phone</span><span>{phone || "—"}</span></div>
            </div>
            <div className="text-xs text-slate-400 mt-6">Preview updates as you type.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
