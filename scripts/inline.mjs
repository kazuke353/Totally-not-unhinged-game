// Inline the built JS + CSS into a single self-contained HTML file.
import fs from 'fs';
import path from 'path';

const dist = path.resolve('dist');
const out = path.resolve('dist-single');
let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
html = html.replace(/<script type="module" crossorigin src="\.\/([^"]+)"><\/script>/g, (m, src) => {
  const js = fs.readFileSync(path.join(dist, src), 'utf8').replace(/<\/script>/g, '<\\/script>');
  return `<script type="module">${js}</script>`;
});
html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/([^"]+)">/g, (m, href) => {
  const css = fs.readFileSync(path.join(dist, href), 'utf8');
  return `<style>${css}</style>`;
});
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('wrote', path.join(out, 'index.html'), (html.length / 1024).toFixed(0) + ' KB');
