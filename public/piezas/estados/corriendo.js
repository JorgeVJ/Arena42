// Estado base: corriendo por el suelo.
export default {
  nombre: 'corriendo',
  autor: '@JorgeVJ',
  etiqueta: 'CORRIENDO',
  transiciones: ['quieto', 'en-el-aire'],
  actualizar(j, dt, entrada, mundo) {
    mundo.moverHorizontal(j, entrada);
    if (!j.enSuelo) return 'en-el-aire';
    if (entrada.saltar) { mundo.saltar(j); return 'en-el-aire'; }
    if (!entrada.izq && !entrada.der) return 'quieto';
  },
};
