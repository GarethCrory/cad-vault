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
