// Validador de Arena 42: reglas de la PR, contratos de las piezas, mapas y una partida simulada.
//   node scripts/validar.mjs                         valida todo lo que hay
//   node scripts/validar.mjs --base origin/dev       además, las reglas de la PR frente a esa rama
//   ... --autor <login> --informe informe.md         autor de la PR y dónde dejar el informe
// Ejecuta el código de las piezas: en una PR ajena, que lo haga la CI, no tu ordenador.
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RAIZ } from './registro.mjs';
import { TIPOS, leerMapa } from '../public/motor/mapa.js';
import { Mundo } from '../public/motor/mundo.js';

const args = process.argv.slice(2);
const opcion = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const BASE = opcion('--base');
const AUTOR = opcion('--autor');
const INFORME = opcion('--informe');

const PUBLICO = join(RAIZ, 'public');
const PROHIBIDOS = ['import', 'require', 'fetch', 'XMLHttpRequest', 'WebSocket', 'document', 'window', 'globalThis', 'self', 'eval', 'Function', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'localStorage', 'sessionStorage', 'indexedDB', 'navigator', 'location', 'process'];
const PARTICULAS = ['chispas', 'humo', 'estrellas', 'burbujas'];
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;
const FOTOGRAMAS = 900;
const MS_MAX = 1;

const secciones = [];
let fallos = 0;
function seccion(titulo) {
  const s = { titulo, errores: [], avisos: [], notas: [] };
  secciones.push(s);
  return s;
}

// ---------- 1. reglas de la PR ----------

if (BASE) {
  const s = seccion('Reglas de la PR');
  const diff = execSync(`git diff --name-status ${BASE}...HEAD`, { cwd: RAIZ, encoding: 'utf8' }).trim();
  const cambios = diff ? diff.split('\n').map((l) => l.split('\t')) : [];
  let piezas = 0, assets = 0;
  for (const [estado, ruta, ruta2] of cambios) {
    const pieza = /^public\/piezas\/([a-z]+)\/[a-z0-9-]+\.js$/.exec(ruta);
    const mapa = /^public\/mapas\/[a-z0-9-]+\.ber$/.test(ruta);
    const asset = /^public\/assets\/[a-z0-9._-]+$/.test(ruta);
    if (estado.startsWith('D')) { s.errores.push(`borra \`${ruta}\`: no se borra nada`); continue; }
    if (estado.startsWith('R')) { s.errores.push(`renombra \`${ruta}\` a \`${ruta2}\`: no se renombra nada`); continue; }
    if (pieza && !TIPOS.includes(pieza[1])) s.errores.push(`\`${ruta}\`: «${pieza[1]}» no es un tipo de pieza (${TIPOS.join(', ')})`);
    else if (pieza || mapa) piezas++;
    else if (asset) {
      assets++;
      if (statSync(join(RAIZ, ruta)).size > 200 * 1024) s.errores.push(`\`${ruta}\` pasa de 200 KB`);
    } else s.errores.push(`toca \`${ruta}\`, que está fuera de \`public/piezas/\`, \`public/mapas/\` y \`public/assets/\``);
    if (estado.startsWith('M') && pieza && AUTOR) {
      const original = execSync(`git show ${BASE}:${ruta}`, { cwd: RAIZ, encoding: 'utf8' });
      const autor = /autor:\s*['"](@[^'"]+)['"]/.exec(original)?.[1];
      if (autor && autor.toLowerCase() !== `@${AUTOR}`.toLowerCase()) s.errores.push(`modifica \`${ruta}\`, que es de ${autor}: solo puedes cambiar tus piezas`);
    }
  }
  if (piezas === 0 && assets === 0) s.errores.push('la PR no añade ninguna pieza, mapa ni asset');
  if (piezas > 1) s.errores.push(`toca ${piezas} piezas o mapas: una PR, una pieza`);
  if (assets > 2) s.errores.push(`añade ${assets} assets: como mucho 2`);
  if (!s.errores.length) s.notas.push(`${cambios.length} archivo(s), todos dentro de las carpetas permitidas`);
}

// ---------- 2. contratos ----------

const contratos = seccion('Contratos de las piezas');
const registro = { mapas: [] };
const porArchivo = new Map();

const fn = (p, k) => p[k] === undefined || typeof p[k] === 'function';
const num = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

function comprobarEfecto(efecto, err) {
  if (efecto === undefined) return;
  if (typeof efecto !== 'object' || efecto === null) return err('`efecto` debe ser un objeto');
  const validas = ['tinte', 'anillo', 'estela', 'particulas', 'parpadeo', 'escala', 'transparencia'];
  for (const k of Object.keys(efecto)) if (!validas.includes(k)) err(`\`efecto.${k}\` no existe (${validas.join(', ')})`);
  if (efecto.tinte !== undefined && !COLOR.test(efecto.tinte)) err('`efecto.tinte` debe ser un color #rrggbb');
  if (efecto.anillo !== undefined && efecto.anillo !== true && !COLOR.test(efecto.anillo)) err('`efecto.anillo` debe ser true o un color #rrggbb');
  if (efecto.particulas !== undefined && !PARTICULAS.includes(efecto.particulas)) err(`\`efecto.particulas\` debe ser ${PARTICULAS.join(', ')}`);
  if (efecto.escala !== undefined && !num(efecto.escala, 0.5, 2)) err('`efecto.escala` va de 0.5 a 2');
  if (efecto.transparencia !== undefined && !num(efecto.transparencia, 0.2, 1)) err('`efecto.transparencia` va de 0.2 a 1');
}

const CONTRATOS = {
  estados(p, err) {
    if (p.etiqueta !== undefined && typeof p.etiqueta !== 'string') err('`etiqueta` debe ser texto');
    for (const k of ['entrar', 'actualizar', 'salir', 'cuando']) if (!fn(p, k)) err(`\`${k}\` debe ser una función`);
    if (p.transiciones !== undefined && !(Array.isArray(p.transiciones) && p.transiciones.every((t) => typeof t === 'string'))) err('`transiciones` debe ser una lista de nombres');
    if (p.actualizar && !p.transiciones) err('tiene `actualizar` pero no declara `transiciones` (pon `[]` si nunca cambia de estado)');
    if (p.desde !== undefined && !(Array.isArray(p.desde) && p.desde.length)) err('`desde` debe ser una lista de estados');
    if (!!p.desde !== !!p.cuando) err('`desde` y `cuando` van juntos');
    comprobarEfecto(p.efecto, err);
  },
  habilidades(p, err) {
    if (!num(p.enfriamiento, 0.3, 60)) err('`enfriamiento` debe ser un número de segundos ≥ 0.3');
    if (typeof p.usar !== 'function') err('falta `usar(j, mundo)`');
  },
  powerups(p, err) {
    if (!COLOR.test(p.color ?? '')) err('`color` debe ser #rrggbb');
    if (!num(p.duracion, 0.1, 15)) err('`duracion` debe estar entre 0.1 y 15 segundos');
    if (typeof p.aplicar !== 'function') err('falta `aplicar(mods, j, mundo)`');
    for (const k of ['alRecoger', 'alTerminar']) if (!fn(p, k)) err(`\`${k}\` debe ser una función`);
    comprobarEfecto(p.efecto, err);
  },
  proyectiles(p, err) {
    if (!COLOR.test(p.color ?? '')) err('`color` debe ser #rrggbb');
    if (!num(p.velocidad, 0, 1200)) err('`velocidad` debe estar entre 0 y 1200');
    if (p.radio !== undefined && !num(p.radio, 1, 16)) err('`radio` debe estar entre 1 y 16');
    if (p.vida !== undefined && !num(p.vida, 0.1, 5)) err('`vida` debe estar entre 0.1 y 5 segundos');
    if (p.gravedad !== undefined && !num(p.gravedad, -2, 2)) err('`gravedad` debe estar entre -2 y 2');
    for (const k of ['mover', 'alChocarMuro', 'alImpactar']) if (!fn(p, k)) err(`\`${k}\` debe ser una función`);
  },
  casillas(p, err) {
    if (typeof p.caracter !== 'string' || p.caracter.length !== 1 || '01P\n\r '.includes(p.caracter)) err('`caracter` debe ser un solo carácter distinto de 0, 1 y P');
    if (typeof p.solida !== 'boolean') err('`solida` debe ser true o false');
    if (!COLOR.test(p.color ?? '')) err('`color` debe ser #rrggbb');
    if (!fn(p, 'alPisar')) err('`alPisar` debe ser una función');
  },
  libre(p, err) {
    for (const k of ['montar', 'actualizar', 'dibujar']) if (!fn(p, k)) err(`\`${k}\` debe ser una función`);
    if (!p.actualizar && !p.dibujar) err('necesita `actualizar` o `dibujar`');
  },
};

function sinComentariosNiTextos(codigo) {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, '""');
}

for (const tipo of TIPOS) {
  registro[tipo] = [];
  const dir = join(PUBLICO, 'piezas', tipo);
  if (!existsSync(dir)) continue;
  const nombres = new Set();
  for (const archivo of readdirSync(dir).filter((f) => f.endsWith('.js')).sort()) {
    const ruta = `piezas/${tipo}/${archivo}`;
    const err = (m) => contratos.errores.push(`\`${ruta}\`: ${m}`);
    const codigo = readFileSync(join(dir, archivo), 'utf8');
    const limpio = sinComentariosNiTextos(codigo).replace(/^\s*export\s+default\b/m, '');
    const usados = PROHIBIDOS.filter((p) => new RegExp(`(^|[^.\\w$])${p}\\b`).test(limpio));
    if (usados.length) { err(`usa ${usados.map((u) => `\`${u}\``).join(', ')}, que está prohibido: habla con el juego solo por \`j\`, \`mundo\` y \`lienzo\``); continue; }
    let p;
    try {
      p = (await import(`${pathToFileURL(join(dir, archivo)).href}?t=${Date.now()}`)).default;
    } catch (e) {
      err(`no se puede cargar: ${e.message}`);
      continue;
    }
    if (!p || typeof p !== 'object') { err('debe hacer `export default { … }`'); continue; }
    const nombre = basename(archivo, '.js');
    if (p.nombre !== nombre) err(`\`nombre\` es «${p.nombre}» y el archivo «${nombre}»: deben coincidir`);
    if (!KEBAB.test(p.nombre ?? '')) err('`nombre` debe ir en kebab-case (letras minúsculas, números y guiones)');
    if (!/^@[\w-]+$/.test(p.autor ?? '')) err('`autor` debe ser tu login con @: `\'@login\'`');
    if (nombres.has(p.nombre)) err(`ya hay otra pieza de ${tipo} llamada «${p.nombre}»`);
    nombres.add(p.nombre);
    CONTRATOS[tipo](p, err);
    registro[tipo].push(p);
    porArchivo.set(p, ruta);
  }
}

const estados = new Set(registro.estados.map((e) => e.nombre));
for (const base of ['quieto', 'corriendo', 'en-el-aire']) if (!estados.has(base)) contratos.errores.push(`falta el estado base «${base}»`);
for (const e of registro.estados) {
  for (const t of e.transiciones || []) if (!estados.has(t)) contratos.errores.push(`\`${porArchivo.get(e)}\`: la transición «${t}» no es un estado que exista`);
  for (const d of e.desde || []) if (d !== '*' && !estados.has(d)) contratos.errores.push(`\`${porArchivo.get(e)}\`: \`desde\` incluye «${d}», que no existe`);
}
const caracteres = new Map();
for (const c of registro.casillas) {
  if (caracteres.has(c.caracter)) contratos.errores.push(`\`${porArchivo.get(c)}\`: el carácter «${c.caracter}» ya lo usa ${caracteres.get(c.caracter)}`);
  caracteres.set(c.caracter, c.nombre);
}
const total = TIPOS.reduce((n, t) => n + registro[t].length, 0);
contratos.notas.push(`${total} piezas: ${TIPOS.map((t) => `${registro[t].length} ${t}`).join(' · ')}`);

// ---------- 3. mapas ----------

const smapas = seccion('Mapas');
const mapas = readdirSync(join(PUBLICO, 'mapas')).filter((f) => f.endsWith('.ber')).sort();
const textos = {};
for (const m of mapas) {
  textos[m] = readFileSync(join(PUBLICO, 'mapas', m), 'utf8');
  const r = leerMapa(textos[m], [...caracteres.keys()]);
  for (const e of r.errores) smapas.errores.push(`\`mapas/${m}\`: ${e}`);
}
smapas.notas.push(`${mapas.length} mapa(s): ${mapas.join(', ')}`);

// ---------- 4. partida simulada ----------

const sim = seccion('Partida simulada');
const mapaSim = mapas.find((m) => !smapas.errores.some((e) => e.includes(m)));
if (contratos.errores.length || !mapaSim) {
  sim.errores.push('no se simula hasta que los contratos y al menos un mapa estén bien');
} else {
  let aleatorio = 42;
  const azar = () => ((aleatorio = (aleatorio * 1103515245 + 12345) % 2147483648) / 2147483648);
  const lienzo = { rect() {}, circulo() {}, linea() {}, texto() {} };
  const mundo = new Mundo(registro, textos[mapaSim]);
  const bots = [1, 2, 3, 4].map((i) => mundo.crearJugador({ id: `bot${i}`, login: `bot${i}`, color: '#3fa7d6', local: true }));
  mundo.iniciar();
  const habilidades = registro.habilidades.map((h) => h.nombre);
  const proyectiles = registro.proyectiles.map((p) => p.nombre);
  const entradas = new Map(bots.map((b) => [b.id, {}]));
  for (let f = 0; f < FOTOGRAMAS; f++) {
    bots.forEach((b, i) => {
      if (f % 20 === 0) entradas.set(b.id, { izq: azar() < 0.4, der: azar() < 0.4, arriba: azar() < 0.2, abajo: azar() < 0.2, saltarMantenido: azar() < 0.3 });
      const e = entradas.get(b.id);
      e.saltar = azar() < 0.05; e.habilidad = azar() < 0.05; e.disparar = azar() < 0.08;
      if (f % 120 === 0) {
        b.habilidad = habilidades[(f / 120 + i) % habilidades.length] ?? null;
        b.proyectil = proyectiles[(f / 120 + i) % proyectiles.length] ?? null;
      }
      if (f % 90 === 0 && registro.powerups.length) mundo.darPowerup(b, registro.powerups[(f / 90 + i) % registro.powerups.length].nombre);
    });
    if (f % 150 === 75 && registro.estados.length) mundo.cambiarEstado(bots[0], registro.estados[(f / 150 | 0) % registro.estados.length].nombre);
    if (f % 200 === 100) for (const c of registro.casillas) mundo.llamar(c, 'alPisar', bots[1], mundo);
    mundo.paso(1 / 60, entradas);
    for (const l of registro.libre) mundo.llamar(l, 'dibujar', lienzo, mundo);
  }
  for (const e of mundo.errores) (e.aviso ? sim.avisos : sim.errores).push(`\`${e.pieza}\` (${e.metodo}): ${e.mensaje}`);
  const lentas = Object.entries(mundo.medidas).map(([k, ms]) => [k, ms / FOTOGRAMAS]).sort((a, b) => b[1] - a[1]);
  for (const [k, ms] of lentas) if (ms > MS_MAX) sim.errores.push(`\`${k}\` gasta ${ms.toFixed(2)} ms por fotograma (máx. ${MS_MAX})`);
  sim.notas.push(`${FOTOGRAMAS} fotogramas en \`${mapaSim}\` con 4 bots que usan todas las piezas`);
  sim.notas.push(`más lentas: ${lentas.slice(0, 3).map(([k, ms]) => `${k} ${ms.toFixed(3)} ms`).join(' · ') || '—'}`);
}

// ---------- informe ----------

const lineas = ['## Validación de Arena 42', ''];
for (const s of secciones) {
  fallos += s.errores.length;
  lineas.push(`### ${s.errores.length ? '❌' : '✅'} ${s.titulo}`);
  for (const e of s.errores) lineas.push(`- ❌ ${e}`);
  for (const a of s.avisos) lineas.push(`- ⚠️ ${a}`);
  for (const n of s.notas) lineas.push(`- ${n}`);
  lineas.push('');
}
lineas.push(fallos ? `**${fallos} error(es).** Corrígelos, haz commit y push en la misma rama: la PR se vuelve a validar sola.` : '**Todo en verde.** Falta la revisión.');
const informe = lineas.join('\n');
console.log(informe);
if (INFORME) writeFileSync(INFORME, informe + '\n');
process.exit(fallos ? 1 : 0);
