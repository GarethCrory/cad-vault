import cors from "cors";
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";
import setupReleaseRoutes from "./releaseRoutes.js";
import { ensureProjectScaffold, projectPath, PROJECT_ROOT, writeProjectMeta, readProjectMetaSync, renameProjectDirectory, candidateProjectDirs } from "./projectService.js";
import { saveUploadedFile } from "./fileService.js";
import { getPartHistory, deletePartBatch } from "./historyService.js";
import { scanProjectCAD } from "./scanService.js";
import {
  listAssembly,
  linkAssembly,
  unlinkAssembly,
  updateAssemblyQty
} from "./assemblyService.js";
import bomRoutes from "./bomRoutes.js";
import attachmentRoutes from "./attachmentRoutes.js";
import { removePartReferences } from "./bomService.js";
// optional - some repos may have this, otherwise ignore
let editPartBatch = null;
try { ({ editPartBatch } = await import("./editService.js")); } catch {}

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

// CORS for Vite dev servers and same-origin
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (/^http:\/\/localhost:51\d{2}$/.test(origin) ||
        /^http:\/\/127\.0\.0\.1:51\d{2}$/.test(origin)) return cb(null, true);
    return cb(null, true); // be permissive for local use
  },
  methods: ["GET","POST","OPTIONS"],
  allowedHeaders: ["content-type"]
}));
app.use(express.json());

const upload = multer({ dest: path.join(process.cwd(), "uploads") });

/** Utility: list projects by scanning ProjectRoot */
function hyphenToTitle(s=""){ return s.replace(/-/g, " ").trim(); }
function titleToSlug(s=""){ return s.trim().replace(/\s+/g,"-"); }

function listProjectsSync() {
  try { fs.mkdirSync(PROJECT_ROOT, { recursive: true }); } catch {}
  const names = fs.readdirSync(PROJECT_ROOT, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  const projectsByKey = new Map();

  for (const dir of names) {
    const m = /^([^_]+)_(.+)$/.exec(dir);
    if (!m) continue;
    const projectNumber = m[1];
    const slugName = m[2];
    const projectName = hyphenToTitle(slugName);
    const key = `${projectNumber}::${projectName.toLowerCase()}`;
    let entry = projectsByKey.get(key);
    if (!entry) {
      entry = {
        projectNumber,
        projectName,
        partCodes: new Set(),
        createdAt: null,
        roots: []
      };
      projectsByKey.set(key, entry);
    }
    const root = path.join(PROJECT_ROOT, dir);
    entry.roots.push(root);
    const cadDir = path.join(root, "CAD");
    try {
      const files = fs.readdirSync(cadDir);
      const escapedNumber = projectNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const filePattern = new RegExp(`^${escapedNumber}_(?<type>[PSAHO])(?<part>\\d{3})_Rev(?<rev>[A-Z])_.*\\.step$`, "i");
      for (const f of files) {
        const mm = filePattern.exec(f);
        if (!mm) continue;
        const type = (mm.groups.type || "").toUpperCase();
        const part = mm.groups.part;
        if (!type || !part) continue;
        entry.partCodes.add(`${type}${part}`);
      }
    } catch {}
    try {
      const st = fs.statSync(root);
      const createdAt = (st.birthtime || st.mtime).toISOString();
      if (!entry.createdAt || new Date(createdAt) < new Date(entry.createdAt)) {
        entry.createdAt = createdAt;
      }
    } catch {}
  }

  const rows = [];
  for (const entry of projectsByKey.values()) {
    const canonicalRoot = projectPath(entry.projectNumber, entry.projectName);
    const canonicalDir = path.basename(canonicalRoot);
    const projectDir = fs.existsSync(canonicalRoot) ? canonicalDir : path.basename(entry.roots[0]);
    let meta = readProjectMetaSync(entry.projectNumber, entry.projectName);
    if (!meta) {
      for (const root of entry.roots) {
        try {
          const metaPath = path.join(root, "project.meta.json");
          if (fs.existsSync(metaPath)) {
            const raw = fs.readFileSync(metaPath, "utf8");
            meta = JSON.parse(raw);
            break;
          }
        } catch {}
      }
    }
    meta = meta || {};
    const displayOrder = typeof meta.displayOrder === "number" ? meta.displayOrder : null;
    rows.push({
      projectNumber: entry.projectNumber,
      projectName: entry.projectName,
      projectDir,
      partCount: entry.partCodes.size,
      createdAt: entry.createdAt || new Date().toISOString(),
      client: meta.client || "Personal Projects",
      contactPerson: meta.contactPerson || "",
      email: meta.email || "",
      phone: meta.phone || "",
      notes: meta.notes || "",
      clientUpdatedAt: meta.updatedAt || entry.createdAt || new Date().toISOString(),
      displayOrder
    });
  }

  rows.sort((a, b) => {
    const ao = typeof a.displayOrder === "number" ? a.displayOrder : Number.MAX_SAFE_INTEGER;
    const bo = typeof b.displayOrder === "number" ? b.displayOrder : Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  return rows;
}

/** Routes **/

// List projects
app.post("/api/projects/list", (req, res) => {
  try {
    const projects = listProjectsSync();
    res.json({ projects, count: projects.length });
  } catch (e) {
    console.error("projects list error", e);
    res.status(400).json({ error: e.message });
  }
});

// Create a new project scaffold
async function handleCreateProject(req, res) {
  try {
    const { projectNumber, projectName, client, contactPerson, email, phone, notes } = req.body || {};
    if (!projectNumber || !projectName) {
      return res.status(400).json({ error: "projectNumber and projectName are required" });
    }
    await ensureProjectScaffold(projectNumber, projectName);
    const meta = {
      client: client?.trim() || "Personal Projects",
      contactPerson: contactPerson || "",
      email: email || "",
      phone: phone || "",
      notes: notes || "",
      updatedAt: new Date().toISOString()
    };
    await writeProjectMeta(projectNumber, projectName, meta);
    res.json({ ok: true, meta });
  } catch (e) {
    console.error("project create error", e);
    res.status(400).json({ error: e.message });
  }
}

app.post("/api/projects/create", handleCreateProject);
app.post("/api/project/create", handleCreateProject);

app.post("/api/project/delete", async (req, res) => {
  try {
    const { projectNumber, projectName } = req.body || {};
    if (!projectNumber || !projectName) return res.status(400).json({ error: "projectNumber and projectName are required" });
    const target = projectPath(projectNumber, projectName);
    await fsp.rm(target, { recursive: true, force: true });
    res.json({ ok: true });
  } catch (e) {
    console.error("project delete error", e);
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/projects/reorder", async (req, res) => {
  try {
    const payload = Array.isArray(req.body?.order) ? req.body.order : [];
    if (!payload.length) {
      return res.json({ ok: true, updated: 0 });
    }
    await Promise.all(payload.map(async (item, idx) => {
      const { projectNumber, projectName } = item || {};
      if (!projectNumber || !projectName) return;
      const meta = readProjectMetaSync(projectNumber, projectName) || {};
      const displayOrder = typeof item.displayOrder === "number" ? item.displayOrder : idx;
      const nextMeta = { ...meta, displayOrder };
      await writeProjectMeta(projectNumber, projectName, nextMeta);
    }));
    res.json({ ok: true, updated: payload.length });
  } catch (e) {
    console.error("projects reorder error", e);
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/project/meta", async (req, res) => {
  try {
    const { projectNumber, projectName, client, contactPerson, email, phone, notes } = req.body || {};
    if (!projectNumber || !projectName) return res.status(400).json({ error: "projectNumber and projectName are required" });
    const meta = {
      client: client?.trim() || "Personal Projects",
      contactPerson: contactPerson || "",
      email: email || "",
      phone: phone || "",
      notes: notes || "",
      updatedAt: new Date().toISOString()
    };
    await writeProjectMeta(projectNumber, projectName, meta);
    res.json({ ok: true, meta });
  } catch (e) {
    console.error("project meta error", e);
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/project/rename", async (req, res) => {
  try {
    const { projectNumber, oldProjectName, newProjectName } = req.body || {};
    if (!projectNumber || !oldProjectName || !newProjectName) {
      return res.status(400).json({ error: "projectNumber, oldProjectName and newProjectName are required" });
    }
    await renameProjectDirectory(projectNumber, oldProjectName, newProjectName);
    res.json({ ok: true });
  } catch (e) {
    console.error("project rename error", e);
    res.status(400).json({ error: e.message });
  }
});

// Scan a project's CAD folder for unique parts/revisions
app.post("/api/project/scan", async (req, res) => {
  try {
    const { projectNumber, projectName } = req.body || {};
    if (!projectNumber || !projectName) return res.status(400).json({ error: "missing" });
    const out = await scanProjectCAD(projectNumber, projectName);
    res.json(out);
  } catch (e) {
    console.error("scan error", e);
    res.status(400).json({ error: e.message });
  }
});

// Get part revision history
app.post("/api/part/history", async (req, res) => {
  try {
    const out = await getPartHistory(req.body || {});
    res.json(out);
  } catch (e) {
    console.error("history error", e);
    res.status(400).json({ error: e.message });
  }
});

// Edit part batch (optional)
app.post("/api/part/edit", async (req, res) => {
  try {
    if (req.body?.action === "delete") {
      const { projectNumber, projectName, typePrefix, partNumber } = req.body || {};
      if (!projectNumber || !projectName || !typePrefix || typeof partNumber === "undefined") {
        return res.status(400).json({ error: "missing fields" });
      }
      const result = await deletePartBatch({ projectNumber, projectName, typePrefix, partNumber });
      const code = `${typePrefix}${String(partNumber).padStart(3, "0")}`;
      await removePartReferences(projectNumber, projectName, code).catch(() => {});
      return res.json({ ok: true, removed: result.removed });
    }
    if (typeof editPartBatch !== "function") return res.json({ success: false, message: "edit service not available" });
    const out = await editPartBatch(req.body || {});
    res.json(out);
  } catch (e) {
    console.error("edit error", e);
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/part/delete", async (req, res) => {
  try {
    const { projectNumber, projectName, typePrefix, partNumber } = req.body || {};
    if (!projectNumber || !projectName || !typePrefix || typeof partNumber === "undefined") {
      return res.status(400).json({ error: "missing fields" });
    }
    const result = await deletePartBatch({ projectNumber, projectName, typePrefix, partNumber });
    const code = `${typePrefix}${String(partNumber).padStart(3, "0")}`;
    await removePartReferences(projectNumber, projectName, code).catch(() => {});
    res.json({ ok: true, removed: result.removed });
  } catch (e) {
    console.error("part delete error", e);
    res.status(400).json({ error: e.message });
  }
});

// Upload and revise a file
app.post("/api/file/revise", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const {
      projectNumber,
      projectName,
      typePrefix,
      partNumber,
      rev,
      description,
      notes
    } = req.body;

    const { cadDir: destDir } = await ensureProjectScaffold(projectNumber, projectName);
    
    // Create canonical filename with sanitized description
    const sanitizedDesc = description.replace(/[^a-zA-Z0-9-]/g, '-');
    const canonicalName = `${projectNumber}_${typePrefix}${partNumber}_${rev}_${sanitizedDesc}.step`;
    const destPath = path.join(destDir, canonicalName);
    
    fs.renameSync(req.file.path, destPath);

    return res.json({ 
      ok: true, 
      path: destPath,
      filename: canonicalName,
      description: description, // Add this
      partNumber: partNumber,
      typePrefix: typePrefix,
      rev: rev
    });
  } catch (err) {
    console.error("revise error:", err);
    return res.status(500).json({ error: err.message || "server error" });
  }
});

// Release routes (publish/list)
setupReleaseRoutes(app);
app.use(bomRoutes);
app.use(attachmentRoutes);

function requireProjectPayload(body = {}) {
  const projectNumber = String(body.projectNumber || "").trim();
  const projectName = String(body.projectName || "").trim();
  if (!projectNumber || !projectName) {
    const error = new Error("Missing project reference");
    error.status = 400;
    throw error;
  }
  return { projectNumber, projectName };
}

app.post("/api/assembly/list", async (req, res) => {
  try {
    const { projectNumber, projectName } = requireProjectPayload(req.body);
    const { typePrefix, partNumber } = req.body;
    const payload = await listAssembly({ projectNumber, projectName, typePrefix, partNumber });
    res.json(payload);
  } catch (err) {
    console.error("assembly list error", err);
    res.status(err.status || 400).json({ error: err.message || "Assembly list failed" });
  }
});

app.post("/api/assembly/link", async (req, res) => {
  try {
    const { projectNumber, projectName } = requireProjectPayload(req.body);
    const response = await linkAssembly({
      projectNumber,
      projectName,
      parent: req.body.parent,
      child: req.body.child,
      qty: req.body.qty
    });
    res.json(response);
  } catch (err) {
    console.error("assembly link error", err);
    res.status(err.status || 400).json({ error: err.message || "Assembly link failed" });
  }
});

app.post("/api/assembly/unlink", async (req, res) => {
  try {
    const { projectNumber, projectName } = requireProjectPayload(req.body);
    const response = await unlinkAssembly({
      projectNumber,
      projectName,
      parent: req.body.parent,
      child: req.body.child
    });
    res.json(response);
  } catch (err) {
    console.error("assembly unlink error", err);
    res.status(err.status || 400).json({ error: err.message || "Assembly unlink failed" });
  }
});

app.post("/api/assembly/updateQty", async (req, res) => {
  try {
    const { projectNumber, projectName } = requireProjectPayload(req.body);
    const response = await updateAssemblyQty({
      projectNumber,
      projectName,
      parent: req.body.parent,
      child: req.body.child,
      qty: req.body.qty
    });
    res.json(response);
  } catch (err) {
    console.error("assembly update qty error", err);
    res.status(err.status || 400).json({ error: err.message || "Assembly update qty failed" });
  }
});

// Health
app.get("/api/health", (req,res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`✅ CAD Vault backend running at http://localhost:${PORT}`);
});
