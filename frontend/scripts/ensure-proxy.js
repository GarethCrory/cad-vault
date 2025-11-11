const fs = require('fs');
const path = 'vite.config.js';
const tmpl = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true }
    }
  }
});
`;
if (!fs.existsSync(path)) {
  fs.writeFileSync(path, tmpl);
  console.log("created vite.config.js with proxy");
  process.exit(0);
}
let s = fs.readFileSync(path, 'utf8');
if (s.includes('"/api"')) {
  console.log("proxy already present");
  process.exit(0);
}
s = s.replace(/plugins:\s*\[react\(\)\]/, 'plugins: [react()],\n  server: { proxy: { "/api": { target: "http://localhost:4000", changeOrigin: true } } }');
if (!s.includes('"/api"')) s = tmpl;
fs.writeFileSync(path, s);
console.log("proxy ensured");
