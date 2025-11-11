import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Cog6ToothIcon, UserGroupIcon, HomeIcon } from "@heroicons/react/24/outline";

export default function App(){
  const navClass = ({ isActive }) =>
    `sidebar-link ${isActive ? "sidebar-link-active" : ""}`;

  return (
    <div className="app-shell">
      <aside className="sidebar w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-5 py-5 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-ink text-white grid place-items-center text-xl">📁</div>
          <div>
            <div className="font-extrabold tracking-tight">CAD Vault</div>
            <div className="text-xs text-slate-500">Release Management</div>
          </div>
        </div>
        <nav className="mt-4 space-y-1 px-2">
          <NavLink className={navClass} to="/">
            <HomeIcon className="h-5 w-5" />
            Projects
          </NavLink>
          <NavLink className={navClass} to="/clients">
            <UserGroupIcon className="h-5 w-5" />
            Clients
          </NavLink>
          <NavLink className={navClass} to="/settings">
            <Cog6ToothIcon className="h-5 w-5" />
            Settings
          </NavLink>
        </nav>
        <div className="px-5 py-6 mt-auto text-xs text-slate-500">Version 1.0.0<br/>CAD Project Management</div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
