# Arena 42 — especificación

Arena multijugador de plataformas que se programa entre todos durante el taller de GitHub. Parte de la idea de so_long (mapa `.ber`), pero no es el proyecto evaluable: aquí se vale romper paredes.

Cada aportación es **una pieza**: un archivo en una carpeta de `public/piezas/`. El motor descubre las piezas solo (nadie edita listas), la CI comprueba que cumplen su contrato y, al hacer merge en `dev`, la partida del proyector las carga.

## 1. Reglas comunes (las comprueba la CI)

1. **Una PR, una pieza.** Una PR añade o modifica **un** archivo de `public/piezas/<tipo>/` o `public/mapas/`. Puede añadir hasta 2 archivos en `public/assets/` (máx. 200 KB cada uno). Nada fuera de esas carpetas.
2. **No se borra ni se renombra** nada. Solo puedes modificar una pieza cuyo `autor` seas tú.
3. **Nombre = archivo.** `nombre` en kebab-case (`rompe-muros`) e igual al nombre del archivo (`rompe-muros.js`). Único dentro de su tipo.
4. **`autor`** con tu login de GitHub: `'@login'`.
5. **Solo la API del juego.** La pieza habla con el juego a través de `j` (jugador), `mundo` y `lienzo`. Prohibido: `import`, `require`, `fetch`, `XMLHttpRequest`, `WebSocket`, `document`, `window`, `globalThis`, `self`, `eval`, `Function`, `setTimeout`, `setInterval`, `requestAnimationFrame`, `localStorage`, `sessionStorage`, `indexedDB`, `navigator`, `location`, `process`. Tu código se ejecuta en el navegador de todos los jugadores.
6. **Sin errores ni lentitud.** La CI juega 900 fotogramas con 4 bots que usan todas las piezas. Si tu pieza lanza una excepción, o gasta más de 1 ms de media por fotograma, la PR falla. En partida, una pieza que falla se desactiva sola y aparece en el panel como «pieza rota».
7. **Límites de equilibrio:** `enfriamiento` ≥ 0,3 s · `duracion` de power-up ≤ 15 s · proyectil con `velocidad` ≤ 1200, `radio` ≤ 16 y `vida` ≤ 5 s · `escala` entre 0,5 y 2.

Además de la CI, revisa Claude desde la cuenta de Jorge: que la pieza haga lo que dice su tarjeta, que se entienda y que no toque campos de `j` o `mundo` que no estén en esta spec.

## 2. Tipos de pieza

Todas exportan un objeto: `export default { … }`. Lo que no se marca como obligatorio es opcional.

### `estados/` — State
El jugador siempre está en un estado. Cada fotograma el motor llama a `actualizar` del estado actual; si devuelve el nombre de otro estado, cambia a él.

| Campo | Tipo | |
|---|---|---|
| `nombre`, `autor` | texto | obligatorios |
| `etiqueta` | texto | lo que se ve sobre la cabeza; si falta, el nombre en mayúsculas |
| `efecto` | objeto | ver §3 |
| `entrar(j, mundo)` | función | al entrar |
| `actualizar(j, dt, entrada, mundo)` | función | devuelve el nombre del siguiente estado o nada |
| `salir(j, mundo)` | función | al salir |
| `transiciones` | lista | **todos** los nombres que `actualizar` puede devolver |
| `desde` | lista | estados desde los que se entra a este solo (`'*'` = cualquiera) |
| `cuando(j, entrada, mundo)` | función | con `desde`: si devuelve `true`, el motor entra aquí |

`desde` + `cuando` es la clave para **no tocar estados ajenos**: un estado nuevo declara cuándo se entra en él. Ejemplo: `agachado` declara `desde: ['quieto', 'corriendo']` y `cuando: (j, e) => e.abajo && j.enSuelo`.

Estados base (los da Jorge): `quieto`, `corriendo`, `en-el-aire`.

### `habilidades/` — Strategy
Lo que hace el jugador al pulsar **J**. Cada jugador elige su habilidad en el panel.

| Campo | Tipo | |
|---|---|---|
| `nombre`, `autor` | texto | obligatorios |
| `enfriamiento` | segundos | obligatorio, ≥ 0,3 |
| `usar(j, mundo)` | función | obligatoria; suele llamar a `mundo.cambiarEstado(j, '…')` |
| `descripcion` | texto | se ve en el selector |

### `powerups/` — Decorator
Aparecen en el mapa; quien los coge los lleva `duracion` segundos. Cada fotograma el motor parte de las estadísticas base y cada power-up activo las modifica.

| Campo | Tipo | |
|---|---|---|
| `nombre`, `autor`, `color` | texto | obligatorios |
| `duracion` | segundos | obligatorio, ≤ 15 |
| `aplicar(mods, j, mundo)` | función | obligatoria; modifica `mods` (ver §4) |
| `efecto` | objeto | ver §3 |
| `alRecoger(j, mundo)`, `alTerminar(j, mundo)` | función | |

### `proyectiles/` — Strategy
Lo que dispara el jugador con **K**. Cada jugador elige su proyectil en el panel.

| Campo | Tipo | |
|---|---|---|
| `nombre`, `autor`, `color` | texto | obligatorios |
| `velocidad` | px/s | obligatoria, ≤ 1200 |
| `radio` | px | ≤ 16 (6 por defecto) |
| `vida` | segundos | ≤ 5 (2 por defecto) |
| `gravedad` | número | 0 = recto, 1 = cae como el jugador |
| `mover(p, dt, mundo)` | función | sustituye al movimiento recto |
| `alChocarMuro(p, casilla, mundo)` | función | devuelve `'destruir'` (por defecto), `'rebotar'` o `'atravesar'` |
| `alImpactar(objetivo, p, mundo)` | función | por defecto `mundo.danar(objetivo, 1, p.de)`; devuelve `true` si hizo daño |

### `casillas/` — Registro de caracteres del `.ber`
| Campo | Tipo | |
|---|---|---|
| `nombre`, `autor`, `color` | texto | obligatorios |
| `caracter` | 1 carácter | obligatorio; no puede ser `0`, `1` ni `P`; único |
| `solida` | booleano | obligatorio |
| `rompible` | booleano | si `mundo.romper` puede romperla |
| `alPisar(j, mundo)` | función | cuando un jugador aterriza encima |

### `libre/` — lo que no está en el backlog
Cualquier idea que no encaje en los otros tipos: un evento que cae del cielo, un marcador nuevo, una bandera que capturar…

| Campo | Tipo | |
|---|---|---|
| `nombre`, `autor` | texto | obligatorios |
| `montar(mundo)` | función | al empezar la partida |
| `actualizar(dt, mundo)` | función | cada fotograma |
| `dibujar(lienzo, mundo)` | función | cada fotograma, encima del mapa |

Al menos una de `actualizar` o `dibujar`. Ojo: cada navegador ejecuta las piezas libres por su cuenta, así que lo aleatorio no coincide entre jugadores. Para dañar a otros, usa proyectiles (§5).

### `mapas/` — sin código
Un `.ber` con las reglas del subject de so_long: rectangular, rodeado de `1` y con al menos 2 salidas `P`. Además de `0`, `1` y `P`, admite los caracteres de `casillas/`. Visto de lado: abajo es el suelo.

### `assets/` — sin código
Un sprite o un sonido. Solo acompaña a una pieza; todo se puede hacer sin assets.

## 3. Efectos (todo paramétrico, sin imágenes)

`efecto` es un objeto que el motor sabe dibujar. Si el estado y los power-ups activos traen efecto, se combinan; si coinciden en una clave, gana el último power-up.

| Clave | Valor | Se ve como |
|---|---|---|
| `tinte` | color `#rrggbb` | el cuerpo toma ese color |
| `anillo` | color o `true` | círculo alrededor |
| `estela` | `true` | copias que se desvanecen detrás |
| `particulas` | `'chispas'`, `'humo'`, `'estrellas'`, `'burbujas'` | partículas continuas |
| `parpadeo` | `true` | el cuerpo parpadea |
| `escala` | 0,5 – 2 | tamaño del dibujo (no de la caja de colisión) |
| `transparencia` | 0,2 – 1 | opacidad |

## 4. El jugador `j` y los modificadores `mods`

Campos de `j` que una pieza puede **leer**: `id`, `login`, `color`, `x`, `y` (esquina superior izquierda, px), `ancho`, `alto`, `vx`, `vy`, `mira` (1 derecha, −1 izquierda), `enSuelo`, `chocoPared`, `estado`, `tEstado` (segundos en el estado actual), `vida`, `mods`, `ultimoGolpe`.

Puede **escribir**: `vx`, `vy`, `mira` y `j.datos`, un objeto libre para guardar lo suyo (usa claves con tu nombre: `j.datos.dashDir`).

`mods` (solo en `aplicar` de un power-up): `velocidad` (1), `salto` (1), `gravedad` (1), `saltosExtra` (0), `inmune` (false), `dano` (1).

La entrada `entrada` (solo lectura): `izq`, `der`, `arriba`, `abajo`, `saltarMantenido` (teclas mantenidas) y `saltar`, `habilidad`, `disparar` (`true` solo el fotograma en que se pulsan).

## 5. El mundo `mundo`

| Función | Qué hace |
|---|---|
| `cambiarEstado(j, nombre)` | entra en ese estado (llama a `salir` y `entrar`) |
| `moverHorizontal(j, entrada, factor = 1)` | `vx` según izquierda/derecha, `mods.velocidad` y `factor` |
| `saltar(j, factor = 1)` | salto normal multiplicado por `factor` |
| `empujar(j, vx, vy)` | lanza al jugador (pasa a `en-el-aire`) |
| `disparar(j, nombre, { vx, vy })` | dispara un proyectil; sin `vx` sale hacia donde mira |
| `danar(j, n, deId)` | quita `n` vidas; solo funciona sobre el jugador de este navegador; devuelve `true` si hizo daño |
| `darPowerup(j, nombre)` | aplica un power-up |
| `romper(cx, cy)` | rompe un muro o casilla `rompible` (no el borde); vuelve a los 20 s |
| `colocar(cx, cy, caracter)` | pone una casilla en un hueco vacío; desaparece a los 20 s |
| `casillaEn(x, y)` | `{ cx, cy, c }` de la casilla bajo el punto (px) |
| `otros(j)` | los demás jugadores |
| `cerca(j, radio)` | los demás jugadores a menos de `radio` px |
| `emitir(tipo, x, y, n, color)` | partículas puntuales (máx. 30) |
| `anunciar(texto)` | mensaje en el panel «En directo» de todos (máx. 1 por segundo) |
| `tiempo`, `constantes`, `CASILLA` | reloj (s), `{ gravedad, velocidad, salto }` y tamaño de casilla (32 px) |

`lienzo` (solo en `dibujar` de una pieza libre): `rect(x, y, w, h, color)`, `circulo(x, y, r, color)`, `linea(x1, y1, x2, y2, color, grosor)`, `texto(t, x, y, color, tam)`.

## 6. Red (para entender, no para tocar)

Cada navegador simula **su** jugador y envía posición, estado y efecto solo cuando cambian, como mucho 10 veces por segundo (y un latido cada 2 s). Una sala (Durable Object de Cloudflare) los reparte. Los proyectiles se simulan en todos los navegadores, pero solo la víctima decide si le dieron. Los power-ups los reparte la sala: quien llega primero se lo lleva. Los cambios del mapa pasan por la sala y se deshacen a los 20 s.

Se juega por rondas de 3 minutos con 10 jugadores como máximo: el resto espera en una cola mirando la partida y, al acabar la ronda, los que jugaron pasan al final. Una conexión que envía más de 30 mensajes por segundo queda fuera.

Al hacer merge en `dev`, Cloudflare redespliega. La partida detecta la versión nueva y recarga: los jugadores vuelven a entrar solos y los puntos se conservan en la sala.

## 7. Flujo de una tarea

1. Coge una tarjeta del tablero del taller en 42Teams y asígnatela.
2. `git switch dev && git pull`, luego `git switch -c feature/<nombre-de-la-pieza>`.
3. Copia la pieza de ejemplo de su carpeta, cámbiale `nombre`, `autor` y el comportamiento.
4. `pnpm dev` y prueba en `http://localhost:8787`.
5. `pnpm validar` antes de subir.
6. `git push -u origin feature/<nombre>` y abre la PR contra `dev` con el id de la tarjeta al principio del título: `H-002 · Estado «aturdido»`. Mueve la tarjeta a «En revisión».
7. La CI comenta el informe de validación. Claude revisa: aprueba o pide cambios. Si los pide, haz commit y push en la misma rama; la PR se actualiza sola.
8. Con la aprobación y la CI en verde, la PR se mergea sola (squash). En unos segundos tu pieza está en la partida del proyector. Mueve la tarjeta a «Hecho».
