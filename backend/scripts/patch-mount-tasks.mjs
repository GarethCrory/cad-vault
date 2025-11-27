import fs from "fs";

const file = "index.js";
let s = fs.readFileSync(file, "utf8");

const hasImport = /import\s+tasks\s+from\s+"\.\/routes\/tasks\.js";?/.test(s);
const hasMount = /app\.use\("\/api\/tasks",\s*tasks\)\s*;/.test(s);

if (!hasImport) {
  const lines = s.split("\n");
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s.+from\s.+;/.test(lines[i])) lastImport = i;
  }
  const importLine = 'import tasks from "./routes/tasks.js";';
  if (lastImport >= 0) lines.splice(lastImport + 1, 0, importLine);
  else lines.unshift(importLine);
  s = lines.join("\n");
}

if (!hasMount) {
  if (/app\.use\("\/api\/assembly",\s*assemblies\)\s*;/.test(s)) {
    s = s.replace(
      /app\.use\("\/api\/assembly",\s*assemblies\)\s*;/,
      (m) => m + '\napp.use("/api/tasks", tasks);'
    );
  } else if (/app\.listen\(/.test(s)) {
    s = s.replace(/app\.listen\([^]*$/, (m) => 'app.use("/api/tasks", tasks);\n\n' + m);
  } else {
    s += '\napp.use("/api/tasks", tasks);\n';
  }
}

fs.writeFileSync(file, s);
console.log("patched index.js");
