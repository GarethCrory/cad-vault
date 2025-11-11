import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import archiver from "archiver";
import { ensureProjectScaffold } from "./projectService.js";
import { scanProjectCAD } from "./historyService.js";

export async function generateRelease({ projectNumber, projectName, tag }) {
  const { releaseDir, releasesArchiveDir } = await ensureProjectScaffold(projectNumber, projectName);

  // clean out release dir
  try {
    const entries = await fsp.readdir(releaseDir);
    await Promise.all(entries.map(e => fsp.rm(path.join(releaseDir, e), { recursive: true, force: true })));
  } catch {}

  const { parts } = await scanProjectCAD(projectNumber, projectName);
  for (const p of parts) {
    if (!p.latestFile) continue;
    const dst = path.join(releaseDir, path.basename(p.latestFile));
    await fsp.copyFile(p.latestFile, dst);
  }

  await fsp.mkdir(releasesArchiveDir, { recursive: true });
  const zipName = `${projectNumber}_${projectName}_CLIENT_SEND_${tag}.zip`;
  const zipPath = path.join(releasesArchiveDir, zipName);

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(releaseDir, false);
    archive.finalize();
  });

  return { zipPath };
}
