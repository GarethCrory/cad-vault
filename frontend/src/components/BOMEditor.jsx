import React, { useEffect, useMemo, useState } from "react";
import { bomGet, bomUpsert } from "../api.js";
import { XMarkIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";

export default function BOMEditor({ isOpen, onClose, project, parentCode, parts = [], onSaved }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const partMap = useMemo(() => {
    const map = new Map();
    parts.forEach((p) => {
      const code = `${p.typePrefix}${String(p.partNumber).padStart(3,"0")}`;
      map.set(code, { ...p, code });
    });
    return map;
  }, [parts]);

  useEffect(() => {
    if (!isOpen || !parentCode) return;
    fetchChildren();
    setSuccess("");
    setError("");
  }, [isOpen, parentCode]);

  async function fetchChildren(){
    setLoading(true);
    try{
      const res = await bomGet({ projectNumber: project.projectNumber, projectName: project.projectName, parent: parentCode });
      setRows((res.children || []).map(item => ({
        child: item.code,
        qty: item.qty,
        note: item.note || ""
      })));
    }catch(err){
      setRows([]);
      setError(err.message || "Could not load BOM");
    }finally{
      setLoading(false);
    }
  }

  function addRow(){
    const firstCode = parts[0] ? `${parts[0].typePrefix}${String(parts[0].partNumber).padStart(3,"0")}` : "";
    setRows(r => [...r, { child: firstCode, qty: 1, note: "" }]);
  }

  function updateRow(idx, patch){
    setRows(r => r.map((row, i) => i === idx ? { ...row, ...patch } : row));
  }

  function removeRow(idx){
    setRows(r => r.filter((_, i) => i !== idx));
  }

  function validate(){
    for (const row of rows) {
      if (!partMap.has(row.child)) return "All children must reference existing parts";
      if (!Number.isInteger(Number(row.qty)) || Number(row.qty) < 1) return "Quantities must be integers ≥ 1";
    }
    return "";
  }

  async function save(){
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }
    setError("");
    setSaving(true);
    try{
      await bomUpsert({
        projectNumber: project.projectNumber,
        projectName: project.projectName,
        parent: parentCode,
        items: rows
      });
      setSuccess("Saved!");
      await fetchChildren();
      onSaved && onSaved();
    }catch(err){
      setError(err.message || "Could not save BOM");
    }finally{
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 z-50 grid place-items-center p-4">
      <div className="card w-full max-w-2xl p-6 relative">
        <button className="absolute right-4 top-4 text-slate-500" onClick={onClose}><XMarkIcon className="h-5 w-5" /></button>
        <h2 className="text-xl font-semibold mb-1">Bill of Materials</h2>
        <div className="text-sm text-slate-500 mb-4">
          Parent <span className="font-mono text-slate-700">{parentCode}</span>
        </div>

        {loading ? (
          <div className="text-sm text-slate-500">Loading...</div>
        ) : (
          <div className="space-y-3">
            {rows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-5">
                  <label className="text-xs text-slate-500">Child</label>
                  <input
                    list="bom-part-list"
                    className="input mt-1"
                    value={row.child}
                    onChange={e => updateRow(idx, { child: e.target.value.toUpperCase() })}
                    placeholder="Code"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-slate-500">Qty</label>
                  <input
                    type="number"
                    min="1"
                    className="input mt-1"
                    value={row.qty}
                    onChange={e => updateRow(idx, { qty: e.target.value })}
                  />
                </div>
                <div className="col-span-4">
                  <label className="text-xs text-slate-500">Note</label>
                  <input
                    className="input mt-1"
                    value={row.note}
                    onChange={e => updateRow(idx, { note: e.target.value })}
                  />
                </div>
                <div className="col-span-1 flex justify-end mt-5">
                  <button className="btn-ghost text-red-500" onClick={() => removeRow(idx)} title="Remove row">
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="text-sm text-slate-500">No children yet.</div>
            )}
            <button className="btn btn-secondary" type="button" onClick={addRow}>
              <PlusIcon className="h-5 w-5" /> Add Child
            </button>
          </div>
        )}

        {error && <div className="text-sm text-red-600 mt-4">{error}</div>}
        {success && <div className="text-sm text-green-600 mt-4">{success}</div>}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save BOM"}
          </button>
        </div>

        <datalist id="bom-part-list">
          {parts.map((p) => {
            const code = `${p.typePrefix}${String(p.partNumber).padStart(3,"0")}`;
            return <option key={code} value={code}>{`${code} — ${p.description || ""}`}</option>;
          })}
        </datalist>
      </div>
    </div>
  );
}
