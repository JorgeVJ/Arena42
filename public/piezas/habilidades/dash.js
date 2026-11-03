// Ejemplo de habilidad: lanza el estado «dash».
export default {
  nombre: 'dash',
  autor: '@JorgeVJ',
  descripcion: 'Acelerón hacia donde miras',
  enfriamiento: 1.2,
  usar(j, mundo) {
    mundo.cambiarEstado(j, 'dash');
  },
};
