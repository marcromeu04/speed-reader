import React, { useEffect, useRef } from 'react';

// "Hoja": muestra el documento como texto corrido, resalta el párrafo actual y
// subraya la palabra que se está leyendo, desplazándose automáticamente.
export default function Sheet({ paragraphs, index, currentPara, images = [], onOpenImage }) {
  const activeRef = useRef(null);
  const boxRef = useRef(null);

  // Mantiene la palabra activa centrada en el panel.
  useEffect(() => {
    const el = activeRef.current;
    const box = boxRef.current;
    if (el && box) {
      const target = el.offsetTop - box.clientHeight / 2 + el.offsetHeight / 2;
      box.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    }
  }, [index]);

  return (
    <aside className="sheet">
      <div className="sheet-head">
        <span>Documento</span>
        <span className="sheet-para">Párrafo {currentPara + 1} / {paragraphs.length}</span>
      </div>
      <div className="sheet-page" ref={boxRef}>
        {images.length > 0 && (
          <div className="sheet-images">
            <div className="imgs-title">🖼 Imágenes del documento · {images.length}</div>
            <div className="imgs-grid">
              {images.map((src, i) => (
                <button key={i} className="thumb" onClick={() => onOpenImage(src)} title="Ver imagen">
                  <img src={src} alt={`Imagen ${i + 1}`} />
                </button>
              ))}
            </div>
          </div>
        )}
        {paragraphs.map((para, pi) => (
          <p key={pi} className={pi === currentPara ? 'p-active' : 'p-idle'}>
            {para.map((tok) => {
              const active = tok.gi === index;
              return (
                <span
                  key={tok.gi}
                  ref={active ? activeRef : null}
                  className={active ? 'w-active' : tok.gi < index ? 'w-read' : 'w-todo'}
                >
                  {tok.word}{' '}
                </span>
              );
            })}
          </p>
        ))}
      </div>
    </aside>
  );
}
