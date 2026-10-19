/**
 * One-off generator for examples/sample-export (tiny bounce square).
 * Run: node scripts/generate-sample-export.mjs
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'examples/sample-export');

const frameW = 32;
const frameH = 32;
const frameCount = 4;
const cols = 4;
const rows = 1;
const fps = 8;
const durationMs = Math.round(1000 / fps);
const sheetW = frameW * cols;
const sheetH = frameH * rows;

const colors = [
  { r: 56, g: 189, b: 248 },
  { r: 52, g: 211, b: 153 },
  { r: 251, g: 191, b: 36 },
  { r: 244, g: 114, b: 182 },
];

fs.mkdirSync(path.join(out, 'frames'), { recursive: true });

const frameBuffers = [];
for (let i = 0; i < frameCount; i += 1) {
  const bounce = Math.round(Math.sin((i / (frameCount - 1)) * Math.PI) * 8);
  const size = 14;
  const x = Math.floor((frameW - size) / 2);
  const y = Math.floor((frameH - size) / 2) - bounce + 4;
  const svg = Buffer.from(`
    <svg width="${frameW}" height="${frameH}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="transparent"/>
      <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="3"
        fill="rgb(${colors[i].r},${colors[i].g},${colors[i].b})"
        stroke="#0f172a" stroke-width="2"/>
    </svg>`);
  const png = await sharp(svg).png().toBuffer();
  frameBuffers.push(png);
  const name = `frame_${String(i + 1).padStart(3, '0')}.png`;
  fs.writeFileSync(path.join(out, 'frames', name), png);
}

const composites = frameBuffers.map((input, i) => ({
  input,
  left: i * frameW,
  top: 0,
}));

await sharp({
  create: {
    width: sheetW,
    height: sheetH,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(composites)
  .png()
  .toFile(path.join(out, 'sprite-sheet.png'));

const aseprite = {
  frames: frameBuffers.map((_, i) => ({
    filename: String(i),
    frame: { x: i * frameW, y: 0, w: frameW, h: frameH },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: frameW, h: frameH },
    sourceSize: { w: frameW, h: frameH },
    duration: durationMs,
  })),
  meta: {
    app: 'https://github.com/poirotw66/Sprite-Animator',
    version: '1.2.0',
    image: 'sprite-sheet.png',
    format: 'RGBA8888',
    size: { w: sheetW, h: sheetH },
    scale: '1',
    frameTags: [
      { name: 'default', from: 0, to: frameCount - 1, direction: 'forward' },
    ],
  },
};
fs.writeFileSync(
  path.join(out, 'sprite-sheet.json'),
  `${JSON.stringify(aseprite, null, 2)}\n`,
);

const manifest = {
  schemaVersion: 1,
  generator: 'Sprite Animator',
  cols,
  rows,
  frameWidth: frameW,
  frameHeight: frameH,
  frameCount,
  fps,
  durationMs,
  loop: true,
  sheet: { fileName: 'sprite-sheet.png', width: sheetW, height: sheetH },
  aseprite: { fileName: 'sprite-sheet.json', format: 'json-array' },
  framesDirectory: 'frames',
  godot: { spriteFramesFileName: 'animation.tres' },
};
fs.writeFileSync(
  path.join(out, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

const loadSteps = frameCount + 1;
let tres = `[gd_resource type="SpriteFrames" load_steps=${loadSteps} format=3]\n\n`;
for (let i = 0; i < frameCount; i += 1) {
  const id = i + 1;
  const name = `frame_${String(i + 1).padStart(3, '0')}.png`;
  tres += `[ext_resource type="Texture2D" path="res://frames/${name}" id="${id}"]\n`;
}
tres += '\n[resource]\n';
const entries = Array.from({ length: frameCount }, (_, i) => {
  const id = i + 1;
  return `{\n"duration": 1.0,\n"texture": ExtResource("${id}")\n}`;
}).join(', ');
tres += `animations = [{\n"frames": [${entries}],\n"loop": true,\n"name": &"default",\n"speed": ${fps.toFixed(1)}\n}]\n`;
fs.writeFileSync(path.join(out, 'animation.tres'), tres);

console.log('Wrote sample to', out);
