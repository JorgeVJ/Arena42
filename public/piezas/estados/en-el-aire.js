// Estado base: saltando o cayendo. Los saltos extra los dan los power-ups (mods.saltosExtra).
export default {
  nombre: 'en-el-aire',
  autor: '@JorgeVJ',
  etiqueta: 'EN EL AIRE',
  transiciones: ['quieto', 'corriendo'],
  actualizar(j, dt, entrada, mundo) {
    mundo.moverHorizontal(j, entrada, 0.9);
    if (entrada.saltar && j.saltosExtraUsados < j.mods.saltosExtra) {
      j.saltosExtraUsados++;
      mundo.saltar(j);
    }
    if (j.enSuelo) return entrada.izq || entrada.der ? 'corriendo' : 'quieto';
  },
};
