import fs from 'fs';
import zlib from 'zlib';

function createPNG(width, height, r, g, b) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor (RGB)
  ihdr[10] = 0; // compression method
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace method

  function createChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(12 + len);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4);
    data.copy(buf, 8);

    // CRC32
    let c = 0xffffffff;
    const table = [];
    for (let n = 0; n < 256; n++) {
      let v = n;
      for (let k = 0; k < 8; k++) {
        v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
      }
      table[n] = v;
    }
    for (let i = 4; i < 8 + len; i++) {
      c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    buf.writeInt32BE((c ^ 0xffffffff) | 0, 8 + len);
    return buf;
  }

  const ihdrChunk = createChunk('IHDR', ihdr);

  // Raw image data: filter byte (0) + width * 3 bytes per row
  const rawData = Buffer.alloc(height * (1 + width * 3));
  let offset = 0;
  const cx = width / 2;
  const cy = height / 2;
  const maxR = width * 0.38;

  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // None filter
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Draw a circular speaker badge inside indigo backdrop
      if (dist < maxR && (dist < maxR * 0.25 || (dist > maxR * 0.45 && dist < maxR * 0.6) || (dist > maxR * 0.8 && dist < maxR * 0.95))) {
        rawData[offset++] = 255;
        rawData[offset++] = 255;
        rawData[offset++] = 255;
      } else {
        rawData[offset++] = r;
        rawData[offset++] = g;
        rawData[offset++] = b;
      }
    }
  }

  const idatData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', idatData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Generate 192x192, 512x512, apple-touch-icon (180x180)
const png192 = createPNG(192, 192, 79, 70, 229); // #4f46e5 indigo
const png512 = createPNG(512, 512, 79, 70, 229);
const png180 = createPNG(180, 180, 79, 70, 229);

fs.writeFileSync('public/pwa-192x192.png', png192);
fs.writeFileSync('public/pwa-512x512.png', png512);
fs.writeFileSync('public/pwa-maskable-512x512.png', png512);
fs.writeFileSync('public/apple-touch-icon.png', png180);
console.log('Icons generated successfully in public/');
