// Teclado: teclas mantenidas y pulsaciones de este fotograma.
const mantenidas = new Set();
const pulsadas = new Set();
const DEL_JUEGO = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'];

addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, select, textarea')) return;
  if (!mantenidas.has(e.code)) pulsadas.add(e.code);
  mantenidas.add(e.code);
  if (DEL_JUEGO.includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => mantenidas.delete(e.code));
addEventListener('blur', () => mantenidas.clear());

export function leerEntrada() {
  const m = (...k) => k.some((c) => mantenidas.has(c));
  const p = (...k) => k.some((c) => pulsadas.has(c));
  const entrada = {
    izq: m('ArrowLeft', 'KeyA'),
    der: m('ArrowRight', 'KeyD'),
    arriba: m('ArrowUp', 'KeyW'),
    abajo: m('ArrowDown', 'KeyS'),
    saltar: p('Space', 'ArrowUp', 'KeyW'),
    saltarMantenido: m('Space', 'ArrowUp', 'KeyW'),
    habilidad: p('KeyJ'),
    disparar: p('KeyK'),
  };
  pulsadas.clear();
  return entrada;
}
