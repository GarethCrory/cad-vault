const fs = require('fs');

const file = 'src/pages/Project.jsx';
if (!fs.existsSync(file)) {
  console.error('src/pages/Project.jsx not found');
  process.exit(1);
}
let s = fs.readFileSync(file, 'utf8');
let changed = 0;

// ensure useState import
if (/from\s+['"]react['"]/.test(s)) {
  if (!/useState/.test(s)) {
    s = s.replace(/import\s+React\s+from\s+['"]react['"];?/, m => `import React, { useState } from "react";`);
    if (!/useState/.test(s)) {
      s = s.replace(/import\s+\{\s*([^}]*)\s*\}\s+from\s+['"]react['"];?/, (m, g) => {
        const list = g.split(',').map(v => v.trim()).filter(Boolean);
        if (!list.includes('useState')) list.push('useState');
        return `import { ${list.join(', ')} } from "react";`;
      });
    }
  }
} else {
  s = `import { useState } from "react";\n` + s;
}
changed++;

// import HistoryModal
if (!/import\s+HistoryModal\s+from\s+["']\.\.\/components\/HistoryModal["']/.test(s)) {
  s = `import HistoryModal from "../components/HistoryModal";\n` + s;
  changed++;
}

// import helpers
if (!/from\s+["']\.\.\/lib\/parts["']/.test(s)) {
  s = `import { resolveProjectCode, resolvePartNumber } from "../lib/parts";\n` + s;
  changed++;
}

// inject state and openHistory using helpers
if (!/openHistory\s*=\s*\(/.test(s)) {
  const inject =
`  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState({ projectCode: null, partNumber: null });
  const openHistory = (row) => {
    const projectCode = resolveProjectCode({ project, selectedProject });
    const partNumber = resolvePartNumber(row);
    if (!partNumber) return;
    if (import.meta?.env?.DEV) console.debug("[History] open", { projectCode, partNumber });
    setHistoryTarget({ projectCode, partNumber });
    setHistoryOpen(true);
  };
`;
  const anchors = [
    /export\s+default\s+function[^{]+\{/,
    /function\s+Project[^{]+\{/,
    /const\s+Project\s*=\s*\([^\)]*\)\s*=>\s*\{/
  ];
  let done = false;
  for (const rx of anchors) {
    const m = s.match(rx);
    if (m) { s = s.replace(rx, m[0] + '\n' + inject); done = true; break; }
  }
  if (!done) s = inject + s;
  changed++;
}

// mount modal
if (!/<HistoryModal\s/is.test(s)) {
  const mount =
`  <HistoryModal
    isOpen={historyOpen}
    onClose={() => setHistoryOpen(false)}
    projectCode={historyTarget.projectCode}
    partNumber={historyTarget.partNumber}
  />`;
  const endRx = /\)\s*;\s*\n\s*\}\s*$/s;
  if (endRx.test(s)) s = s.replace(endRx, mount + '\n);\n}\n');
  else s = s + '\n' + mount + '\n';
  changed++;
}

// wire any History buttons
let wired = 0;
function wireButtons(rx) {
  s = s.replace(rx, (m) => {
    if (/onClick=/.test(m)) return m;
    wired++;
    return m.replace(/>$/, ' onClick={() => openHistory(row || item || part)}>');
  });
}
wireButtons(/<button(?:(?!<\/button>)[\s\S])*?(?:title|aria-label)\s*=\s*['"][^'"]*History[^'"]*['"][\s\S]*?>/gi);
wireButtons(/<button(?:(?!<\/button>)[\s\S])*?data-action\s*=\s*['"]history['"][\s\S]*?>/gi);

// save
fs.writeFileSync(file, s);
console.log(JSON.stringify({ changed, wired }, null, 2));
