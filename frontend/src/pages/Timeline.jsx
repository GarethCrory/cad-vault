import React, { useEffect, useState } from "react";
import { listTasks, addTask, updateTask, reorderTasks, deleteTask } from "../api/tasks";

const USER_ID = "user-123";

export default function Timeline(){
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");

  async function load(){
    setLoading(true);
    try{
      const { tasks } = await listTasks(USER_ID);
      // preserve server ids exactly; only fill missing priority for display
      setTasks(tasks.map((t, i)=>({ ...t, priority: Number.isFinite(t.priority) ? t.priority : i })));
    } finally { setLoading(false); }
  }

  useEffect(()=>{ load(); }, []);

  async function onAdd(e){
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    await addTask({ userId: USER_ID, title: t, status: "todo", priority: tasks.length });
    setTitle("");
    await load(); // re-fetch so ids come from server
  }

  return (
    <div className="page-container compact space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Timeline</h1>
        <form onSubmit={onAdd} className="flex items-center gap-2">
          <input className="input" placeholder="Add a task" value={title} onChange={(e)=>setTitle(e.target.value)} />
          <button className="btn-primary" type="submit">Add</button>
        </form>
      </div>

      <div className="card">
        <table className="table compact timeline-table">
          <thead>
            <tr>
              <th className="th">ID</th>
              <th className="th">Title</th>
              <th className="th">Status</th>
              <th className="th">Priority</th>
              <th className="th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="td" colSpan="5">Loading…</td></tr>}
            {!loading && tasks.length===0 && <tr><td className="td" colSpan="5">No tasks yet.</td></tr>}
            {tasks.map((t)=>(
              <tr key={t.id}>
                <td className="td font-mono">{t.id}</td>
                <td className="td">{t.title}</td>
                <td className="td">{t.status}</td>
                <td className="td">{t.priority}</td>
                <td className="td">
                  <div className="flex gap-2">
                    <button className="btn-secondary" onClick={async ()=>{
                      const next = t.status === "todo" ? "doing" : (t.status === "doing" ? "done" : "todo");
                      await updateTask({ userId: USER_ID, id: t.id, status: next });
                      await load();
                    }}>Advance</button>
                    <button className="btn-secondary" onClick={async ()=>{
                      await deleteTask(USER_ID, t.id);
                      await load();
                    }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
