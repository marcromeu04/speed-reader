// Lógica del lector RSVP: tokenización, pausas inteligentes y cálculo del
// punto de reconocimiento óptimo (ORP), la letra que se pinta en rojo y se
// alinea en el centro.

const DEFAULTS = {
  chunkSize: 1,
  pausePunctuation: true,
  slowLongWords: true,
};

// Divide el texto en "tokens" de lectura. Cada token lleva la(s) palabra(s),
// un factor de retardo extra y el índice de párrafo al que pertenece (para
// pintar marcas en la barra de progreso).
export function tokenize(text, opts = {}) {
  const { chunkSize, pausePunctuation, slowLongWords } = { ...DEFAULTS, ...opts };
  if (!text) return [];

  const paragraphs = text.replace(/\r\n?/g, '\n').split(/\n{2,}/);
  const tokens = [];

  paragraphs.forEach((para, pIdx) => {
    const words = para.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    for (let i = 0; i < words.length; i += chunkSize) {
      const group = words.slice(i, i + chunkSize);
      const word = group.join(' ');
      const last = group[group.length - 1];

      let delay = 1;
      if (pausePunctuation) {
        if (/[.!?…]["»”)]?$/.test(last)) delay = 2.4;   // fin de frase
        else if (/[,:;)»”]$/.test(last)) delay = 1.6;    // pausa media
        else if (/[—–]$/.test(last)) delay = 1.4;
      }
      if (slowLongWords && word.length > 8) delay += 0.25;

      const firstOfPara = i === 0;
      tokens.push({ word, delay, para: pIdx, firstOfPara });
    }
  });

  return tokens;
}

// Punto de reconocimiento óptimo según la longitud de la palabra.
export function orpIndex(word) {
  const len = word.replace(/[^\p{L}\p{N}]/gu, '').length || word.length;
  if (len <= 1) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  if (len <= 13) return 3;
  return 4;
}

// Descompone una palabra en {left, pivot, right} para centrarla por el pivote.
export function splitWord(word) {
  if (!word) return { left: '', pivot: '', right: '' };
  const i = Math.min(orpIndex(word), Math.max(0, word.length - 1));
  return {
    left: word.slice(0, i),
    pivot: word.slice(i, i + 1),
    right: word.slice(i + 1),
  };
}

// Devuelve una ventana de contexto alrededor del índice actual.
export function contextWindow(tokens, index, radius = 7) {
  const before = [];
  const after = [];
  for (let k = Math.max(0, index - radius); k < index; k++) before.push(tokens[k]?.word);
  for (let k = index + 1; k <= Math.min(tokens.length - 1, index + radius); k++) after.push(tokens[k]?.word);
  return { before: before.filter(Boolean), after: after.filter(Boolean) };
}
