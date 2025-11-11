const fs = require('fs');

const file = 'src/pages/Project.jsx';
if (!fs.existsSync(file)) {
  console.error('Project.jsx not found at src/pages/Project.jsx');
  process.exit(1);
}
let s = fs.readFileSync(file, 'utf8');
let changed = 0;

// 1) Ensure useState import exists
if (!/from\s+['"]react['"]/.test(s)) {
  s = `import { useState } from "react";\n` + s;
  changed++;
} else if (!/useState/.test(s)) {
  s = s.replace(
    /import\s+React\s+from\s+['"]react['"];?/,
    m => `import React, { useState } from "react";`
  );
  if (!/useState/.test(s)) {
    s = s.replace(
      /import\s+\{\s*([^}]*)\s*\}\s+from\s+['"]react['"];?/,
      (m, g) => {
        const list = g.split(',').map(v => v.trim()).filter(Boolean);
        if (!list.includes('useState')) list.push('useState');
        return `import { ${list.join(', ')} } from "react";`;
      }
    );
  }
}

// 2) Import HistoryModal once
if (!/import\s+HistoryModal\s+from\s+["']\.\.\/components\/HistoryModal["']/.test(s)) {
  s = `import HistoryModal from "../components/HistoryModal";\n` + s;
  changed++;
}

// 3) Inject state and opener if missing
if (!/const\s*\[\s*historyOpen\s*,\s*setHistoryOpen\s*\]/.test(s)) {
  const inject =
`  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState({ projectCode: null, partNumber: null });
  const openHistory = part => {
    try {
      const code = (project && (project.code || project.projectCode)) ||
                   (selectedProject && (selectedProject.code || selectedProject.projectCode)) ||
                   "P001";
      const pn = (part && (part.partNumber || part.number || part.code || part.id)) || "";
      if (!pn) return;
      setHistoryTarget({ projectCode: code, partNumber: pn });
      setHistoryOpen(true);
      if (import.meta && import.meta.env && import.meta.env.DEV) { window._openHistory = openHistory; }
    } catch (err) { /* no-op */ }
  };
`;
  let done = false;
  const anchors = [
    /export\s+default\s+function[^{]+\{/,
    /function\s+Project[^{]+\{/,
    /const\s+Project\s*=\s*\([^\)]*\)\s*=>\s*\{/
  ];
  for (const rx of anchors) {
    const m = s.match(rx);
    if (m) {
      s = s.replace(rx, m[0] + '\n' + inject);
      done = true;
      break;
    }
  }
  if (!done) {
    s = inject + s;
  }
  changed++;
}

// 4) Mount modal near component end if not already there
if (!/<HistoryModal\s/is.test(s)) {
  const mount =
`  <HistoryModal
    isOpen={historyOpen}
    onClose={() => setHistoryOpen(false)}
    projectCode={historyTarget.projectCode}
    partNumber={historyTarget.partNumber}
  />`;
  const endRx = /\)\s*;\s*\n\s*\}\s*$/s;
  if (endRx.test(s)) {
    s = s.replace(endRx, mount + '\n);\n}\n');
  } else {
    // Fallback: append safely
    s = s + '\n' + mount + '\n';
  }
  changed++;
}

// 5) Wire onClick for any History button candidates
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

// 6) Save if changed
if (changed || wired) {
  fs.writeFileSync(file, s);
}
console.log(
  JSON.stringify({ changedBlocks: changed, wiredButtons: wired, file }, null, 2)
);
