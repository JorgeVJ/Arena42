# Arena 42

Arena multijugador de plataformas para el taller de GitHub de 42 Madrid. Cada estudiante programa una pieza (un estado, una habilidad, un power-up…) y, cuando su PR entra en `dev`, aparece en la partida del proyector.

- Qué es una pieza y qué reglas cumple: [SPEC.md](SPEC.md).
- Tareas para empezar: el tablero del taller en 42Teams, que sale de [backlog/issues.md](backlog/issues.md). El título de la PR empieza por el id de la tarjeta (`H-002 · …`).

## Jugar en local

```bash
pnpm install
pnpm dev
```

Abre `http://localhost:8787`. Desde otro ordenador de la misma red: `http://<ip-de-este-ordenador>:8787`. Un navegador en modo «Proyector» hace de espectador.

Se juega por rondas (3 min, 10 jugadores; el resto espera en cola). Salas: `?sala=taller` (por defecto) o `?sala=ensayo`. Para cambiar las rondas o aceptar cualquier sala en local, crea `.dev.vars`:

```
MAX_JUGADORES=2
RONDA_S=20
SALAS=
```

Para otro mapa: `?mapa=arena-02.ber` (lo fija el primero que entra en la sala).

## Antes de abrir una PR

```bash
pnpm validar
```

Comprueba las reglas de la PR frente a `dev`, el contrato de cada pieza, los mapas y una partida simulada de 900 fotogramas. Es lo mismo que ejecuta la CI.

## Para Jorge

| Qué | Cómo |
|---|---|
| Crear el repo y las reglas (una vez) | `bash scripts/configurar-github.sh JorgeVJ/Arena42` |
| Backlog a 42Teams (plantilla `arena42-taller`) | `node scripts/exportar-42teams.mjs` |
| Revisión automática durante el taller | `pnpm vigilar` (necesita la CLI `claude`; ignora las PR de quien no es colaborador) |
| Solo comentar, sin aprobar | `node scripts/vigilar-prs.mjs --solo-comentar` |
| Ensayo con agentes | `/simular-taller 3` en Claude Code, con `pnpm dev` abierto |
| Desplegar a mano | `pnpm desplegar` |

Arquitectura: `public/` es el cliente (motor en `public/motor/`, piezas en `public/piezas/`), `worker/index.js` sirve los archivos y la sala multijugador (un Durable Object por partida). `scripts/registro.mjs` genera `public/registro.js` con todas las piezas, así que nadie edita una lista compartida.
