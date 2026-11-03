// Ejemplo de casilla: «T» en el .ber. Lanza hacia arriba al aterrizar encima.
export default {
  nombre: 'trampolin',
  autor: '@JorgeVJ',
  caracter: 'T',
  solida: true,
  color: '#f2b33d',
  alPisar(j, mundo) {
    mundo.empujar(j, j.vx, -1150);
  },
};
