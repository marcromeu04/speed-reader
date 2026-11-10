import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Reticle from './Reticle.jsx';
import Sheet from './Sheet.jsx';
import { tokenize, contextWindow } from './reader.js';
import { SAMPLE_TEXT } from './sample.js';
import {
  DEFAULT_SETTINGS, loadSettings, saveSettings,
  loadLibrary, saveLibrary, makeId,
} from './store.js';

const SAMPLE_DOC = {
  id: 'sample',
  name: 'Bienvenida · ejemplo',
  text: SAMPLE_TEXT,
  pos: 0,
  addedAt: 0,
};

export default function App() {
  // ---- estado persistente ----
  const [settings, setSettings] = useState(loadSettings);
  const [library, setLibrary] = useState(() => {
    const lib = loadLibrary();
    return lib.length ? lib : [SAMPLE_DOC];
  });
  const [activeId, setActiveId] = useState(() => (loadLibrary()[0]?.id) || 'sample');

  // ---- estado de sesión ----
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [focus, setFocus] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [status, setStatus] = useState('');
  const [dragging, setDragging] = useState(false);

  // estadísticas de lectura
  const [elapsed, setElapsed] = useState(0); // ms acumulados reproduciendo
  const startRef = useRef(0);
  const timerRef = useRef(null);

  const set = useCallback((patch) => setSettings((s) => ({ ...s, ...patch })), []);

  const activeDoc = useMemo(
    () => library.find((d) => d.id === activeId) || library[0] || SAMPLE_DOC,
    [library, activeId]
  );
  const text = activeDoc?.text || '';

  const tokens = useMemo(
    () => tokenize(text, {
      chunkSize: settings.chunkSize,
      pausePunctuation: settings.pausePunctuation,
      slowLongWords: settings.slowLongWords,
    }),
    [text, settings.chunkSize, settings.pausePunctuation, settings.slowLongWords]
  );
  const total = tokens.length;
  const atEnd = index >= total;
  const current = tokens[Math.min(index, total - 1)] || { word: '', delay: 1 };
  const context = useMemo(() => contextWindow(tokens, index), [tokens, index]);
  const currentPara = tokens[Math.min(index, total - 1)]?.para ?? 0;

  // Agrupa los tokens por párrafo guardando su índice global (para la hoja).
  const paragraphs = useMemo(() => {
    const groups = [];
    tokens.forEach((t, gi) => {
      if (!groups[t.para]) groups[t.para] = [];
      groups[t.para].push({ word: t.word, gi });
    });
    return groups.filter(Boolean);
  }, [tokens]);

  // ---- persistencia ----
  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => { document.documentElement.dataset.theme = settings.theme; }, [settings.theme]);
  useEffect(() => saveLibrary(library), [library]);

  // guarda la posición en el documento activo (con rebote)
  useEffect(() => {
    const t = setTimeout(() => {
      setLibrary((lib) => lib.map((d) => (d.id === activeId ? { ...d, pos: index } : d)));
    }, 400);
    return () => clearTimeout(t);
  }, [index, activeId]);

  // al cambiar de documento, recupera su posición guardada
  useEffect(() => {
    setPlaying(false);
    setIndex(Math.min(activeDoc?.pos || 0, Math.max(0, total - 1)));
    setElapsed(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // ---- bucle de reproducción ----
  useEffect(() => {
    if (!playing) return;
    if (atEnd) { setPlaying(false); return; }
    const base = 60000 / settings.wpm;
    const ms = base * (current.delay || 1);
    timerRef.current = setTimeout(() => setIndex((i) => i + 1), ms);
    return () => clearTimeout(timerRef.current);
  }, [playing, index, settings.wpm, atEnd, current]);

  // cronómetro de estadísticas
  useEffect(() => {
    if (!playing) return;
    startRef.current = Date.now();
    const id = setInterval(() => {
      setElapsed((e) => e + (Date.now() - startRef.current));
      startRef.current = Date.now();
    }, 500);
    return () => clearInterval(id);
  }, [playing]);

  // ---- controles ----
  const play = useCallback(() => {
    if (atEnd) { setIndex(0); setElapsed(0); }
    else if (settings.rewindOnPause) setIndex((i) => Math.max(0, i - 2)); // retrocede un poco al reanudar
    setPlaying(true);
  }, [atEnd, settings.rewindOnPause]);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => (playing ? pause() : play()), [playing, play, pause]);
  const restart = useCallback(() => { setPlaying(false); setIndex(0); setElapsed(0); }, []);
  const step = useCallback((d) => {
    setPlaying(false);
    setIndex((i) => Math.max(0, Math.min(total - 1, i + d)));
  }, [total]);
  const jumpPara = useCallback((dir) => {
    setPlaying(false);
    setIndex((i) => {
      const curPara = tokens[Math.min(i, total - 1)]?.para ?? 0;
      const targetPara = curPara + dir;
      const t = tokens.findIndex((tok) => tok.para === targetPara && tok.firstOfPara);
      return t >= 0 ? t : Math.max(0, Math.min(total - 1, i + dir * 20));
    });
  }, [tokens, total]);

  // ---- atajos ----
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      switch (e.code) {
        case 'Space': e.preventDefault(); toggle(); break;
        case 'ArrowRight': step(1); break;
        case 'ArrowLeft': step(-1); break;
        case 'ArrowUp': e.preventDefault(); set({ wpm: Math.min(1200, settings.wpm + 25) }); break;
        case 'ArrowDown': e.preventDefault(); set({ wpm: Math.max(100, settings.wpm - 25) }); break;
        case 'KeyF': setFocus((f) => !f); break;
        case 'KeyR': restart(); break;
        case 'Escape': setFocus(false); setShowHelp(false); break;
        case 'Slash': if (e.shiftKey) setShowHelp((h) => !h); break;
        default: break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, step, restart, set, settings.wpm]);

  // ---- carga de archivos (txt / md / pdf) ----
  const ingest = useCallback(async (file) => {
    setStatus('Procesando ' + file.name + '…');
    const isMd = /\.(md|markdown)$/i.test(file.name);
    const isPdf = /\.pdf$/i.test(file.name);
    try {
      let cleaned;
      if (isPdf) {
        const buf = await file.arrayBuffer();
        const res = await fetch('/api/parse-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/pdf' },
          body: buf,
        });
        if (!res.ok) throw new Error('pdf');
        cleaned = (await res.json()).text;
      } else {
        const raw = await file.text();
        const res = await fetch('/api/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: raw, name: file.name, markdown: isMd }),
        });
        cleaned = (await res.json()).text;
      }
      const doc = { id: makeId(), name: file.name, text: cleaned, pos: 0, addedAt: Date.now() };
      setLibrary((lib) => [doc, ...lib.filter((d) => d.id !== 'sample' || lib.length === 1)]);
      setActiveId(doc.id);
      setStatus(`✓ ${file.name} · ${cleaned.length.toLocaleString('es')} caracteres`);
    } catch {
      setStatus('⚠ No se pudo procesar ' + file.name);
    }
  }, []);

  const onFile = (e) => { const f = e.target.files?.[0]; if (f) ingest(f); e.target.value = ''; };

  // Carga el PDF de ejemplo incluido (client/public/ejemplo.pdf).
  const loadExamplePdf = useCallback(async () => {
    try {
      const blob = await (await fetch('/ejemplo.pdf')).blob();
      await ingest(new File([blob], 'ejemplo.pdf', { type: 'application/pdf' }));
    } catch {
      setStatus('⚠ No se encontró el PDF de ejemplo');
    }
  }, [ingest]);

  // drag & drop global
  useEffect(() => {
    const over = (e) => { e.preventDefault(); setDragging(true); };
    const leave = (e) => { if (e.target === document.documentElement) setDragging(false); };
    const drop = (e) => {
      e.preventDefault(); setDragging(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) ingest(f);
    };
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [ingest]);

  const removeDoc = (id) => {
    setLibrary((lib) => {
      const next = lib.filter((d) => d.id !== id);
      return next.length ? next : [SAMPLE_DOC];
    });
    if (id === activeId) setActiveId((library.find((d) => d.id !== id) || SAMPLE_DOC).id);
  };

  // ---- métricas ----
  const progress = total ? (index / total) * 100 : 0;
  const minutes = elapsed / 60000;
  const effWpm = minutes > 0.02 ? Math.round(index / minutes) : 0;
  const remainMin = settings.wpm ? (total - index) / settings.wpm : 0;
  const fmtTime = (m) => (m < 1 ? `${Math.max(0, Math.ceil(m * 60))} s` : `${m.toFixed(1)} min`);

  // marcas de párrafo en la barra de progreso
  const paraMarks = useMemo(() => {
    if (!total) return [];
    const marks = [];
    let lastP = -1;
    tokens.forEach((t, i) => { if (t.para !== lastP) { marks.push((i / total) * 100); lastP = t.para; } });
    return marks.slice(1, 60);
  }, [tokens, total]);

  return (
    <div className={`app ${focus ? 'focus' : ''} ${sidebarOpen ? '' : 'collapsed'} ${settings.showSheet && !focus ? 'with-sheet' : ''}`}>
      {dragging && <div className="dropzone"><div>Suelta tu archivo · .txt .md .pdf</div></div>}

      {/* ---------------- Sidebar ---------------- */}
      <aside className="sidebar">
        <div className="side-head">
          <div className="brand"><span className="logo">⚡</span> Speed<b>Reader</b></div>
        </div>

        <label className="open-btn">
          <input type="file" accept=".txt,.md,.markdown,.pdf" onChange={onFile} hidden />
          <span>＋ Añadir documento</span>
          <small>.txt · .md · .pdf · o arrastra aquí</small>
        </label>

        <button className="example-btn" onClick={loadExamplePdf}>📄 Probar PDF de ejemplo</button>

        <div className="lib">
          <div className="lib-title">Biblioteca <span>{library.length}</span></div>
          <ul>
            {library.map((d) => {
              const toks = d.id === activeId ? total : null;
              const pct = toks ? Math.round((index / Math.max(1, toks)) * 100)
                              : (d.text ? Math.round((d.pos / Math.max(1, d.text.split(/\s+/).length)) * 100) : 0);
              return (
                <li key={d.id} className={d.id === activeId ? 'active' : ''} onClick={() => setActiveId(d.id)}>
                  <div className="doc-name" title={d.name}>{d.name}</div>
                  <div className="doc-bar"><span style={{ width: `${Math.min(100, pct)}%` }} /></div>
                  <button className="x" title="Quitar" onClick={(e) => { e.stopPropagation(); removeDoc(d.id); }}>✕</button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="settings">
          <div className="lib-title">Ajustes</div>

          <Toggle label="Tema claro" on={settings.theme === 'light'}
            onChange={(v) => set({ theme: v ? 'light' : 'dark' })} />
          <Toggle label="Mostrar hoja (documento)" on={settings.showSheet}
            onChange={(v) => set({ showSheet: v })} />
          <Toggle label="Mostrar contexto" on={settings.showContext}
            onChange={(v) => set({ showContext: v })} />
          <Toggle label="Pausa en puntuación" on={settings.pausePunctuation}
            onChange={(v) => set({ pausePunctuation: v })} />
          <Toggle label="Ralentizar palabras largas" on={settings.slowLongWords}
            onChange={(v) => set({ slowLongWords: v })} />
          <Toggle label="Retroceder al reanudar" on={settings.rewindOnPause}
            onChange={(v) => set({ rewindOnPause: v })} />

          <div className="field">
            <span>Tamaño de letra · {settings.fontSize}px</span>
            <input type="range" min="40" max="260" step="2" value={settings.fontSize}
              onChange={(e) => set({ fontSize: Number(e.target.value) })} />
          </div>
          <div className="field">
            <span>Tipografía</span>
            <div className="seg">
              {['mono', 'sans', 'serif'].map((f) => (
                <button key={f} className={settings.font === f ? 'on' : ''} onClick={() => set({ font: f })}>
                  {f === 'mono' ? 'Mono' : f === 'sans' ? 'Sans' : 'Serif'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button className="help-link" onClick={() => setShowHelp(true)}>⌨ Atajos de teclado</button>
      </aside>

      {/* ---------------- Main ---------------- */}
      <main className="main">
        <header className="topbar">
          <button className="icon" title="Mostrar/ocultar panel" onClick={() => setSidebarOpen((s) => !s)}>☰</button>
          <div className="doc-title">{activeDoc?.name}</div>
          <div className="top-right">
            <div className="chip">{total.toLocaleString('es')} palabras</div>
            <button className="icon" title="Modo enfoque (F)" onClick={() => setFocus((f) => !f)}>⛶</button>
          </div>
        </header>

        <section className="stage">
          <Reticle
            word={atEnd ? '' : current.word}
            fontSize={settings.fontSize}
            font={settings.font}
            context={context}
            showContext={settings.showContext && !atEnd}
            done={atEnd && total > 0}
          />
        </section>

        {/* barra de progreso con marcas de párrafo */}
        <div className="progress" onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const p = (e.clientX - r.left) / r.width;
          setPlaying(false);
          setIndex(Math.max(0, Math.min(total - 1, Math.round(p * (total - 1)))));
        }}>
          {paraMarks.map((m, i) => <span key={i} className="pmark" style={{ left: `${m}%` }} />)}
          <div className="progress-fill" style={{ width: `${progress}%` }} />
          <div className="progress-head" style={{ left: `${progress}%` }} />
        </div>

        {/* controles */}
        <section className="controls">
          <div className="transport">
            <button className="icon" title="Párrafo anterior" onClick={() => jumpPara(-1)}>⏮</button>
            <button className="icon" title="Palabra anterior (←)" onClick={() => step(-1)}>◀</button>
            <button className="play" onClick={toggle} title="Play / Pausa (espacio)">
              {playing ? '❚❚' : '▶'}
            </button>
            <button className="icon" title="Palabra siguiente (→)" onClick={() => step(1)}>▶</button>
            <button className="icon" title="Párrafo siguiente" onClick={() => jumpPara(1)}>⏭</button>
          </div>

          <div className="wpm-box">
            <div className="wpm-num"><b>{settings.wpm}</b> ppm</div>
            <input type="range" min="100" max="1200" step="25" value={settings.wpm}
              onChange={(e) => set({ wpm: Number(e.target.value) })} />
            <div className="chunk">
              <span>Grupo</span>
              {[1, 2, 3, 4].map((n) => (
                <button key={n} className={settings.chunkSize === n ? 'on' : ''}
                  onClick={() => { set({ chunkSize: n }); restart(); }}>{n}</button>
              ))}
            </div>
          </div>
        </section>

        {/* estadísticas */}
        <section className="stats">
          <Stat label="Progreso" value={`${Math.round(progress)}%`} />
          <Stat label="Palabra" value={`${Math.min(index + 1, total)} / ${total}`} />
          <Stat label="Velocidad real" value={effWpm ? `${effWpm} ppm` : '—'} />
          <Stat label="Tiempo leído" value={fmtTime(minutes)} />
          <Stat label="Restante" value={fmtTime(remainMin)} />
        </section>

        <details className="editor">
          <summary>✎ Pegar o editar texto {status && <em className="status">· {status}</em>}</summary>
          <textarea value={text} spellCheck={false} rows={6}
            onChange={(e) => {
              const v = e.target.value;
              setLibrary((lib) => lib.map((d) => d.id === activeId ? { ...d, text: v, name: d.name === 'Bienvenida · ejemplo' ? '(editado)' : d.name } : d));
              setIndex(0);
            }} />
        </details>
      </main>

      {settings.showSheet && !focus && (
        <Sheet paragraphs={paragraphs} index={index} currentPara={currentPara} />
      )}

      {/* ---------------- Ayuda ---------------- */}
      {showHelp && (
        <div className="modal" onClick={() => setShowHelp(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Atajos de teclado</h3>
            <table>
              <tbody>
                <tr><td><kbd>espacio</kbd></td><td>Play / Pausa</td></tr>
                <tr><td><kbd>←</kbd> <kbd>→</kbd></td><td>Palabra anterior / siguiente</td></tr>
                <tr><td><kbd>↑</kbd> <kbd>↓</kbd></td><td>Subir / bajar velocidad</td></tr>
                <tr><td><kbd>F</kbd></td><td>Modo enfoque</td></tr>
                <tr><td><kbd>R</kbd></td><td>Reiniciar</td></tr>
                <tr><td><kbd>Esc</kbd></td><td>Salir de enfoque / cerrar</td></tr>
              </tbody>
            </table>
            <button className="play close" onClick={() => setShowHelp(false)}>Entendido</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ label, on, onChange }) {
  return (
    <button className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>
      <span className="knob" /><span className="tlabel">{label}</span>
    </button>
  );
}
function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="stat-val">{value}</div>
      <div className="stat-lab">{label}</div>
    </div>
  );
}
