import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { ensureProjectScaffold, candidateProjectDirs } from "./projectService.js";
import { normRev } from "./fileService.js";

function pad3(n) { return String(n).padStart(3, "0"); }
function revIndex(r) { return r && /^Rev[A-Z]$/.test(r) ? r.charCodeAt(3) - 65 : -1; }
function nextRev(r) {
  if (!r) return "RevA";
  const c = r.charCodeAt(3);
  return "Rev" + String.fromCharCode(Math.min(c + 1, 90));
}

async function readMeta(metaPath) {
  try {
    const txt = await fsp.readFile(metaPath, "utf8");
    return JSON.parse(txt);
  } catch {
    return {};
  }
}

export async function getPartHistory({ projectNumber, projectName, typePrefix, partNumber }) {
  const dirs = candidateProjectDirs(projectNumber, projectName);
  const history = [];
  const pattern = new RegExp(`^${projectNumber}_${typePrefix}${partNumber}_Rev[A-Z]_.*\\.step$`, "i");
  try {
    for (const { cadDir } of dirs) {
      let files = [];
      try {
        files = fs.readdirSync(cadDir);
      } catch {
        continue;
      }
      for (const file of files) {
        if (pattern.test(file)) {
          const stats = fs.statSync(path.join(cadDir, file));
          const revMatch = /_Rev([A-Z])_/.exec(file);
          history.push({
            fileName: file,
            rev: revMatch ? revMatch[1] : "?",
            time: stats.mtime.toISOString(),
            size: stats.size
          });
        }
      }
    }
    history.sort((a, b) => b.rev.localeCompare(a.rev));
    return { history };
  } catch (err) {
    console.error("History error:", err);
    return { history: [] };
  }
}

export async function scanProjectCAD(projectNumber, projectName) {
  const { projectRoot, cadDir } = await ensureProjectScaffold(projectNumber, projectName);
  const map = new Map();
  const re = new RegExp(`^(${projectNumber})_([A-Z])(\\d{3})_Rev([A-Z])_(.+)\\.step$`);
  const files = await fsp.readdir(cadDir);
  for (const f of files) {
    const m = f.match(re);
    if (!m) continue;
    const typePrefix = m[2];
    const partNumber = m[3];
    const rev = "Rev" + m[4];
    const key = `${typePrefix}_${partNumber}`;
    const rec = map.get(key) || { typePrefix, partNumber, latestRev: null, latestFile: null, revisions: [] };
    const abs = path.join(cadDir, f);
    rec.revisions.push({ rev, file: abs });
    if (!rec.latestRev || revIndex(rev) > revIndex(rec.latestRev)) {
      rec.latestRev = rev;
      rec.latestFile = abs;
    }
    map.set(key, rec);
  }
  const parts = [...map.values()].map(p => ({
    typePrefix: p.typePrefix,
    partNumber: p.partNumber,
    latestRev: p.latestRev,
    latestFile: p.latestFile,
    revisionCount: p.revisions.length
  }));
  return { parts, count: parts.length, projectPath: projectRoot };
}

export async function restoreRevisionAsNew({ projectNumber, projectName, typePrefix, partNumber, sourceRev, notes }) {
  const { cadDir } = await ensureProjectScaffold(projectNumber, projectName);
  const pn = pad3(partNumber);
  const re = new RegExp(`^${projectNumber}_${typePrefix}${pn}_${normRev(sourceRev)}_(.+)\\.step$`);
  const files = await fsp.readdir(cadDir);
  const src = files.find(f => re.test(f));
  if (!src) throw new Error("source revision not found");
  const desc = src.replace(/^.*_Rev[A-Z]_/, "").replace(/\.step$/, "");
  const history = await getPartHistory({ projectNumber, projectName, typePrefix, partNumber });
  const newRev = nextRev(history.latestRev);
  const dstName = `${projectNumber}_${typePrefix}${pn}_${newRev}_${desc}.step`;
  const srcAbs = path.join(cadDir, src);
  const dstAbs = path.join(cadDir, dstName);
  await fsp.copyFile(srcAbs, dstAbs);
  const meta = {
    projectNumber, projectName, typePrefix, partNumber: pn,
    rev: newRev, description: desc, notes: notes || "restore",
    originalFilename: src, createdBy: "restore", createdAt: new Date().toISOString()
  };
  await fsp.writeFile(dstAbs + ".meta.json", JSON.stringify(meta, null, 2), "utf8");
  return {
    projectPath: path.dirname(path.dirname(cadDir)),
    cadDir,
    newFilename: dstName,
    newAbsPath: dstAbs,
    newRev
  };
}

export async function editPartBatch({ projectNumber, projectName, typePrefix, partNumber, newTypePrefix, newDescription, note }) {
  const { projectRoot, cadDir } = await ensureProjectScaffold(projectNumber, projectName);
  const pn = pad3(partNumber);
  const re = new RegExp(`^${projectNumber}_${typePrefix}${pn}_Rev([A-Z])_(.+)\\.step$`);
  const files = await fsp.readdir(cadDir);
  const changes = [];
  for (const f of files) {
    const m = f.match(re);
    if (!m) continue;
    const rev = "Rev" + m[1];
    const oldDesc = m[2];
    const desc = newDescription ? sanitize(newDescription) : oldDesc;
    const tp = newTypePrefix || typePrefix;
    const to = `${projectNumber}_${tp}${pn}_${rev}_${desc}.step`;
    if (to === f) continue;
    await fsp.rename(path.join(cadDir, f), path.join(cadDir, to));
    const metaPath = path.join(cadDir, to + ".meta.json");
    let meta = {};
    try { meta = JSON.parse(await fsp.readFile(metaPath, "utf8")); } catch {}
    const stamp = `Edit @ ${new Date().toISOString()}: renamed from ${f}` +
      (newDescription ? `; desc "${oldDesc}"→"${desc}"` : "") +
      (newTypePrefix ? `; type ${typePrefix}→${tp}` : "") +
      (note ? `; note: ${note}` : "");
    meta.notes = meta.notes ? `${meta.notes} | ${stamp}` : stamp;
    await fsp.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");
    changes.push({ from: f, to, meta: path.basename(metaPath), renamed: true });
  }
  return {
    success: true,
    projectPath: projectRoot,
    cadDir,
    newTypePrefix: newTypePrefix || null,
    newDescription: newDescription || null,
    changesCount: changes.length,
    changes
  };
}

export async function deletePartBatch({ projectNumber, projectName, typePrefix, partNumber }) {
  if (!projectNumber || !projectName || !typePrefix || typeof partNumber === "undefined") {
    throw new Error("Missing required fields");
  }
  const dirs = candidateProjectDirs(projectNumber, projectName);
  const pn = pad3(partNumber);
  const re = new RegExp(`^${projectNumber}_${typePrefix}${pn}_Rev([A-Z])_(.+)`);
  let removed = 0;
  for (const { cadDir } of dirs) {
    let files = [];
    try {
      files = await fsp.readdir(cadDir);
    } catch {
      continue;
    }
    const targets = files.filter((file) => re.test(file));
    for (const file of targets) {
      await fsp.rm(path.join(cadDir, file), { force: true });
      await fsp.rm(path.join(cadDir, file + ".meta.json"), { force: true }).catch(() => {});
      removed++;
    }
  }
  if (!removed) throw new Error("Part files not found");
  return { removed };
}

function sanitize(s) {
  return String(s).normalize("NFKD").replace(/[^\w\s.-]/g, "").trim().replace(/\s+/g, "-");
}
