// Vigilante del taller: cada 30 s mira las PR abiertas contra dev y, por cada commit nuevo
// con la CI terminada, lanza a Claude con la skill revisar-pr. Claude revisa desde la cuenta de gh
// de este ordenador: aprueba (y activa el auto-merge) o pide cambios. Las PR de quien no es
// colaborador del repo se ignoran: con el repo público cualquiera puede abrir una.
//   node scripts/vigilar-prs.mjs [--cada 30] [--solo-comentar]
// Necesita la CLI de Claude Code (`claude`; otra ruta con la variable CLAUDE_CLI). Los comandos de gh
// que puede usar sin preguntar están en .claude/settings.json.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from './registro.mjs';

const args = process.argv.slice(2);
const CADA = Number(args[args.indexOf('--cada') + 1]) || 30;
const SOLO_COMENTAR = args.includes('--solo-comentar');
const DIR = join(RAIZ, '.vigilante');
const ESTADO = join(DIR, 'revisadas.json');
mkdirSync(DIR, { recursive: true });
const revisadas = existsSync(ESTADO) ? JSON.parse(readFileSync(ESTADO, 'utf8')) : {};

const CLAUDE = process.env.CLAUDE_CLI || 'claude';

// `gh pr checks` sale con código distinto de 0 si algún check falla: el JSON sigue en stdout.
function gh(...a) {
  try {
    return JSON.parse(execFileSync('gh', a, { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch (e) {
    if (e.stdout?.trim().startsWith('[')) return JSON.parse(e.stdout);
    throw e;
  }
}
const REPO = gh('repo', 'view', '--json', 'nameWithOwner').nameWithOwner;
const colaboradores = new Map();
// `gh api .../collaborators/<login>` responde 204 (sale con 0) si lo es y 404 si no.
function esColaborador(login) {
  if (!colaboradores.has(login)) {
    try {
      execFileSync('gh', ['api', `repos/${REPO}/collaborators/${login}`], { cwd: RAIZ, stdio: 'ignore' });
      colaboradores.set(login, true);
    } catch {
      colaboradores.set(login, false);
    }
  }
  return colaboradores.get(login);
}
const marcar = (pr) => { revisadas[pr.number] = pr.headRefOid; writeFileSync(ESTADO, JSON.stringify(revisadas, null, 2)); };
const hora = () => new Date().toLocaleTimeString('es-ES');

function vuelta() {
  let prs;
  try {
    prs = gh('pr', 'list', '--base', 'dev', '--state', 'open', '--json', 'number,title,headRefOid,author,isDraft');
  } catch (e) {
    console.error(`[${hora()}] gh falló: ${e.message.split('\n')[0]}`);
    return;
  }
  for (const pr of prs) {
    if (pr.isDraft || revisadas[pr.number] === pr.headRefOid) continue;
    if (!esColaborador(pr.author.login)) {
      console.log(`[${hora()}] #${pr.number} ignorada: @${pr.author.login} no es colaborador`);
      marcar(pr);
      continue;
    }
    const checks = gh('pr', 'checks', String(pr.number), '--json', 'name,bucket');
    if (!checks.length || checks.some((c) => c.bucket === 'pending')) {
      console.log(`[${hora()}] #${pr.number} espera a la CI`);
      continue;
    }
    console.log(`[${hora()}] revisando #${pr.number} «${pr.title}» de @${pr.author.login}`);
    const r = spawnSync(CLAUDE, ['-p'], {
      cwd: RAIZ, encoding: 'utf8', shell: process.platform === 'win32', timeout: 10 * 60 * 1000,
      input: `/revisar-pr ${pr.number}${SOLO_COMENTAR ? ' --solo-comentar' : ''}`,
    });
    console.log((r.stdout || '').trim() || (r.stderr || '').trim());
    if (r.status === 0) marcar(pr);
  }
}

console.log(`Vigilando PR de colaboradores de ${REPO} contra dev cada ${CADA} s${SOLO_COMENTAR ? ' (solo comentar, sin aprobar)' : ''}. Ctrl+C para parar.`);
vuelta();
setInterval(vuelta, CADA * 1000);
