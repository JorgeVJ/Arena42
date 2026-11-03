// Lectura y validación de mapas .ber (reglas del subject de so_long, vistos de lado).

export const TIPOS = ['estados', 'habilidades', 'powerups', 'proyectiles', 'casillas', 'libre'];

export function leerMapa(texto, caracteresExtra = []) {
  const filas = texto.replace(/\r/g, '').split('\n').filter((l) => l.length > 0);
  const errores = new Set();
  const ancho = filas[0]?.length ?? 0;
  const validos = new Set(['0', '1', 'P', ...caracteresExtra]);
  const salidas = [];
  if (filas.length < 3 || ancho < 3) errores.add('el mapa necesita al menos 3 filas y 3 columnas');
  filas.forEach((fila, y) => {
    if (fila.length !== ancho) errores.add(`la fila ${y + 1} mide ${fila.length} y la primera ${ancho}: el mapa debe ser rectangular`);
    [...fila].forEach((c, x) => {
      if (!validos.has(c)) errores.add(`carácter «${c}» desconocido (fila ${y + 1}, columna ${x + 1})`);
      const borde = y === 0 || y === filas.length - 1 || x === 0 || x === fila.length - 1;
      if (borde && c !== '1') errores.add(`el borde debe ser muro (fila ${y + 1}, columna ${x + 1})`);
      if (c === 'P') salidas.push({ cx: x, cy: y });
    });
  });
  if (salidas.length < 2) errores.add('hacen falta al menos 2 salidas «P»');
  return {
    filas: filas.map((f) => [...f]),
    originales: filas.map((f) => [...f]),
    ancho,
    alto: filas.length,
    salidas,
    errores: [...errores],
  };
}
