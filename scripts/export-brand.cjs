// Render repository-native SVG paths as transparent PNGs without changing the artwork.
// Requires sharp: npm install --no-save --prefix /tmp/chantier-brand sharp
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const assets = path.join(__dirname, '../web/assets');
(async () => {
  for (const name of ['chantier-logo', 'chantier-logo-light', 'chantier-mark']) {
    const source = fs.readFileSync(path.join(assets, name + '.svg'));
    const image = sharp(source, { density: 192 });
    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let transparent = 0;
    for (let i = 3; i < data.length; i += info.channels) if (data[i] === 0) transparent++;
    if (!transparent || data[3] !== 0) throw Error('Transparent canvas required: ' + name);
    await sharp(source, { density: 192 }).png().toFile(path.join(assets, name + '.png'));
    console.log(`${name}.png: ${info.width}×${info.height}, alpha verified`);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
