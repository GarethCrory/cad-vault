import express from 'express';
import multer from 'multer';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { deletePartBatch } from "../historyService.js";
import { removePartReferences } from "../bomService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();
const upload = multer({ dest: os.tmpdir() });

// Change from upload.any() to upload.single() with the correct field name
router.post("/api/file/revise", upload.single('file'), async (req, res) => {
  try {
    // Use req.file instead of req.files
    if (!req.file) return res.status(400).json({ error: "temp file missing" });

    const {
      projectNumber,
      projectName,
      typePrefix,
      partNumber,
      rev,
      description,
      notes,
      originalname
    } = req.body;

    // Move file to project folder
    const projectsRoot = path.resolve(process.cwd(), "ProjectRoot");
    const destDir = path.join(projectsRoot, `${projectNumber}_${projectName}`, "CAD");
    fs.mkdirSync(destDir, { recursive: true });
    
    // Create canonical filename
    const canonicalName = `${projectNumber}_${typePrefix}${partNumber}_${rev}_${description}.step`;
    const destPath = path.join(destDir, canonicalName);
    
    fs.renameSync(req.file.path, destPath);

    return res.json({ 
      ok: true, 
      path: destPath,
      filename: canonicalName
    });
  } catch (err) {
    console.error("revise error:", err);
    return res.status(500).json({ error: err.message || "server error" });
  }
});

router.post("/api/part/delete", async (req, res) => {
  try {
    const { projectNumber, projectName, typePrefix, partNumber } = req.body || {};
    if (!projectNumber || !projectName || !typePrefix || typeof partNumber === "undefined") {
      return res.status(400).json({ error: "missing fields" });
    }
    const result = await deletePartBatch({ projectNumber, projectName, typePrefix, partNumber });
    const code = `${typePrefix}${String(partNumber).padStart(3, "0")}`;
    await removePartReferences(projectNumber, projectName, code).catch(() => {});
    res.json({ ok: true, removed: result.removed });
  } catch (err) {
    console.error("delete part error:", err);
    res.status(500).json({ error: err.message || "server error" });
  }
});

export default router;
