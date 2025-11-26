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
import Timeline from "./pages/Timeline.jsx";

const router = createBrowserRouter([
  { path: "/", element: <App />, children: [
      { index: true, element: <Projects /> },
      { path: "p/:projectNumber/:projectName", element: <Project /> },
      { path: "clients", element: <Clients /> },
      { path: "timeline", element: <Timeline /> },
      { path: "settings", element: <Settings /> }
  ] }
]);

createRoot(document.getElementById("root")).render(<RouterProvider router={router} />);
