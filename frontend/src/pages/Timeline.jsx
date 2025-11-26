import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bars3BottomLeftIcon, CalendarDaysIcon, FolderIcon, PencilSquareIcon, TrashIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { listProjects } from "../api.js";
import { fetchClients, mergeClientRecords } from "../lib/clientStore.js";

const TASK_STORE_KEY = "cadVault.timelineTasks.v1";
const STATUS_OPTIONS = [
  { value: "todo", label: "To do", tone: "bg-slate-100 text-slate-700" },
  { value: "in_progress", label: "In progress", tone: "bg-amber-100 text-amber-700" },
  { value: "blocked", label: "Blocked", tone: "bg-rose-100 text-rose-700" },
  { value: "done", label: "Done", tone: "bg-green-100 text-green-700" }
];

function loadTasks(){
  if (typeof window === "undefined") return [];
  try{
    const raw = window.localStorage.getItem(TASK_STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  }catch{
    return [];
  }
}

function persistTasks(tasks = []){
  if (typeof window === "undefined") return;
  try{
    window.localStorage.setItem(TASK_STORE_KEY, JSON.stringify(tasks));
  }catch{
    /* noop */
  }
}

function makeId(){
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `task_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

function makeProjectKey(projectNumber, projectName){
  if (!projectNumber && !projectName) return "";
  return `${projectNumber || "unknown"}__${projectName || ""}`;
}

function formatDate(value){
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function reorderById(list = [], fromId, toId){
  if (!fromId || !toId || fromId === toId) return list;
  const next = [...list];
  const fromIndex = next.findIndex((t) => t.id === fromId);
  const toIndex = next.findIndex((t) => t.id === toId);
  if (fromIndex === -1 || toIndex === -1) return list;
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

const emptyForm = {
  id: null,
  title: "",
  projectKey: "",
  client: "",
  dueDate: "",
  status: "todo",
  notes: ""
};

export default function Timeline(){
  const [tasks, setTasks] = useState(() => loadTasks());
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [draggingId, setDraggingId] = useState(null);
  const [error, setError] = useState("");

  const loadProjects = useCallback(async () => {
    try{
      const res = await listProjects();
      setProjects(res.projects || []);
    }catch{
      setProjects([]);
    }
  }, []);

  const loadClients = useCallback(async () => {
    const list = await fetchClients().catch(() => []);
    setClients(list);
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);
  useEffect(() => { loadClients(); }, [loadClients]);

  useEffect(() => { persistTasks(tasks); }, [tasks]);

  const projectOptions = useMemo(() => {
    return projects.map((p) => ({
      key: makeProjectKey(p.projectNumber, p.projectName),
      label: `${p.projectNumber || ""} — ${p.projectName || ""}`.trim(),
      projectNumber: p.projectNumber,
      projectName: p.projectName,
      client: p.client || "Personal Projects",
      contactPerson: p.contactPerson || "",
      email: p.email || "",
      phone: p.phone || ""
    }));
  }, [projects]);

  const clientDirectory = useMemo(
    () => mergeClientRecords(projects, clients),
    [projects, clients]
  );

  const clientFilterOptions = useMemo(() => {
    const names = Array.from(new Set(clientDirectory.map((c) => c.name))).filter(Boolean);
    return names;
  }, [clientDirectory]);

  const openTasks = tasks.filter((t) => t.status !== "done");
  const nextDue = useMemo(() => {
    return [...openTasks]
      .filter((t) => t.dueDate)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
  }, [openTasks]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks
      .filter((t) => statusFilter === "all" || t.status === statusFilter)
      .filter((t) => clientFilter === "all" || (t.client || "") === clientFilter)
      .filter((t) => {
        if (!q) return true;
        const hay = `${t.title} ${t.client || ""} ${t.projectName || ""} ${t.notes || ""}`.toLowerCase();
        return hay.includes(q);
      })
      .map((t) => {
        const project = projectOptions.find((p) => p.projectNumber === t.projectNumber && p.projectName === t.projectName);
        const clientName = t.client || project?.client || "Personal Projects";
        const client = clientDirectory.find((c) => c.name === clientName);
        const projectLink = project
          ? `/p/${project.projectNumber}/${encodeURIComponent(project.projectName || "")}`
          : null;
        return { ...t, project, clientName, client, projectLink };
      });
  }, [tasks, statusFilter, clientFilter, search, projectOptions, clientDirectory]);

  function resetForm(){
    setForm(emptyForm);
    setError("");
  }

  function handleProjectSelect(value){
    setForm((prev) => {
      const match = projectOptions.find((p) => p.key === value);
      return {
        ...prev,
        projectKey: value,
        client: match?.client || prev.client
      };
    });
  }

  function handleEditTask(task){
    setForm({
      id: task.id,
      title: task.title,
      projectKey: makeProjectKey(task.projectNumber, task.projectName),
      client: task.client,
      dueDate: task.dueDate || "",
      status: task.status || "todo",
      notes: task.notes || ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleDeleteTask(task){
    if (!window.confirm(`Delete "${task.title}" from the timeline?`)) return;
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    if (form.id === task.id) resetForm();
  }

  function handleSaveTask(e){
    e.preventDefault();
    if (!form.title.trim()){
      setError("A task title is required");
      return;
    }
    const selectedProject = projectOptions.find((p) => p.key === form.projectKey);
    const payload = {
      id: form.id || makeId(),
      title: form.title.trim(),
      projectNumber: selectedProject?.projectNumber || "",
      projectName: selectedProject?.projectName || "",
      client: (form.client || selectedProject?.client || "Personal Projects").trim(),
      dueDate: form.dueDate || "",
      status: form.status || "todo",
      notes: form.notes || "",
      createdAt: form.createdAt || new Date().toISOString()
    };
    setTasks((prev) => {
      if (form.id){
        return prev.map((t) => (t.id === form.id ? { ...payload, createdAt: t.createdAt || payload.createdAt } : t));
      }
      return [payload, ...prev];
    });
    resetForm();
  }

  function handleDragStart(e, id){
    setDraggingId(id);
    if (e?.dataTransfer){
      e.dataTransfer.effectAllowed = "move";
      try{ e.dataTransfer.setData("text/plain", id); }catch{/* noop */}
    }
  }

  function handleDragEnter(targetId){
    if (!draggingId || draggingId === targetId) return;
    setTasks((prev) => reorderById(prev, draggingId, targetId));
  }

  function handleDragOver(e){
    if (e?.preventDefault) e.preventDefault();
    if (e?.dataTransfer) e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e){
    if (e?.preventDefault) e.preventDefault();
    setDraggingId(null);
  }

  function handleDragEnd(){
    setDraggingId(null);
  }

  return (
    <div className="page-container">
      <div className="space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Bars3BottomLeftIcon className="h-8 w-8 text-slate-600" />
              <div>
                <h1 className="text-3xl font-extrabold">Timeline</h1>
                <div className="text-sm text-slate-500 mt-1">Priority-ordered worklist linked to clients and projects</div>
              </div>
            </div>
            <div className="mt-4 flex gap-3 text-sm text-slate-600 flex-wrap">
              <span className="chip chip-soft">Total tasks: {tasks.length}</span>
              <span className="chip chip-soft">Open: {openTasks.length}</span>
              {nextDue && (
                <span className="chip chip-soft chip-accent">
                  Next due: {formatDate(nextDue.dueDate)} — {nextDue.title}
                </span>
              )}
            </div>
          </div>
          <div className="text-right space-y-2 text-sm text-slate-500">
            <div>Drag cards to set priority (top = highest).</div>
            <div className="text-xs">Tasks are saved locally in your browser.</div>
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-700">{form.id ? "Edit task" : "Add a new task"}</div>
              <div className="text-xs text-slate-500">Link to a project so you can jump back to the right workspace.</div>
            </div>
            {form.id && (
              <button className="btn btn-secondary" type="button" onClick={resetForm}>Cancel edit</button>
            )}
          </div>
          <form className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" onSubmit={handleSaveTask}>
            <div className="lg:col-span-2">
              <label className="text-xs font-semibold text-slate-500">Task *</label>
              <input
                className="input mt-1"
                placeholder="e.g. Prepare STEP for Acme bracket"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Status</label>
              <select
                className="input mt-1"
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Project</label>
              <select
                className="input mt-1"
                value={form.projectKey}
                onChange={(e) => handleProjectSelect(e.target.value)}
              >
                <option value="">Not linked to a project</option>
                {projectOptions.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Client</label>
              <select
                className="input mt-1"
                value={form.client}
                onChange={(e) => setForm((prev) => ({ ...prev, client: e.target.value }))}
              >
                <option value="">Select client</option>
                {clientDirectory.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Due date</label>
              <input
                type="date"
                className="input mt-1"
                value={form.dueDate}
                onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>
            <div className="lg:col-span-3">
              <label className="text-xs font-semibold text-slate-500">Notes</label>
              <textarea
                className="input mt-1 h-20"
                placeholder="Context, links, acceptance criteria…"
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
            {error && <div className="text-sm text-red-600 lg:col-span-3">{error}</div>}
            <div className="flex items-center gap-3 lg:col-span-3">
              <button type="submit" className="btn btn-primary">
                {form.id ? "Save task" : "Add task"}
              </button>
              <div className="text-xs text-slate-500">Tasks appear at the top as highest priority.</div>
            </div>
          </form>
        </div>

        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <input
                className="input"
                style={{ minWidth: 240 }}
                placeholder="Search tasks…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <select
                className="input"
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
              >
                <option value="all">All clients</option>
                {clientFilterOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div className="text-xs text-slate-500">Drag between rows to reprioritise.</div>
          </div>

          <div className="timeline-grid" onDragOver={handleDragOver} onDrop={handleDrop}>
            {filteredTasks.map((task, idx) => {
              const statusStyle = STATUS_OPTIONS.find((s) => s.value === task.status)?.tone || "bg-slate-100 text-slate-700";
              const isDragging = draggingId === task.id;
              return (
                <div
                  key={task.id}
                  className={`timeline-card ${isDragging ? "dragging" : ""}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragEnter={() => handleDragEnter(task.id)}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  aria-grabbed={isDragging}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="priority-dot">{idx + 1}</span>
                      <span>Priority</span>
                    </div>
                    <div className={`chip ${statusStyle}`}>{STATUS_OPTIONS.find((s) => s.value === task.status)?.label || "To do"}</div>
                  </div>
                  <div className="mt-3">
                    <div className="text-lg font-semibold">{task.title}</div>
                    {task.notes && <div className="text-sm text-slate-600 mt-1">{task.notes}</div>}
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="flex items-start gap-2 text-sm text-slate-600">
                      <FolderIcon className="h-5 w-5 text-slate-400" />
                      <div>
                        <div className="text-xs uppercase text-slate-400">Project</div>
                        {task.project ? (
                          <Link to={task.projectLink} className="text-indigo-600 hover:underline">
                            {task.project.projectNumber} — {task.project.projectName}
                          </Link>
                        ) : (
                          <div className="text-slate-500">Not linked</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-slate-600">
                      <UserGroupIcon className="h-5 w-5 text-slate-400" />
                      <div>
                        <div className="text-xs uppercase text-slate-400">Client</div>
                        <div>{task.clientName}</div>
                        {task.client?.contactPerson && (
                          <div className="text-xs text-slate-500">Contact: {task.client.contactPerson}</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm text-slate-600 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <CalendarDaysIcon className="h-5 w-5 text-slate-400" />
                      <span>{task.dueDate ? `Due ${formatDate(task.dueDate)}` : "No due date"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="btn-ghost p-2 rounded-full" title="Edit task" onClick={() => handleEditTask(task)}>
                        <PencilSquareIcon className="h-5 w-5" />
                      </button>
                      <button className="btn-ghost p-2 rounded-full text-red-500" title="Delete task" onClick={() => handleDeleteTask(task)}>
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredTasks.length === 0 && (
              <div className="p-4 text-sm text-slate-500">No tasks yet. Add a task and start prioritising.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
