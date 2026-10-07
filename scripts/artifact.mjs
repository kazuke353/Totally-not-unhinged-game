// Turn dist-single/index.html into page content for an artifact (no document wrapper).
import fs from 'fs';
const [,, outPath] = process.argv;
const html = fs.readFileSync('dist-single/index.html', 'utf8');
const style = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
const script = (html.match(/<script type="module">([\s\S]*?)<\/script>/) || [])[1] || '';
const page = `<title>HALF-HOP</title>
<style>${style}</style>
<div id="game"></div>
<div id="ui"></div>
<script type="module">${script}</script>
`;
fs.writeFileSync(outPath, page);
console.log('wrote', outPath, (page.length / 1024).toFixed(0) + ' KB');
