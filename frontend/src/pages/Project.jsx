import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { scanProject, history, editPart, generateRelease, API_BASE, bomTree, bomGet, deletePart, listAttachments, uploadAttachments, deleteAttachment } from "../api.js";
import { linkAssembly } from "../api.assembly.js";
import { listAssembly } from "../api.assembly.js";
import { PencilSquareIcon, ClockIcon, BoltIcon, ArrowUpTrayIcon, XMarkIcon, CheckCircleIcon, LinkIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import HistoryModal from "../components/HistoryModal";
import AssembliesPanel from "../components/AssembliesPanel.jsx";
import AddComponentsModal from "../components/AddComponentsModal.jsx";
import SegmentedControl from "../components/SegmentedControl.jsx";

const typeColors = {
  P: "bg-zinc-200 text-zinc-800",
  S: "bg-zinc-300 text-zinc-900",
  A: "bg-zinc-200 text-zinc-800",
  H: "bg-zinc-100 text-zinc-700",
  O: "bg-zinc-100 text-zinc-700"
};

const PartTypeBadge = ({ t }) => {
  const palette = typeColors[t] || "bg-slate-100 text-slate-700";
  return <span className={`badge ${palette}`}>{t}</span>;
};

function pad3(n){ return String(n).padStart(3,"0"); }

function partCode(part){
  if(!part) return "";
  return `${part.typePrefix || ""}${pad3(part.partNumber || "0")}`;
}

function splitCode(code=""){
  const cleaned = String(code || "").trim().toUpperCase();
  if(!cleaned) return null;
  return { typePrefix: cleaned[0], partNumber: cleaned.slice(1) };
}

function ReleaseTab({ project, parts = [], onPublish, assemblyChildCounts = {} }) {
  const [tag, setTag] = useState(new Date().toISOString().split('T')[0]);
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    setSelected(prev => {
      const next = new Set([...prev].filter(id => parts.some(p => `${p.typePrefix}${pad3(p.partNumber)}` === id)));
      return next;
    });
  }, [parts]);

  function toggle(id){
    setSelected(s => {
      const n = new Set(s);
      if(n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function selectAll(){
    setSelected(new Set(parts.map(p => `${p.typePrefix}${pad3(p.partNumber)}`)));
  }
  function deselectAll(){
    setSelected(new Set());
  }

  async function publish(){
    const files = [...selected];
    onPublish && onPublish({ tag, files });
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="font-semibold mb-4">Configure Client Release</h3>
        
        <label className="text-xs text-slate-600">Release Tag</label>
        <input 
          type="text" 
          className="input mb-4" 
          value={tag}
          onChange={e => setTag(e.target.value)}
          placeholder="YYYY-MM-DD"
        />
        <div className="text-xs text-slate-500 mb-6">Used in ZIP filename and directory structure</div>

        <div className="flex items-center gap-2 mb-4">
          <button className="btn-ghost text-sm" onClick={deselectAll}>
            Deselect All
          </button>
          <button className="btn-ghost text-sm" onClick={selectAll}>
            Select All
          </button>
          <div className="flex-1 text-right text-xs text-slate-500">
            {selected.size} of {parts.length} selected
          </div>
        </div>

        <div className="space-y-2">
          {parts.map(p => {
            const id = `${p.typePrefix}${pad3(p.partNumber)}`;
            const revForFile = stripRevPrefix(p.latestRev || "") || "?";
            const fileLabel = p.latestFile || `${project.projectNumber}_${p.typePrefix}${pad3(p.partNumber)}_Rev${revForFile}.step`;
            const childCount = assemblyChildCounts[id] || 0;
            return (
              <label key={id} className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
                <input type="checkbox" checked={selected.has(id)} onChange={() => toggle(id)} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    <span>{p.description || id}</span>
                    {childCount > 0 && (
                      <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-[0.65rem] font-semibold text-slate-700">
                        ASM · {childCount} child{childCount === 1 ? "" : "ren"}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 font-mono mt-1">{fileLabel}</div>
                </div>
                <div className="ml-4">
                  <span className="badge badge-blue">CAD</span>
                </div>
              </label>
            );
          })}
          {parts.length === 0 && <div className="text-sm text-slate-500 p-4">No files available for release.</div>}
        </div>

        <button 
          className="btn btn-primary w-full mt-6"
          onClick={publish}
          disabled={selected.size === 0}
        >
          Publish Release ({selected.size} files)
        </button>
      </div>

      <div className="card">
        <div className="px-6 py-4">
          <h3 className="font-semibold">Previous Releases</h3>
        </div>
        <div className="border-t border-slate-200">
          <div className="p-6 text-sm text-slate-500">No previous releases</div>
        </div>
      </div>
    </div>
  );
}

export default function Project(){
  const { projectNumber, projectName } = useParams();
  const [parts, setParts] = useState([]);
  const [projectMeta, setProjectMeta] = useState({ projectNumber, projectName, partCount: 0 });
  const project = useMemo(() => ({
    projectNumber,
    projectName,
    partCount: projectMeta.partCount ?? parts.length
  }), [projectNumber, projectName, projectMeta.partCount, parts.length]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState({ projectCode: null, partNumber: null });
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [releaseSuccess, setReleaseSuccess] = useState(false);
  const [releasePath, setReleasePath] = useState("");
  const [revUpOpen, setRevUpOpen] = useState(false);
  const [revUpSelected, setRevUpSelected] = useState(null);
  const [activeTab, setActiveTab] = useState('files');

  const types = useMemo(() => ([
    { key: "P", label: "Parts" },
    { key: "S", label: "Sub-assemblies" },
    { key: "A", label: "Assemblies" },
    { key: "H", label: "Hardware" },
    { key: "O", label: "OEM" }
  ]), []);

  // compute next number per type (e.g. P -> "003")
  const perTypeNext = useMemo(() => {
    const next = {};
    types.forEach(t => next[t.key] = "001");
    (parts || []).forEach(p => {
      const n = parseInt(p.partNumber, 10) || 0;
      if (!Number.isNaN(n)) {
        const candidate = String(n + 1).padStart(3, "0");
        if (parseInt(candidate, 10) > parseInt(next[p.typePrefix], 10)) {
          next[p.typePrefix] = candidate;
        }
      }
    });
    return next;
  }, [parts]);

  // keep old single nextPartNumber (for header card) but prefer Parts next
  const nextPartNumber = perTypeNext.P || "001";

  // UI state: grouped vs flat
  const [viewMode, setViewMode] = useState("grouped");
  const viewOptions = useMemo(() => ([
    { key: "grouped", label: "Grouped" },
    { key: "flat", label: "Flat" },
    { key: "hierarchy", label: "Hierarchy" }
  ]), []);
  const [selectedAssemblyPart, setSelectedAssemblyPart] = useState(null);
  const [linkModalPart, setLinkModalPart] = useState(null);
  const [parentLinkTarget, setParentLinkTarget] = useState(null);
  const [bulkAttachOpen, setBulkAttachOpen] = useState(false);
  const [linkModalBlocked, setLinkModalBlocked] = useState([]);
  const [assemblyRefreshKey, setAssemblyRefreshKey] = useState(0);
  const [bomChildren, setBomChildren] = useState({});
  const [bomParents, setBomParents] = useState({});
  const [hierarchyRootCode, setHierarchyRootCode] = useState("");
  const [hierarchyTree, setHierarchyTree] = useState(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [hierarchyError, setHierarchyError] = useState("");
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);


  const assemblyChildCounts = useMemo(() => {
    const map = {};
    Object.entries(bomChildren).forEach(([parent, list]) => {
      map[parent] = list.length;
    });
    return map;
  }, [bomChildren]);

  const assemblyCandidates = useMemo(
    () => (parts || []).filter(p => ["A", "S"].includes(p.typePrefix)),
    [parts]
  );

  useEffect(() => {
    if (!assemblyCandidates.length) {
      if (selectedAssemblyPart) setSelectedAssemblyPart(null);
      return;
    }
    const selectedCode = selectedAssemblyPart ? `${selectedAssemblyPart.typePrefix}${selectedAssemblyPart.partNumber}` : null;
    if (!selectedCode) {
      setSelectedAssemblyPart(assemblyCandidates[0]);
      return;
    }
    const match = assemblyCandidates.find(p => `${p.typePrefix}${p.partNumber}` === selectedCode);
    if (match && match !== selectedAssemblyPart) {
      setSelectedAssemblyPart(match);
    } else if (!match) {
      setSelectedAssemblyPart(assemblyCandidates[0]);
    }
  }, [assemblyCandidates, selectedAssemblyPart]);

  useEffect(() => {
    if (!assemblyCandidates.length) {
      if (hierarchyRootCode) {
        setHierarchyRootCode("");
      }
      setHierarchyTree(null);
      return;
    }
    const exists = assemblyCandidates.some(p => partCode(p) === hierarchyRootCode);
    if (!hierarchyRootCode || !exists) {
      setHierarchyRootCode(partCode(assemblyCandidates[0]));
    }
  }, [assemblyCandidates, hierarchyRootCode]);

  useEffect(() => {
    let cancelled = false;
    async function loadBomSummary(){
      try{
        const res = await bomGet({ projectNumber, projectName });
        if (cancelled) return;
        const items = res.items || [];
        const childMap = {};
        const parentMap = {};
        items.forEach(item => {
          if (!childMap[item.parent]) childMap[item.parent] = [];
          childMap[item.parent].push({ code: item.child, qty: item.qty, note: item.note || "" });
          if (!parentMap[item.child]) parentMap[item.child] = [];
          parentMap[item.child].push({ code: item.parent, qty: item.qty });
        });
        setBomChildren(childMap);
        setBomParents(parentMap);
      }catch(err){
        if (!cancelled) {
          setBomChildren({});
          setBomParents({});
        }
      }
    }
    loadBomSummary();
    return () => { cancelled = true; };
  }, [projectNumber, projectName, assemblyRefreshKey]);

  useEffect(() => {
    if (viewMode !== "hierarchy" || !hierarchyRootCode) {
      return;
    }
    let cancelled = false;
    setHierarchyLoading(true);
    setHierarchyError("");
    bomTree({
      projectNumber,
      projectName,
      root: hierarchyRootCode
    })
      .then((res) => {
        if (cancelled) return;
        setHierarchyTree(res.tree || null);
      })
      .catch((err) => {
        if (cancelled) return;
        setHierarchyTree(null);
        setHierarchyError(err.message || "Unable to build hierarchy");
      })
      .finally(() => {
        if (!cancelled) setHierarchyLoading(false);
      });
    return () => { cancelled = true; };
  }, [viewMode, hierarchyRootCode, projectNumber, projectName, assemblyRefreshKey]);

  // which type panels are expanded (Parts open by default)
  const [expandedTypes, setExpandedTypes] = useState(() => {
    const init = {};
    types.forEach(t => { init[t.key] = t.key === "P"; });
    return init;
  });
  function toggleType(key){ setExpandedTypes(s => ({ ...s, [key]: !s[key] })); }

  useEffect(() => {
    setExpandedTypes(prev => {
      const next = { ...prev };
      let changed = false;
      types.forEach(section => {
        const hasItems = parts.some(part => part.typePrefix === section.key);
        if (hasItems && !next[section.key]) {
          next[section.key] = true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [parts, types]);
  
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try{
      const sc = await scanProject(projectNumber, projectName);
      const nextParts = sc?.parts || [];
      const nextCount = typeof sc?.partCount === "number"
        ? sc.partCount
        : typeof sc?.partsCount === "number"
          ? sc.partsCount
          : nextParts.length;
      setParts(nextParts);
      setProjectMeta(prev => ({
        ...(prev || {}),
        projectNumber,
        projectName,
        partCount: nextCount
      }));
    }catch(e){
      setError("Could not load project parts");
    }finally{
      setLoading(false);
    }
  }, [projectNumber, projectName]);

  useEffect(()=>{ refresh(); }, [refresh]);

  function openAdd(){ setShowAdd(true); }
  function closeAdd(){ setShowAdd(false); }

  async function onSaveEdit(form){
    try{
      await editPart({
        projectNumber,
        projectName,
        typePrefix: form.typePrefix,
        partNumber: form.partNumber,
        description: form.description,
        notes: form.notes || ""
      });
      setEditing(null);
      await refresh();
      showToast("Part updated");
    }catch(err){
      console.error("Edit failed", err);
      showToast(err.message || "Unable to save changes","error");
      throw err;
    }
  }

  function openHistory(p) {
    const projectCode = `${projectNumber}_${projectName}`;
    const partNumber = `${p.typePrefix}${String(p.partNumber).padStart(3,"0")}`;
    setHistoryTarget({ projectCode, partNumber });
    setHistoryOpen(true);
  }

  async function handleRelease(opts) {
    setReleaseLoading(true);
    try {
      const payload = {
        projectNumber,
        projectName,
        tag: opts?.tag || new Date().toISOString().split('T')[0],
        files: opts?.files || []
      };
      const result = await generateRelease(payload);
      setReleasePath(result.path || "");
      setReleaseSuccess(true);
      setTimeout(() => setReleaseSuccess(false), 3000);
    } catch (err) {
      console.error("Release failed:", err);
    } finally {
      setReleaseLoading(false);
    }
  }

  function openRevUpFor(part){
    setRevUpSelected(part);
    setRevUpOpen(true);
  }

  const handleAssemblyChange = useCallback(async () => {
    setAssemblyRefreshKey(v => v + 1);
    await refresh();
  }, [refresh]);

  async function handlePartDeleted(){
    setEditing(null);
    await handleAssemblyChange();
    showToast("Part deleted");
  }

  const showToast = useCallback((message, variant = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, variant });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  async function openLinkModal(part){
    if (!part) return;
    setLinkModalPart(part);
    setLinkModalBlocked([]);
    try{
      const snapshot = await listAssembly({
        projectNumber,
        projectName,
        typePrefix: part.typePrefix,
        partNumber: part.partNumber
      });
      const existing = (snapshot.children || []).map(child => partCode(child));
      setLinkModalBlocked(existing);
    }catch(err){
      console.error("Failed to pre-load assembly links", err);
    }
  }

  function openParentLink(part) {
    if (!part) return;
    if (!assemblyCandidates.length) {
      alert("Add an Assembly or Sub-assembly first to link parts.");
      return;
    }
    setParentLinkTarget(part);
  }

  return (
    <div className="page-container compact">
      <div className="space-y-6 w-full">
        <div>
          <Link to="/" className="back-link">
            <ArrowLeftIcon className="h-4 w-4" />
            <span>Back to Projects</span>
          </Link>
        </div>

        <div className="card p-6 grid gap-6 lg:grid-cols-2 items-start">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-ink text-white grid place-items-center text-2xl">📁</div>
            <div>
              <div className="flex items-center gap-2 whitespace-nowrap">
                <span className="text-xs text-slate-500">{projectNumber}</span>
                <span className="badge badge-green">active</span>
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight">{projectName}</h2>
              <div className="text-xs text-slate-500 mt-1">Client release management</div>
            </div>
          </div>

          <div className="flex flex-col gap-4 w-full lg:w-auto lg:items-end">
            <div className="flex flex-wrap items-center gap-2 justify-start lg:justify-end">
              <button 
                className="btn btn-secondary"
                onClick={() => setRevUpOpen(true)}
                disabled={releaseLoading}
                title="Rev up"
              >
                <BoltIcon className="h-6 w-6" />
                Rev Up
              </button>
              <button className="btn btn-primary" onClick={openAdd}>
                <ArrowUpTrayIcon className="h-6 w-6" />
                Add File
              </button>
              <button className="btn btn-secondary" onClick={() => setBulkAttachOpen(true)}>
                Attach PDFs
              </button>
            </div>

            <div className="project-stats grid grid-cols-2 gap-4 w-full lg:w-auto">
              <div className="stat-card p-4 rounded-lg text-center">
                <div className="text-sm text-slate-500">Total Parts</div>
                <div className="text-2xl font-bold">{parts.length}</div>
              </div>
              <div className="stat-card p-4 rounded-lg text-center">
                <div className="text-sm text-slate-500">Next Part #</div>
                <div className="text-2xl font-bold text-orange-500">{nextPartNumber}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="tabbar no-border">
          <button 
            className={`tab ${activeTab === 'files' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('files')}
          >
            Files & Parts
          </button>
          <button
            className={`tab ${activeTab === 'assemblies' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('assemblies')}
          >
            Assemblies
          </button>
          <button 
            className={`tab ${activeTab === 'release' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('release')}
          >
            Client Release
          </button>
        </div>

        {activeTab === 'files' && (
        <div className="card overflow-hidden">
            <div className="px-6 py-4 flex flex-wrap items-center gap-4 justify-between">
              <div className="font-semibold">Parts & Files</div>
              <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                <div className="count-chip" aria-label={`${parts.length} parts`}>
                  <span className="count-chip__value">{parts.length}</span>
                  <span className="count-chip__label">parts</span>
                </div>
                <SegmentedControl
                  options={viewOptions.map(option => ({ value: option.key, label: option.label }))}
                  value={viewMode}
                  onChange={setViewMode}
                />
              </div>
            </div>

            { loading ? (
              <div className="px-6 pb-6 text-sm text-slate-500">Loading parts…</div>
            ) : viewMode === "grouped" ? (
              <div className="space-y-4 px-6 pb-6">
                {types.map(t => {
                  const group = parts.filter(p => p.typePrefix === t.key);
                  const expanded = !!expandedTypes[t.key];
                  const smallEmpty = !expanded && group.length === 0;
                  return (
                    <div key={t.key} className={`card ${smallEmpty ? 'p-3' : 'p-4'}`}>
                      <div
                        className="flex items-center justify-between mb-3 cursor-pointer"
                        onClick={() => toggleType(t.key)}
                        role="button"
                        tabIndex={0}
                      >
                        <div>
                          <div className="text-lg font-bold">{t.label}</div>
                          <div className="text-xs text-slate-400">{group.length} items</div>
                        </div>
                        <div className="text-xs text-slate-500">{expanded ? 'Collapse' : 'Expand'}</div>
                      </div>

                      {expanded && (
              <div className="table-scroll px-6 pb-6">
                <table className="table compact">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="th text-xs h-12">Type</th>
                                <th className="th text-xs h-12">Part #</th>
                                <th className="th text-xs h-12">Description</th>
                                <th className="th text-xs h-12">File</th>
                                <th className="th text-xs h-12">Rev</th>
                                <th className="th text-xs h-12">Notes</th>
                                <th className="th text-xs h-12">Source</th>
                                <th className="th text-xs h-12 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {group.map(item => (
                                <PartRow key={item.typePrefix + "-" + item.partNumber}
                                  p={item}
                                  projectNumber={projectNumber}
                                  projectName={projectName}
                                  onEdit={()=>setEditing(item)}
                                  onHistory={()=>openHistory(item)}
                                  onRevUp={()=>openRevUpFor(item)}
                                  onLink={() => openLinkModal(item)}
                                  onParentLink={() => openParentLink(item)}
                                  hasChildren={Boolean(assemblyChildCounts[partCode(item)])}
                                  childLinks={bomChildren[partCode(item)] || []}
                                  parentLinks={bomParents[partCode(item)] || []}
                                  canLinkToAssembly={assemblyCandidates.length > 0}
                                />
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {/* keep minimal footprint when expanded & empty */}
                      {expanded && group.length === 0 && <div className="h-12" />}
                    </div>
                  );
                })}
              </div>
            ) : viewMode === "flat" ? (
              // flat table (single table with header) when not grouped
              <div className="table-scroll px-6 pb-6">
                <table className="table compact">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="th text-xs h-12">Type</th>
                      <th className="th text-xs h-12">Part #</th>
                      <th className="th text-xs h-12">Description</th>
                      <th className="th text-xs h-12">File</th>
                      <th className="th text-xs h-12">Rev</th>
                      <th className="th text-xs h-12">Notes</th>
                      <th className="th text-xs h-12">Source</th>
                      <th className="th text-xs h-12 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {loading && <tr><td className="td text-sm py-2 leading-tight" colSpan="8">Loading…</td></tr>}
                    {!loading && parts.length===0 && <tr><td className="td text-sm py-2 leading-tight" colSpan="8">No parts yet.</td></tr>}
                    {!loading && parts.map(p => (
                      <PartRow
                        key={p.typePrefix + "-" + p.partNumber}
                        p={p}
                        projectNumber={projectNumber}
                        projectName={projectName}
                        onEdit={()=>setEditing(p)}
                        onHistory={()=>openHistory(p)}
                        onRevUp={()=>openRevUpFor(p)}
                        onLink={() => openLinkModal(p)}
                        onParentLink={() => openParentLink(p)}
                        hasChildren={Boolean(assemblyChildCounts[partCode(p)])}
                        childLinks={bomChildren[partCode(p)] || []}
                        parentLinks={bomParents[partCode(p)] || []}
                        canLinkToAssembly={assemblyCandidates.length > 0}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 pb-6 space-y-4">
                {assemblyCandidates.length === 0 ? (
                  <div className="text-sm text-slate-500 border border-dashed border-slate-300 rounded-2xl px-4 py-6">
                    Create an Assembly or Sub-assembly first to explore the hierarchy.
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-3">
                      <select
                        className="select w-full md:w-64"
                        value={hierarchyRootCode}
                        onChange={(e) => setHierarchyRootCode(e.target.value)}
                      >
                        {assemblyCandidates.map((part) => {
                          const code = partCode(part);
                          return (
                            <option key={code} value={code}>
                              {code} — {part.description || "Untitled"}
                            </option>
                          );
                        })}
                      </select>
                      <button
                        type="button"
                        className="btn-ghost text-sm"
                        onClick={() => setAssemblyRefreshKey((v) => v + 1)}
                      >
                        Refresh tree
                      </button>
                    </div>
                    {hierarchyError && (
                      <div className="rounded-xl border border-rose-100 bg-rose-50 text-rose-600 text-sm px-4 py-2">
                        {hierarchyError}
                      </div>
                    )}
                    {hierarchyLoading && (
                      <div className="text-sm text-slate-500 px-4 py-6 border border-dashed border-slate-200 rounded-2xl">
                        Building hierarchy…
                      </div>
                    )}
                    {!hierarchyLoading && hierarchyTree && (
                      <HierarchyTreeView tree={hierarchyTree} />
                    )}
                    {!hierarchyLoading && !hierarchyTree && !hierarchyError && (
                      <div className="text-sm text-slate-500 px-4 py-6 border border-dashed border-slate-200 rounded-2xl">
                        No hierarchy found for {hierarchyRootCode}. Add children from the Assemblies tab to populate this view.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'assemblies' && (
          <AssembliesPanel
            projectNumber={projectNumber}
            projectName={projectName}
            assemblies={assemblyCandidates}
            parts={parts}
            selectedPart={selectedAssemblyPart}
                        onSelectPart={setSelectedAssemblyPart}
            onLinkRequest={openLinkModal}
            refreshToken={assemblyRefreshKey}
            onAssemblyChange={handleAssemblyChange}
            showToast={showToast}
          />
        )}

        {activeTab === 'release' && (
          <ReleaseTab 
            project={project}
            parts={parts}
            onPublish={handleRelease}
            assemblyChildCounts={assemblyChildCounts}
          />
        )}

        {editing && (
          <EditModal
            p={editing}
            project={{projectNumber,projectName}}
            assemblies={assemblyCandidates}
            parts={parts}
            childLinks={bomChildren[partCode(editing)] || []}
            parentLinks={bomParents[partCode(editing)] || []}
            onClose={()=>setEditing(null)}
            onSave={onSaveEdit}
            onAssemblyLinked={handleAssemblyChange}
            onDeleted={handlePartDeleted}
            showToast={showToast}
          />
        )}
        {showAdd && (
          <AddFileModal
            project={project}
            defaultType="P"
            defaultPartNumber={nextPartNumber}
            perTypeNext={perTypeNext}
            assemblies={assemblyCandidates}
            parts={parts}
            onClose={closeAdd}
            onSaved={async ()=>{ closeAdd(); await refresh(); }}
            onLinked={handleAssemblyChange}
          />
        )}
        {revUpOpen && (
          <RevUpModal
            parts={parts}
            project={project}
            initialSelected={revUpSelected}
            onClose={() => { setRevUpOpen(false); setRevUpSelected(null); }}
            onSaved={async () => { setRevUpOpen(false); setRevUpSelected(null); await refresh(); }}
          />
        )}
        <HistoryModal 
          isOpen={historyOpen}
          onClose={() => setHistoryOpen(false)}
          projectCode={historyTarget.projectCode}
          partNumber={historyTarget.partNumber}
        />
        <AddComponentsModal
          isOpen={!!linkModalPart}
          onClose={() => setLinkModalPart(null)}
          parent={linkModalPart}
          projectNumber={projectNumber}
          projectName={projectName}
          parts={parts}
          blockedCodes={linkModalBlocked}
          showToast={showToast}
          onLinked={async () => {
            await handleAssemblyChange();
            setLinkModalPart(null);
          }}
        />
        <LinkToAssemblyModal
          isOpen={!!parentLinkTarget}
          part={parentLinkTarget}
          assemblies={assemblyCandidates}
          project={project}
          onClose={() => setParentLinkTarget(null)}
           onLinked={async () => {
            await handleAssemblyChange();
            setParentLinkTarget(null);
          }}
        />
        <BulkAttachmentModal
          isOpen={bulkAttachOpen}
          onClose={() => setBulkAttachOpen(false)}
          project={project}
          onUploaded={async () => {
            await refresh();
            setBulkAttachOpen(false);
          }}
          showToast={showToast}
        />

        {releaseSuccess && (
          <div className="fixed bottom-4 right-4 bg-green-50 text-green-700 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2">
            <CheckCircleIcon className="h-6 w-6" />
            <div>
              <div className="font-medium">Release generated!</div>
              {releasePath && (
                <div className="text-sm">Path: {releasePath}</div>
              )}
            </div>
          </div>
        )}
        {toast && <Toast notification={toast} onDismiss={() => setToast(null)} />}
      </div>
    </div>
  );
}

function parseDescription(filename) {
  if (!filename) return "";
  const match = /_Rev[A-Z]_(.+)\.[^.]+$/.exec(filename);
  return match ? match[1].replace(/[-_]/g, " ").trim() : "";
}

function stripRevPrefix(value = "") {
  if (!value) return "";
  return String(value).trim().replace(/^rev/i, "");
}

function formatRevLabel(value = "") {
  const plain = stripRevPrefix(value);
  return plain ? `Rev${plain}` : "";
}

// Update PartNumberCell to show simplified part numbers
function PartNumberCell({ typePrefix, partNumber, tooltip }) {
  const displayNumber = `${typePrefix}${String(partNumber).padStart(3,"0")}`;
  
  return (
    <div className="relative group">
      <span className="font-mono">{displayNumber}</span>
      <div className="absolute hidden group-hover:block bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap">
        {tooltip}
      </div>
    </div>
  );
}

function PartRow({ p, projectNumber, projectName, onEdit, onHistory, onRevUp, onLink, onParentLink, hasChildren, canLinkToAssembly, childLinks = [], parentLinks = [] }) {
  const [latest, setLatest] = useState(p.latestRev || "");
  const [latestFile, setLatestFile] = useState(p.latestFile || "");
  useEffect(() => {
    setLatest(p.latestRev || "");
  }, [p.latestRev]);
  useEffect(() => {
    setLatestFile(p.latestFile || "");
  }, [p.latestFile]);
  useEffect(() => {
    let mounted = true;
    // only fetch history if we don't already have rev/file info
    if (!p.latestRev && !p.latestFile) {
      history({ projectNumber, projectName, typePrefix: p.typePrefix, partNumber: p.partNumber })
        .then(h => {
          if (!mounted) return;
          setLatest(h.latestRev || "");
          setLatestFile(h.latestFile || "");
        })
        .catch(() => {/* noop */});
    }
    return () => { mounted = false; };
  }, [p, projectNumber, projectName]);

  const rev = p.latestRev || p.rev || latest || "";
  const revLabel = formatRevLabel(rev);
  const desc = p.description || parseDescription(latestFile) || "—";
  const isAssembly = ["A","S"].includes(p.typePrefix);
  const partLabel = `${p.typePrefix}${pad3(p.partNumber)} — ${p.description || "Untitled component"}`;
  const code = partCode(p);
  const linkEnabled = isAssembly || canLinkToAssembly;
  return (
    <tr>
      <td className="td text-sm py-2 leading-tight" data-label="Type"><PartTypeBadge t={p.typePrefix} /></td>
      <td className="td text-sm py-2 leading-tight" data-label="Part #">
        <PartNumberCell
          typePrefix={p.typePrefix}
          partNumber={p.partNumber}
          tooltip={latestFile || "No source file"}
        />
      </td>
      <td className="td text-sm py-2 leading-tight" data-label="Description">
        <div className="flex flex-col gap-1 max-w-[40ch]">
          <div className="flex items-center gap-2 truncate">
            <span className="truncate">{desc}</span>
            {isAssembly && hasChildren && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600">
                ASM
              </span>
            )}
          </div>
          {isAssembly && childLinks.length > 0 && (
            <div className="flex flex-wrap gap-1 text-[0.7rem] text-slate-500">
              {childLinks.slice(0,4).map(link => (
                <span key={link.code} className="px-2 py-0.5 rounded-full bg-slate-100 font-mono">{link.code}×{link.qty}</span>
              ))}
              {childLinks.length > 4 && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100">+{childLinks.length - 4} more</span>
              )}
            </div>
          )}
          {!isAssembly && parentLinks.length > 0 && (
            <div className="flex flex-wrap gap-1 text-[0.7rem] text-slate-500">
              {parentLinks.slice(0,4).map(link => (
                <span key={link.code} className="px-2 py-0.5 rounded-full bg-amber-50 font-mono">↳ {link.code}×{link.qty}</span>
              ))}
              {parentLinks.length > 4 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-50">+{parentLinks.length - 4} more</span>
              )}
            </div>
          )}
        </div>
      </td>
      <td className="td text-sm py-2 leading-tight" data-label="File"><span className="chip chip-step">STEP</span></td>
      <td className="td text-sm py-2 leading-tight" data-label="Rev">
        {revLabel ? <span className="chip chip-rev">{revLabel}</span> : <span className="text-slate-400">—</span>}
      </td>
      <td className="td text-sm py-2 leading-tight text-slate-500" data-label="Notes">Manual</td>
      <td className="td text-sm py-2 leading-tight" data-label="Source"><span className="badge badge-muted">Manual</span></td>
      <td className="td text-sm py-2 leading-tight cell-actions" data-label="Actions">
        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
          <button
            onClick={() => (isAssembly ? onLink?.(p) : onParentLink?.(p))}
            title={linkEnabled ? (isAssembly ? "Manage components" : "Link to assembly") : "Add an assembly first"}
            className="action-icon"
            type="button"
            aria-label={isAssembly ? `Link components for ${code}` : `Link ${code} to assembly`}
          >
            <LinkIcon className="h-6 w-6" />
          </button>
          <button onClick={onEdit} title="Edit" className="action-icon" type="button">
            <PencilSquareIcon className="h-6 w-6" />
          </button>
          <button onClick={() => onHistory?.(p)} title="History" className="action-icon" type="button">
            <ClockIcon className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={() => onRevUp?.(p)}
            title="Rev Up"
            className="action-icon cursor-pointer text-orange-500 hover:text-orange-600"
            aria-label={`Rev up ${p.typePrefix}${pad3(p.partNumber)}`}
          >
            <BoltIcon className="h-6 w-6" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function EditModal({p, project: projectInfo, assemblies = [], parts = [], childLinks = [], parentLinks = [], onClose, onSave, onAssemblyLinked, onDeleted, showToast}){
  const [desc,setDesc] = useState(p.description||"");
  const [type,setType] = useState(p.typePrefix);
  const [note,setNote] = useState("");
  const [parentAssembly, setParentAssembly] = useState("");
  const [parentQty, setParentQty] = useState(1);
  const [childPick, setChildPick] = useState("");
  const [childQty, setChildQty] = useState(1);
  const [linkBusy, setLinkBusy] = useState(false);
  const [childBusy, setChildBusy] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [childError, setChildError] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const partLabel = `${p.typePrefix}${pad3(p.partNumber)} — ${p.description || "Untitled component"}`;
  const project = projectInfo || { projectNumber: "", projectName: "" };
  const [attachments, setAttachments] = useState([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentsError, setAttachmentsError] = useState("");
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function fetchAttachments() {
      setAttachmentsLoading(true);
      setAttachmentsError("");
      try {
        const res = await listAttachments({
          projectNumber: project.projectNumber,
          projectName: project.projectName,
          typePrefix: p.typePrefix,
          partNumber: p.partNumber
        });
        if (!cancelled) {
          setAttachments(res.attachments || []);
        }
      } catch (err) {
        if (!cancelled) setAttachmentsError(err.message || "Unable to load attachments");
      } finally {
        if (!cancelled) setAttachmentsLoading(false);
      }
    }
    fetchAttachments();
    return () => { cancelled = true; };
  }, [project.projectNumber, project.projectName, p.typePrefix, p.partNumber]);

  async function handleAttachmentUpload(files){
    if (!files?.length) return;
    setUploadingAttachments(true);
    setAttachmentsError("");
    try{
      await uploadAttachments({
        projectNumber: project.projectNumber,
        projectName: project.projectName,
        typePrefix: p.typePrefix,
        partNumber: p.partNumber,
        files: Array.from(files)
      });
      const res = await listAttachments({
        projectNumber: project.projectNumber,
        projectName: project.projectName,
        typePrefix: p.typePrefix,
        partNumber: p.partNumber
      });
      setAttachments(res.attachments || []);
      showToast?.(`${files.length} attachment${files.length > 1 ? "s" : ""} uploaded`);
    }catch(err){
      setAttachmentsError(err.message || "Upload failed");
      showToast?.(err.message || "Attachment upload failed","error");
    }finally{
      setUploadingAttachments(false);
    }
  }

  async function handleAttachmentDelete(filename){
    if (!filename) return;
    try{
      await deleteAttachment({
        projectNumber: project.projectNumber,
        projectName: project.projectName,
        typePrefix: p.typePrefix,
        partNumber: p.partNumber,
        filename
      });
      setAttachments(prev => prev.filter(att => att.filename !== filename));
      showToast?.("Attachment removed");
    }catch(err){
      setAttachmentsError(err.message || "Could not delete attachment");
      showToast?.(err.message || "Attachment delete failed","error");
    }
  }

  async function save(){
    setSaveError("");
    try{
      await onSave({
        typePrefix: p.typePrefix,
        partNumber: p.partNumber,
        nextTypePrefix: type,
        description: desc,
        notes: note
      });
    }catch(err){
      setSaveError(err.message || "Unable to save changes");
    }
  }

  const isAssembly = ["A","S"].includes(p.typePrefix);
  const assemblyOptions = (assemblies || []).filter(part => partCode(part) !== partCode(p)).map(part => ({
    code: partCode(part),
    label: `${partCode(part)} — ${part.description || "Untitled"}`
  }));
  const childOptions = (parts || []).filter(part => partCode(part) !== partCode(p)).map(part => ({
    code: partCode(part),
    label: `${partCode(part)} — ${part.description || "Untitled"}`
  }));

  async function linkParentAssembly(){
    if (!parentAssembly) return;
    const parent = splitCode(parentAssembly);
    if (!parent) return;
    setLinkBusy(true);
    setLinkError("");
    try{
      await linkAssembly({
        projectNumber: project.projectNumber,
        projectName: project.projectName,
        parent,
        child: { typePrefix: p.typePrefix, partNumber: p.partNumber },
        qty: Number(parentQty) > 0 ? Number(parentQty) : 1
      });
      onAssemblyLinked?.();
      showToast?.("Assembly link updated");
    }catch(err){
      setLinkError(err.message || "Link failed");
      showToast?.(err.message || "Assembly link failed","error");
    }finally{
      setLinkBusy(false);
    }
  }

  async function addChildToAssembly(){
    if (!childPick) return;
    const child = splitCode(childPick);
    if (!child) return;
    setChildBusy(true);
    setChildError("");
    try{
      await linkAssembly({
        projectNumber: project.projectNumber,
        projectName: project.projectName,
        parent: { typePrefix: p.typePrefix, partNumber: p.partNumber },
        child,
        qty: Number(childQty) > 0 ? Number(childQty) : 1
      });
      onAssemblyLinked?.();
      setChildPick("");
      setChildQty(1);
      showToast?.("Component added to assembly");
    }catch(err){
      setChildError(err.message || "Unable to add component");
      showToast?.(err.message || "Unable to add component","error");
    }finally{
      setChildBusy(false);
    }
  }

  async function handleDelete(){
    if (deleteBusy) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleteBusy(true);
    setDeleteError("");
    try{
      await deletePart({
        projectNumber: project.projectNumber,
        projectName: project.projectName,
        typePrefix: p.typePrefix,
        partNumber: p.partNumber
      });
      if (onDeleted) await onDeleted(p);
    }catch(err){
      setDeleteError(err.message || "Delete failed");
    }finally{
      setDeleteBusy(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 grid place-items-center p-4 z-50">
      <div className="card modal-card w-full max-w-2xl overflow-hidden">
        <div className="relative border-b border-slate-100 bg-slate-50 px-6 py-5">
          <button className="absolute right-5 top-5 text-slate-500" onClick={onClose}>
            <XMarkIcon className="h-6 w-6" />
          </button>
          <p className="text-xs uppercase tracking-wide text-slate-500">Edit part</p>
          <h3 className="text-2xl font-semibold text-slate-900 mt-1">{p.description || "Untitled component"}</h3>
          <div className="text-sm text-slate-500 mt-1 font-mono">
            {project.projectNumber}_{p.typePrefix}{p.partNumber.padStart(3,"0")}
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wide">Description</label>
              <input className="input mt-2" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description" />
            </div>
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wide">Part type</label>
              <select className="select mt-2" value={type} onChange={e=>setType(e.target.value)}>
                <option value="P">Part</option>
                <option value="A">Assembly</option>
                <option value="S">SubAssembly</option>
                <option value="H">Hardware</option>
                <option value="O">OEM</option>
              </select>
            </div>
          </div>

          <div className="modal-field">
            <label>Change note</label>
            <textarea
              className="input min-h-[96px]"
              value={note}
              onChange={e=>setNote(e.target.value)}
              placeholder="Add a short note describing the update"
            />
          </div>

          <div className="flex flex-col gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>Project</span>
              <span className="font-semibold">{project.projectNumber}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Part number</span>
              <span className="font-mono">{p.typePrefix}{p.partNumber.padStart(3,"0")}</span>
            </div>
          </div>

        {!isAssembly && (
          <div className="rounded-xl border border-slate-200 px-4 py-4 space-y-2">
            <div className="text-xs uppercase tracking-wide text-slate-500">Link to assembly</div>
            {parentLinks.length > 0 && (
              <div className="text-xs text-slate-500">
                Currently linked to {parentLinks.map(link => `${link.code}×${link.qty}`).join(", ")}.
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <select className="select flex-1 min-w-[200px]" value={parentAssembly} onChange={e=>setParentAssembly(e.target.value)}>
                <option value="">No parent</option>
                {assemblyOptions.map(opt => (
                  <option key={opt.code} value={opt.code}>{opt.label}</option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-right text-xs"
                value={parentQty}
                onChange={e=>setParentQty(e.target.value)}
                disabled={!parentAssembly}
              />
              <button type="button" className="btn-ghost text-sm" onClick={linkParentAssembly} disabled={!parentAssembly || linkBusy}>
                {linkBusy ? "Linking…" : "Link"}
              </button>
            </div>
            {linkError && <div className="text-xs text-rose-600">{linkError}</div>}
          </div>
        )}

        {isAssembly && (
          <div className="rounded-xl border border-slate-200 px-4 py-4 space-y-2">
            <div className="text-xs uppercase tracking-wide text-slate-500">Add components</div>
            {childLinks.length > 0 && (
              <div className="text-xs text-slate-500">
                Currently contains {childLinks.map(link => `${link.code}×${link.qty}`).join(", ")}.
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <select className="select flex-1 min-w-[200px]" value={childPick} onChange={e=>setChildPick(e.target.value)}>
                <option value="">Select file…</option>
                {childOptions.map(opt => (
                  <option key={opt.code} value={opt.code}>{opt.label}</option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-right text-xs"
                value={childQty}
                onChange={e=>setChildQty(e.target.value)}
              />
              <button type="button" className="btn-ghost text-sm" onClick={addChildToAssembly} disabled={!childPick || childBusy}>
                {childBusy ? "Adding…" : "Add"}
              </button>
            </div>
            {childError && <div className="text-xs text-rose-600">{childError}</div>}
            <p className="text-xs text-slate-500">Use the Assemblies tab for full BOM editing.</p>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 px-4 py-4 space-y-3 relative">
          <div className="text-xs uppercase tracking-wide text-slate-500">Attachments (PDF)</div>
          {attachmentsError && <div className="text-xs text-rose-600">{attachmentsError}</div>}
          {attachmentsLoading ? (
            <div className="text-sm text-slate-500">Loading attachments…</div>
          ) : attachments.length === 0 ? (
            <div className="text-sm text-slate-500">No attachments yet.</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {attachments.map(att => (
                <li key={att.filename} className="flex items-center justify-between gap-2">
                  <a href={att.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                    {att.filename}
                  </a>
                  <button type="button" className="btn-ghost text-xs" onClick={() => handleAttachmentDelete(att.filename)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-slate-500">Upload PDF</label>
            <input
              type="file"
              accept="application/pdf"
              multiple
              className="input py-2"
              disabled={uploadingAttachments}
              onChange={e => {
                handleAttachmentUpload(e.target.files);
                e.target.value = "";
              }}
            />
            {uploadingAttachments && <span className="text-xs text-slate-500">Uploading…</span>}
          </div>
          {uploadingAttachments && <UploadOverlay message="Uploading attachment…" />}
        </div>

        {saveError && (
          <div className="rounded-xl border border-rose-100 bg-rose-50 text-rose-600 text-sm px-4 py-2">
            {saveError}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {deleteError && <p className="text-xs text-rose-600">{deleteError}</p>}
            {confirmDelete && (
              <p className="text-xs text-rose-600">
                This removes all revisions and BOM links for {partLabel}. Click “Confirm delete” to proceed.
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button className="btn-ghost text-rose-600" onClick={handleDelete} disabled={deleteBusy}>
                {deleteBusy ? "Deleting…" : confirmDelete ? "Confirm delete" : "Delete part"}
              </button>
              <div className="modal-actions">
                <button className="btn-ghost" onClick={onClose}>Cancel</button>
                <button className="btn btn-primary" onClick={save}>Save Changes</button>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Canonical filenames refresh automatically once the update is saved.
          </p>
        </div>
      </div>
    </div>
  );
}

function AddFileModal({ project: projectInfo, defaultType="P", defaultPartNumber="001", perTypeNext = {}, assemblies = [], parts = [], onClose, onSaved, onLinked }) {
  const project = projectInfo || { projectNumber: "", projectName: "" };
  const [typePrefix, setTypePrefix] = useState(defaultType);
  const [partNumber, setPartNumber] = useState(defaultPartNumber);
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [parentAssembly, setParentAssembly] = useState("");
  const [parentQty, setParentQty] = useState(1);
  const [childPick, setChildPick] = useState("");
  const [childSelections, setChildSelections] = useState([]);
  const [childQtyMap, setChildQtyMap] = useState({});
  const fileRef = useRef(null);

  // when modal opens or type changes, prefill next for selected type
  useEffect(() => {
    const next = perTypeNext[typePrefix] || "001";
    // only prefill if user hasn't typed a custom value (simple heuristic)
    if (!partNumber || /^[0]+$/.test(partNumber) || partNumber === defaultPartNumber) {
      setPartNumber(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typePrefix, perTypeNext]);

  useEffect(() => {
    setParentAssembly("");
    setParentQty(1);
    setChildPick("");
    setChildSelections([]);
    setChildQtyMap({});
  }, [typePrefix]);

  // allow manual editing but normalize digits
  function onPartInput(v){
    setPartNumber(v.replace(/[^0-9]/g,"").slice(-3).padStart(3,"0"));
  }

  const assemblyOptions = (assemblies || []).map(part => ({
    code: partCode(part),
    label: `${partCode(part)} — ${part.description || "Untitled"}`
  }));

  const childOptions = (parts || []).filter(part => {
    const code = partCode(part);
    if (!code) return false;
    if (code === `${typePrefix}${partNumber}`) return false;
    return true;
  }).map(part => ({
    code: partCode(part),
    label: `${partCode(part)} — ${part.description || "Untitled"}`
  }));

  function addChildSelection() {
    if (!childPick || childSelections.includes(childPick)) return;
    setChildSelections(prev => [...prev, childPick]);
    setChildQtyMap(prev => ({ ...prev, [childPick]: prev[childPick] || "1" }));
    setChildPick("");
  }

  function removeChildSelection(code) {
    setChildSelections(prev => prev.filter(c => c !== code));
    setChildQtyMap(prev => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
  }

  async function submit(){
    if(busy) return;
    const file = fileRef.current?.files?.[0];
    if(!file) {
      alert("Please choose a .step file to upload.");
      return;
    }

    setBusy(true);
    try{
      const fd = new FormData();
      fd.append("file", file);
      fd.append("originalname", file.name);
      fd.append("projectNumber", project.projectNumber);
      fd.append("projectName", project.projectName);
      fd.append("typePrefix", typePrefix);
      fd.append("partNumber", partNumber);
      fd.append("rev", "RevA");
      fd.append("description", description||"");
      fd.append("notes", note||"Added via UI");

      const r = await fetch("/api/file/revise", { method:"POST", body: fd });
      const text = await r.text();
      let body;
      try { body = JSON.parse(text); } catch(e){ body = text; }

      if(!r.ok){
        throw new Error((body && body.error) ? body.error : String(body));
      }

      const links = [];
      const newChild = { typePrefix, partNumber };
      if (parentAssembly) {
        const parent = splitCode(parentAssembly);
        if (parent) {
          links.push(
            linkAssembly({
              projectNumber: project.projectNumber,
              projectName: project.projectName,
              parent,
              child: newChild,
              qty: Number(parentQty) > 0 ? Number(parentQty) : 1
            })
          );
        }
      }
      if (["A","S"].includes(typePrefix) && childSelections.length) {
        childSelections.forEach(code => {
          const child = splitCode(code);
          if (!child) return;
          links.push(
            linkAssembly({
              projectNumber: project.projectNumber,
              projectName: project.projectName,
              parent: newChild,
              child,
              qty: Number(childQtyMap[code]) > 0 ? Number(childQtyMap[code]) : 1
            })
          );
        });
      }
      if (links.length) {
        await Promise.all(links);
        if (onLinked) await onLinked();
      }

      if (onSaved) await onSaved();
    }catch(err){
      alert(err.message || String(err));
    }finally{
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 grid place-items-center p-4 z-50">
      <div className="card modal-card w-full max-w-3xl overflow-hidden">
        <div className="relative border-b border-slate-100 bg-slate-50 px-6 py-5">
          <button className="absolute right-5 top-5 text-slate-500" onClick={onClose}>
            <XMarkIcon className="h-6 w-6" />
          </button>
          <p className="text-xs uppercase tracking-wide text-slate-500">Add new part</p>
          <h3 className="text-2xl font-semibold text-slate-900 mt-1">Upload STEP file</h3>
          <p className="text-sm text-slate-500 mt-1">Provide the basics and we will scaffold the naming automatically.</p>
        </div>

        <div className="p-6 space-y-6 modal-form">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="modal-field">
              <label>Description</label>
              <input className="input" value={description} onChange={e=>setDescription(e.target.value)} placeholder="e.g. Base Plate" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="modal-field">
                <label>Part type</label>
                <select className="select" value={typePrefix} onChange={e=>setTypePrefix(e.target.value)}>
                  <option value="P">Part</option>
                  <option value="A">Assembly</option>
                  <option value="S">SubAssembly</option>
                  <option value="H">Hardware</option>
                  <option value="O">OEM</option>
                </select>
              </div>
              <div className="modal-field">
                <label>Part number</label>
                <input className="input font-mono text-center" value={partNumber} onChange={e=>onPartInput(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="modal-field">
              <label>Note</label>
              <input className="input" value={note} onChange={e=>setNote(e.target.value)} placeholder="Optional note" />
            </div>
            {["A","S"].includes(typePrefix) ? (
              <div className="mt-4 space-y-2">
                <div className="text-xs uppercase tracking-wide text-slate-500">Components</div>
                <div className="flex flex-wrap items-center gap-2">
                  <select className="select flex-1 min-w-[200px]" value={childPick} onChange={e => setChildPick(e.target.value)}>
                    <option value="">Select file…</option>
                    {childOptions.map(opt => (
                      <option key={opt.code} value={opt.code}>{opt.label}</option>
                    ))}
                  </select>
                  <button type="button" className="btn-ghost text-sm" onClick={addChildSelection}>
                    Add component
                  </button>
                </div>
                {childSelections.length > 0 && (
                  <div className="space-y-2">
                    {childSelections.map(code => (
                      <div key={code} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm">
                        <div className="font-mono">{code}</div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-right text-xs"
                            value={childQtyMap[code] || "1"}
                            onChange={e => setChildQtyMap(prev => ({ ...prev, [code]: e.target.value }))}
                          />
                          <button type="button" className="action-icon text-rose-500" onClick={() => removeChildSelection(code)}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-500">Link to assembly</label>
                <div className="flex flex-wrap items-center gap-2">
                  <select className="select flex-1 min-w-[200px]" value={parentAssembly} onChange={e=>setParentAssembly(e.target.value)}>
                    <option value="">No link</option>
                    {assemblyOptions.map(opt => (
                      <option key={opt.code} value={opt.code}>{opt.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-right text-xs"
                    value={parentQty}
                    onChange={e=>setParentQty(e.target.value)}
                    disabled={!parentAssembly}
                  />
                </div>
              </div>
            )}
          </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span>Project</span>
                <span className="font-semibold">{project.projectNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Client</span>
                <span className="font-semibold">{project.projectName}</span>
              </div>
            </div>
          </div>

          <div className="modal-field">
            <label>File (.step)</label>
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center">
              <input type="file" accept=".step,.stp" ref={fileRef} className="block w-full text-sm text-slate-600" />
              <p className="text-xs text-slate-500 mt-2">Drag in a .step file or tap to browse. Max 200&nbsp;MB.</p>
            </div>
          </div>

          <div className="modal-actions">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={submit}>
              <ArrowUpTrayIcon className="h-6 w-6" />
              {busy ? "Uploading…" : "Upload"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// helper: next revision letter (A -> B, Z -> Z+1 stays Z)
function nextRevLetter(curr){
  if(!curr) return "A";
  // accept either "A" or "RevA"
  const m = /Rev?([A-Z])$/i.exec(String(curr));
  const c = m ? m[1].toUpperCase() : String(curr).toUpperCase();
  if(c === "Z") return "Z";
  const next = String.fromCharCode(c.charCodeAt(0) + 1);
  return next;
}

function RevUpModal({ parts = [], project: projectInfo, initialSelected = null, onClose, onSaved }) {
  const project = projectInfo || { projectNumber: "", projectName: "" };
  const [selected, setSelected] = useState(parts[0] || null);
  const [file, setFile] = useState(null);
  const [notes, setNotes] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSelected(initialSelected || parts[0] || null);
    setDescription(initialSelected?.description || parts[0]?.description || "");
  }, [parts, initialSelected]);

  function onPick(id){
    const p = parts.find(x => `${x.typePrefix}${pad3(x.partNumber)}` === id);
    setSelected(p || null);
    setDescription(p?.description || "");
  }

  async function submit(){
    if(!selected){
      alert("Select a part to rev up.");
      return;
    }
    if(!file){
      alert("Choose a STEP file for the new revision.");
      return;
    }

    setBusy(true);
    try{
      const nextRev = nextRevLetter(selected.latestRev || selected.rev || "");
      const revTag = `Rev${nextRev}`;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("originalname", file.name);
      fd.append("projectNumber", project.projectNumber);
      fd.append("projectName", project.projectName);
      fd.append("typePrefix", selected.typePrefix);
      fd.append("partNumber", String(selected.partNumber).padStart(3,"0"));
      fd.append("rev", revTag);
      fd.append("description", description || selected.description || "");
      fd.append("notes", notes || `Rev up to ${nextRev}`);

      const r = await fetch(`${API_BASE}/api/file/revise`, { method: "POST", body: fd });
      const text = await r.text();
      let body;
      try { body = JSON.parse(text); } catch(e){ body = text; }

      if(!r.ok) throw new Error((body && body.error) ? body.error : String(body));
      if (onSaved) await onSaved();
      if (body && body.filename) {
        alert(`Rev up saved as ${body.filename}`);
      }
    }catch(err){
      alert(err.message || String(err));
    }finally{
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/20 grid place-items-center p-4 z-50">
      <div className="card modal-card w-full max-w-md p-4 relative">
        <button className="absolute right-3 top-3 text-slate-500" onClick={onClose}><XMarkIcon className="h-6 w-6" /></button>
        <div className="text-lg font-semibold mb-2">Rev Up Part</div>
        <div className="text-xs text-slate-500 mb-4">Upload a new file to increment the part revision and record change details.</div>

        <div className="modal-form">
          <div className="modal-field">
            <label>Select Part</label>
            <select
              className="select"
              value={selected ? `${selected.typePrefix}${pad3(selected.partNumber)}` : ""}
              onChange={e => onPick(e.target.value)}
            >
              {parts.map(p => (
                <option key={p.typePrefix + p.partNumber} value={`${p.typePrefix}${pad3(p.partNumber)}`}>
                  {p.typePrefix}{pad3(p.partNumber)} — {p.description || "(no description)"} — {formatRevLabel(p.latestRev || p.rev || "?") || "Rev?"}
                </option>
              ))}
            </select>
          </div>

          <div className="modal-field">
            <label>Description (what changed)</label>
            <input
              className="input"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Short summary of changes"
            />
          </div>

          <div className="modal-field">
            <label>Notes</label>
            <input
              className="input"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes for history"
            />
          </div>

          <div className="modal-field">
            <label>New File (.step)</label>
            <input
              type="file"
              accept=".step,.stp"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm file:font-medium"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? "Uploading…" : "Apply Rev Up"}
          </button>
        </div>
      </div>
    </div>
  );
}

function HierarchyTreeView({ tree }) {
  if (!tree) return null;
  return (
    <div className="border border-slate-200 rounded-2xl p-4 bg-white">
      <ul className="space-y-3">
        <HierarchyTreeNode node={tree} depth={0} />
      </ul>
    </div>
  );
}

function HierarchyTreeNode({ node, depth }) {
  if (!node) return null;
  const qty = node.edgeQty || node.qty || 1;
  return (
    <li>
      <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
        <div>
          <div className="font-mono text-sm text-slate-900">{node.code}</div>
          <div className="text-xs text-slate-500 truncate max-w-[32ch]">{node.description || "—"}</div>
        </div>
        <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 border border-slate-200">
          Qty {qty}
        </span>
      </div>
      {node.children && node.children.length > 0 && (
        <ul className="mt-2 ml-5 border-l border-slate-200 pl-4 space-y-2">
          {node.children.map((child, idx) => (
            <HierarchyTreeNode key={`${node.code}-${child.code}-${idx}`} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

function LinkToAssemblyModal({ isOpen, part, assemblies = [], project: projectInfo, onClose, onLinked }) {
  const project = projectInfo || { projectNumber: "", projectName: "" };
  const [parentCode, setParentCode] = useState("");
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    const filtered = assemblies.filter(a => partCode(a) !== partCode(part));
    setParentCode(filtered[0] ? partCode(filtered[0]) : "");
    setQty(1);
    setError("");
  }, [isOpen, assemblies, part]);

  if (!isOpen || !part) return null;
  const options = assemblies.filter(a => partCode(a) !== partCode(part));
  const partLabel = `${partCode(part)} — ${part.description || "Untitled"}`;

  async function submit(){
    if (!parentCode) {
      setError("Choose an assembly");
      return;
    }
    const parent = splitCode(parentCode);
    if (!parent) {
      setError("Invalid code");
      return;
    }
    setBusy(true);
    setError("");
    try{
      await linkAssembly({
        projectNumber: project.projectNumber,
        projectName: project.projectName,
        parent,
        child: { typePrefix: part.typePrefix, partNumber: part.partNumber },
        qty: Number(qty) > 0 ? Number(qty) : 1
      });
      if (onLinked) await onLinked();
      onClose?.();
    }catch(err){
      setError(err.message || "Link failed");
    }finally{
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 grid place-items-center p-4 z-50">
      <div className="card modal-card w-full max-w-lg p-6 relative">
        <button className="absolute right-4 top-4 text-slate-500" onClick={onClose}>
          <XMarkIcon className="h-6 w-6" />
        </button>
        <div className="text-xs uppercase tracking-wide text-slate-500">Link part</div>
        <h2 className="text-2xl font-semibold mt-1">{partLabel}</h2>
        <p className="text-sm text-slate-500 mt-1">Attach this part to an assembly or sub-assembly.</p>

        {options.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
            Add an Assembly or Sub-assembly first.
          </div>
        ) : (
          <div className="modal-form mt-6">
            <div className="modal-field">
              <label>Assembly</label>
              <select className="select" value={parentCode} onChange={e=>setParentCode(e.target.value)}>
                {options.map(opt => (
                  <option key={opt.code} value={opt.code}>{opt.code} — {opt.description || "Untitled"}</option>
                ))}
              </select>
            </div>
            <div className="modal-field">
              <label>Quantity</label>
              <input
                type="number"
                min="1"
                className="input w-32"
                value={qty}
                onChange={e=>setQty(e.target.value)}
              />
            </div>
            {error && <div className="text-sm text-rose-600">{error}</div>}
            <div className="modal-actions">
              <button className="btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={submit} disabled={busy}>
                {busy ? "Linking…" : "Link part"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BulkAttachmentModal({ isOpen, onClose, project: projectInfo, onUploaded, showToast }) {
  const project = projectInfo || { projectNumber: "", projectName: "" };
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setSelectedFiles([]);
      setBusy(false);
      setResult(null);
      setError("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function submit(){
    if (!selectedFiles.length) {
      setError("Select one or more PDF files.");
      return;
    }
    setBusy(true);
    setError("");
    try{
      const res = await uploadAttachments({
        projectNumber: project.projectNumber,
        projectName: project.projectName,
        files: selectedFiles,
        autoDetect: true
      });
      setResult(res.results || []);
      if (onUploaded) await onUploaded();
      const linked = (res.results || []).filter(row => row.status === "linked").length;
      if (linked) {
        showToast?.(`${linked} PDF${linked === 1 ? "" : "s"} linked to parts`);
      } else {
        showToast?.("Upload finished", res.results?.length ? "warning" : "success");
      }
    }catch(err){
      const message = err.message || "Upload failed";
      setError(message);
      showToast?.(message,"error");
    }finally{
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 grid place-items-center p-4 z-50">
      <div className="card modal-card w-full max-w-2xl p-6 relative max-h-[90vh] overflow-auto">
        <button className="absolute right-4 top-4 text-slate-500" onClick={onClose}>
          <XMarkIcon className="h-6 w-6" />
        </button>
        <div className="text-xs uppercase tracking-wide text-slate-500">Bulk PDF attachments</div>
        <h2 className="text-2xl font-semibold mt-1">Auto-match PDFs to parts</h2>
        <p className="text-sm text-slate-500 mt-2">
          Drop multiple PDFs. Filenames containing a part code such as P001 or A003 will be linked automatically.
        </p>

        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center">
          <input
            type="file"
            accept="application/pdf"
            multiple
            onChange={e => setSelectedFiles(Array.from(e.target.files || []))}
            className="text-sm text-slate-600"
          />
          <p className="text-xs text-slate-500 mt-2">
            {selectedFiles.length
              ? `${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""} ready`
              : "No files selected"}
          </p>
        </div>

        {error && <div className="mt-3 text-sm text-rose-600">{error}</div>}
        {result && (
          <div className="mt-4 max-h-48 overflow-auto border border-slate-200 rounded-xl">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Filename</th>
                  <th className="px-3 py-2 text-left">Result</th>
                </tr>
              </thead>
              <tbody>
                {result.map((row, idx) => (
                  <tr key={`${row.filename}-${idx}`} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs">{row.filename}</td>
                    <td className="px-3 py-2 text-xs">
                      {row.status === "linked"
                        ? `Linked to ${row.typePrefix}${pad3(row.partNumber)}`
                        : row.reason || row.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="modal-actions mt-6">
          <button className="btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? "Uploading…" : "Upload & match"}
          </button>
        </div>
        {busy && <UploadOverlay message={`Uploading ${selectedFiles.length || ""} PDF${selectedFiles.length === 1 ? "" : "s"}…`} />}
      </div>
    </div>
  );
}

function UploadOverlay({ message = "Uploading…" }) {
  return (
    <div className="absolute inset-0 bg-white/85 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center z-20">
      <div className="h-8 w-8 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
      <div className="mt-3 text-sm font-medium text-slate-600 text-center px-4">{message}</div>
    </div>
  );
}

function Toast({ notification, onDismiss }) {
  if (!notification) return null;
  const palette = notification.variant === "error"
    ? "bg-rose-600 text-white"
    : notification.variant === "warning"
      ? "bg-amber-500 text-slate-900"
      : "bg-emerald-600 text-white";
  return (
    <div className={`fixed bottom-6 right-6 rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 ${palette}`}>
      <span className="text-sm font-semibold">{notification.message}</span>
      <button className="text-sm underline" onClick={onDismiss}>Dismiss</button>
    </div>
  );
}
