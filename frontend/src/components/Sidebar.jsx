import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
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
  ChevronUpIcon,
} from '@heroicons/react/24/outline';

const Sidebar = () => {
  const [accountingOpen, setAccountingOpen] = useState(false);
  const navClass = ({ isActive }) =>
    `flex items-center px-4 py-2 text-gray-100 hover:bg-gray-700 ${isActive ? 'bg-gray-700' : ''}`;

  return (
    <div className="flex flex-col w-64 bg-gray-800">
      <div className="flex items-center justify-center h-16 bg-gray-900">
        <span className="text-white font-bold uppercase">CAD Vault</span>
      </div>
      <div className="flex flex-col flex-1 overflow-y-auto">
        <nav className="flex-1 px-2 py-4 bg-gray-800">
          <NavLink to="/clients" className={navClass}>
            <UserGroupIcon className="h-6 w-6 mr-3" />
            Clients
          </NavLink>
          <NavLink to="/" className={navClass}>
            <HomeIcon className="h-6 w-6 mr-3" />
            Projects
          </NavLink>
          <NavLink to="/people" className={navClass}>
            <UsersIcon className="h-6 w-6 mr-3" />
            People
          </NavLink>
          <div>
            <button
              onClick={() => setAccountingOpen(!accountingOpen)}
              className="flex items-center w-full px-4 py-2 mt-2 text-gray-100 hover:bg-gray-700"
            >
              <CurrencyDollarIcon className="h-6 w-6 mr-3" />
              Accounting
              {accountingOpen ? (
                <ChevronUpIcon className="h-4 w-4 ml-auto" />
              ) : (
                <ChevronDownIcon className="h-4 w-4 ml-auto" />
              )}
            </button>
            {accountingOpen && (
              <div className="pl-8">
                <NavLink to="/accounting/invoices" className={navClass}>
                  <ReceiptRefundIcon className="h-5 w-5 mr-3" />
                  Invoices
                </NavLink>
                <NavLink to="/accounting/estimates" className={navClass}>
                  <DocumentTextIcon className="h-5 w-5 mr-3" />
                  Estimates
                </NavLink>
                <NavLink to="/accounting/recurring" className={navClass}>
                  <CreditCardIcon className="h-5 w-5 mr-3" />
                  Recurring
                </NavLink>
                <NavLink to="/accounting/expenses" className={navClass}>
                  <CreditCardIcon className="h-5 w-5 mr-3" />
                  Expenses
                </NavLink>
              </div>
            )}
          </div>
          <NavLink to="/timeline" className={navClass}>
            <Bars3BottomLeftIcon className="h-6 w-6 mr-3" />
            Timeline
          </NavLink>
          <NavLink to="/settings" className={navClass}>
            <Cog6ToothIcon className="h-6 w-6 mr-3" />
            Settings
          </NavLink>
        </nav>
      </div>
      <div className="px-5 py-4 mt-auto space-y-2 text-xs text-slate-400">
        <button
          type="button"
          className="w-full justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          onClick={() => {
            window.location.href =
              'https://cad-vault.pages.dev/cdn-cgi/access/logout?return_to=https://cad-vault.pages.dev';
          }}
        >
          Sign out
        </button>
        <div className="text-center text-xs text-slate-500">
          Version 1.0.0
          <br />
          CAD Project Management
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
