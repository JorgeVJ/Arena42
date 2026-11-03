// Ejemplo de estado: un acelerón horizontal corto. Se entra desde la habilidad «dash».
export default {
  nombre: 'dash',
  autor: '@JorgeVJ',
  etiqueta: 'DASH',
  efecto: { estela: true, tinte: '#7fd3ff' },
  transiciones: ['en-el-aire'],
  entrar(j) {
    j.datos.dashDir = j.mira;
  },
  actualizar(j) {
    j.vx = j.datos.dashDir * 900;
    j.vy = 0;
    if (j.tEstado > 0.18 || j.chocoPared) return 'en-el-aire';
  },
};
