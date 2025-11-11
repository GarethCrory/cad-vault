#!/usr/bin/env bash
set -e

npm i react-router-dom @heroicons/react

node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync("package.json","utf8"));p.scripts=p.scripts||{};p.scripts.dev="vite";p.scripts.build="vite build";p.scripts.preview="vite preview";fs.writeFileSync("package.json",JSON.stringify(p,null,2))'

cat > tailwind.config.js <<'EOF'
export default {
  content: ["./index.html","./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter","system-ui","Avenir","Helvetica","Arial"] },
      colors: { ink:"#0F172A", slate:{25:"#F8FAFC"}, brand:{600:"#0F3D91"} },
      boxShadow: { card:"0 2px 8px rgba(15,23,42,.06), 0 1px 2px rgba(15,23,42,.04)" }
    }
  },
  plugins: []
}
EOF

cat > postcss.config.js <<'EOF'
export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
EOF

cat > index.html <<'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <title>CAD Vault</title>
  </head>
  <body class="min-h-screen">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
EOF

mkdir -p src/pages

cat > src/index.css <<'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background:
    radial-gradient(1200px 600px at 80% -200px, rgba(15,61,145,.05), transparent 60%),
    radial-gradient(900px 500px at -100px 40%, rgba(2,132,199,.05), transparent 60%),
    #f7fafc;
  color: #0f172a;
}

.badge { @apply inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium; }
.badge-muted { @apply bg-slate-100 text-slate-700; }
.badge-green { @apply bg-green-100 text-green-700; }
.badge-blue  { @apply bg-blue-100 text-blue-700; }
.card { @apply bg-white shadow-card rounded-2xl border border-slate-200; }
.btn  { @apply inline-flex items-center gap-2 rounded-xl bg-ink text-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:opacity-95; }
.btn-ghost { @apply inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100; }
.input { @apply w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500; }
.select { @apply input pr-8; }
.table { @apply min-w-full divide-y divide-slate-200; }
.th { @apply px-4 py-2 text-left text-xs font-semibold text-slate-600; }
.td { @apply px-4 py-3 text-sm text-slate-800; }
EOF

cat > src/main.jsx <<'EOF'
import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import Projects from "./pages/Projects.jsx";
import Project from "./pages/Project.jsx";

const router = createBrowserRouter([
  { path: "/", element: <App />, children: [
      { index: true, element: <Projects /> },
      { path: "p/:projectNumber/:projectName", element: <Project /> }
  ] }
]);

createRoot(document.getElementById("root")).render(<RouterProvider router={router} />);
EOF

cat > src/App.jsx <<'EOF'
import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Cog6ToothIcon, UserGroupIcon } from "@heroicons/react/24/outline";

export default function App(){
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-white border-r border-slate-200">
        <div className="px-5 py-5 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-ink text-white grid place-items-center text-xl">📁</div>
          <div>
            <div className="font-extrabold tracking-tight">CAD Vault</div>
            <div className="text-xs text-slate-500">Release Management</div>
          </div>
        </div>
        <nav className="mt-4 space-y-1 px-2">
          <NavLink className="btn-ghost w-full justify-start" to="/">Projects</NavLink>
          <button className="btn-ghost w-full justify-start"><UserGroupIcon className="h-5 w-5" />Clients</button>
          <button className="btn-ghost w-full justify-start"><Cog6ToothIcon className="h-5 w-5" />Settings</button>
        </nav>
        <div className="px-5 py-6 mt-auto text-xs text-slate-500">Version 1.0.0<br/>CAD Project Management</div>
      </aside>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
EOF

cat > src/api.js <<'EOF'
const BASE = "http://localhost:4000";

async function jpost(path, body){
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body||{})
  });
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function scanProject(projectNumber, projectName){
  return jpost("/api/project/scan", { projectNumber, projectName });
}

export async function history(p){
  return jpost("/api/part/history", p);
}

export async function editPart(p){
  const r = await fetch(BASE + "/api/part/edit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p)
  });
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function reviseUpload({ file, projectNumber, projectName, typePrefix, partNumber, description, notes }){
  const fd = new FormData();
  fd.append("file", file);
  fd.append("project", JSON.stringify({ projectNumber, projectName }));
  fd.append("typePrefix", typePrefix);
  fd.append("partNumber", partNumber);
  fd.append("description", description||"");
  fd.append("notes", notes||"");
  const r = await fetch(BASE + "/api/file/revise", { method:"POST", body: fd });
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}
EOF

cat > src/pages/Projects.jsx <<'EOF'
import React from "react";
import { Link } from "react-router-dom";

export default function Projects(){
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-4xl font-extrabold tracking-tight">Projects</h1>
        <p className="text-slate-600 mt-1">Manage your CAD projects and deliverables</p>
      </div>

      <div className="card p-6 max-w-3xl">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-ink text-white grid place-items-center text-2xl">📁</div>
          <div className="flex-1">
            <div className="text-xs text-slate-500">P001</div>
            <div className="text-xl font-semibold">TestProject</div>
            <div className="mt-1 text-xs text-slate-500">Created 06 Nov 2025</div>
          </div>
          <Link className="btn" to="/p/P001/TestProject">Open</Link>
        </div>
      </div>
    </div>
  );
}
EOF

cat > src/pages/Project.jsx <<'EOF'
import React, { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { scanProject, reviseUpload, editPart, history } from "../api.js";
import { PencilSquareIcon, ArrowUpOnSquareIcon, ClockIcon, BoltIcon } from "@heroicons/react/24/outline";

const PartTypeBadge = ({t}) => (
  <span className="badge badge-blue">{t}</span>
);

export default function Project(){
  const { projectNumber, projectName } = useParams();
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const fileRef = useRef(null);

  async function load(){
    setLoading(true);
    try{
      const sc = await scanProject(projectNumber, projectName);
      setParts(sc.parts||[]);
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{ load(); }, []);

  async function onUpload(p){
    const f = fileRef.current?.files?.[0];
    if(!f) return;
    await reviseUpload({
      file: f,
      projectNumber, projectName,
      typePrefix: p.typePrefix,
      partNumber: p.partNumber,
      description: p.description||"",
      notes: "Uploaded via UI"
    });
    fileRef.current.value = "";
    await load();
  }

  async function onSaveEdit(form){
    await editPart({
      projectNumber, projectName,
      typePrefix: form.typePrefix,
      partNumber: form.partNumber,
      newTypePrefix: form.newTypePrefix,
      newDescription: form.newDescription,
      note: form.note||""
    });
    setEditing(null);
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="btn-ghost">Back to Projects</Link>
      </div>

      <div className="card p-6 flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl bg-ink text-white grid place-items-center text-2xl">📁</div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">{projectNumber}</span>
            <span className="badge badge-green">active</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight">{projectName}</h2>
          <div className="text-xs text-slate-500 mt-1">Client release management</div>
        </div>
        <div className="flex items-center gap-2">
          <label className="btn" htmlFor="upload">Upload Files</label>
          <input id="upload" ref={fileRef} type="file" className="hidden" />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="font-semibold">Parts & Files</div>
          <div className="text-xs badge badge-muted">{parts.length} parts</div>
        </div>
        <table className="table">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Type</th>
              <th className="th">Part #</th>
              <th className="th">Description</th>
              <th className="th">File</th>
              <th className="th">Rev</th>
              <th className="th">Notes</th>
              <th className="th">Source</th>
              <th className="th">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading && (<tr><td className="td" colSpan="8">Loading…</td></tr>)}
            {!loading && parts.length===0 && (<tr><td className="td" colSpan="8">No parts yet.</td></tr>)}
            {parts.map(p => (
              <PartRow key={p.typePrefix+"-"+p.partNumber}
                p={p}
                projectNumber={projectNumber}
                projectName={projectName}
                onUpload={()=>onUpload(p)}
                onEdit={()=>setEditing(p)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {editing && <EditModal p={editing} project={{projectNumber,projectName}} onClose={()=>setEditing(null)} onSave={onSaveEdit} />}
    </div>
  );
}

function PartRow({p, projectNumber, projectName, onUpload, onEdit}){
  const [latest,setLatest]=useState("");
  useEffect(()=>{
    history({ projectNumber, projectName, typePrefix:p.typePrefix, partNumber:p.partNumber })
      .then(h=>setLatest(h.latestRev||""))
      .catch(()=>setLatest(""));
  },[]);
  return (
    <tr>
      <td className="td"><PartTypeBadge t={p.typePrefix} /></td>
      <td className="td font-mono">{`${projectNumber}_${p.typePrefix}${p.partNumber.padStart(3,"0")}`.replace(projectNumber+"_","")}</td>
      <td className="td">{p.description||"—"}</td>
      <td className="td"><span className="badge badge-blue">STEP</span></td>
      <td className="td"><span className="badge badge-muted">{latest||"—"}</span></td>
      <td className="td text-slate-500">Manual</td>
      <td className="td"><span className="badge badge-muted">Manual</span></td>
      <td className="td">
        <div className="flex items-center gap-3">
          <button className="text-green-700" title="Revise" onClick={onUpload}><ArrowUpOnSquareIcon className="h-5 w-5" /></button>
          <button className="text-slate-700" title="Edit" onClick={onEdit}><PencilSquareIcon className="h-5 w-5" /></button>
          <button className="text-slate-700" title="History"><ClockIcon className="h-5 w-5" /></button>
          <button className="text-orange-500" title="Release"><BoltIcon className="h-5 w-5" /></button>
        </div>
      </td>
    </tr>
  );
}

function EditModal({p, project, onClose, onSave}){
  const [desc,setDesc]=useState(p.description||"");
  const [type,setType]=useState(p.typePrefix);
  const [note,setNote]=useState("");

  async function save(){
    await onSave({
      typePrefix: p.typePrefix,
      partNumber: p.partNumber,
      newTypePrefix: type,
      newDescription: desc,
      note
    });
  }

  return (
    <div className="fixed inset-0 bg-black/20 grid place-items-center p-4">
      <div className="card w-full max-w-xl p-6">
        <div className="text-lg font-semibold mb-1">Edit Part</div>
        <div className="text-xs text-slate-500 mb-4">Update part details. Project and part numbers cannot be changed.</div>

        <div className="text-xs text-slate-600 mb-2">Part Number (read-only)</div>
        <div className="input mb-4 font-mono bg-slate-50">{project.projectNumber}_{p.typePrefix}{p.partNumber.padStart(3,"0")}</div>

        <label className="text-xs text-slate-600">Description</label>
        <input className="input mb-4" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description" />

        <label className="text-xs text-slate-600">Part Type</label>
        <select className="select mb-4" value={type} onChange={e=>setType(e.target.value)}>
          <option value="P">Part (P)</option>
          <option value="A">Assembly (A)</option>
          <option value="H">Hardware (H)</option>
        </select>

        <label className="text-xs text-slate-600">Note</label>
        <input className="input mb-6" value={note} onChange={e=>setNote(e.target.value)} placeholder="Change note" />

        <div className="flex items-center justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save}>Save Changes</button>
        </div>

        <div className="text-xs text-slate-500 mt-4">
          Current canonical filename will update after save and refresh.
        </div>
      </div>
    </div>
  );
}
EOF

echo "Frontend files written."
