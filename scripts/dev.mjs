// Servidor local: regenera el registro cuando cambian piezas, mapas o la rama, y arranca wrangler dev.
// Escucha en toda la red local para que otros ordenadores entren con http://<tu-ip>:8787.
import { watch, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { generarRegistro, RAIZ } from './registro.mjs';

let temporizador;
function regenerar() {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    try {
      console.log(`[registro] versión ${generarRegistro().hash}`);
    } catch (e) {
      console.error(`[registro] ${e.message}`);
    }
  }, 300);
}

regenerar();
for (const dir of ['public/piezas', 'public/mapas', 'public/motor']) watch(join(RAIZ, dir), { recursive: true }, regenerar);
const head = join(RAIZ, '.git', 'logs', 'HEAD');
if (existsSync(head)) watch(head, regenerar);

const puerto = process.env.PUERTO || '8787';
spawn('pnpm', ['exec', 'wrangler', 'dev', '--ip', '0.0.0.0', '--port', puerto], { cwd: RAIZ, stdio: 'inherit', shell: true });
