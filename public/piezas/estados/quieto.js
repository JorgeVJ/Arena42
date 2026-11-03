// Estado base: de pie, sin moverse.
export default {
  nombre: 'quieto',
  autor: '@JorgeVJ',
  etiqueta: 'QUIETO',
  transiciones: ['corriendo', 'en-el-aire'],
  actualizar(j, dt, entrada, mundo) {
    j.vx = 0;
    if (!j.enSuelo) return 'en-el-aire';
    if (entrada.saltar) { mundo.saltar(j); return 'en-el-aire'; }
    if (entrada.izq || entrada.der) return 'corriendo';
  },
};
