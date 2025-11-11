const fs = require('fs');
const f = 'src/pages/Project.jsx';
let s = fs.readFileSync(f,'utf8');
// Replace the literal "\n" text that was mistakenly inserted after return (
s = s.replace(/return\s*\(\\n\s*<>\s*\\n/, 'return (\n  <>\n');
fs.writeFileSync(f,s);
console.log('fixed fragment opener');
