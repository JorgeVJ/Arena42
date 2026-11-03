# Arena 42

Arena multijugador de plataformas para el taller de GitHub de 42 Madrid. Cada estudiante programa una pieza (un estado, una habilidad, un power-up…) y, cuando su PR entra en `dev`, aparece en la partida del proyector.

- Qué es una pieza y qué reglas cumple: [SPEC.md](SPEC.md).
- Tareas para empezar: [backlog/issues.md](backlog/issues.md).

## Jugar en local

```bash
npm install
npm run dev
```

Abre `http://localhost:8787`. Desde otro ordenador de la misma red: `http://<ip-de-este-ordenador>:8787`. Un navegador en modo «Proyector» hace de espectador.

Para varias partidas a la vez: `?sala=nombre`. Para otro mapa: `?mapa=arena-02.ber` (lo fija el primero que entra en la sala).

## Antes de abrir una PR

```bash
npm run validar
```

Comprueba las reglas de la PR frente a `dev`, el contrato de cada pieza, los mapas y una partida simulada de 900 fotogramas. Es lo mismo que ejecuta la CI.

## Para Jorge

| Qué | Cómo |
|---|---|
| Crear el repo y las reglas (una vez) | `bash scripts/configurar-github.sh JorgeVJ/arena42` |
| Backlog en GitHub | `node scripts/crear-issues.mjs JorgeVJ/arena42` |
| Revisión automática durante el taller | `npm run vigilar` (necesita la CLI `claude`) |
| Solo comentar, sin aprobar | `node scripts/vigilar-prs.mjs --solo-comentar` |
| Ensayo con agentes | `/simular-taller 3` en Claude Code, con `npm run dev` abierto |
| Desplegar a mano | `npm run deploy` |

Arquitectura: `public/` es el cliente (motor en `public/motor/`, piezas en `public/piezas/`), `worker/index.js` sirve los archivos y la sala multijugador (un Durable Object por partida). `scripts/registro.mjs` genera `public/registro.js` con todas las piezas, así que nadie edita una lista compartida.
