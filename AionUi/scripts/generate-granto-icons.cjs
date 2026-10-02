/* Regenerate app icons from the selected third 造物坊 F mark. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="1024" height="1024">
  <rect x="1" y="1" width="98" height="98" rx="21" fill="#ffffff" stroke="#e2e6ec" stroke-width="2"/>
  <path d="M28 16 H76 V30 H42 V42 H62 V56 H42 V84 H34 L28 78 Z" fill="#1E293B"/>
  <rect x="66" y="42" width="10" height="14" fill="#2563EB"/>
</svg>`;
const iconset = path.join(root, 'resources/Granto.iconset');
fs.mkdirSync(iconset, { recursive: true });
fs.writeFileSync(path.join(root, 'public/pwa/granto.svg'), svg);

async function main() {
  for (const [filename, size] of [
    ['public/pwa/icon-180.png', 180],
    ['public/pwa/icon-192.png', 192],
    ['public/pwa/icon-512.png', 512],
    ['resources/app.png', 512],
    ['resources/app_dev.png', 512],
    ['resources/icon.png', 512],
    ['mobile/assets/images/icon.png', 512],
    ['packages/desktop/src/renderer/assets/logos/brand/app.png', 512],
  ]) {
    await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(root, filename));
  }
  const pngs = new Map();
  for (const size of [16, 32, 48, 64, 128, 256, 512, 1024]) {
    pngs.set(size, await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer());
  }
  for (const [name, size] of [
    ['icon_16x16.png', 16],
    ['icon_16x16@2x.png', 32],
    ['icon_32x32.png', 32],
    ['icon_32x32@2x.png', 64],
    ['icon_128x128.png', 128],
    ['icon_128x128@2x.png', 256],
    ['icon_256x256.png', 256],
    ['icon_256x256@2x.png', 512],
    ['icon_512x512.png', 512],
    ['icon_512x512@2x.png', 1024],
  ])
    fs.writeFileSync(path.join(iconset, name), pngs.get(size));
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', path.join(root, 'resources/app.icns')]);

  const sizes = [16, 32, 48, 256];
  const head = Buffer.alloc(6 + sizes.length * 16);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(sizes.length, 4);
  let offset = head.length;
  for (const [index, size] of sizes.entries()) {
    const png = pngs.get(size);
    const at = 6 + index * 16;
    head.writeUInt8(size === 256 ? 0 : size, at);
    head.writeUInt8(size === 256 ? 0 : size, at + 1);
    head.writeUInt16LE(1, at + 4);
    head.writeUInt16LE(32, at + 6);
    head.writeUInt32LE(png.length, at + 8);
    head.writeUInt32LE(offset, at + 12);
    offset += png.length;
  }
  fs.writeFileSync(path.join(root, 'resources/app.ico'), Buffer.concat([head, ...sizes.map((size) => pngs.get(size))]));
  console.log('Generated 造物坊 desktop, web, and mobile icons.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
