import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { projectPath } from "./projectService.js";

const NAME_RE = /^P\d{3}_(?<type>[PSAHO])(?<part>\d{3})_(?<rev>Rev[A-Z])_(?<desc>.+)\.(?<ext>[^.]+)$/;

function revIndex(revStr) {
  const m = /^Rev([A-Z])$/.exec(revStr || "");
  return m ? m[1].charCodeAt(0) : -1;
}
function nextRevFrom(files) {
  let max = -1;
  for (const f of files) max = Math.max(max, revIndex(f.rev));
  const nextCode = (max < 0 ? "A".charCodeAt(0) : max + 1);
  if (nextCode > "Z".charCodeAt(0)) throw new Error("Revision overflow");
  return "Rev" + String.fromCharCode(nextCode);
}
async function hashFile(absPath) {
  const buf = await fs.readFile(absPath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function listPartFiles(projectNumber, projectName, typePrefix, partNumber) {
  const root = projectPath(projectNumber, projectName);
  const cadDir = path.join(root, "CAD");
  let files = [];
  try { files = await fs.readdir(cadDir); } catch { return { cadDir, items: [] }; }

  const items = [];
  const partStr = String(partNumber).padStart(3, "0");
  for (const f of files) {
    if (f.endsWith(".meta.json")) continue;
    const m = NAME_RE.exec(f);
    if (!m) continue;
    if (m.groups.type !== String(typePrefix)) continue;
    if (m.groups.part !== partStr) continue;
    items.push({
      file: f,
      rev: m.groups.rev,
      desc: m.groups.desc,
      ext: m.groups.ext,
      abs: path.join(cadDir, f),
    });
  }
  return { cadDir, items };
}

export async function restoreRevision({ projectNumber, projectName, typePrefix, partNumber, sourceRev, notes }) {
  if (!projectNumber || !projectName || !typePrefix || !partNumber || !sourceRev) {
    throw new Error("Missing required fields");
  }

  const { cadDir, items } = await listPartFiles(projectNumber, projectName, typePrefix, partNumber);
  if (!items.length) throw new Error("No files found for that part");

  const src = items.find(i => i.rev === sourceRev);
  if (!src) throw new Error(`Source revision ${sourceRev} not found`);

  const newRev = nextRevFrom(items);
  const projectStr = projectNumber; // already like P001
  const typeStr = String(typePrefix);
  const partStr = String(partNumber).padStart(3, "0");
  const newName = `${projectStr}_${typeStr}${partStr}_${newRev}_${src.desc}.${src.ext}`;
  const newAbs = path.join(cadDir, newName);

  await fs.copyFile(src.abs, newAbs);

  const h = await hashFile(newAbs);
  const meta = {
    notes: notes || `Restored from ${path.basename(src.abs)}`,
    originalFilename: path.basename(src.abs),
    hash: h,
    createdBy: "restore",
    createdAt: new Date().toISOString(),
  };
  await fs.writeFile(newAbs + ".meta.json", JSON.stringify(meta, null, 2), "utf8");

  return {
    projectPath: path.dirname(path.dirname(cadDir)),
    cadDir,
    newFilename: newName,
    newAbsPath: newAbs,
    newRev,
  };
}
