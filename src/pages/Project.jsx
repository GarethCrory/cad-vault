import React, { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { scanProject, reviseUpload, editPart, history } from "../api.js";
import { PencilSquareIcon, ArrowUpOnSquareIcon, ClockIcon, BoltIcon, XMarkIcon } from "@heroicons/react/24/outline";

const PartTypeBadge = ({t}) => <span className="badge badge-blue">{t}</span>;

export default function Project(){
  const { projectNumber, projectName } = useParams();
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [hist, setHist] = useState(null);

  async function load(){
    setLoading(true);
    setError("");
    try{
      const sc = await scanProject(projectNumber, projectName);
      setParts(sc.parts||[]);
    }catch(e){
      setError("Could not load project parts");
    }finally{
      setLoading(false);
    }
  }
  useEffect(()=>{ load(); }, []);

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

  async function openHistory(p){
    try{
      const h = await history({ projectNumber, projectName, typePrefix: p.typePrefix, partNumber: p.partNumber });
      setHist({ part: p, data: h });
    }catch(e){
      alert("History error: " + e.message);
    }
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
            {loading && <tr><td className="td" colSpan="8">Loading…</td></tr>}
            {!loading && parts.length===0 && (
              <tr><td className="td" colSpan="8">No parts yet.</td></tr>
            )}
            {parts.map(p => (
              <PartRow key={p.typePrefix+"-"+p.partNumber}
                p={p}
                projectNumber={projectNumber}
                projectName={projectName}
                onReload={load}
                onEdit={()=>setEditing(p)}
                onHistory={()=>openHistory(p)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {editing && <EditModal p={editing} project={{projectNumber,projectName}} onClose={()=>setEditing(null)} onSave={onSaveEdit} />}

      {hist && (
        <div className="fixed inset-0 bg-black/20 grid place-items-center p-4">
          <div className="card w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-semibold">History — {hist.part.typePrefix}{hist.part.partNumber}</div>
              <button className="btn-ghost" onClick={()=>setHist(null)}><XMarkIcon className="h-5 w-5" /></button>
            </div>
            {hist.data ? (
              <div className="text-sm">
                <div className="mb-2">Latest: <span className="badge badge-muted">{hist.data.latestRev||"—"}</span></div>
                <ul className="space-y-2 max-h-72 overflow-auto">
                  {(hist.data.revisions||[]).map(r=>(
                    <li key={r.rev} className="p-3 rounded-lg border border-slate-200">
                      <div className="font-medium">{r.rev} — {r.filename}</div>
                      <div className="text-xs text-slate-500">{r.createdAt} · {r.notes||"—"}</div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : <div className="text-sm">Loading…</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function PartRow({p, projectNumber, projectName, onReload, onEdit, onHistory}){
  const [busy,setBusy]=useState(false);
  const inputRef = useRef(null);

  async function doRevise(file){
    if(!file) return;
    try{
      setBusy(true);
      await reviseUpload({
        file,
        projectNumber, projectName,
        typePrefix: p.typePrefix,
        partNumber: p.partNumber,
        description: p.description||"",
        notes: "Uploaded via UI"
      });
      await onReload();
      alert(`Revised ${p.typePrefix}${p.partNumber} successfully`);
    }catch(e){
      alert("Upload failed: " + e.message);
    }finally{
      setBusy(false);
      if(inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <tr>
      <td className="td"><PartTypeBadge t={p.typePrefix} /></td>
      <td className="td font-mono">{p.partNumber.padStart(3,"0")}</td>
      <td className="td">{p.description||"—"}</td>
      <td className="td"><span className="badge badge-blue">STEP</span></td>
      <td className="td"><span className="badge badge-muted">{p.latestRev||"—"}</span></td>
      <td className="td text-slate-500">Manual</td>
      <td className="td"><span className="badge badge-muted">Manual</span></td>
      <td className="td">
        <div className="flex items-center gap-1">
          {/* Revise: overlay input covers the green icon — guaranteed user gesture */}
          <div className="relative">
            <button className="icon-btn text-green-700" title="Revise" disabled={busy}>
              <ArrowUpOnSquareIcon className="h-5 w-5" />
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".step,.stp,application/octet-stream"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={e=>doRevise(e.target.files?.[0])}
            />
          </div>

          <button className="icon-btn text-slate-700" title="Edit" onClick={onEdit}>
            <PencilSquareIcon className="h-5 w-5" />
          </button>
          <button className="icon-btn text-slate-700" title="History" onClick={onHistory}>
            <ClockIcon className="h-5 w-5" />
          </button>
          <button className="icon-btn text-orange-500" title="Release" onClick={(e)=>e.stopPropagation()}>
            <BoltIcon className="h-5 w-5" />
          </button>
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
