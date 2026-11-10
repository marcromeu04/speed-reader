// Servidor Node/Express para el lector RSVP.
// - /api/parse : recibe texto crudo (.txt o .md) y devuelve texto limpio.
//   Si es markdown, elimina los caracteres de sintaxis dejando solo la prosa.
// - En producción sirve el build de Vite (client/dist).

const path = require('path');
const fs = require('fs');
const express = require('express');

let pdfParse = null;
try { pdfParse = require('pdf-parse'); } catch { /* opcional */ }

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.text({ type: ['text/*', 'text/markdown'], limit: '20mb' }));
app.use(express.raw({ type: 'application/pdf', limit: '50mb' }));

const PORT = process.env.PORT || 8099;

/**
 * Convierte markdown en texto plano legible, quitando los símbolos de sintaxis
 * pero conservando el contenido (títulos, listas, énfasis, enlaces, etc.).
 */
function stripMarkdown(md) {
  let t = md;

  // Normaliza saltos de línea.
  t = t.replace(/\r\n?/g, '\n');

  // Bloques de código cercados ```...``` -> contenido sin las comillas.
  t = t.replace(/```[^\n]*\n([\s\S]*?)```/g, (_, code) => code);

  // Front-matter YAML al inicio (--- ... ---).
  t = t.replace(/^---\n[\s\S]*?\n---\n/, '');

  // Imágenes ![alt](url) -> alt.
  t = t.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');

  // Enlaces [texto](url) -> texto.
  t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

  // Enlaces de referencia [texto][ref] -> texto.
  t = t.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1');

  // Líneas de definición de referencia [ref]: url
  t = t.replace(/^\s*\[[^\]]+\]:\s+\S+.*$/gm, '');

  // Encabezados #, ## ... al principio de línea.
  t = t.replace(/^\s{0,3}#{1,6}\s+/gm, '');

  // Citas >.
  t = t.replace(/^\s{0,3}>\s?/gm, '');

  // Reglas horizontales --- *** ___
  t = t.replace(/^\s{0,3}([-*_])\s*(?:\1\s*){2,}$/gm, '');

  // Viñetas de lista -, *, + al principio de línea.
  t = t.replace(/^\s{0,3}[-*+]\s+/gm, '');

  // Listas numeradas 1. 2. ...
  t = t.replace(/^\s{0,3}\d+\.\s+/gm, '');

  // Tablas: quita las barras verticales y las filas separadoras.
  t = t.replace(/^\s*\|?[\s:|-]+\|?\s*$/gm, (line) =>
    /[-:]/.test(line) && !/[a-zA-Z0-9]/.test(line) ? '' : line
  );
  t = t.replace(/\|/g, ' ');

  // Negrita/cursiva **x** *x* __x__ _x_
  t = t.replace(/(\*\*|__)(.*?)\1/g, '$2');
  t = t.replace(/(\*|_)(.*?)\1/g, '$2');

  // Tachado ~~x~~
  t = t.replace(/~~(.*?)~~/g, '$1');

  // Código en línea `x`
  t = t.replace(/`([^`]+)`/g, '$1');

  // HTML inline simple.
  t = t.replace(/<\/?[a-zA-Z][^>]*>/g, '');

  // Colapsa espacios y líneas en blanco de más.
  t = t.replace(/[ \t]+/g, ' ');
  t = t.replace(/\n{3,}/g, '\n\n');

  return t.trim();
}

app.post('/api/parse', (req, res) => {
  const body = typeof req.body === 'string' ? { text: req.body } : req.body || {};
  const raw = body.text || '';
  const isMarkdown =
    body.markdown === true ||
    (typeof body.name === 'string' && /\.(md|markdown)$/i.test(body.name));
  const text = isMarkdown ? stripMarkdown(raw) : raw.replace(/\r\n?/g, '\n').trim();
  res.json({ text, markdown: isMarkdown, chars: text.length });
});

// Extrae el texto de un PDF (cuerpo binario application/pdf).
app.post('/api/parse-pdf', async (req, res) => {
  if (!pdfParse) return res.status(501).json({ error: 'pdf-parse no instalado' });
  try {
    const data = await pdfParse(req.body);
    let text = (data.text || '').replace(/\r\n?/g, '\n');
    // Une líneas partidas por guion al final y colapsa saltos sueltos dentro de párrafos.
    text = text.replace(/(\p{L})-\n(\p{L})/gu, '$1$2');
    text = text.replace(/([^\n])\n(?!\n)/g, '$1 ');
    text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    res.json({ text, pages: data.numpages, chars: text.length });
  } catch (e) {
    res.status(422).json({ error: 'No se pudo leer el PDF' });
  }
});

// En producción servimos el build del cliente.
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`[speed-reader] API escuchando en http://localhost:${PORT}`);
});
