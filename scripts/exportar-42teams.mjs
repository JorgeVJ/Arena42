// Escribe backlog/issues.md como plantilla de tablero de 42Teams (datos/plantillas/arena42-taller/)
// y el proyecto arena42, y pasa el validador de 42Teams. La plantilla es generada: se cambia aquí.
//   node scripts/exportar-42teams.mjs [ruta del repo 42Teams, por defecto ../42Teams]
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { RAIZ } from './registro.mjs';

const TEAMS = resolve(process.argv[2] || join(RAIZ, '..', '42Teams'));
if (!existsSync(join(TEAMS, 'datos', 'proyectos'))) { console.error(`no encuentro 42Teams en ${TEAMS}`); process.exit(1); }

// tipo de la etiqueta → carpeta de la pieza, rol del tablero y patrón de SPEC.md §2
const TIPOS = {
  estado: { carpeta: 'public/piezas/estados', rol: 'jugador', patron: 'State' },
  habilidad: { carpeta: 'public/piezas/habilidades', rol: 'jugador', patron: 'Strategy' },
  'power-up': { carpeta: 'public/piezas/powerups', rol: 'objetos', patron: 'Decorator' },
  proyectil: { carpeta: 'public/piezas/proyectiles', rol: 'objetos', patron: 'Strategy' },
  casilla: { carpeta: 'public/piezas/casillas', rol: 'mundo', patron: 'registro de caracteres' },
  mapa: { carpeta: 'public/mapas', rol: 'mundo', patron: null },
  libre: { carpeta: 'public/piezas/libre', rol: 'libre', patron: null },
};
const DIFICULTAD = { 'fácil': 'facil', medio: 'medio', 'difícil': 'dificil' };

const texto = readFileSync(join(RAIZ, 'backlog', 'issues.md'), 'utf8');
const tarjetas = texto.split(/^## /m).slice(1).map((bloque) => {
  const [cabecera, ...lineas] = bloque.trim().split('\n');
  const [, id, titulo] = cabecera.match(/^(H-\d{3,}) · (.+)$/) || [];
  if (!id) throw new Error(`tarea sin id H-XXX: ${cabecera}`);
  const campo = (k) => lineas.find((l) => l.startsWith(`${k}:`))?.slice(k.length + 1).trim();
  const [tipo, dificultad] = (campo('etiqueta') || '').split('·').map((s) => s.trim());
  const t = TIPOS[tipo];
  if (!t) throw new Error(`${id}: tipo desconocido «${tipo}»`);
  const dif = DIFICULTAD[dificultad];
  return {
    id,
    titulo,
    descripcion: lineas.filter((l) => !/^(etiqueta|bloqueada|relacionada):/.test(l)).join('\n').trim(),
    rol: t.rol,
    columna: 'backlog',
    epic: tipo === 'libre' ? 'libre' : 'validacion',
    etiquetas: [tipo === 'power-up' ? 'powerup' : tipo, ...(dif ? [dif] : [])],
    conceptos: [],
    criterios: [
      'Hace lo que pide la descripción.',
      `La PR toca un solo archivo nuevo en \`${t.carpeta}/\` y su título empieza por ${id}.`,
      '`pnpm validar` en verde.',
    ],
    criterios_codigo_extra: [t.patron ? `Cumple el contrato de su tipo (${t.patron}) en SPEC.md §2.` : 'Cumple las reglas comunes de SPEC.md §1.'],
    relaciones: [
      ...(campo('bloqueada') ? [{ tipo: 'bloqueada_por', tarjeta: campo('bloqueada') }] : []),
      ...(campo('relacionada') ? [{ tipo: 'relacionada', tarjeta: campo('relacionada') }] : []),
    ],
    subject: `SPEC.md §2 · ${t.carpeta.split('/').pop()}`,
    asignados: [],
    estimacion_h: 0.5,
  };
});
const ids = new Set(tarjetas.map((t) => t.id));
for (const t of tarjetas) for (const r of t.relaciones) if (!ids.has(r.tarjeta)) throw new Error(`${t.id}: relación con ${r.tarjeta}, que no existe`);

const proyecto = {
  id: 'arena42',
  nombre: 'Arena 42 · taller de GitHub',
  nucleo: 'taller',
  grupo: '10-15',
  horas: 3,
  xp: 0,
  lenguajes: ['JavaScript'],
  resumen_subject: 'https://github.com/JorgeVJ/Arena42/blob/dev/SPEC.md',
  roles: [
    { id: 'jugador', nombre: 'Jugador', descripcion: 'Estados (State) y habilidades (Strategy) del personaje.' },
    { id: 'objetos', nombre: 'Objetos', descripcion: 'Power-ups (Decorator) y proyectiles (Strategy).' },
    { id: 'mundo', nombre: 'Mundo', descripcion: 'Casillas nuevas del .ber y mapas.' },
    { id: 'libre', nombre: 'Libre', descripcion: 'Ideas que no están en el backlog y cumplen la spec.' },
  ],
  conceptos_recomendados: [],
};
const columnas = [['backlog', 'Backlog'], ['por-hacer', 'Por hacer'], ['en-curso', 'En curso'], ['en-revision', 'En revisión'], ['hecho', 'Hecho']];
const etiquetas = [
  ['estado', 'Estado', '#3fa7d6'], ['habilidad', 'Habilidad', '#7fd3ff'], ['powerup', 'Power-up', '#ff7ab6'],
  ['proyectil', 'Proyectil', '#5ce1e6'], ['casilla', 'Casilla', '#8a7a5a'], ['mapa', 'Mapa', '#6b8f4e'],
  ['libre', 'Libre', '#b28dff'], ['facil', 'Fácil', '#4caf50'], ['medio', 'Medio', '#ffb300'], ['dificil', 'Difícil', '#e5533d'],
];
// 42Teams exige los epics fijos de validación y bonus. Aquí «validación» es el backlog del taller
// (la dificultad va en las etiquetas) y el bonus queda vacío.
const epics = [
  ['validacion', 'Tareas del taller', 'validacion', true, 'Una pieza por PR. Empieza por una fácil para estrenar el flujo rama → PR → revisión → merge.'],
  ['bonus', 'Bonus', 'bonus', true, 'Vacío: en el taller no hay bonus.'],
  ['libre', 'Libre', 'propio', false, 'Ideas propias que cumplen la spec.'],
];

const escribir = (ruta, o) => { mkdirSync(dirname(ruta), { recursive: true }); writeFileSync(ruta, JSON.stringify(o, null, 2) + '\n'); };
const DATOS = join(TEAMS, 'datos');
const PL = join(DATOS, 'plantillas', 'arena42-taller');
rmSync(PL, { recursive: true, force: true });
escribir(join(DATOS, 'proyectos', 'arena42.json'), proyecto);
escribir(join(PL, 'plantilla.json'), {
  id: 'arena42-taller',
  nombre: 'Arena 42 · taller de GitHub',
  proyecto: 'arena42',
  descripcion: 'Backlog del taller de GitHub (charla 02): cada tarjeta es una pieza del juego Arena 42 en una PR propia. Generada desde Arena42/backlog/issues.md con scripts/exportar-42teams.mjs; no se edita a mano.',
  roles: proyecto.roles.map((r) => r.id),
  columnas: columnas.map((c) => c[0]),
  etiquetas: etiquetas.map((e) => e[0]),
  epics: epics.map((e) => e[0]),
  autor: 'jvasquez',
  creada: '2026-11-04',
});
for (const [id, nombre] of columnas) escribir(join(PL, 'columnas', `${id}.json`), { id, nombre, wip: null });
for (const [id, nombre, color] of etiquetas) escribir(join(PL, 'etiquetas', `${id}.json`), { id, nombre, color });
for (const [id, nombre, tipo, fijo, descripcion] of epics) escribir(join(PL, 'epics', `${id}.json`), { id, nombre, tipo, fijo, descripcion });
for (const t of tarjetas) escribir(join(PL, 'tarjetas', `${t.id}.json`), t);
console.log(`${tarjetas.length} tarjetas en ${PL}`);

// Del informe del validador solo interesa esta plantilla y el veredicto.
const r = spawnSync('python', ['-I', 'herramientas/validar.py'], { cwd: TEAMS, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
const informe = `${r.stdout ?? ''}${r.stderr ?? ''}`.split('\n').filter((l) => /arena42|^ERROR|^OK|Traceback/.test(l));
console.log(informe.join('\n'));
process.exit(r.status ?? 1);
