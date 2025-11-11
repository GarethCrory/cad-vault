const fs = require('fs');
const f = 'src/pages/Project.jsx';
if (!fs.existsSync(f)) process.exit(1);
let s = fs.readFileSync(f,'utf8');

const openIdx = s.indexOf('return (');
if (openIdx === -1) process.exit(0);

// insert <> after first return (
const afterOpen = s.slice(openIdx, openIdx + 40);
if (!afterOpen.includes('<>')) {
  s = s.slice(0, openIdx) + 'return (\\n  <>\\n' + s.slice(openIdx + 'return ('.length);
}

// insert </> before the final ');
const closePattern = /;\s*\n\s*\}\s*$/s;
const m = s.match(closePattern);
if (m) {
  const endPos = m.index;
  const before = s.slice(0, endPos);
  const after = s.slice(endPos);
  if (!before.trimEnd().endsWith('</>')) {
    s = before.replace(/\)\s*$/s, '  </>)') + after;
  }
}

fs.writeFileSync(f, s);
console.log('wrapped');
