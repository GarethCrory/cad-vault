import React, { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Cog6ToothIcon, UserGroupIcon, HomeIcon, Bars3Icon, XMarkIcon, ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";

export default function App(){
  const [navOpen, setNavOpen] = useState(false);
  const navClass = ({ isActive }) =>
    `sidebar-link ${isActive ? "sidebar-link-active" : ""}`;
  const buildHash = (typeof __BUILD__ !== "undefined" && __BUILD__) ? __BUILD__ : "dev";
  const buildLabel = (buildHash || "dev").slice(0,7);

  useEffect(() => {
    function handleResize(){
      if (window.innerWidth > 1024) setNavOpen(false);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function closeNav(){ setNavOpen(false); }

  function handleLogout(){
    if (typeof window === "undefined") return;
    const origin = window.location.origin || "/";
    const logoutBase = import.meta.env.VITE_LOGOUT_URL || "/cdn-cgi/access/logout";
    try {
      const url = new URL(logoutBase, origin);
      if (origin) url.searchParams.set("return_to", origin);
      window.location.href = url.toString();
    } catch {
      const base = logoutBase || "/";
      const joiner = base.includes("?") ? "&" : "?";
      window.location.href = `${base}${origin ? `${joiner}return_to=${encodeURIComponent(origin)}` : ""}`;
    }
  }

  return (
    <div className={`app-shell ${navOpen ? "nav-open" : ""}`}>
      <button
        className="mobile-nav-toggle"
        type="button"
        onClick={() => setNavOpen(true)}
        aria-label="Open navigation"
      >
        <Bars3Icon className="h-6 w-6" />
      </button>
      <div className="sidebar-overlay" onClick={closeNav} />
      <aside className="sidebar w-64 bg-white border-r border-slate-200 flex flex-col">
        <button className="sidebar-close" type="button" onClick={closeNav} aria-label="Close navigation">
          <XMarkIcon className="h-6 w-6" />
        </button>
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
        <div className="px-5 mt-auto space-y-4 pb-6">
          <button
            type="button"
            className="sidebar-link justify-start"
            onClick={handleLogout}
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
            Sign out
          </button>
          <div className="text-xs text-slate-500">
            Version 1.0.0 • {buildLabel}<br/>CAD Project Management
          </div>
        </div>
      </aside>

      <main className="main-content">
        <Outlet context={{ closeNav }} />
      </main>
    </div>
  );
}
