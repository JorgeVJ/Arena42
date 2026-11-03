// Ejemplo de pieza libre: dibuja el tiempo de partida arriba en el centro.
export default {
  nombre: 'reloj',
  autor: '@JorgeVJ',
  dibujar(lienzo, mundo) {
    const s = Math.floor(mundo.tiempo);
    const texto = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    lienzo.texto(texto, (mundo.mapa.ancho * mundo.CASILLA) / 2, 22, '#c3bbe0', 14);
  },
};
