// Arranque del cliente: entrada en la sala, bucle de juego, red y panel.
import registro from '../registro.js';
import { Mundo, CASILLA, ENTRADA_VACIA } from './mundo.js';
import { dibujar } from './render.js';
import { leerEntrada } from './entrada.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const SALA = params.get('sala') || 'taller';
const ENVIO_MS = 100;   // como mucho 10 envíos por segundo, y solo si algo cambió
const LATIDO_MS = 2000; // aunque no cambie nada, para que quien entra tarde vea a los quietos
const POWERUP_CADA = 8;

const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const leer = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const guardarSesion = (v) => { try { sessionStorage.setItem('arena-sesion', JSON.stringify(v)); } catch {} };
const leerSesion = () => { try { return JSON.parse(sessionStorage.getItem('arena-sesion')); } catch { return null; } };

let mundo = null, yo = null, ws = null, miId = null, anfitrion = null, version = null;
let puntos = {}, feed = [], pendientes = [];
let ronda = null, espera = [];
let sesion = null;

// ---------- entrada a la sala ----------

const previo = leer('arena-jugador') || {};
$('#login').value = previo.login || '';
$('#color').value = previo.color || '#3fa7d6';
$('#entrar').addEventListener('submit', (e) => {
  e.preventDefault();
  const espectador = e.submitter?.value === 'espectador';
  const datos = { login: $('#login').value.trim() || 'anónimo', color: $('#color').value, espectador };
  guardar('arena-jugador', datos);
  empezar(datos);
});

const anterior = leerSesion();
if (anterior) empezar(anterior);

function empezar(datos) {
  sesion = datos;
  guardarSesion(datos);
  $('#vestibulo').hidden = true;
  $('#partida').hidden = false;
  document.body.classList.toggle('espectador', datos.espectador);
  document.body.classList.toggle('esperando', !datos.espectador);
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws?sala=${encodeURIComponent(SALA)}`);
  ws.onopen = () => enviar({ t: 'hola', login: datos.login, color: datos.color, espectador: datos.espectador, mapa: params.get('mapa') || registro.mapas[0] });
  ws.onmessage = (e) => recibir(JSON.parse(e.data));
  let abierto = false;
  ws.addEventListener('open', () => { abierto = true; });
  ws.onclose = (e) => {
    $('#estado-red').textContent = !abierto ? `la sala «${SALA}» no existe`
      : e.code === 1008 ? 'expulsado por enviar demasiados mensajes · recarga la página'
      : 'desconectado · recarga la página';
  };
  vigilarVersion();
}

function enviar(m) {
  if (ws?.readyState === 1) ws.send(JSON.stringify(m));
}

// ---------- mensajes de la sala ----------

async function recibir(m) {
  if (m.t === 'bienvenida') return iniciarMundo(m);
  if (!mundo) { pendientes.push(m); return; }
  switch (m.t) {
    case 'estado': {
      let j = mundo.jugadores.get(m.id);
      if (!j) j = mundo.crearJugador({ id: m.id, login: m.login, color: m.color, local: false });
      Object.assign(j, { x: m.x, y: m.y, vx: m.vx, vy: m.vy, estado: m.estado, mira: m.mira, efecto: m.efecto || {}, vida: m.vida, login: m.login, color: m.color, habilidad: m.habilidad, tRed: mundo.tiempo });
      break;
    }
    case 'sale': mundo.jugadores.delete(m.id); break;
    case 'disparo': mundo.recibirProyectil(m.p); break;
    case 'golpe': mundo.quitarProyectil(m.pid); break;
    case 'mapa': mundo.ponerCasilla(m.cx, m.cy, m.c); break;
    case 'powerup': mundo.agregarPowerup(m.p); break;
    case 'recogido':
      mundo.quitarPowerup(m.id);
      if (yo && m.por === miId) mundo.darPowerup(yo, m.nombre);
      break;
    case 'puntos': puntos = m.puntos; break;
    case 'feed': feed = m.feed; break;
    case 'anfitrion': anfitrion = m.id; break;
    case 'ronda': aplicarRonda(m); break;
  }
}

async function iniciarMundo(m) {
  miId = m.id;
  anfitrion = m.anfitrion;
  puntos = m.puntos;
  feed = m.feed;
  const texto = await fetch(`mapas/${m.mapa}`, { cache: 'no-store' }).then((r) => r.text());
  mundo = new Mundo(registro, texto);
  for (const [k, c] of Object.entries(m.cambiosMapa)) {
    const [cx, cy] = k.split(',').map(Number);
    mundo.mapa.filas[cy][cx] = c;
  }
  for (const pu of m.powerups) mundo.agregarPowerup(pu);
  mundo.red = {
    disparo: (pr) => enviar({ t: 'disparo', p: pr }),
    golpe: (pid, de, dano) => enviar({ t: 'golpe', pid, de, dano }),
    mapa: (cx, cy, c, antes) => enviar({ t: 'mapa', cx, cy, c, antes }),
    recoger: (id) => enviar({ t: 'recoger', id }),
    anuncio: (texto) => enviar({ t: 'anuncio', texto }),
  };
  mundo.iniciar();
  aplicarRonda(m.ronda);
  const lienzo = $('#lienzo');
  lienzo.width = mundo.mapa.ancho * CASILLA;
  lienzo.height = mundo.mapa.alto * CASILLA;
  $('#mapa-nombre').textContent = m.mapa;
  for (const m of pendientes) recibir(m);
  pendientes = [];
  requestAnimationFrame(bucle);
}

// ---------- rondas: la sala decide quién juega; el resto espera mirando ----------

function aplicarRonda(r) {
  ronda = { numero: r.numero, fin: performance.now() + r.quedan * 1000 };
  espera = r.cola;
  if (sesion.espectador) return;
  const dentro = r.jugadores.includes(miId);
  if (dentro && !yo) entrarEnJuego();
  if (!dentro && yo) salirDelJuego();
}

function entrarEnJuego() {
  yo = mundo.crearJugador({ id: miId, login: sesion.login, color: sesion.color, local: true });
  montarSelectores();
  ultimoEnviado = '';
  document.body.classList.remove('esperando');
}

function salirDelJuego() {
  mundo.jugadores.delete(miId);
  yo = null;
  document.body.classList.add('esperando');
}

// ---------- bucle ----------

let anterior_t = performance.now(), ultimoEnvio = 0, ultimoEnviado = '', ultimoPanel = 0, proximoPowerup = POWERUP_CADA;

function bucle(ahora) {
  const dt = (ahora - anterior_t) / 1000;
  anterior_t = ahora;
  const entrada = yo ? leerEntrada() : ENTRADA_VACIA;
  mundo.paso(dt, yo ? new Map([[yo.id, entrada]]) : new Map());

  if (yo && ahora - ultimoEnvio > ENVIO_MS) enviarEstado(ahora);
  if (anfitrion === miId && mundo.tiempo > proximoPowerup) {
    proximoPowerup = mundo.tiempo + POWERUP_CADA;
    sembrarPowerup();
  }

  dibujar($('#lienzo').getContext('2d'), mundo, ahora / 1000);
  if (ahora - ultimoPanel > 250) { ultimoPanel = ahora; pintarPanel(); }
  requestAnimationFrame(bucle);
}

function enviarEstado(ahora) {
  const r = (n) => Math.round(n);
  const m = { t: 'estado', x: r(yo.x), y: r(yo.y), vx: r(yo.vx), vy: r(yo.vy), estado: yo.estado, mira: yo.mira, efecto: yo.efecto, vida: yo.vida, habilidad: yo.habilidad };
  const texto = JSON.stringify(m);
  if (texto === ultimoEnviado && ahora - ultimoEnvio < LATIDO_MS) return;
  ultimoEnvio = ahora;
  ultimoEnviado = texto;
  if (ws?.readyState === 1) ws.send(texto);
}

function sembrarPowerup() {
  const nombres = Object.keys(mundo.piezas.powerups);
  if (!nombres.length || mundo.powerups.size >= 3) return;
  for (let intento = 0; intento < 40; intento++) {
    const cx = 1 + Math.floor(Math.random() * (mundo.mapa.ancho - 2));
    const cy = 1 + Math.floor(Math.random() * (mundo.mapa.alto - 3));
    if (!mundo.esSolida(cx, cy) && mundo.esSolida(cx, cy + 1)) {
      const nombre = nombres[Math.floor(Math.random() * nombres.length)];
      enviar({ t: 'nuevoPowerup', nombre, x: cx * CASILLA + CASILLA / 2, y: cy * CASILLA + CASILLA / 2 });
      return;
    }
  }
}

// ---------- panel ----------

function montarSelectores() {
  const rellenar = (sel, piezas, clave) => {
    sel.innerHTML = '';
    for (const p of Object.values(piezas)) {
      const o = document.createElement('option');
      o.value = p.nombre;
      o.textContent = `${p.nombre} · ${p.autor}`;
      sel.append(o);
    }
    const guardado = leer(`arena-${clave}`);
    sel.value = guardado && piezas[guardado] ? guardado : sel.options[0]?.value ?? '';
    yo[clave] = sel.value || null;
    sel.onchange = () => { yo[clave] = sel.value; guardar(`arena-${clave}`, sel.value); sel.blur(); };
  };
  rellenar($('#habilidad'), mundo.piezas.habilidades, 'habilidad');
  rellenar($('#proyectil'), mundo.piezas.proyectiles, 'proyectil');
}

function pintarPanel() {
  const filas = [...mundo.jugadores.values()]
    .sort((a, b) => (puntos[b.login] || 0) - (puntos[a.login] || 0))
    .map((j) => `<li><i style="background:${esc(j.color)}"></i><b>${esc(j.login)}</b><span>${esc(mundo.piezas.estados[j.estado]?.etiqueta || j.estado || '')}</span><strong>${puntos[j.login] || 0}</strong></li>`);
  $('#jugadores').innerHTML = filas.join('') || '<li class="vacio">Nadie en la arena todavía</li>';
  $('#feed').innerHTML = feed.slice().reverse().map((f) => `<li>${esc(f.texto)}</li>`).join('');
  const rotas = [...new Set(mundo.errores.filter((e) => !e.aviso).map((e) => e.pieza))];
  $('#rotas').hidden = !rotas.length;
  $('#rotas-lista').textContent = rotas.join(', ');
  const piezas = Object.values(mundo.piezas).reduce((n, t) => n + Object.keys(t).length, 0);
  $('#contadores').textContent = `${mundo.jugadores.size} jugadores · ${Object.keys(mundo.piezas.estados).length} estados · ${piezas} piezas`;
  pintarRonda();
  $('#estado-red').textContent = ws?.readyState === 1 ? `sala «${SALA}»${anfitrion === miId ? ' · anfitrión' : ''}` : 'conectando…';
  if (version?.commit) {
    $('#merge-mensaje').textContent = version.commit.mensaje;
    $('#merge-detalle').textContent = `${version.commit.hash} · ${version.commit.autor}`;
  }
}

const reloj = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function pintarRonda() {
  if (!ronda) return;
  const quedan = Math.max(0, (ronda.fin - performance.now()) / 1000);
  $('#ronda').textContent = `Ronda ${ronda.numero} · ${reloj(quedan)}`;
  $('#cola').textContent = espera.length ? `En espera: ${espera.map((e) => e.login).join(', ')}` : 'Nadie en espera';
  const puesto = espera.findIndex((e) => e.id === miId) + 1;
  $('#aviso-cola').hidden = !puesto;
  if (puesto) $('#aviso-cola').textContent = `Estás en la cola · puesto ${puesto} · la próxima ronda empieza en ${reloj(quedan)}`;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- recarga al desplegar ----------

async function vigilarVersion() {
  try {
    const v = await fetch('version.json', { cache: 'no-store' }).then((r) => r.json());
    if (version && v.hash !== version.hash) { location.reload(); return; }
    version = v;
  } catch {}
  setTimeout(vigilarVersion, 4000);
}
