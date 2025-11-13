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
import Login from "./pages/Login.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";

const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <App />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Projects /> },
      { path: "p/:projectNumber/:projectName", element: <Project /> },
      { path: "clients", element: <Clients /> },
      { path: "settings", element: <Settings /> }
    ]
  }
]);

createRoot(document.getElementById("root")).render(
  <AuthProvider>
    <RouterProvider router={router} />
  </AuthProvider>
);
