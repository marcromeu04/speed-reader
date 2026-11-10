// Persistencia ligera en localStorage: biblioteca de documentos y ajustes.

const LIB_KEY = 'sr.library.v1';
const SET_KEY = 'sr.settings.v2';

export const DEFAULT_SETTINGS = {
  wpm: 350,
  chunkSize: 1,
  fontSize: 120,
  theme: 'dark',
  showSheet: true,
  showContext: true,
  pausePunctuation: true,
  slowLongWords: true,
  rewindOnPause: true,
  font: 'mono',
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* ignora cuota llena */
  }
}

export const loadSettings = () => ({ ...DEFAULT_SETTINGS, ...read(SET_KEY, {}) });
export const saveSettings = (s) => write(SET_KEY, s);

export const loadLibrary = () => read(LIB_KEY, []);
export const saveLibrary = (docs) => write(LIB_KEY, docs);

export function makeId() {
  return 'd' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}
