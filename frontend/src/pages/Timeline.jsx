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

export default function Timeline(){
  const [tasks, setTasks] = useState(() => loadTasks());
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [draggingId, setDraggingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

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

  function handleEditTask(task){
    setEditingTask(task);
    setShowModal(true);
  }

  function handleDeleteTask(task){
    if (!window.confirm(`Delete "${task.title}" from the timeline?`)) return;
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
  }

  function handleSaveTask(data){
    const selectedProject = projectOptions.find((p) => p.key === data.projectKey);
    const existing = data.id ? tasks.find((t) => t.id === data.id) : null;
    const payload = {
      id: data.id || makeId(),
      title: data.title.trim(),
      projectNumber: selectedProject?.projectNumber || "",
      projectName: selectedProject?.projectName || "",
      client: (data.client || selectedProject?.client || "Personal Projects").trim(),
      dueDate: data.dueDate || "",
      status: data.status || "todo",
      notes: data.notes || "",
      createdAt: existing?.createdAt || new Date().toISOString()
    };
    setTasks((prev) => {
      if (data.id){
        return prev.map((t) => (t.id === data.id ? { ...payload, createdAt: t.createdAt || payload.createdAt } : t));
      }
      return [payload, ...prev];
    });
    setEditingTask(null);
    setShowModal(false);
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

        <div className="card p-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-700">Timeline tasks</div>
            <div className="text-xs text-slate-500">Add a task to track what’s next.</div>
          </div>
          <button className="btn btn-primary" onClick={() => { setEditingTask(null); setShowModal(true); }}>+ New task</button>
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

          <div className="table-scroll">
            <table className="table compact timeline-table" onDragOver={handleDragOver} onDrop={handleDrop}>
              <thead>
                <tr>
                  <th className="th w-10">#</th>
                  <th className="th">Task</th>
                  <th className="th">Project</th>
                  <th className="th">Client</th>
                  <th className="th">Due</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task, idx) => {
                  const statusStyle = STATUS_OPTIONS.find((s) => s.value === task.status)?.tone || "bg-slate-100 text-slate-700";
                  const isDragging = draggingId === task.id;
                  return (
                    <tr
                      key={task.id}
                      className={`timeline-row ${isDragging ? "dragging" : ""}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnter={() => handleDragEnter(task.id)}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onDragEnd={handleDragEnd}
                      aria-grabbed={isDragging}
                    >
                      <td className="td" data-label="#">
                        <span className="priority-dot">{idx + 1}</span>
                      </td>
                      <td className="td" data-label="Task">
                        <div className="font-semibold text-sm">{task.title}</div>
                        {task.notes && <div className="text-xs text-slate-500 truncate max-w-xs">{task.notes}</div>}
                      </td>
                      <td className="td" data-label="Project">
                        {task.project ? (
                          <Link to={task.projectLink} className="inline-flex items-center gap-2 text-indigo-600 hover:underline">
                            <FolderIcon className="h-4 w-4 text-slate-400" />
                            <span className="truncate max-w-[220px]">{task.project.projectNumber} — {task.project.projectName}</span>
                          </Link>
                        ) : (
                          <span className="text-slate-500">Not linked</span>
                        )}
                      </td>
                      <td className="td" data-label="Client">
                        <div className="text-sm">{task.clientName}</div>
                        {task.client?.contactPerson && (
                          <div className="text-xs text-slate-500">Contact: {task.client.contactPerson}</div>
                        )}
                      </td>
                      <td className="td" data-label="Due">
                        <div className="text-sm">{task.dueDate ? formatDate(task.dueDate) : "No date"}</div>
                      </td>
                      <td className="td" data-label="Status">
                        <span className={`chip ${statusStyle}`}>{STATUS_OPTIONS.find((s) => s.value === task.status)?.label || "To do"}</span>
                      </td>
                      <td className="td cell-actions text-right" data-label="Actions">
                        <div className="inline-flex items-center gap-2">
                          <button className="btn-ghost p-2 rounded-full" title="Edit task" onClick={() => handleEditTask(task)}>
                            <PencilSquareIcon className="h-5 w-5" />
                          </button>
                          <button className="btn-ghost p-2 rounded-full text-red-500" title="Delete task" onClick={() => handleDeleteTask(task)}>
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredTasks.length === 0 && (
                  <tr>
                    <td className="td text-sm text-slate-500" colSpan={7}>No tasks yet. Add a task and start prioritising.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showModal && (
          <NewTaskModal
            onClose={() => { setShowModal(false); setEditingTask(null); }}
            onSave={handleSaveTask}
            projectOptions={projectOptions}
            clientDirectory={clientDirectory}
            initialTask={editingTask}
          />
        )}
      </div>
    </div>
  );
}

function NewTaskModal({ onClose, onSave, projectOptions = [], clientDirectory = [], initialTask = null }){
  const isEdit = Boolean(initialTask);
  const [title, setTitle] = useState(initialTask?.title || "");
  const [projectKey, setProjectKey] = useState(initialTask ? makeProjectKey(initialTask.projectNumber, initialTask.projectName) : "");
  const [client, setClient] = useState(initialTask?.client || "");
  const [dueDate, setDueDate] = useState(initialTask?.dueDate || "");
  const [status, setStatus] = useState(initialTask?.status || "todo");
  const [notes, setNotes] = useState(initialTask?.notes || "");
  const [error, setError] = useState("");

  function handleSubmit(e){
    e.preventDefault();
    if (!title.trim()){
      setError("Task title is required");
      return;
    }
    setError("");
    onSave({
      id: initialTask?.id || null,
      title,
      projectKey,
      client,
      dueDate,
      status,
      notes
    });
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 grid place-items-center px-4">
      <div className="card timeline-modal w-full max-w-4xl p-8 relative">
        <button className="btn-ghost absolute right-4 top-4 text-sm" onClick={onClose}>✕</button>
        <div className="timeline-icon-badge">
          <Bars3BottomLeftIcon className="h-7 w-7" />
        </div>
        <div className="text-center mb-6">
          <div className="text-2xl font-bold text-slate-800">{isEdit ? "Edit Task" : "Add New Task"}</div>
          <div className="text-sm text-slate-500 mt-1">Quickly capture what needs doing and link it to projects/clients.</div>
        </div>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div className="text-sm font-semibold text-slate-700">Task Details</div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Task name *</label>
                <input className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Prepare STEP for Acme bracket" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Project</label>
                <select className="input mt-1" value={projectKey} onChange={(e) => setProjectKey(e.target.value)}>
                  <option value="">Not linked to a project</option>
                  {projectOptions.map((p) => (
                    <option key={p.key} value={p.key}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Client</label>
                <select className="input mt-1" value={client} onChange={(e) => setClient(e.target.value)}>
                  <option value="">Select client</option>
                  {clientDirectory.map((c) => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-sm font-semibold text-slate-700">Schedule & Status</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500">Status</label>
                  <select className="input mt-1" value={status} onChange={(e) => setStatus(e.target.value)}>
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">Due date</label>
                  <input type="date" className="input mt-1" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Notes</label>
                <textarea className="input mt-1 h-24" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Context, links, acceptance criteria…" />
              </div>
            </div>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex items-center gap-3 justify-end">
            <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" type="submit">{isEdit ? "Save task" : "Add task"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
