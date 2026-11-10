// Genera un PDF de ejemplo (con una imagen embebida) en client/public/ejemplo.pdf
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const PDFDocument = require('pdfkit');

// ---- generador mínimo de PNG (RGBA) sin dependencias ----
const crcTable = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function makePng(width, height, fn) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  let p = 0;
  for (let y = 0; y < height; y++) {
    raw[p++] = 0; // filtro "none"
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = fn(x, y);
      raw[p++] = r; raw[p++] = g; raw[p++] = b; raw[p++] = a;
    }
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 bits, RGBA
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// Imagen: gradiente diagonal azul→rojo con un brillo radial y un "pico" de ritmo.
const W = 720, H = 360;
const png = makePng(W, H, (x, y) => {
  const tx = x / W, ty = y / H;
  const d = (tx + ty) / 2;                       // diagonal
  let r = Math.round(40 + d * 215);
  let g = Math.round(90 + (1 - d) * 60);
  let b = Math.round(255 - d * 190);
  // brillo radial
  const dx = x - W * 0.3, dy = y - H * 0.35;
  const dist = Math.sqrt(dx * dx + dy * dy) / (W * 0.5);
  const glow = Math.max(0, 1 - dist) * 60;
  r = Math.min(255, r + glow); g = Math.min(255, g + glow); b = Math.min(255, b + glow);
  // onda tipo "lectura/ritmo" en blanco
  const wave = H * 0.5 + Math.sin(tx * Math.PI * 4) * H * 0.18;
  if (Math.abs(y - wave) < 3) { r = 255; g = 255; b = 255; }
  return [r | 0, g | 0, b | 0, 255];
});

const out = path.join(__dirname, '..', 'client', 'public', 'ejemplo.pdf');
fs.mkdirSync(path.dirname(out), { recursive: true });

const doc = new PDFDocument({ margin: 64, size: 'A4' });
doc.pipe(fs.createWriteStream(out));

doc.fontSize(24).font('Helvetica-Bold').text('El arte de leer rápido');
doc.moveDown(0.4);
doc.fontSize(11).font('Helvetica-Oblique').fillColor('#555')
  .text('Documento de ejemplo con una imagen embebida para probar el lector RSVP.');
doc.moveDown(0.8).fillColor('#000');

// imagen embebida (raster PNG real -> extraíble con pdfimages)
doc.image(png, { fit: [466, 220], align: 'center' });
doc.moveDown(0.4);
doc.fontSize(9).fillColor('#888').text('Figura 1. Gradiente generado como imagen de muestra.', { align: 'center' });
doc.moveDown(1).fillColor('#000');

const paras = [
  'La lectura rápida no consiste en saltarse palabras, sino en entrenar al ojo y al cerebro para procesar el texto con menos esfuerzo. La mayoría de las personas lee en voz interior, un hábito llamado subvocalización que limita la velocidad a la de nuestra habla.',
  'El método RSVP, siglas en inglés de presentación visual serial rápida, muestra las palabras una tras otra en un punto fijo. Al no mover los ojos, se eliminan las sacadas y las regresiones involuntarias, dos de los mayores ladrones de tiempo durante la lectura tradicional.',
  'Cada palabra tiene un punto óptimo de reconocimiento, situado ligeramente a la izquierda de su centro. Si alineamos siempre ese punto y lo resaltamos en rojo, el cerebro identifica la palabra con más rapidez y la mirada permanece relajada y quieta.',
  'La práctica es clave. Conviene empezar a una velocidad cómoda, alrededor de trescientas palabras por minuto, e ir subiendo poco a poco. Con el tiempo, muchos lectores alcanzan quinientas o seiscientas palabras por minuto sin perder una comprensión razonable.',
];

doc.fontSize(13).font('Helvetica');
paras.forEach((p) => { doc.text(p, { align: 'justify', lineGap: 4 }); doc.moveDown(0.8); });

doc.end();
console.log('PDF con imagen generado en', out);
