import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import "./override.css";
import App from "./App.jsx";
import Projects from "./pages/Projects.jsx";
import Project from "./pages/Project.jsx";
import Clients from "./pages/Clients.jsx";
import Settings from "./pages/Settings.jsx";
import PeopleUsers from "./pages/PeopleUsers.jsx";
import PeopleGuests from "./pages/PeopleGuests.jsx";
import AccountingInvoices from "./pages/AccountingInvoices.jsx";
import AccountingEstimates from "./pages/AccountingEstimates.jsx";
import AccountingRecurring from "./pages/AccountingRecurring.jsx";
import AccountingExpenses from "./pages/AccountingExpenses.jsx";

const router = createBrowserRouter([
  { path: "/", element: <App />, children: [
      { index: true, element: <Projects /> },
      { path: "p/:projectNumber/:projectName", element: <Project /> },
      { path: "clients", element: <Clients /> },
      { path: "people/users", element: <PeopleUsers /> },
      { path: "people/guests", element: <PeopleGuests /> },
      { path: "accounting/invoices", element: <AccountingInvoices /> },
      { path: "accounting/estimates", element: <AccountingEstimates /> },
      { path: "accounting/recurring", element: <AccountingRecurring /> },
      { path: "accounting/expenses", element: <AccountingExpenses /> },
      { path: "settings", element: <Settings /> }
  ] }
]);

createRoot(document.getElementById("root")).render(<RouterProvider router={router} />);
