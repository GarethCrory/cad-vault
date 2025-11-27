import React, { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  Cog6ToothIcon,
  UserGroupIcon,
  HomeIcon,
  FolderIcon,
  Bars3BottomLeftIcon,
  UsersIcon,
  UserIcon,
  CurrencyDollarIcon,
  ReceiptRefundIcon,
  CreditCardIcon,
  DocumentTextIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from "@heroicons/react/24/outline";

export default function App(){
  const [peopleOpen, setPeopleOpen] = useState(true);
  const [accountingOpen, setAccountingOpen] = useState(true);
  const navClass = ({ isActive }) =>
    `sidebar-link ${isActive ? "sidebar-link-active" : ""}`;

  return (
    <div className="app-shell">
      <aside className="sidebar w-72 flex flex-col">
        <div className="px-5 py-5 flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-ink text-white grid place-items-center shadow-lg shadow-emerald-500/30">
            <FolderIcon className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <div className="font-extrabold tracking-tight text-white">CAD Vault</div>
            <div className="text-xs text-slate-400">Release Management</div>
          </div>
        </div>
        <nav className="mt-3 space-y-1 px-3">
          <NavLink className={navClass} to="/">
            <HomeIcon className="h-5 w-5" />
            Projects
          </NavLink>
          <NavLink className={navClass} to="/clients">
            <UserGroupIcon className="h-5 w-5" />
            Clients
          </NavLink>

          <div className="sidebar-section">
            <button className="sidebar-section-toggle" onClick={() => setPeopleOpen(!peopleOpen)}>
              <div className="flex items-center gap-3">
                <UsersIcon className="h-5 w-5" />
                <span>People</span>
              </div>
              {peopleOpen ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
            </button>
            {peopleOpen && (
              <div className="sidebar-subnav">
                <NavLink className={navClass} to="/people/users">
                  <UserIcon className="h-5 w-5" />
                  Users
                </NavLink>
                <NavLink className={navClass} to="/people/guests">
                  <UserGroupIcon className="h-5 w-5" />
                  Guests
                </NavLink>
              </div>
            )}
          </div>

          <div className="sidebar-section">
            <button className="sidebar-section-toggle" onClick={() => setAccountingOpen(!accountingOpen)}>
              <div className="flex items-center gap-3">
                <CurrencyDollarIcon className="h-5 w-5" />
                <span>Accounting</span>
              </div>
              {accountingOpen ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
            </button>
            {accountingOpen && (
              <div className="sidebar-subnav">
                <NavLink className={navClass} to="/accounting/invoices">
                  <ReceiptRefundIcon className="h-5 w-5" />
                  Invoices
                </NavLink>
                <NavLink className={navClass} to="/accounting/estimates">
                  <DocumentTextIcon className="h-5 w-5" />
                  Estimates
                </NavLink>
                <NavLink className={navClass} to="/accounting/recurring">
                  <CreditCardIcon className="h-5 w-5" />
                  Recurring
                </NavLink>
                <NavLink className={navClass} to="/accounting/expenses">
                  <CreditCardIcon className="h-5 w-5" />
                  Expenses
                </NavLink>
              </div>
            )}
          </div>

          <NavLink className={navClass} to="/timeline">
            <Bars3BottomLeftIcon className="h-5 w-5" />
            Timeline
          </NavLink>
          <NavLink className={navClass} to="/settings">
            <Cog6ToothIcon className="h-5 w-5" />
            Settings
          </NavLink>
        </nav>
        <div className="px-5 py-4 mt-auto space-y-2 text-xs text-slate-400">
          <button
            type="button"
            className="signout-inline w-full justify-center"
            onClick={() => {
              window.location.href =
                "https://cad-vault.pages.dev/cdn-cgi/access/logout?return_to=https://cad-vault.pages.dev";
            }}
          >
            Sign out
          </button>
          <div className="text-xs text-slate-500">
            Version 1.0.0
            <br />
            CAD Project Management
          </div>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
