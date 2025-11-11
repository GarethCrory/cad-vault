import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
let pdfParse = null;
import {
  saveAttachment,
  listAttachments,
  deleteAttachment,
  detectPartFromFilename,
  resolveAttachmentPath,
  detectCodesInText
} from "./attachmentService.js";

const router = express.Router();
const upload = multer({ dest: path.join(process.cwd(), "uploads") });

function requireProject(body = {}) {
  const projectNumber = String(body.projectNumber || "").trim();
  const projectName = String(body.projectName || "").trim();
  if (!projectNumber || !projectName) {
    const err = new Error("project reference required");
    err.status = 400;
    throw err;
  }
  return { projectNumber, projectName };
}

router.post("/api/attachment/list", async (req, res) => {
  try {
    const { projectNumber, projectName } = requireProject(req.body);
    const { typePrefix, partNumber } = req.body || {};
    if (!typePrefix || typeof partNumber === "undefined") {
      throw new Error("part reference required");
    }
    const rows = await listAttachments({ projectNumber, projectName, typePrefix, partNumber });
    const payload = rows.map((row) => ({
      ...row,
      url: `/api/attachment/download?projectNumber=${encodeURIComponent(projectNumber)}&projectName=${encodeURIComponent(projectName)}&typePrefix=${encodeURIComponent(typePrefix)}&partNumber=${encodeURIComponent(partNumber)}&filename=${encodeURIComponent(row.filename)}`
    }));
    res.json({ attachments: payload });
  } catch (err) {
    console.error("attachment list error", err);
    res.status(err.status || 400).json({ error: err.message || "attachment list failed" });
  }
});

router.post("/api/attachment/delete", async (req, res) => {
  try {
    const { projectNumber, projectName } = requireProject(req.body);
    const { typePrefix, partNumber, filename } = req.body || {};
    if (!typePrefix || typeof partNumber === "undefined" || !filename) {
      throw new Error("part reference and filename required");
    }
    await deleteAttachment({ projectNumber, projectName, typePrefix, partNumber, filename });
    res.json({ ok: true });
  } catch (err) {
    console.error("attachment delete error", err);
    res.status(err.status || 400).json({ error: err.message || "attachment delete failed" });
  }
});

router.post("/api/attachment/upload", upload.array("files"), async (req, res) => {
  try {
    const { projectNumber, projectName } = requireProject(req.body);
    const explicitType = req.body.typePrefix;
    const explicitPart = req.body.partNumber;
    const autoDetect = String(req.body.autoDetect || "").toLowerCase() === "true";
    const files = req.files || [];
    if (!files.length) throw new Error("No files uploaded");

    const results = [];
    if (autoDetect && !pdfParse) {
      try {
        ({ default: pdfParse } = await import("pdf-parse"));
      } catch (err) {
        console.warn("pdf-parse unavailable", err.message);
        pdfParse = null;
      }
    }

    for (const file of files) {
      const targets = new Map();
      const addTarget = (part) => {
        if (!part || !part.typePrefix || typeof part.partNumber === "undefined") return;
        const key = `${part.typePrefix}${String(part.partNumber).padStart(3, "0")}`;
        if (!targets.has(key)) {
          targets.set(key, {
            typePrefix: part.typePrefix.toUpperCase(),
            partNumber: String(part.partNumber).padStart(3, "0")
          });
        }
      };

      if (explicitType && typeof explicitPart !== "undefined") {
        addTarget({ typePrefix: explicitType, partNumber: explicitPart });
      }

      if (!targets.size && autoDetect) {
        const detected = detectPartFromFilename(file.originalname);
        if (detected) addTarget(detected);
      }

      let buffer = await fs.promises.readFile(file.path);
      if (!targets.size && autoDetect && pdfParse) {
        try {
          const parsed = await pdfParse(buffer);
          const codes = detectCodesInText(parsed.text || "");
          codes.forEach(addTarget);
        } catch (err) {
          console.warn("pdf parse failed", err.message);
        }
      }

      if (!targets.size) {
        results.push({ filename: file.originalname, status: "skipped", reason: "No matching part" });
        await fs.promises.unlink(file.path).catch(() => {});
        continue;
      }

      for (const target of targets.values()) {
        try {
          const saved = await saveAttachment({
            projectNumber,
            projectName,
            typePrefix: target.typePrefix,
            partNumber: target.partNumber,
            originalName: file.originalname,
            buffer
          });
          results.push({ filename: saved, status: "linked", typePrefix: target.typePrefix, partNumber: target.partNumber });
        } catch (err) {
          results.push({ filename: file.originalname, status: "error", reason: err.message, typePrefix: target.typePrefix, partNumber: target.partNumber });
        }
      }

      await fs.promises.unlink(file.path).catch(() => {});
    }
    res.json({ ok: true, results });
  } catch (err) {
    console.error("attachment upload error", err);
    res.status(err.status || 400).json({ error: err.message || "attachment upload failed" });
  }
});

router.get("/api/attachment/download", async (req, res) => {
  try {
    const { projectNumber, projectName, typePrefix, partNumber, filename } = req.query || {};
    if (!projectNumber || !projectName || !typePrefix || typeof partNumber === "undefined" || !filename) {
      return res.status(400).json({ error: "missing fields" });
    }
    const abs = await resolveAttachmentPath({
      projectNumber,
      projectName,
      typePrefix,
      partNumber,
      filename
    });
    return res.sendFile(abs);
  } catch (err) {
    console.error("attachment download error", err);
    res.status(404).json({ error: "attachment not found" });
  }
});

export default router;
