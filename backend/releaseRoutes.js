import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import archiver from "archiver";

const PROJECT_ROOT = path.join(process.cwd(), "ProjectRoot");

function safeJoin(...p) {
  return path.join(...p).replace(/\\/g, "/");
}
function projDir(pn, pnme) {
  return `${pn}_${pnme}`;
}
function cadDir(pn, pnme) {
  return safeJoin(PROJECT_ROOT, projDir(pn, pnme), "CAD");
}
function releasesDir(pn, pnme) {
  return safeJoin(PROJECT_ROOT, projDir(pn, pnme), "Releases-Archive");
}
async function ensureDir(d) {
  await fsp.mkdir(d, { recursive: true });
}

async function listLatestFiles(pn, pnme, items) {
  const dir = cadDir(pn, pnme);
  const all = await fsp.readdir(dir).catch(() => []);
  const out = [];
  for (const it of items) {
    const pref = `${pn}_${it.typePrefix}${it.partNumber.padStart(3, "0")}_`;
    const c = all.filter((n) => n.startsWith(pref) && /Rev([A-Z])_/.test(n));
    if (!c.length) continue;
    c.sort((a, b) =>
      ((b.match(/Rev([A-Z])_/) || [])[1] || "A").localeCompare(
        (a.match(/Rev([A-Z])_/) || [])[1] || "A"
      )
    );
    const best = c[0];
    out.push({ name: best, abs: safeJoin(dir, best) });
  }
  return out;
}

async function readIndex(pn, pnme) {
  try {
    return JSON.parse(
      await fsp.readFile(safeJoin(releasesDir(pn, pnme), "releases.json"), "utf8")
    );
  } catch {
    return { releases: [] };
  }
}

async function writeIndex(pn, pnme, d) {
  await ensureDir(releasesDir(pn, pnme));
  await fsp.writeFile(
    safeJoin(releasesDir(pn, pnme), "releases.json"),
    JSON.stringify(d, null, 2)
  );
}

export default function setupReleaseRoutes(app) {
  app.post("/api/release/publish", async (req, res) => {
    try {
      const { projectNumber, projectName, tag, items } = req.body || {};
      if (!projectNumber || !projectName || !tag)
        return res.status(400).json({ error: "missing fields" });
      const files = await listLatestFiles(projectNumber, projectName, items);
      if (!files.length) return res.status(400).json({ error: "no matching files" });
      const dir = releasesDir(projectNumber, projectName);
      await ensureDir(dir);
      const zipName = `${projectNumber}_${projectName}_CLIENT_SEND_${tag}.zip`;
      const zipAbs = safeJoin(dir, zipName);
      await new Promise((resv, rej) => {
        const out = fs.createWriteStream(zipAbs);
        const a = archiver("zip", { zlib: { level: 9 } });
        out.on("close", resv);
        a.on("error", rej);
        a.pipe(out);
        files.forEach((f) => a.file(f.abs, { name: safeJoin("CAD", f.name) }));
        a.finalize();
      });
      const index = await readIndex(projectNumber, projectName);
      const rec = {
        tag,
        publishedAt: new Date().toISOString(),
        zip: zipAbs,
        files: files.map((f) => ({ name: f.name })),
      };
      index.releases.unshift(rec);
      await writeIndex(projectNumber, projectName, index);
      res.json({ ok: true, zipRelPath: zipAbs });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "publish fail" });
    }
  });

  app.post("/api/release/list", async (req, res) => {
    const { projectNumber, projectName } = req.body || {};
    if (!projectNumber || !projectName)
      return res.status(400).json({ error: "missing" });
    res.json(await readIndex(projectNumber, projectName));
  });
}
