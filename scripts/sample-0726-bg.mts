import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { decodeImage } from './line-sticker/nodeImage.mts';

for (const set of ['花花：貓貓旅行', '花花：購物失控', '花花：我是可愛打工貓']) {
  const dir = join('inbox/0726', set);
  const files = readdirSync(dir).filter((x) => x.endsWith('.png'));
  for (const f of files) {
    const img = decodeImage(new Uint8Array(readFileSync(join(dir, f))));
    const samples: Array<[number, number]> = [
      [5, 5],
      [img.width - 5, 5],
      [5, img.height - 5],
      [Math.floor(img.width / 2), 5],
      [5, Math.floor(img.height / 2)],
      [Math.floor(img.width / 2), Math.floor(img.height / 2)],
    ];
    console.log(set, f, img.width + 'x' + img.height);
    for (const [x, y] of samples) {
      const i = (y * img.width + x) * 4;
      console.log(
        `  (${x},${y}) rgb=${img.data[i]},${img.data[i + 1]},${img.data[i + 2]} a=${img.data[i + 3]}`
      );
    }
  }
}
