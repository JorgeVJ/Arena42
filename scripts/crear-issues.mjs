// Crea en GitHub los issues de backlog/issues.md, con su etiqueta (estado, habilidad…) y su dificultad.
//   node scripts/crear-issues.mjs <dueño>/<repo>
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { RAIZ } from './registro.mjs';

const REPO = process.argv[2];
if (!REPO) { console.error('uso: node scripts/crear-issues.mjs <dueño>/<repo>'); process.exit(1); }

const texto = readFileSync(join(RAIZ, 'backlog', 'issues.md'), 'utf8');
const issues = texto.split(/^## /m).slice(1).map((bloque) => {
  const [titulo, ...resto] = bloque.trim().split('\n');
  const linea = resto.find((l) => l.startsWith('etiqueta:')) || '';
  const etiquetas = linea.replace('etiqueta:', '').split('·').map((s) => s.trim()).filter(Boolean);
  const cuerpo = resto.filter((l) => l !== linea).join('\n').trim();
  return { titulo: titulo.trim(), etiquetas, cuerpo: `${cuerpo}\n\nSigue la spec: [SPEC.md](../blob/dev/SPEC.md).` };
});

const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
for (const e of new Set(issues.flatMap((i) => i.etiquetas))) {
  try { gh('label', 'create', e, '--repo', REPO, '--force'); } catch {}
}
for (const i of issues) {
  const args = ['issue', 'create', '--repo', REPO, '--title', i.titulo, '--body', i.cuerpo];
  for (const e of i.etiquetas) args.push('--label', e);
  console.log(gh(...args).trim());
}
