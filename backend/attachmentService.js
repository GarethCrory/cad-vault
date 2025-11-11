import path from "path";
import fsp from "fs/promises";
import { ensureProjectScaffold } from "./projectService.js";

const VALID_EXTENSIONS = [".pdf"];
const PART_CODE_RE = /([PSAHO])(\d{3})/i;

function pad3(n) {
  return String(n).padStart(3, "0");
}

function sanitizeName(name = "") {
  return String(name)
    .trim()
    .replace(/[^\w.\-]+/g, "-");
}

async function attachmentsRoot(projectNumber, projectName) {
  const { projectRoot } = await ensureProjectScaffold(projectNumber, projectName);
  const dir = path.join(projectRoot, "Attachments");
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

async function ensurePartDir(projectNumber, projectName, typePrefix, partNumber) {
  const root = await attachmentsRoot(projectNumber, projectName);
  const dir = path.join(root, `${String(typePrefix).toUpperCase()}${pad3(partNumber)}`);
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

async function exists(p) {
  try { await fsp.access(p); return true; } catch { return false; }
}

async function uniquePath(dir, filename) {
  const ext = path.extname(filename) || ".pdf";
  const base = path.basename(filename, ext) || "attachment";
  let attempt = 0;
  let candidate;
  do {
    const suffix = attempt ? `-${attempt}` : "";
    candidate = path.join(dir, `${base}${suffix}${ext}`);
    attempt += 1;
  } while (await exists(candidate));
  return candidate;
}

export async function saveAttachment({ projectNumber, projectName, typePrefix, partNumber, originalName, tempPath, buffer }) {
  const dir = await ensurePartDir(projectNumber, projectName, typePrefix, partNumber);
  const ext = path.extname(originalName || "").toLowerCase();
  const normalizedExt = ext || ".pdf";
  if (!VALID_EXTENSIONS.includes(normalizedExt)) {
    throw new Error("Only PDF attachments are supported");
  }
  const safeName = sanitizeName(originalName || `attachment-${Date.now()}.pdf`) || `attachment-${Date.now()}.pdf`;
  const target = await uniquePath(dir, safeName.endsWith(normalizedExt) ? safeName : `${safeName}${normalizedExt}`);
  if (buffer) {
    await fsp.writeFile(target, buffer);
  } else if (tempPath) {
    await fsp.rename(tempPath, target);
  } else {
    throw new Error("No attachment data provided");
  }
  return path.basename(target);
}

export async function listAttachments({ projectNumber, projectName, typePrefix, partNumber }) {
  const dir = await ensurePartDir(projectNumber, projectName, typePrefix, partNumber);
  let files = [];
  try {
    files = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    files = [];
  }
  const rows = [];
  for (const entry of files) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!VALID_EXTENSIONS.includes(ext)) continue;
    const abs = path.join(dir, entry.name);
    const st = await fsp.stat(abs);
    rows.push({
      filename: entry.name,
      size: st.size,
      updatedAt: st.mtime.toISOString()
    });
  }
  rows.sort((a, b) => a.filename.localeCompare(b.filename));
  return rows;
}

export async function deleteAttachment({ projectNumber, projectName, typePrefix, partNumber, filename }) {
  const dir = await ensurePartDir(projectNumber, projectName, typePrefix, partNumber);
  const target = path.join(dir, filename);
  await fsp.rm(target, { force: true });
}

export function detectPartFromFilename(filename = "") {
  const match = filename.match(PART_CODE_RE);
  if (!match) return null;
  return {
    typePrefix: match[1].toUpperCase(),
    partNumber: pad3(match[2])
  };
}

export async function resolveAttachmentPath({ projectNumber, projectName, typePrefix, partNumber, filename }) {
  const dir = await ensurePartDir(projectNumber, projectName, typePrefix, partNumber);
  return path.join(dir, filename);
}

export function detectCodesInText(text = "") {
  const map = new Map();
  const patterns = [
    /\b([PSAHO])\s*-?\s*(\d{3})\b/gi,
    /\b\d{2,4}[-_ ]([PSAHO])[-_ ]?0*(\d{3})\b/gi
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text))) {
      const typePrefix = match[1].toUpperCase();
      const partNumber = pad3(match[2]);
      map.set(typePrefix + partNumber, { typePrefix, partNumber });
    }
  }
  return Array.from(map.values());
}
