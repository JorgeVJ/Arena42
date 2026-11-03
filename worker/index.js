// Worker: sirve el juego (public/) y enruta /ws a la sala de la partida.
import { DurableObject } from 'cloudflare:workers';

const VUELVE_EN_MS = 20000;
const MAX_POWERUPS = 4;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      const sala = (url.searchParams.get('sala') || 'taller').slice(0, 40);
      return env.SALA.get(env.SALA.idFromName(sala)).fetch(req);
    }
    return env.ASSETS.fetch(req);
  },
};

// Una sala por partida: reparte lo que envía cada jugador y arbitra lo compartido
// (power-ups, cambios del mapa, puntos). La física la simula cada navegador.
export class Sala extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.conexiones = new Map();
    this.cambiosMapa = {};
    this.powerups = new Map();
    this.puntos = {};
    this.feed = [];
    this.mapa = null;
    this.anfitrion = null;
    this.sigId = 1;
    this.sigPowerup = 1;
  }

  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Se esperaba un WebSocket', { status: 426 });
    const [cliente, servidor] = Object.values(new WebSocketPair());
    servidor.accept();
    const info = { id: `j${this.sigId++}`, login: null, color: null, espectador: true };
    this.conexiones.set(servidor, info);
    servidor.addEventListener('message', (e) => this.mensaje(servidor, info, e.data));
    servidor.addEventListener('close', () => this.salir(servidor, info));
    servidor.addEventListener('error', () => this.salir(servidor, info));
    return new Response(null, { status: 101, webSocket: cliente });
  }

  enviar(ws, m) {
    try { ws.send(JSON.stringify(m)); } catch {}
  }

  difundir(m, excepto = null) {
    const texto = JSON.stringify(m);
    for (const ws of this.conexiones.keys()) if (ws !== excepto) try { ws.send(texto); } catch {}
  }

  elegirAnfitrion() {
    const primero = [...this.conexiones.values()].find((i) => i.login && !i.espectador);
    const nuevo = primero?.id ?? null;
    if (nuevo !== this.anfitrion) {
      this.anfitrion = nuevo;
      this.difundir({ t: 'anfitrion', id: nuevo });
    }
  }

  alFeed(texto) {
    this.feed = [...this.feed, { texto, hora: Date.now() }].slice(-8);
    this.difundir({ t: 'feed', feed: this.feed });
  }

  mensaje(ws, info, datos) {
    let m;
    try { m = JSON.parse(datos); } catch { return; }
    switch (m.t) {
      case 'hola':
        info.login = String(m.login || 'anónimo').slice(0, 20);
        info.color = /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#3fa7d6';
        info.espectador = !!m.espectador;
        this.mapa ??= /^[a-z0-9-]+\.ber$/.test(m.mapa) ? m.mapa : 'arena-01.ber';
        this.enviar(ws, { t: 'bienvenida', id: info.id, mapa: this.mapa, cambiosMapa: this.cambiosMapa, powerups: [...this.powerups.values()], puntos: this.puntos, feed: this.feed, anfitrion: this.anfitrion });
        this.elegirAnfitrion();
        if (!info.espectador) this.alFeed(`${info.login} entra en la arena`);
        break;
      case 'estado':
        if (!info.espectador) this.difundir({ ...m, id: info.id, login: info.login, color: info.color }, ws);
        break;
      case 'disparo':
        this.difundir({ t: 'disparo', p: { ...m.p, de: info.id } }, ws);
        break;
      case 'golpe': {
        this.difundir({ t: 'golpe', pid: m.pid }, ws);
        const autor = [...this.conexiones.values()].find((i) => i.id === m.de);
        if (m.dano && autor && autor !== info) {
          this.puntos[autor.login] = (this.puntos[autor.login] || 0) + 1;
          this.difundir({ t: 'puntos', puntos: this.puntos });
        }
        break;
      }
      case 'mapa': {
        const clave = `${m.cx},${m.cy}`;
        this.cambiosMapa[clave] = m.c;
        this.difundir({ t: 'mapa', cx: m.cx, cy: m.cy, c: m.c }, ws);
        setTimeout(() => {
          if (this.cambiosMapa[clave] !== m.c) return;
          delete this.cambiosMapa[clave];
          this.difundir({ t: 'mapa', cx: m.cx, cy: m.cy, c: m.antes });
        }, VUELVE_EN_MS);
        break;
      }
      case 'nuevoPowerup': {
        if (info.id !== this.anfitrion || this.powerups.size >= MAX_POWERUPS) break;
        const p = { id: this.sigPowerup++, nombre: String(m.nombre).slice(0, 40), x: +m.x, y: +m.y };
        this.powerups.set(p.id, p);
        this.difundir({ t: 'powerup', p });
        break;
      }
      case 'recoger': {
        const p = this.powerups.get(m.id);
        if (!p) break;
        this.powerups.delete(m.id);
        this.difundir({ t: 'recogido', id: m.id, nombre: p.nombre, por: info.id });
        this.alFeed(`${info.login} coge ${p.nombre}`);
        break;
      }
      case 'anuncio':
        this.alFeed(String(m.texto).slice(0, 80));
        break;
    }
  }

  salir(ws, info) {
    if (!this.conexiones.delete(ws)) return;
    this.difundir({ t: 'sale', id: info.id });
    if (info.login && !info.espectador) this.alFeed(`${info.login} sale`);
    this.elegirAnfitrion();
  }
}
