/**
 * 生成思源插件的占位图标（icon.png / preview.png）
 *
 * 说明：这是一个零依赖的 PNG 生成脚本，用 Node 内置 zlib 手工构造 PNG 字节流。
 * 正式的图标素材应由设计提供，这里只保证构建链有可用资源、插件在集市里不显示破图。
 *
 * 用法：node scripts/gen-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, pixelFn) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const raw = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // filter type: none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y);
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
      raw[offset++] = a;
    }
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** 圆角矩形裁剪：在圆角外返回透明 */
function roundedAlpha(x, y, width, height, radius) {
  const rx = x < radius ? radius - x : x > width - 1 - radius ? x - (width - 1 - radius) : 0;
  const ry = y < radius ? radius - y : y > height - 1 - radius ? y - (height - 1 - radius) : 0;
  if (rx === 0 || ry === 0) return 255;
  const d = Math.hypot(rx, ry);
  if (d <= radius) return 255;
  if (d >= radius + 1) return 0;
  return Math.round((1 - (d - radius)) * 255);
}

const SIYUAN_BLUE = [53, 117, 240];

function iconPixel(size) {
  const cx = size / 2;
  const cy = size / 2;
  return (x, y) => {
    const alpha = roundedAlpha(x, y, size, size, Math.round(size * 0.22));
    if (alpha === 0) return [0, 0, 0, 0];

    const d = Math.hypot(x - cx, y - cy);
    let color = SIYUAN_BLUE;

    // 白色圆环 + 中心圆点，构成一个简洁的 "AI" 意象
    const outer = size * 0.3;
    const inner = size * 0.2;
    if (d <= outer && d >= inner) color = [255, 255, 255];
    if (d <= size * 0.075) color = [255, 255, 255];

    return [color[0], color[1], color[2], alpha];
  };
}

function previewPixel(width, height) {
  const cardX = Math.round(width * 0.12);
  const cardY = Math.round(height * 0.14);
  const cardW = Math.round(width * 0.76);
  const cardH = Math.round(height * 0.72);
  const lines = [0.24, 0.36, 0.48, 0.6, 0.72].map((p) => Math.round(cardY + cardH * p));

  return (x, y) => {
    // 卡片外：浅灰背景
    if (x < cardX || x > cardX + cardW || y < cardY || y > cardY + cardH) {
      return [245, 246, 248, 255];
    }

    // 卡片内：白色
    const inCard = [
      roundedAlpha(x - cardX, y - cardY, cardW, cardH, 18),
      x - cardX,
      y - cardY,
    ];
    const cardAlpha = inCard[0];

    // 卡片顶部的一条蓝色标题条
    if (y - cardY < 64) {
      return [SIYUAN_BLUE[0], SIYUAN_BLUE[1], SIYUAN_BLUE[2], cardAlpha];
    }

    // 模拟文字行
    for (let i = 0; i < lines.length; i++) {
      const lineY = lines[i];
      if (y >= lineY && y < lineY + 14) {
        const lineW = i % 2 === 0 ? cardW * 0.62 : cardW * 0.44;
        if (x - cardX >= 48 && x - cardX < 48 + lineW) {
          return [200, 205, 214, cardAlpha];
        }
      }
    }

    return [255, 255, 255, cardAlpha];
  };
}

const targets = [
  { file: 'siyuan-plugin/public/icon.png', width: 160, height: 160, make: iconPixel },
  { file: 'siyuan-plugin/public/preview.png', width: 1024, height: 768, make: previewPixel },
];

for (const { file, width, height, make } of targets) {
  const outPath = resolve(root, file);
  mkdirSync(dirname(outPath), { recursive: true });
  const buffer = encodePng(width, height, make(width, height));
  writeFileSync(outPath, buffer);
  console.log(`${file}  ${width}x${height}  ${buffer.length} bytes`);
}
