import React, { useEffect, useMemo, useState } from "react";
import { XMarkIcon, PlusIcon, MinusIcon } from "@heroicons/react/24/outline";
import { linkAssembly } from "../api.assembly.js";

function padCode(part) {
  if (!part) return "";
  return `${part.typePrefix || ""}${String(part.partNumber || "").padStart(3, "0")}`;
}

export default function AddComponentsModal({
  isOpen,
  onClose,
  parent,
  projectNumber,
  projectName,
  parts = [],
  blockedCodes = [],
  onLinked,
  showToast
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState([]);
  const [qtyMap, setQtyMap] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setSelected([]);
    setQtyMap({});
    setError("");
  }, [isOpen, parent?.typePrefix, parent?.partNumber]);

  const parentCode = padCode(parent);
  const blocked = useMemo(() => new Set([parentCode, ...(blockedCodes || [])]), [parentCode, blockedCodes]);

  const eligibleParts = useMemo(() => {
    return (parts || []).filter((part) => {
      const code = padCode(part);
      if (!code) return false;
      if (blocked.has(code)) return false;
      return true;
    });
  }, [parts, blocked]);

  const filteredParts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return eligibleParts;
    return eligibleParts.filter((part) => {
      const code = padCode(part).toLowerCase();
      const desc = (part.description || "").toLowerCase();
      return code.includes(q) || desc.includes(q);
    });
  }, [eligibleParts, query]);

  const selectedCodes = useMemo(() => new Set(selected.map((item) => padCode(item))), [selected]);

  if (!isOpen) return null;

  function addPart(part) {
    const code = padCode(part);
    if (!code || selectedCodes.has(code)) return;
    setSelected((prev) => [...prev, part]);
    setQtyMap((prev) => ({ ...prev, [code]: prev[code] || "1" }));
    setError("");
  }

  function removePart(code) {
    setSelected((prev) => prev.filter((p) => padCode(p) !== code));
    setQtyMap((prev) => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
    setError("");
  }

  function updateQty(code, value) {
    if (/^\d*$/.test(value)) {
      setQtyMap((prev) => ({ ...prev, [code]: value }));
      setError("");
    }
  }

  async function handleLink() {
    if (!parent) {
      setError("Select a parent assembly first.");
      return;
    }
    if (!selected.length) {
      setError("Choose at least one component to link.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      for (const child of selected) {
        const code = padCode(child);
        const qty = Number(qtyMap[code] || 1);
        if (!Number.isInteger(qty) || qty <= 0) {
          throw new Error(`Quantity for ${code} must be 1 or more.`);
        }
        await linkAssembly({
          projectNumber,
          projectName,
          parent,
          child,
          qty
        });
      }
      if (onLinked) await onLinked();
      onClose?.();
      showToast?.(`${selected.length} component${selected.length === 1 ? "" : "s"} linked`);
    } catch (err) {
      const message = err.message || "Unable to link components";
      setError(message);
      showToast?.(message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 grid place-items-center p-4">
      <div className="card w-full max-w-4xl p-6 relative max-h-[90vh] overflow-hidden flex flex-col">
        <button className="absolute right-4 top-4 text-slate-500" onClick={onClose}>
          <XMarkIcon className="h-6 w-6" />
        </button>
        <div className="mb-2">
          <div className="text-xs uppercase tracking-wide text-slate-500">Link components</div>
          <h2 className="text-2xl font-semibold">{parentCode || "Select assembly"}</h2>
          <p className="text-sm text-slate-500 mt-1">
            Search parts, set quantities, and link them into this assembly. Duplicates automatically update their quantity.
          </p>
        </div>

        {error && (
          <div className="mb-3 rounded-xl border border-rose-100 bg-rose-50 text-rose-600 text-sm px-4 py-2">
            {error}
          </div>
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-2 min-h-0 flex-1">
          <div className="flex flex-col border border-slate-200 rounded-2xl p-4 overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <input
                className="input flex-1"
                placeholder="Search by code or description"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <span className="text-xs text-slate-500">{filteredParts.length} results</span>
            </div>
            <div className="flex-1 overflow-auto divide-y divide-slate-100">
              {filteredParts.map((part) => {
                const code = padCode(part);
                const alreadySelected = selectedCodes.has(code);
                return (
                  <div key={code} className="py-2 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-mono text-sm">{code}</div>
                      <div className="text-xs text-slate-500">{part.description || "—"}</div>
                    </div>
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold border ${alreadySelected ? "border-slate-200 text-slate-400 cursor-default" : "border-slate-300 text-slate-700 hover:border-slate-400"}`}
                      disabled={alreadySelected}
                      onClick={() => addPart(part)}
                    >
                      <PlusIcon className="h-4 w-4" />
                      {alreadySelected ? "Added" : "Add"}
                    </button>
                  </div>
                );
              })}
              {!filteredParts.length && (
                <div className="text-sm text-slate-500 py-8 text-center">
                  {query ? "No matches for that search." : "No eligible parts found."}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col border border-slate-200 rounded-2xl p-4 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-slate-700">Selected components</div>
              <div className="text-xs text-slate-500">{selected.length} items</div>
            </div>
            <div className="flex-1 overflow-auto divide-y divide-slate-100">
              {!selected.length && (
                <div className="text-sm text-slate-500 py-10 text-center">
                  Pick parts from the list to build this assembly.
                </div>
              )}
              {selected.map((part) => {
                const code = padCode(part);
                const qty = qtyMap[code] ?? "1";
                const qtyInvalid = qty === "" || Number(qty) <= 0;
                return (
                  <div key={code} className="py-3 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="font-mono text-sm">{code}</div>
                      <div className="text-xs text-slate-500">{part.description || "—"}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="action-icon text-slate-500"
                        onClick={() => {
                          const current = Number(qty || 1);
                          const next = Math.max(1, current - 1);
                          setQtyMap((prev) => ({ ...prev, [code]: String(next) }));
                        }}
                      >
                        <MinusIcon className="h-4 w-4" />
                      </button>
                      <div className="flex flex-col items-end gap-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          className={`w-20 rounded-lg border px-2 py-1 text-right text-xs ${qtyInvalid ? "border-rose-400 text-rose-600 focus:border-rose-500 focus:ring-rose-200" : "border-slate-300 focus:border-slate-400"}`}
                          value={qty}
                          aria-invalid={qtyInvalid || undefined}
                          onChange={(e) => updateQty(code, e.target.value)}
                        />
                        {qtyInvalid && <span className="text-[11px] text-rose-600">Must be 1 or more</span>}
                      </div>
                      <button
                        type="button"
                        className="action-icon text-slate-500"
                        onClick={() => {
                          const current = Number(qty || 1);
                          const next = current + 1;
                          setQtyMap((prev) => ({ ...prev, [code]: String(next) }));
                        }}
                      >
                        <PlusIcon className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="action-icon text-rose-500"
                      onClick={() => removePart(code)}
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleLink}
            disabled={busy || !selected.length}
          >
            {busy ? "Linking…" : `Link ${selected.length || ""} components`}
          </button>
        </div>
      </div>
    </div>
  );
}
