import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";
import { ensureProjectScaffold, sanitizeName } from "./projectService.js";

function parseMaybeJSON(v) {
  if (v && typeof v === "string") {
    try { return JSON.parse(v); } catch { return v; }
  }
  return v;
}

function normaliseProject(opts = {}) {
  const pj = parseMaybeJSON(opts.project);
  const p = pj && typeof pj === "object" ? pj : {};
  const projectNumber = String(opts.projectNumber || p.projectNumber || "").trim();
  const projectName = String(opts.projectName || p.projectName || "").trim();
  if (!projectNumber || !projectName) throw new Error("project missing");
  return { projectNumber, projectName };
}

function normTypePrefix(tp) {
  const t = String(tp || "").trim().toUpperCase();
  if (!t) throw new Error("typePrefix missing");
  return t;
}

function normPartNumber(n) {
  const s = String(n ?? "").trim();
  if (!s) throw new Error("partNumber missing");
  return s.padStart(3, "0");
}

export function normRev(rev) {
  const r = String(rev || "").trim();
  if (!/^Rev[A-Z]$/.test(r)) throw new Error("rev must be like RevA");
  return r;
}

function normDescription(d) {
  const s = String(d || "").trim();
  if (!s) throw new Error("description missing");
  return sanitizeName(s).replace(/\s+/g, "-");
}

async function sha256(filePath) {
  const buf = await fsp.readFile(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export async function saveUploadedFile(opts = {}) {
  const { projectNumber, projectName } = normaliseProject(opts);
  const typePrefix = normTypePrefix(opts.typePrefix);
  const partNumber = normPartNumber(opts.partNumber);
  const rev = normRev(opts.rev);
  const description = normDescription(opts.description);

  const tempPath = opts.tempPath;
  const originalName = opts.originalName || null;
  const fileSize = opts.fileSize || null;
  const createdBy = opts.createdBy || "manual";
  const notes = opts.notes || null;

  if (!tempPath || !fs.existsSync(tempPath)) throw new Error("temp file missing");

  const { cadDir } = await ensureProjectScaffold(projectNumber, projectName);

  const base = `${projectNumber}_${typePrefix}${partNumber}_${rev}_${description}.step`;
  const dest = path.join(cadDir, base);

  await fsp.rename(tempPath, dest);

  const hash = await sha256(dest);
  const meta = {
    projectNumber,
    projectName,
    typePrefix,
    partNumber,
    rev,
    description,
    notes,
    originalFilename: originalName,
    fileSize,
    hash,
    createdBy,
    createdAt: new Date().toISOString()
  };

  await fsp.writeFile(dest + ".meta.json", JSON.stringify(meta, null, 2), "utf8");

  return {
    savedAs: dest,
    relative: path.relative(process.cwd(), dest),
    filename: path.basename(dest)
  };
}
