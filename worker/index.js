// Worker: sirve el juego (public/) y enruta /ws a la sala de la partida.
import { DurableObject } from 'cloudflare:workers';

const VUELVE_EN_MS = 20000;
const MAX_POWERUPS = 4;
// Límite por conexión (cubo de fichas): quien lo supera queda fuera. Un cliente normal envía ~10/s.
const FICHAS_POR_S = 30;
const RAFAGA = 60;
const MAX_BYTES = 4096;
// Mensajes que solo cuentan si vienen de alguien que está jugando la ronda.
const DE_JUGADOR = new Set(['estado', 'disparo', 'golpe', 'mapa', 'nuevoPowerup', 'recoger', 'anuncio']);

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      const sala = (url.searchParams.get('sala') || 'taller').slice(0, 40);
      const permitidas = (env.SALAS || '').split(',').map((s) => s.trim()).filter(Boolean);
      if (permitidas.length && !permitidas.includes(sala)) return new Response('Sala desconocida', { status: 404 });
      return env.SALA.get(env.SALA.idFromName(sala)).fetch(req);
    }
    return env.ASSETS.fetch(req);
  },
};

// Una sala por partida: reparte lo que envía cada jugador y arbitra lo compartido
// (quién juega cada ronda, power-ups, cambios del mapa, puntos). La física la simula cada navegador.
export class Sala extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.maxJugadores = Number(env.MAX_JUGADORES) || 10;
    this.rondaS = Number(env.RONDA_S) || 180;
    this.conexiones = new Map();
    this.enJuego = new Set();
    this.espera = [];
    this.ronda = { numero: 0, fin: 0 };
    this.temporizador = null;
    this.cambiosMapa = {};
    this.powerups = new Map();
    this.puntos = {};
    this.puntosRonda = {};
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
    const info = { id: `j${this.sigId++}`, login: null, color: null, espectador: true, fichas: RAFAGA, ultima: Date.now() };
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
    const nuevo = [...this.enJuego][0]?.id ?? null;
    if (nuevo !== this.anfitrion) {
      this.anfitrion = nuevo;
      this.difundir({ t: 'anfitrion', id: nuevo });
    }
  }

  alFeed(texto) {
    this.feed = [...this.feed, { texto, hora: Date.now() }].slice(-8);
    this.difundir({ t: 'feed', feed: this.feed });
  }

  // ---------- rondas ----------

  estadoRonda() {
    return {
      numero: this.ronda.numero,
      quedan: Math.max(0, (this.ronda.fin - Date.now()) / 1000),
      jugadores: [...this.enJuego].map((i) => i.id),
      cola: this.espera.map((i) => ({ id: i.id, login: i.login })),
    };
  }

  difundirRonda() {
    this.difundir({ t: 'ronda', ...this.estadoRonda() });
  }

  quiereJugar(info) {
    if (this.enJuego.size < this.maxJugadores) this.enJuego.add(info);
    else this.espera.push(info);
    if (!this.temporizador) this.empezarRonda();
    else this.difundirRonda();
    this.elegirAnfitrion();
  }

  empezarRonda() {
    this.ronda = { numero: this.ronda.numero + 1, fin: Date.now() + this.rondaS * 1000 };
    this.puntosRonda = {};
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.acabarRonda(), this.rondaS * 1000);
    this.difundirRonda();
  }

  // Los que jugaron pasan al final de la cola y entran los primeros que esperaban.
  acabarRonda() {
    this.temporizador = null;
    const [ganador, n] = Object.entries(this.puntosRonda).sort((a, b) => b[1] - a[1])[0] ?? [];
    this.alFeed(ganador ? `Ronda ${this.ronda.numero}: gana ${ganador} con ${n}` : `Fin de la ronda ${this.ronda.numero}`);
    if (!this.enJuego.size) return;
    if (this.espera.length) {
      const salen = [...this.enJuego];
      const turno = [...this.espera, ...salen];
      this.enJuego = new Set(turno.slice(0, this.maxJugadores));
      this.espera = turno.slice(this.maxJugadores);
      for (const i of salen) if (!this.enJuego.has(i)) this.difundir({ t: 'sale', id: i.id });
      this.alFeed(`Entran: ${[...this.enJuego].filter((i) => !salen.includes(i)).map((i) => i.login).join(', ')}`);
    }
    this.empezarRonda();
    this.elegirAnfitrion();
  }

  // ---------- mensajes ----------

  // Repone fichas según el tiempo pasado; sin fichas o con un mensaje enorme, se corta la conexión.
  dentroDelLimite(ws, info, datos) {
    const ahora = Date.now();
    info.fichas = Math.min(RAFAGA, info.fichas + ((ahora - info.ultima) / 1000) * FICHAS_POR_S);
    info.ultima = ahora;
    if (info.fichas >= 1 && String(datos).length <= MAX_BYTES) {
      info.fichas--;
      return true;
    }
    try { ws.close(1008, 'demasiados mensajes'); } catch {}
    this.salir(ws, info);
    return false;
  }

  mensaje(ws, info, datos) {
    if (!this.dentroDelLimite(ws, info, datos)) return;
    let m;
    try { m = JSON.parse(datos); } catch { return; }
    if (DE_JUGADOR.has(m.t) && !this.enJuego.has(info)) return;
    switch (m.t) {
      case 'hola':
        if (info.login) break;
        info.login = String(m.login || 'anónimo').slice(0, 20);
        info.color = /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#3fa7d6';
        info.espectador = !!m.espectador;
        this.mapa ??= /^[a-z0-9-]+\.ber$/.test(m.mapa) ? m.mapa : 'arena-01.ber';
        this.enviar(ws, { t: 'bienvenida', id: info.id, mapa: this.mapa, cambiosMapa: this.cambiosMapa, powerups: [...this.powerups.values()], puntos: this.puntos, feed: this.feed, anfitrion: this.anfitrion, ronda: this.estadoRonda() });
        if (!info.espectador) {
          this.quiereJugar(info);
          this.alFeed(`${info.login} entra en la arena`);
        }
        break;
      case 'estado':
        this.difundir({ ...m, id: info.id, login: info.login, color: info.color }, ws);
        break;
      case 'disparo':
        this.difundir({ t: 'disparo', p: { ...m.p, de: info.id } }, ws);
        break;
      case 'golpe': {
        this.difundir({ t: 'golpe', pid: m.pid }, ws);
        const autor = [...this.conexiones.values()].find((i) => i.id === m.de);
        if (m.dano && autor && autor !== info) {
          this.puntos[autor.login] = (this.puntos[autor.login] || 0) + 1;
          this.puntosRonda[autor.login] = (this.puntosRonda[autor.login] || 0) + 1;
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

  // Si sale alguien que jugaba, su hueco lo ocupa el primero de la cola.
  salir(ws, info) {
    if (!this.conexiones.delete(ws)) return;
    this.difundir({ t: 'sale', id: info.id });
    if (info.login && !info.espectador) this.alFeed(`${info.login} sale`);
    const jugaba = this.enJuego.delete(info);
    this.espera = this.espera.filter((i) => i !== info);
    if (jugaba && this.espera.length) this.enJuego.add(this.espera.shift());
    if (!this.enJuego.size) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }
    if (info.login && !info.espectador) this.difundirRonda();
    this.elegirAnfitrion();
  }
}
