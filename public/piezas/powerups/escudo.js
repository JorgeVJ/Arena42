// Ejemplo de power-up: inmune unos segundos.
export default {
  nombre: 'escudo',
  autor: '@JorgeVJ',
  color: '#5ce1e6',
  duracion: 6,
  efecto: { anillo: '#5ce1e6' },
  aplicar(mods) {
    mods.inmune = true;
  },
};
