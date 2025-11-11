import fs from "fs";
import path from "path";

const root = path.join(process.cwd(), "ProjectRoot");

function rebuildParts() {
  const projects = fs.readdirSync(root).filter((p) => p.startsWith("P"));
  for (const project of projects) {
    const projPath = path.join(root, project, "CAD");
    if (!fs.existsSync(projPath)) continue;
    const files = fs.readdirSync(projPath).filter((f) => f.endsWith(".step"));
    console.log(`\nRebuilding ${project}…`);
    for (const f of files) {
      const match = f.match(/(P\d+)_(\w\d{3})_Rev([A-Z])_(.*)\.step/i);
      if (match) {
        console.log(`  Found: ${match[0]}`);
      }
    }
  }
}

rebuildParts();
