// TrainLog ikon üreteci — bağımlılıksız PNG (node:zlib). Koyu zemin + accent
// halter markası. Çalıştır: `node scripts/gen-icons.mjs` (çıktı: public/icons).
// Derleme bağımlılığı DEĞİL; ikonları yeniden üretmek gerektiğinde elle koşulur.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BG = [14, 17, 22, 255]; // #0e1116
const FG = [79, 140, 255, 255]; // #4f8cff

// ---- PNG encode (RGBA, 8-bit) ----
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const tb = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
  return Buffer.concat([len, tb, data, crcBuf]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---- basit raster ----
function makeIcon(S) {
  const buf = Buffer.alloc(S * S * 4);
  const put = (x, y, c) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    buf[i] = c[0];
    buf[i + 1] = c[1];
    buf[i + 2] = c[2];
    buf[i + 3] = c[3];
  };
  // zemin
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) put(x, y, BG);
  // yuvarlatılmış dikdörtgen dolgu
  const rrect = (fx0, fy0, fx1, fy1, fr, c) => {
    const x0 = fx0 * S, y0 = fy0 * S, x1 = fx1 * S, y1 = fy1 * S, r = fr * S;
    for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
      for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
        const dx = x < x0 + r ? x0 + r - x : x > x1 - r ? x - (x1 - r) : 0;
        const dy = y < y0 + r ? y0 + r - y : y > y1 - r ? y - (y1 - r) : 0;
        if (dx * dx + dy * dy <= r * r) put(x, y, c);
      }
    }
  };
  // halter: sap + iç plakalar + dış plakalar (merkez %80 güvenli bölgede)
  rrect(0.28, 0.475, 0.72, 0.525, 0.02, FG); // sap
  rrect(0.3, 0.38, 0.36, 0.62, 0.02, FG); // sol iç plaka
  rrect(0.64, 0.38, 0.7, 0.62, 0.02, FG); // sağ iç plaka
  rrect(0.24, 0.42, 0.3, 0.58, 0.02, FG); // sol dış plaka
  rrect(0.7, 0.42, 0.76, 0.58, 0.02, FG); // sağ dış plaka
  return encodePNG(S, S, buf);
}

const outDir = process.argv[2] ?? fileURLToPath(new URL('../public/icons', import.meta.url));
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/icon-512.png`, makeIcon(512));
writeFileSync(`${outDir}/icon-192.png`, makeIcon(192));
writeFileSync(`${outDir}/apple-touch-icon-180.png`, makeIcon(180));
console.log('ikonlar yazıldı →', outDir);
