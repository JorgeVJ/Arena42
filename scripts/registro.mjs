// Genera public/registro.js (importa todas las piezas) y public/version.json.
// Así nadie edita una lista compartida: añadir un archivo basta para que el juego lo cargue.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIPOS } from '../public/motor/mapa.js';

export const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const PUBLICO = join(RAIZ, 'public');

const listar = (dir, ext) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(ext)).sort() : []);

export function generarRegistro() {
  const hash = createHash('sha1');
  const lineas = ['// Generado por scripts/registro.mjs. No se edita a mano ni se sube a git.'];
  const grupos = {};
  for (const tipo of TIPOS) {
    grupos[tipo] = [];
    for (const archivo of listar(join(PUBLICO, 'piezas', tipo), '.js')) {
      const id = `${tipo.replace(/\W/g, '')}_${grupos[tipo].length}`;
      lineas.push(`import ${id} from './piezas/${tipo}/${archivo}';`);
      grupos[tipo].push(id);
      hash.update(readFileSync(join(PUBLICO, 'piezas', tipo, archivo)));
    }
  }
  const mapas = listar(join(PUBLICO, 'mapas'), '.ber');
  for (const m of mapas) hash.update(readFileSync(join(PUBLICO, 'mapas', m)));
  for (const m of listar(join(PUBLICO, 'motor'), '.js')) hash.update(readFileSync(join(PUBLICO, 'motor', m)));

  lineas.push('', 'export default {');
  for (const tipo of TIPOS) lineas.push(`  ${tipo}: [${grupos[tipo].join(', ')}],`);
  lineas.push(`  mapas: ${JSON.stringify(mapas)},`, '};', '');
  writeFileSync(join(PUBLICO, 'registro.js'), lineas.join('\n'));

  let commit = null;
  try {
    const [h, mensaje, autor] = execSync('git log -1 --format=%h%x09%s%x09%an', { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\t');
    commit = { hash: h, mensaje, autor };
  } catch {}
  const version = { hash: hash.digest('hex').slice(0, 12), commit, generado: new Date().toISOString() };
  writeFileSync(join(PUBLICO, 'version.json'), JSON.stringify(version, null, 2) + '\n');
  return version;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const v = generarRegistro();
  console.log(`registro generado · versión ${v.hash}`);
}
