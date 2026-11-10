import React, { useLayoutEffect, useRef, useState } from 'react';
import { splitWord } from './reader.js';

// Zona central de lectura: palabra con letra pivote en rojo alineada SIEMPRE
// sobre la línea roja. Para garantizar la alineación medimos el ancho real del
// pivote y posicionamos las partes izquierda/derecha a ambos lados de su centro,
// que coincide exactamente con el 50% (donde está la marca roja).
export default function Reticle({ word, fontSize, font, context, showContext, done }) {
  const { left, pivot, right } = splitWord(word);
  const pivotRef = useRef(null);
  const [half, setHalf] = useState(0);

  const fam =
    font === 'serif'
      ? 'Georgia, "Times New Roman", serif'
      : font === 'sans'
      ? 'Inter, system-ui, sans-serif'
      : '"DejaVu Sans Mono", "SF Mono", Consolas, ui-monospace, monospace';

  useLayoutEffect(() => {
    if (pivotRef.current) {
      const w = pivotRef.current.getBoundingClientRect().width;
      setHalf(w / 2);
    }
  }, [pivot, fontSize, font, word]);

  return (
    <div className="reticle-wrap">
      {showContext && (
        <div className="context context-before">{context.before.slice(-7).join(' ')}</div>
      )}

      <div className="reticle" style={{ '--word-size': `${fontSize}px`, fontFamily: fam }}>
        <div className="guide guide-top"><span className="tick" /></div>

        <div className={`word ${done ? 'is-done' : ''}`}>
          {done ? (
            <span className="done-msg">✓ Lectura completada</span>
          ) : (
            <>
              <span className="left" style={{ right: `calc(50% + ${half}px)` }}>{left}</span>
              <span className="pivot" ref={pivotRef}>{pivot}</span>
              <span className="right" style={{ left: `calc(50% + ${half}px)` }}>{right}</span>
            </>
          )}
        </div>

        <div className="guide guide-bottom"><span className="tick" /></div>
      </div>

      {showContext && (
        <div className="context context-after">{context.after.slice(0, 7).join(' ')}</div>
      )}
    </div>
  );
}
