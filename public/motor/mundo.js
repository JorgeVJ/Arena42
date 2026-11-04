// Mundo: estado y reglas de la partida. No usa el DOM: el validador lo ejecuta en Node.
import { leerMapa, TIPOS } from './mapa.js';

export const CASILLA = 32;
export const CONSTANTES = { gravedad: 2000, velocidad: 260, salto: 720, caidaMaxima: 1100 };
export const ENTRADA_VACIA = Object.freeze({ izq: false, der: false, arriba: false, abajo: false, saltar: false, saltarMantenido: false, habilidad: false, disparar: false });
const MODS_BASE = { velocidad: 1, salto: 1, gravedad: 1, saltosExtra: 0, inmune: false, dano: 1 };
const C = CASILLA;
const MAX_PARTICULAS = 400;
const ENFRIAMIENTO_DISPARO = 0.35;
const INVULNERABLE_TRAS_GOLPE = 0.6;
const VUELVE_EN = 20;

export class Mundo {
  constructor(registro, textoMapa) {
    this.piezas = {};
    this.claves = new Map();
    for (const tipo of TIPOS) {
      this.piezas[tipo] = {};
      for (const p of registro[tipo] || []) {
        this.piezas[tipo][p.nombre] = p;
        this.claves.set(p, `${tipo}/${p.nombre}`);
      }
    }
    this.casillasPorCaracter = Object.fromEntries(Object.values(this.piezas.casillas).map((p) => [p.caracter, p]));
    this.mapa = leerMapa(textoMapa, Object.keys(this.casillasPorCaracter));
    if (this.mapa.errores.length) throw new Error(`Mapa inválido: ${this.mapa.errores.join('; ')}`);
    this.CASILLA = C;
    this.constantes = CONSTANTES;
    this.tiempo = 0;
    this.jugadores = new Map();
    this.proyectiles = [];
    this.powerups = new Map();
    this.particulas = [];
    this.errores = [];
    this.rotas = new Set();
    this.medidas = {};
    this.avisados = new Set();
    this.red = {};
    this.sigProyectil = 0;
    this.ultimoAnuncio = -99;
  }

  iniciar() {
    for (const l of Object.values(this.piezas.libre)) this.llamar(l, 'montar', this);
  }

  // Toda llamada a una pieza pasa por aquí: si falla, se desactiva y no tumba la partida.
  llamar(pieza, metodo, ...args) {
    if (!pieza || typeof pieza[metodo] !== 'function' || this.rotas.has(pieza)) return undefined;
    const clave = this.claves.get(pieza) || pieza.nombre;
    const t0 = performance.now();
    try {
      return pieza[metodo](...args);
    } catch (e) {
      this.rotas.add(pieza);
      this.errores.push({ pieza: clave, metodo, mensaje: String(e?.message ?? e) });
      return undefined;
    } finally {
      this.medidas[clave] = (this.medidas[clave] || 0) + performance.now() - t0;
    }
  }

  avisar(pieza, mensaje) {
    const clave = `${this.claves.get(pieza)}: ${mensaje}`;
    if (this.avisados.has(clave)) return;
    this.avisados.add(clave);
    this.errores.push({ pieza: this.claves.get(pieza), metodo: 'actualizar', mensaje, aviso: true });
  }

  // ---------- jugadores ----------

  crearJugador({ id, login, color, local }) {
    const j = {
      id, login, color, local: !!local, x: 0, y: 0, vx: 0, vy: 0, ancho: 22, alto: 30, mira: 1,
      enSuelo: false, chocoPared: false, estado: 'en-el-aire', tEstado: 0, vida: 3, mods: { ...MODS_BASE },
      powerups: [], enfriamientos: {}, saltosExtraUsados: 0, datos: {}, efecto: {}, ultimoGolpe: -99,
      habilidad: null, proyectil: null, rastro: [], tParticula: 0,
    };
    this.colocarEnSalida(j);
    this.jugadores.set(id, j);
    return j;
  }

  colocarEnSalida(j) {
    const s = this.mapa.salidas[Math.floor(Math.random() * this.mapa.salidas.length)];
    j.x = s.cx * C + (C - j.ancho) / 2;
    j.y = s.cy * C + C - j.alto;
    j.vx = 0;
    j.vy = 0;
  }

  reaparecer(j) {
    this.colocarEnSalida(j);
    j.vida = 3;
    j.powerups = [];
    this.cambiarEstado(j, 'en-el-aire');
  }

  cambiarEstado(j, nombre) {
    const nuevo = this.piezas.estados[nombre];
    if (!nuevo) return false;
    this.llamar(this.piezas.estados[j.estado], 'salir', j, this);
    j.estado = nombre;
    j.tEstado = 0;
    this.llamar(nuevo, 'entrar', j, this);
    return true;
  }

  paso(dt, entradas = new Map()) {
    dt = Math.min(dt, 1 / 30);
    this.tiempo += dt;
    for (const j of this.jugadores.values()) {
      if (j.local) this.pasoJugador(j, dt, entradas.get(j.id) || ENTRADA_VACIA);
      else if (this.tiempo - (j.tRed ?? 0) < 0.3) { j.x += j.vx * dt; j.y += j.vy * dt; }
      j.rastro.unshift({ x: j.x, y: j.y });
      j.rastro.length = Math.min(j.rastro.length, 6);
      const tipo = j.efecto?.particulas;
      if (tipo && (j.tParticula -= dt) <= 0) {
        j.tParticula = 0.05;
        this.emitir(tipo, j.x + Math.random() * j.ancho, j.y + Math.random() * j.alto, 1, j.efecto.tinte || j.color);
      }
    }
    this.pasoProyectiles(dt);
    for (const l of Object.values(this.piezas.libre)) this.llamar(l, 'actualizar', dt, this);
    this.pasoParticulas(dt);
  }

  pasoJugador(j, dt, e) {
    // Power-ups: cada uno decora las estadísticas base (Decorator).
    j.mods = { ...MODS_BASE };
    j.powerups = j.powerups.filter((pu) => {
      const p = this.piezas.powerups[pu.nombre];
      if (!p) return false;
      pu.restante -= dt;
      if (pu.restante <= 0) { this.llamar(p, 'alTerminar', j, this); return false; }
      this.llamar(p, 'aplicar', j.mods, j, this);
      return true;
    });

    if (e.izq && !e.der) j.mira = -1;
    else if (e.der && !e.izq) j.mira = 1;

    if (!this.piezas.estados[j.estado]) this.cambiarEstado(j, 'en-el-aire');

    // Estados que declaran por sí mismos cuándo se entra en ellos.
    for (const est of Object.values(this.piezas.estados)) {
      if (est.nombre === j.estado || !Array.isArray(est.desde) || typeof est.cuando !== 'function') continue;
      if ((est.desde.includes(j.estado) || est.desde.includes('*')) && this.llamar(est, 'cuando', j, e, this)) {
        this.cambiarEstado(j, est.nombre);
        break;
      }
    }

    const actual = this.piezas.estados[j.estado];
    const sig = this.llamar(actual, 'actualizar', j, dt, e, this);
    if (sig && sig !== j.estado) {
      if (actual.transiciones?.includes(sig) && this.piezas.estados[sig]) this.cambiarEstado(j, sig);
      else this.avisar(actual, `devolvió «${sig}», que no está en sus transiciones o no existe`);
    }
    j.tEstado += dt;

    this.fisica(j, dt);

    if (e.habilidad && j.habilidad) {
      const h = this.piezas.habilidades[j.habilidad];
      if (h && (j.enfriamientos[h.nombre] ?? 0) <= this.tiempo) {
        j.enfriamientos[h.nombre] = this.tiempo + h.enfriamiento;
        this.llamar(h, 'usar', j, this);
      }
    }
    if (e.disparar && j.proyectil && (j.enfriamientos['@disparo'] ?? 0) <= this.tiempo) {
      j.enfriamientos['@disparo'] = this.tiempo + ENFRIAMIENTO_DISPARO;
      this.disparar(j, j.proyectil);
    }

    for (const pu of this.powerups.values()) {
      if (!pu.pedido && pu.x > j.x - 12 && pu.x < j.x + j.ancho + 12 && pu.y > j.y - 12 && pu.y < j.y + j.alto + 12) {
        pu.pedido = true;
        if (this.red.recoger) this.red.recoger(pu.id);
        else { this.powerups.delete(pu.id); this.darPowerup(j, pu.nombre); }
      }
    }

    j.efecto = this.efectoDe(j);
    if (j.y > this.mapa.alto * C + 200) this.reaparecer(j);
  }

  efectoDe(j) {
    const efecto = { ...(this.piezas.estados[j.estado]?.efecto || {}) };
    for (const pu of j.powerups) Object.assign(efecto, this.piezas.powerups[pu.nombre]?.efecto || {});
    if (this.tiempo - j.ultimoGolpe < INVULNERABLE_TRAS_GOLPE) efecto.parpadeo = true;
    return efecto;
  }

  // ---------- física ----------

  casilla(cx, cy) {
    if (cy < 0 || cy >= this.mapa.alto || cx < 0 || cx >= this.mapa.ancho) return '1';
    return this.mapa.filas[cy][cx];
  }

  esSolida(cx, cy) {
    const c = this.casilla(cx, cy);
    if (c === '1') return true;
    if (c === '0' || c === 'P') return false;
    return !!this.casillasPorCaracter[c]?.solida;
  }

  // La caja ocupa [x, x + w) × [y, y + h): un pie que se hunde una fracción de píxel ya toca el suelo.
  chocaRect(x, y, w, h) {
    for (let cy = Math.floor(y / C); cy <= Math.ceil((y + h) / C) - 1; cy++)
      for (let cx = Math.floor(x / C); cx <= Math.ceil((x + w) / C) - 1; cx++)
        if (this.esSolida(cx, cy)) return true;
    return false;
  }

  fisica(j, dt) {
    j.vy = Math.min(j.vy + CONSTANTES.gravedad * j.mods.gravedad * dt, CONSTANTES.caidaMaxima);

    j.chocoPared = false;
    if (j.vx !== 0) {
      const nx = j.x + j.vx * dt;
      if (this.chocaRect(nx, j.y, j.ancho, j.alto)) {
        j.x = j.vx > 0 ? (Math.ceil((nx + j.ancho) / C) - 1) * C - j.ancho : (Math.floor(nx / C) + 1) * C;
        j.vx = 0;
        j.chocoPared = true;
      } else j.x = nx;
    }

    const estabaEnSuelo = j.enSuelo;
    j.enSuelo = false;
    const ny = j.y + j.vy * dt;
    if (this.chocaRect(j.x, ny, j.ancho, j.alto)) {
      if (j.vy > 0) {
        j.y = (Math.ceil((ny + j.alto) / C) - 1) * C - j.alto;
        j.enSuelo = true;
      } else j.y = (Math.floor(ny / C) + 1) * C;
      j.vy = 0;
    } else j.y = ny;

    if (j.enSuelo) {
      j.saltosExtraUsados = 0;
      if (!estabaEnSuelo) {
        const c = this.casilla(Math.floor((j.x + j.ancho / 2) / C), Math.floor((j.y + j.alto + 1) / C));
        const p = this.casillasPorCaracter[c];
        if (p) this.llamar(p, 'alPisar', j, this);
      }
    }
  }

  // ---------- API para las piezas ----------

  moverHorizontal(j, e, factor = 1) {
    const dir = (e.der ? 1 : 0) - (e.izq ? 1 : 0);
    j.vx = dir * CONSTANTES.velocidad * j.mods.velocidad * factor;
  }

  saltar(j, factor = 1) {
    j.vy = -CONSTANTES.salto * j.mods.salto * factor;
    j.enSuelo = false;
  }

  empujar(j, vx, vy) {
    j.vx = vx;
    j.vy = vy;
    j.enSuelo = false;
    if (j.estado !== 'en-el-aire') this.cambiarEstado(j, 'en-el-aire');
  }

  disparar(j, nombre, opciones = {}) {
    const p = this.piezas.proyectiles[nombre];
    if (!p) return null;
    const radio = p.radio ?? 6;
    const pr = {
      pid: `${j.id}-${this.sigProyectil++}`, nombre, de: j.id, radio, vida: p.vida ?? 2,
      x: j.x + j.ancho / 2 + j.mira * (j.ancho / 2 + radio + 2), y: j.y + j.alto * 0.4,
      vx: opciones.vx ?? j.mira * p.velocidad, vy: opciones.vy ?? 0, datos: {},
    };
    this.proyectiles.push(pr);
    this.red.disparo?.(pr);
    return pr;
  }

  recibirProyectil(pr) {
    this.proyectiles.push({ ...pr, datos: {} });
  }

  quitarProyectil(pid) {
    this.proyectiles = this.proyectiles.filter((p) => p.pid !== pid);
  }

  pasoProyectiles(dt) {
    this.proyectiles = this.proyectiles.filter((pr) => {
      const p = this.piezas.proyectiles[pr.nombre];
      if (!p || (pr.vida -= dt) <= 0) return false;
      if (typeof p.mover === 'function') this.llamar(p, 'mover', pr, dt, this);
      else {
        if (p.gravedad) pr.vy += CONSTANTES.gravedad * p.gravedad * dt;
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
      }
      const cx = Math.floor(pr.x / C), cy = Math.floor(pr.y / C);
      if (this.esSolida(cx, cy)) {
        const r = this.llamar(p, 'alChocarMuro', pr, { cx, cy, c: this.casilla(cx, cy) }, this) ?? 'destruir';
        if (r === 'rebotar') {
          pr.x -= pr.vx * dt;
          pr.y -= pr.vy * dt;
          if (this.esSolida(Math.floor((pr.x + pr.vx * dt) / C), Math.floor(pr.y / C))) pr.vx = -pr.vx;
          else pr.vy = -pr.vy;
        } else if (r !== 'atravesar') {
          this.emitir('chispas', pr.x, pr.y, 6, p.color);
          return false;
        }
      }
      for (const j of this.jugadores.values()) {
        if (!j.local || j.id === pr.de) continue;
        const r = pr.radio;
        if (pr.x + r > j.x && pr.x - r < j.x + j.ancho && pr.y + r > j.y && pr.y - r < j.y + j.alto) {
          const dano = typeof p.alImpactar === 'function' ? this.llamar(p, 'alImpactar', j, pr, this) : this.danar(j, 1, pr.de);
          this.red.golpe?.(pr.pid, pr.de, !!dano);
          return false;
        }
      }
      return true;
    });
  }

  danar(j, n = 1, deId = null) {
    if (!j?.local || j.mods.inmune || this.tiempo - j.ultimoGolpe < INVULNERABLE_TRAS_GOLPE) return false;
    j.vida -= Math.max(0, n);
    j.ultimoGolpe = this.tiempo;
    this.emitir('chispas', j.x + j.ancho / 2, j.y + j.alto / 2, 12, '#ff5a5a');
    if (j.vida <= 0) {
      const de = deId && this.jugadores.get(deId);
      this.anunciar(de ? `${j.login} cae ante ${de.login}` : `${j.login} cae`, true);
      this.reaparecer(j);
    }
    return true;
  }

  darPowerup(j, nombre) {
    const p = this.piezas.powerups[nombre];
    if (!p) return;
    j.powerups = j.powerups.filter((pu) => pu.nombre !== nombre);
    j.powerups.push({ nombre, restante: p.duracion });
    this.llamar(p, 'alRecoger', j, this);
  }

  agregarPowerup(pu) { this.powerups.set(pu.id, { ...pu }); }
  quitarPowerup(id) { this.powerups.delete(id); }

  romper(cx, cy) {
    if (cx <= 0 || cy <= 0 || cx >= this.mapa.ancho - 1 || cy >= this.mapa.alto - 1) return false;
    const c = this.casilla(cx, cy);
    if (c !== '1' && !this.casillasPorCaracter[c]?.rompible) return false;
    this.ponerCasilla(cx, cy, '0');
    this.red.mapa?.(cx, cy, '0', c);
    return true;
  }

  colocar(cx, cy, caracter) {
    if (cx <= 0 || cy <= 0 || cx >= this.mapa.ancho - 1 || cy >= this.mapa.alto - 1) return false;
    if (this.casilla(cx, cy) !== '0' || (caracter !== '1' && !this.casillasPorCaracter[caracter])) return false;
    for (const j of this.jugadores.values())
      if (j.x < (cx + 1) * C && j.x + j.ancho > cx * C && j.y < (cy + 1) * C && j.y + j.alto > cy * C) return false;
    this.ponerCasilla(cx, cy, caracter);
    this.red.mapa?.(cx, cy, caracter, '0');
    return true;
  }

  // Cambio de casilla que llega por la red (o propio). Sin red, se deshace aquí.
  ponerCasilla(cx, cy, c) {
    const antes = this.mapa.filas[cy][cx];
    this.mapa.filas[cy][cx] = c;
    if (c === '0') this.emitir('humo', cx * C + C / 2, cy * C + C / 2, 14, '#4a4170');
    if (!this.red.mapa && this.mapa.originales[cy][cx] === antes) {
      const t = this.tiempo + VUELVE_EN;
      (this.pendientes ??= []).push({ t, cx, cy, c: antes });
    }
  }

  casillaEn(x, y) {
    const cx = Math.floor(x / C), cy = Math.floor(y / C);
    return { cx, cy, c: this.casilla(cx, cy) };
  }

  otros(j) { return [...this.jugadores.values()].filter((o) => o !== j); }

  cerca(j, radio) {
    const x = j.x + j.ancho / 2, y = j.y + j.alto / 2;
    return this.otros(j).filter((o) => Math.hypot(o.x + o.ancho / 2 - x, o.y + o.alto / 2 - y) < radio);
  }

  emitir(tipo, x, y, n = 8, color = '#ffffff') {
    n = Math.min(Math.max(0, n | 0), 30);
    for (let i = 0; i < n && this.particulas.length < MAX_PARTICULAS; i++) {
      const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 140;
      this.particulas.push({ tipo, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (tipo === 'burbujas' || tipo === 'humo' ? 80 : 0), vida: 0.6 + Math.random() * 0.4, color });
    }
  }

  pasoParticulas(dt) {
    for (const p of this.particulas) {
      p.vida -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.tipo === 'chispas' || p.tipo === 'estrellas') p.vy += 400 * dt;
    }
    this.particulas = this.particulas.filter((p) => p.vida > 0);
    if (this.pendientes?.length) {
      for (const v of this.pendientes.filter((v) => v.t <= this.tiempo)) this.mapa.filas[v.cy][v.cx] = v.c;
      this.pendientes = this.pendientes.filter((v) => v.t > this.tiempo);
    }
  }

  anunciar(texto, motor = false) {
    if (!motor && this.tiempo - this.ultimoAnuncio < 1) return;
    if (!motor) this.ultimoAnuncio = this.tiempo;
    this.red.anuncio?.(String(texto).slice(0, 80));
  }
}
