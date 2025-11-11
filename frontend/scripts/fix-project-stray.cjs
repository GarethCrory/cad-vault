const fs = require('fs');
const f = 'src/pages/Project.jsx';
let s = fs.readFileSync(f, 'utf8');

function replaceCount(str, re, repl) {
  let c = 0;
  const out = str.replace(re, () => { c++; return repl; });
  return [out, c];
}

// 1) Remove stray lines like `){` injected after function blocks
[s, c1] = replaceCount(s, /\n\)\s*\{\s*\n/g, '\n');

// 2) Repair any literal "\n" sequences accidentally inserted near fragments
[s, c2] = replaceCount(s, /return\s*\(\s*\\n\s*<>\s*\\n/g, 'return (\n  <>\n');
[s, c3] = replaceCount(s, /<\/>\)\s*\\n/g, '</>)\n');

// 3) Ensure imports include useState/useEffect (non-destructive)
if (/from\s+['"]react['"]/.test(s) && !/useState/.test(s)) {
  s = s.replace(/import\s+React\s+from\s+['"]react['"];?/,
                 'import React, { useState, useEffect } from "react";');
  if (!/useState/.test(s)) {
    s = s.replace(/import\s+\{\s*([^}]*)\s*\}\s+from\s+['"]react['"];?/,
      (m, g) => {
        const list = g.split(',').map(v => v.trim()).filter(Boolean);
        if (!list.includes('useState')) list.push('useState');
        if (!list.includes('useEffect')) list.push('useEffect');
        return `import { ${list.join(', ')} } from "react";`;
      }
    );
  }
}

// 4) Final tidy: collapse any repeated blank lines left behind
[s, c4] = replaceCount(s, /\n{3,}/g, '\n\n');

fs.writeFileSync(f, s);
console.log(JSON.stringify({ removedParenBrace:c1, fixedFragOpen:c2, fixedFragClose:c3, compacted:c4 }, null, 2));
