import React, { useState, useMemo } from "react";

export default function AddFileModal({ project, onClose, onSaved }) {
  const [desc, setDesc] = useState("");
  const [notes, setNotes] = useState("");
  const [typePrefix, setTypePrefix] = useState("P"); // P=Part, A=Assembly, H=Hardware
  const [file, setFile] = useState(null);
  const nextPart = project?.nextPartNumber || "001";

  // Display only
  const previewPartNumber = useMemo(() => {
    const pn = project?.projectNumber || "P000";
    return `${pn}_${typePrefix}${nextPart}`;
  }, [project, typePrefix, nextPart]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) { alert("Please choose a STEP file"); return; }
    if (!project?.projectNumber || !project?.projectName) {
      alert("Project info missing"); return;
    }

    try {
      const body = new FormData();
      body.append("file", file);
      body.append("project",
        JSON.stringify({ projectNumber: project.projectNumber, projectName: project.projectName })
      );
      body.append("typePrefix", typePrefix);
      body.append("partNumber", nextPart);
      body.append("description", desc || "");
      body.append("notes", notes || "Manual");

      const res = await fetch("/api/file/revise", { method: "POST", body });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `Upload failed: ${res.status}`);
      }
      const data = await res.json().catch(() => ({}));
      // success
      onSaved && onSaved(data);
    } catch (err) {
      console.error(err);
      alert(`Upload error: ${err.message || err}`);
    }
  }

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.25)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000
    }}>
      <div style={{
        width:540, maxWidth:"92vw", background:"#fff", borderRadius:16,
        boxShadow:"0 10px 30px rgba(16,24,40,0.16)", padding:24
      }}>
        <h3 style={{margin:"0 0 8px", fontSize:20, fontWeight:700, color:"#12182a"}}>Add File</h3>
        <p style={{margin:"0 0 16px", fontSize:14, color:"#656c7c"}}>
          Part number will be created automatically from the project and type.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{marginBottom:12}}>
            <label style={{display:"block", fontSize:12, fontWeight:600, color:"#6b7382", marginBottom:6}}>
              Project Part Number
            </label>
            <input value={previewPartNumber} readOnly
              style={{width:"100%", height:44, border:"1px solid #eceff2", borderRadius:10, padding:"0 12px", background:"#f8fafc"}} />
          </div>

          <div style={{marginBottom:12}}>
            <label style={{display:"block", fontSize:12, fontWeight:600, color:"#6b7382", marginBottom:6}}>Description</label>
            <input placeholder="e.g. Base Plate" value={desc} onChange={e=>setDesc(e.target.value)}
              style={{width:"100%", height:44, border:"1px solid #eceff2", borderRadius:10, padding:"0 12px"}} />
          </div>

          <div style={{marginBottom:12}}>
            <label style={{display:"block", fontSize:12, fontWeight:600, color:"#6b7382", marginBottom:6}}>Part Type</label>
            <select value={typePrefix} onChange={e=>setTypePrefix(e.target.value)}
              style={{width:"100%", height:44, border:"1px solid #eceff2", borderRadius:10, padding:"0 10px", background:"#fff"}}>
              <option value="P">Part (P)</option>
              <option value="A">Assembly (A)</option>
              <option value="H">Hardware (H)</option>
            </select>
          </div>

          <div style={{marginBottom:12}}>
            <label style={{display:"block", fontSize:12, fontWeight:600, color:"#6b7382", marginBottom:6}}>Note (optional)</label>
            <input placeholder="Manual / from supplier / etc." value={notes} onChange={e=>setNotes(e.target.value)}
              style={{width:"100%", height:44, border:"1px solid #eceff2", borderRadius:10, padding:"0 12px"}} />
          </div>

          <div style={{marginBottom:18}}>
            <label style={{display:"block", fontSize:12, fontWeight:600, color:"#6b7382", marginBottom:6}}>STEP File</label>
            <input type="file" accept=".step,.stp,.STEP,.STP" onChange={e=>setFile(e.target.files?.[0]||null)} />
          </div>

        <div style={{display:"flex", gap:12, justifyContent:"flex-end"}}>
            <button type="button" onClick={onClose}
              style={{height:44, padding:"0 14px", borderRadius:12, border:"1px solid #eceff2", background:"#fff", color:"#12182a"}}>
              Cancel
            </button>
            <button type="submit"
              style={{height:44, padding:"0 16px", borderRadius:12, border:"1px solid #cc7c2e", background:"#fff",
                      color:"#cc7c2e", fontWeight:700}}>
              Add File
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
