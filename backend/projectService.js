import fs from "fs";
import fsp from "fs/promises";
import path from "path";

export const PROJECT_ROOT = path.join(process.cwd(), "ProjectRoot");

export function sanitizeName(s = "") {
  return String(s)
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function projectSlug(projectNumber, projectName) {
  return `${String(projectNumber).trim()}_${sanitizeName(projectName)}`;
}

export function projectPath(projectNumber, projectName) {
  return path.join(PROJECT_ROOT, projectSlug(projectNumber, projectName));
}

export async function ensureProjectScaffold(projectNumber, projectName) {
  const root = projectPath(projectNumber, projectName);
  const dirs = [
    root,
    path.join(root, "CAD"),
    path.join(root, "Documentation"),
    path.join(root, "Documentation", "contracts"),
    path.join(root, "Documentation", "images"),
    path.join(root, "Documentation", "research"),
    path.join(root, "Documentation", "sketches"),
    path.join(root, "Downloads"),
    path.join(root, "Export"),
    path.join(root, "Release"),
    path.join(root, "Releases-Archive"),
    path.join(root, "Renders"),
    path.join(root, "Renders", "Images"),
    path.join(root, "Renders", "Keyshot"),
    path.join(root, "Renders", "Textures"),
    path.join(root, "Attachments")
  ];
  await Promise.all(dirs.map(d => fsp.mkdir(d, { recursive: true })));
  return {
    projectRoot: root,
    cadDir: path.join(root, "CAD"),
    releaseDir: path.join(root, "Release"),
    releasesArchiveDir: path.join(root, "Releases-Archive")
  };
}

const META_FILENAME = "project.meta.json";

function projectMetaPath(projectNumber, projectName) {
  return path.join(projectPath(projectNumber, projectName), META_FILENAME);
}

export async function writeProjectMeta(projectNumber, projectName, meta = {}) {
  const target = projectMetaPath(projectNumber, projectName);
  await fsp.writeFile(target, JSON.stringify(meta, null, 2), "utf8");
}

export function readProjectMetaSync(projectNumber, projectName) {
  try {
    const target = projectMetaPath(projectNumber, projectName);
    const raw = fs.readFileSync(target, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function renameProjectDirectory(projectNumber, oldProjectName, newProjectName) {
  const from = projectPath(projectNumber, oldProjectName);
  const to = projectPath(projectNumber, newProjectName);
  const fromExists = fs.existsSync(from);
  const toExists = fs.existsSync(to);
  if (!fromExists) {
    if (!toExists) {
      await ensureProjectScaffold(projectNumber, newProjectName);
    }
    return { projectRoot: to };
  }
  await fsp.rename(from, to);
  return { projectRoot: to };
}

export function candidateProjectDirs(projectNumber, projectName) {
  const sanitizedRoot = projectPath(projectNumber, projectName);
  const legacyRoot = path.join(PROJECT_ROOT, `${projectNumber}_${projectName}`);
  const list = [{ root: sanitizedRoot, cadDir: path.join(sanitizedRoot, "CAD") }];
  if (legacyRoot !== sanitizedRoot) {
    list.push({ root: legacyRoot, cadDir: path.join(legacyRoot, "CAD") });
  }
  return list;
}
