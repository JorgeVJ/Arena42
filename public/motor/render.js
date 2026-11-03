// Dibujo del mundo en un canvas 2D. Todo es paramétrico: no hay imágenes.
import { CASILLA as C } from './mundo.js';

const FONDO = '#1a1628', MURO = '#3b3355', BORDE_MURO = '#4a4170';

export function crearLienzo(ctx) {
  return {
    rect: (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); },
    circulo: (x, y, r, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); },
    linea: (x1, y1, x2, y2, color, grosor = 2) => { ctx.strokeStyle = color; ctx.lineWidth = grosor; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); },
    texto: (t, x, y, color = '#ffffff', tam = 14) => { ctx.fillStyle = color; ctx.font = `600 ${tam}px "IBM Plex Mono", monospace`; ctx.textAlign = 'center'; ctx.fillText(String(t).slice(0, 60), x, y); },
  };
}

export function dibujar(ctx, mundo, t) {
  const { mapa } = mundo;
  ctx.fillStyle = FONDO;
  ctx.fillRect(0, 0, mapa.ancho * C, mapa.alto * C);

  for (let cy = 0; cy < mapa.alto; cy++) {
    for (let cx = 0; cx < mapa.ancho; cx++) {
      const c = mapa.filas[cy][cx];
      if (c === '0' || c === 'P') continue;
      const x = cx * C, y = cy * C;
      if (c === '1') {
        ctx.fillStyle = MURO; ctx.fillRect(x, y, C, C);
        ctx.strokeStyle = BORDE_MURO; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, y + 1.5, C - 3, C - 3);
      } else {
        const p = mundo.casillasPorCaracter[c];
        ctx.fillStyle = p?.color || '#ff00ff';
        ctx.fillRect(x, y + (p?.solida ? 0 : C / 2), C, p?.solida ? C : C / 2);
      }
    }
  }

  ctx.textAlign = 'center';
  for (const pu of mundo.powerups.values()) {
    const p = mundo.piezas.powerups[pu.nombre];
    const y = pu.y + Math.sin(t * 3 + pu.id) * 5;
    ctx.fillStyle = p?.color || '#ffffff';
    ctx.beginPath(); ctx.arc(pu.x, y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke();
    etiqueta(ctx, pu.nombre, pu.x, y - 18, 'rgba(0,0,0,.6)', '#ffffff');
  }

  for (const pr of mundo.proyectiles) {
    const color = mundo.piezas.proyectiles[pr.nombre]?.color || '#ffffff';
    ctx.shadowColor = color; ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.radio, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  for (const p of mundo.particulas) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.vida));
    ctx.fillStyle = p.color;
    const s = p.tipo === 'humo' ? 6 : p.tipo === 'burbujas' ? 5 : 3;
    if (p.tipo === 'burbujas') { ctx.strokeStyle = p.color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.stroke(); }
    else if (p.tipo === 'estrellas') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.PI / 4); ctx.fillRect(-s, -s, s * 2, s * 2); ctx.restore(); }
    else ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
  }
  ctx.globalAlpha = 1;

  for (const j of mundo.jugadores.values()) dibujarJugador(ctx, mundo, j, t);

  const lienzo = crearLienzo(ctx);
  for (const l of Object.values(mundo.piezas.libre)) mundo.llamar(l, 'dibujar', lienzo, mundo);
}

function dibujarJugador(ctx, mundo, j, t) {
  const e = j.efecto || {};
  const escala = Math.min(2, Math.max(0.5, e.escala || 1));
  const w = j.ancho * escala, h = j.alto * escala;
  const x = j.x + j.ancho / 2 - w / 2, y = j.y + j.alto - h;
  const color = e.tinte || j.color;

  if (e.estela) {
    j.rastro.forEach((r, i) => {
      if (i === 0) return;
      ctx.globalAlpha = 0.35 * (1 - i / j.rastro.length);
      ctx.fillStyle = color;
      ctx.fillRect(r.x + j.ancho / 2 - w / 2, r.y + j.alto - h, w, h);
    });
  }

  const visible = !(e.parpadeo && Math.floor(t * 12) % 2);
  ctx.globalAlpha = Math.min(1, Math.max(0.2, e.transparencia ?? 1)) * (visible ? 1 : 0.25);
  ctx.fillStyle = color;
  redondeado(ctx, x, y, w, h, 7 * escala);
  ctx.fill();
  ctx.fillStyle = '#0a0812';
  const ojo = 5 * escala, ox = x + w / 2 + j.mira * 3 * escala;
  ctx.fillRect(ox - 7 * escala, y + 9 * escala, ojo, ojo);
  ctx.fillRect(ox + 2 * escala, y + 9 * escala, ojo, ojo);
  ctx.globalAlpha = 1;

  if (e.anillo) {
    ctx.strokeStyle = typeof e.anillo === 'string' ? e.anillo : '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, Math.max(w, h) * 0.8, 0, Math.PI * 2); ctx.stroke();
  }

  const est = mundo.piezas.estados[j.estado];
  const texto = est?.etiqueta || String(j.estado || '').toUpperCase();
  etiqueta(ctx, texto, x + w / 2, y - 10, e.tinte || j.color, '#0a0812');
  ctx.fillStyle = '#ffffff';
  ctx.font = '11px "IBM Plex Mono", monospace';
  ctx.fillText(j.login, x + w / 2, y - 26);
  for (let i = 0; i < j.vida; i++) {
    ctx.fillStyle = '#ff5a5a';
    ctx.fillRect(x + w / 2 - 13 + i * 10, y + h + 4, 7, 4);
  }
}

function etiqueta(ctx, texto, x, y, fondo, color) {
  ctx.font = '600 11px "IBM Plex Mono", monospace';
  const w = ctx.measureText(texto).width + 10;
  ctx.fillStyle = fondo;
  redondeado(ctx, x - w / 2, y - 11, w, 15, 4);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(texto, x, y);
}

function redondeado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
