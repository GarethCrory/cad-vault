import React, { useEffect, useState } from "react";

const NEXT_KEY = "cadVault.nextProjectNumber";

export default function Settings(){
  const [nextNumber, setNextNumber] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(NEXT_KEY) || "";
  });
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    if (!savedMessage) return;
    const t = setTimeout(() => setSavedMessage(""), 1500);
    return () => clearTimeout(t);
  }, [savedMessage]);

  function saveOverride(e){
    e.preventDefault();
    if(nextNumber.trim()){
      localStorage.setItem(NEXT_KEY, nextNumber.trim());
      setSavedMessage("Saved override");
    }
  }

  function clearOverride(){
    localStorage.removeItem(NEXT_KEY);
    setNextNumber("");
    setSavedMessage("Cleared override");
  }

  return (
    <div className="page-container compact">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold">Settings</h1>
            <div className="text-sm text-slate-500 mt-1">Personalise numbering and defaults.</div>
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Next project number</h2>
            <p className="text-sm text-slate-500">Override the automatically detected next number if you follow a custom scheme.</p>
          </div>
          <form className="space-y-4" onSubmit={saveOverride}>
            <div>
              <label className="text-xs font-semibold text-slate-500">Preferred next number</label>
              <input className="input mt-1 w-48" value={nextNumber} onChange={e=>setNextNumber(e.target.value)} placeholder="e.g. 012" />
            </div>
            <div className="flex items-center gap-3">
              <button className="btn btn-primary" type="submit">Save Override</button>
              <button className="btn btn-secondary" type="button" onClick={clearOverride}>Clear</button>
              {savedMessage && <span className="text-xs text-green-600">{savedMessage}</span>}
            </div>
          </form>
          <div className="text-xs text-slate-500">
            When unset, CAD Vault looks at all existing projects and picks the next sequential number automatically.
          </div>
        </div>
      </div>
    </div>
  );
}
