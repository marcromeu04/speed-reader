// Genera un PDF de ejemplo en client/public/ejemplo.pdf
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const out = path.join(__dirname, '..', 'client', 'public', 'ejemplo.pdf');
fs.mkdirSync(path.dirname(out), { recursive: true });

const doc = new PDFDocument({ margin: 64, size: 'A4' });
doc.pipe(fs.createWriteStream(out));

doc.fontSize(24).font('Helvetica-Bold').text('El arte de leer rápido', { align: 'left' });
doc.moveDown(0.5);
doc.fontSize(11).font('Helvetica-Oblique').fillColor('#555')
  .text('Un documento de ejemplo para probar el lector RSVP con archivos PDF.');
doc.moveDown(1).fillColor('#000');

const paras = [
  'La lectura rápida no consiste en saltarse palabras, sino en entrenar al ojo y al cerebro para procesar el texto con menos esfuerzo. La mayoría de las personas lee en voz interior, un hábito llamado subvocalización que limita la velocidad a la de nuestra habla.',
  'El método RSVP, siglas en inglés de presentación visual serial rápida, muestra las palabras una tras otra en un punto fijo. Al no mover los ojos, se eliminan las sacadas y las regresiones involuntarias, dos de los mayores ladrones de tiempo durante la lectura tradicional.',
  'Cada palabra tiene un punto óptimo de reconocimiento, situado ligeramente a la izquierda de su centro. Si alineamos siempre ese punto y lo resaltamos en rojo, el cerebro identifica la palabra con más rapidez y la mirada permanece relajada y quieta.',
  'La práctica es clave. Conviene empezar a una velocidad cómoda, alrededor de trescientas palabras por minuto, e ir subiendo poco a poco. Con el tiempo, muchos lectores alcanzan quinientas o seiscientas palabras por minuto sin perder una comprensión razonable del contenido.',
  'Recuerda descansar la vista, hidratarte y alternar la lectura rápida con la lectura profunda. No todos los textos piden la misma velocidad: una novela se saborea, pero un informe o un correo se despacha. La habilidad consiste en elegir el ritmo adecuado para cada ocasión.',
];

doc.fontSize(13).font('Helvetica');
paras.forEach((p) => { doc.text(p, { align: 'justify', lineGap: 4 }); doc.moveDown(0.8); });

doc.end();
console.log('PDF generado en', out);
