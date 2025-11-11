import fs from "fs/promises";
import path from "path";
import { projectPath } from "./projectService.js";

const NAME_RE = /^P\d{3}_(?<type>[PSAHO])(?<part>\d{3})_(?<rev>Rev[A-Z])_(?<desc>.+)\.(?<ext>[^.]+)$/;

function sanitizeDescription(desc) {
  return String(desc || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function revIndex(revStr) {
  const m = /^Rev([A-Z])$/.exec(revStr || "");
  return m ? m[1].charCodeAt(0) : -1;
}

async function fileExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
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
      type: m.groups.type,
      part: m.groups.part,
      rev: m.groups.rev,
      desc: m.groups.desc,
      ext: m.groups.ext,
      abs: path.join(cadDir, f),
    });
  }
  return { cadDir, items, root };
}

/**
 * Edit a part: change description and/or type prefix for ALL revisions.
 * Keeps project number, part number, and rev tokens intact.
 */
export async function editPart({ projectNumber, projectName, typePrefix, partNumber, newDescription, newTypePrefix, note }) {
  if (!projectNumber || !projectName || !typePrefix || !partNumber) {
    throw new Error("Missing required fields");
  }

  const { cadDir, items, root } = await listPartFiles(projectNumber, projectName, typePrefix, partNumber);
  if (!items.length) throw new Error("No files found for that part");

  const sanitizedDesc = newDescription ? sanitizeDescription(newDescription) : null;
  const targetType = newTypePrefix ? String(newTypePrefix) : String(typePrefix);
  const projStr = String(projectNumber); // e.g. P001
  const partStr = String(partNumber).padStart(3, "0");
  const changes = [];

  // Process in order of ascending rev so older files move first, then latest — order not critical but predictable.
  items.sort((a, b) => revIndex(a.rev) - revIndex(b.rev));

  for (const it of items) {
    const oldAbs = it.abs;
    const oldBase = path.basename(oldAbs);
    const useDesc = sanitizedDesc ? sanitizedDesc : it.desc;
    const newBase = `${projStr}_${targetType}${partStr}_${it.rev}_${useDesc}.${it.ext}`;
    const newAbs = path.join(cadDir, newBase);

    // If filename is unchanged, skip rename but still update meta note if provided.
    const renamed = oldBase !== newBase;
    if (renamed) {
      await fs.rename(oldAbs, newAbs);
    }

    // Handle meta: move/rename if exists, otherwise create; then append note.
    const oldMeta = oldAbs + ".meta.json";
    const newMeta = newAbs + ".meta.json";
    let hadMeta = await fileExists(oldMeta);
    if (hadMeta) {
      // If we renamed the CAD file, rename meta to match
      if (renamed) {
        await fs.rename(oldMeta, newMeta);
      } else {
        // CAD file name unchanged but meta may still be at old name
        if (await fileExists(newMeta) === false) {
          await fs.rename(oldMeta, newMeta);
        }
      }
    }

    // Load or create meta, then append an audit note
    let meta = {};
    if (await fileExists(newMeta)) {
      try {
        const raw = await fs.readFile(newMeta, "utf8");
        meta = JSON.parse(raw || "{}");
      } catch { meta = {}; }
    }

    const ts = new Date().toISOString();
    const changeBits = [];
    if (renamed) changeBits.push(`renamed from ${oldBase}`);
    if (newTypePrefix && newTypePrefix !== it.type) changeBits.push(`type ${it.type}→${targetType}`);
    if (sanitizedDesc && sanitizedDesc !== it.desc) changeBits.push(`desc "${it.desc}"→"${sanitizedDesc}"`);
    if (note) changeBits.push(`note: ${note}`);

    const line = changeBits.length ? `Edit @ ${ts}: ${changeBits.join("; ")}` : `Edit @ ${ts}`;
    meta.notes = meta.notes ? `${meta.notes} | ${line}` : line;
    meta.createdBy = meta.createdBy || "manual";
    meta.createdAt = meta.createdAt || ts;

    await fs.writeFile(newMeta, JSON.stringify(meta, null, 2), "utf8");

    changes.push({
      from: oldBase,
      to: newBase,
      meta: path.basename(newMeta),
      renamed
    });
  }

  return {
    success: true,
    projectPath: root,
    cadDir,
    newTypePrefix: targetType,
    newDescription: sanitizedDesc,
    changesCount: changes.length,
    changes
  };
}
