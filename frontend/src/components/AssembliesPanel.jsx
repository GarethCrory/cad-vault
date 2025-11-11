import React, { useEffect, useMemo, useState } from "react";
import { LinkIcon, ArrowPathIcon, TrashIcon } from "@heroicons/react/24/outline";
import { listAssembly, unlinkAssembly, updateAssemblyQty } from "../api.assembly.js";

function codeOf(part) {
  if (!part) return "";
  return `${part.typePrefix || ""}${String(part.partNumber || "").padStart(3, "0")}`;
}

export default function AssembliesPanel({
  assemblies = [],
  parts = [],
  selectedPart,
  onSelectPart,
  onLinkRequest,
  projectNumber,
  projectName,
  refreshToken = 0,
  onAssemblyChange,
  showToast
}) {
  const [snapshot, setSnapshot] = useState({ parent: null, children: [], usedIn: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draftQty, setDraftQty] = useState({});
  const [localRefreshKey, setLocalRefreshKey] = useState(0);

  const selectedCode = codeOf(selectedPart);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      if (!selectedPart) {
        setSnapshot({ parent: null, children: [], usedIn: [] });
        setDraftQty({});
        return;
      }
      setLoading(true);
      setError("");
      try {
        const data = await listAssembly({
          projectNumber,
          projectName,
          typePrefix: selectedPart.typePrefix,
          partNumber: selectedPart.partNumber
        });
        if (cancelled) return;
        setSnapshot(data);
        const nextDrafts = {};
        (data.children || []).forEach((child) => {
          nextDrafts[codeOf(child)] = String(child.qty);
        });
        setDraftQty(nextDrafts);
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to load BOM");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [projectNumber, projectName, selectedPart?.typePrefix, selectedPart?.partNumber, refreshToken, localRefreshKey]);

  const assemblyList = assemblies.length ? assemblies : parts.filter((p) => ["A", "S"].includes(p.typePrefix));
  const hasAssemblies = assemblyList.length > 0;
  const noSelection = !selectedPart;
  const partLookup = useMemo(() => {
    const map = new Map();
    (parts || []).forEach((p) => map.set(codeOf(p), p));
    return map;
  }, [parts]);

  const handleQtyChange = (code, value) => {
    setDraftQty((prev) => ({ ...prev, [code]: value }));
  };

  async function handleSaveQty(child) {
    const childCode = codeOf(child);
    const qtyValue = Number(draftQty[childCode]);
    if (!Number.isInteger(qtyValue) || qtyValue <= 0) {
      setError("Quantity must be a positive integer");
      return;
    }
    try {
      setError("");
      await updateAssemblyQty({
        projectNumber,
        projectName,
        parent: selectedPart,
        child,
        qty: qtyValue
      });
      onAssemblyChange?.();
      setLocalRefreshKey((v) => v + 1);
      showToast?.("Quantity updated");
    } catch (err) {
      setError(err.message || "Could not update quantity");
      showToast?.(err.message || "Could not update quantity", "error");
    }
  }

  async function handleUnlink(child) {
    try {
      setError("");
      await unlinkAssembly({
        projectNumber,
        projectName,
        parent: selectedPart,
        child
      });
      onAssemblyChange?.();
      setLocalRefreshKey((v) => v + 1);
      showToast?.("Component unlinked");
    } catch (err) {
      setError(err.message || "Unable to remove link");
      showToast?.(err.message || "Unable to remove link", "error");
    }
  }

  const usedInList = snapshot.usedIn || [];
  const childRows = snapshot.children || [];

  const selectionOptions = useMemo(() => {
    return assemblyList.map((p) => ({
      code: codeOf(p),
      label: `${codeOf(p)} — ${p.description || "Unnamed part"}`
    }));
  }, [assemblyList]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card p-6 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Bill of Materials</div>
            {selectedCode ? (
              <div className="text-lg font-semibold text-slate-900">{selectedCode}</div>
            ) : (
              <div className="text-sm text-slate-500">Select an assembly to manage its structure.</div>
            )}
          </div>
          {hasAssemblies && (
            <select
              className="select w-full lg:w-56"
              value={selectedCode}
              onChange={(e) => {
                const next = assemblyList.find((p) => codeOf(p) === e.target.value);
                onSelectPart?.(next || null);
              }}
            >
              <option value="">Choose parent…</option>
              {selectionOptions.map((opt) => (
                <option key={opt.code} value={opt.code}>{opt.label}</option>
              ))}
            </select>
          )}
        </div>

        {!hasAssemblies && (
          <div className="border border-dashed border-slate-200 rounded-2xl p-6 text-sm text-slate-500">
            Add an Assembly or Sub-assembly first, then you can link child components.
          </div>
        )}

        {hasAssemblies && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn btn-primary text-sm"
                onClick={() => selectedPart && onLinkRequest?.(selectedPart)}
                disabled={noSelection}
              >
                <LinkIcon className="h-5 w-5" />
                Add components
              </button>
              <button
                type="button"
                className="btn-ghost text-sm inline-flex items-center gap-2"
                onClick={() => setLocalRefreshKey((v) => v + 1)}
                disabled={noSelection}
              >
                <ArrowPathIcon className="h-4 w-4" />
                Refresh
              </button>
              <div className="text-xs text-slate-500">
                {loading ? "Loading…" : childRows.length ? `${childRows.length} linked items` : "No components linked yet"}
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm px-4 py-2">
                {error}
              </div>
            )}

            <div className="table-scroll -mx-4">
              <table className="table compact min-w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th text-xs uppercase tracking-wide">Part</th>
                    <th className="th text-xs uppercase tracking-wide">Description</th>
                    <th className="th text-xs uppercase tracking-wide text-right">Qty</th>
                    <th className="th text-xs uppercase tracking-wide text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loading && (
                    <tr>
                      <td colSpan={4} className="td text-sm py-6 text-center text-slate-500">Loading BOM…</td>
                    </tr>
                  )}
                  {!loading && !childRows.length && (
                    <tr>
                      <td colSpan={4} className="td text-sm py-6 text-center text-slate-500">
                        No components linked yet. Use “Add components” to start building the BOM.
                      </td>
                    </tr>
                  )}
                  {!loading && childRows.map((child) => {
                    const childCode = codeOf(child);
                    const meta = partLookup.get(childCode);
                    return (
                      <tr key={childCode}>
                        <td className="td font-mono text-sm">{childCode}</td>
                        <td className="td text-sm text-slate-600 truncate max-w-[32ch]">{meta?.description || "—"}</td>
                        <td className="td">
                          <div className="flex items-center justify-end gap-2">
                            <input
                              type="number"
                              min="1"
                              value={draftQty[childCode] ?? child.qty}
                              onChange={(e) => handleQtyChange(childCode, e.target.value)}
                              className="w-20 rounded-lg border border-slate-300 text-sm px-2 py-1 text-right"
                            />
                            <button
                              type="button"
                              className="btn-ghost text-xs font-semibold"
                              onClick={() => handleSaveQty(child)}
                              disabled={loading}
                            >
                              Save
                            </button>
                          </div>
                        </td>
                        <td className="td">
                          <div className="flex justify-end">
                            <button
                              type="button"
                              className="action-icon text-rose-500 hover:text-rose-600"
                              onClick={() => handleUnlink(child)}
                              title="Unlink component"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="card p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Used In</div>
            {selectedCode && <div className="font-semibold">{selectedCode}</div>}
          </div>
        </div>
        <div className="divide-y divide-slate-200 rounded-xl border border-slate-100">
          {!usedInList.length && (
            <div className="text-sm text-slate-500 px-4 py-6 text-center">
              {selectedCode ? "This part is not referenced by any assemblies yet." : "Select a part to see where it is used."}
            </div>
          )}
          {usedInList.map((row) => {
            const parentCode = codeOf(row.parent);
            const meta = partLookup.get(parentCode);
            return (
              <div key={`${parentCode}-${row.qty}`} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-sm">{parentCode}</div>
                  <div className="text-xs text-slate-500">{meta?.description || "—"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    Qty {row.qty}
                  </span>
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    onClick={() => {
                      const next = assemblyList.find((p) => codeOf(p) === parentCode) || row.parent;
                      onSelectPart?.(next);
                    }}
                  >
                    View
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
