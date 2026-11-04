---
name: simular-taller
description: Ensayo del taller sin público — "/simular-taller", "simula el taller", "lanza estudiantes de prueba". Despliega agentes que hacen de estudiantes (cada uno coge una tarjeta H-XXX del backlog, programa su pieza en su rama y la valida) y un agente revisor que aprueba o pide cambios con los criterios de revisar-pr. Lo aprobado se fusiona en dev local y aparece en la partida de pnpm dev. Argumentos: número de estudiantes (3 por defecto) y --con-trampa.
---

# Simular el taller

Ensayo local de todo el ciclo: tarjeta → rama → pieza → validación → revisión → cambios → merge en `dev` → la partida recarga. Todo pasa en este ordenador, sin GitHub: en GitHub no se puede aprobar una PR propia, así que el flujo con PR reales se prueba con una segunda cuenta.

## Antes de empezar

- `git status` limpio y rama actual `dev` (si no existe: `git branch dev main`). Si hay cambios sin commit, para y avisa a Jorge.
- Pide a Jorge que tenga `pnpm dev` abierto y la partida en `http://localhost:8787` (mejor un navegador como espectador y otro jugando). El servidor regenera el registro cuando cambia `dev`.
- Argumentos: `N` estudiantes (3 por defecto, máx. 6). Con `--con-trampa`, uno más recibe a escondidas una tarea que incumple la spec (tocar `public/motor/mundo.js` para darse ventaja, o usar `fetch`), para ver que el revisor y el validador la paran.

## 1. Repartir tareas

Lee `backlog/issues.md` y elige N tareas cuya pieza aún no exista en `public/piezas/` (ni el mapa en `public/mapas/`). Mezcla tipos (un estado, un power-up, un proyectil…) y evita las que dependen de otra que no esté hecha (`bloqueada:`, o «congelado» sin «hielo»). Di a Jorge en una línea qué ha tocado a quién.

Para cada tarea: `slug` = nombre de la pieza, rama `feature/<slug>`, y un worktree propio para que los agentes no se pisen:

```bash
git worktree add ../Arena42-sim/<slug> -b feature/<slug> dev
```

## 2. Estudiantes (en paralelo)

Un agente por tarea (`general-purpose`, modelo `sonnet`), todos en el mismo mensaje. Brief de cada uno, con sus datos:

> Eres un estudiante de 42 en un taller de GitHub. Tu login es `sim-<slug>`. Trabajas SOLO en `<ruta absoluta del worktree>`, en la rama `feature/<slug>`: no cambies de rama, no toques otras carpetas ni hagas merge.
> Tarea (tarjeta H-XXX de backlog/issues.md): «<título>» — <texto de la tarea>.
> 1. Lee `SPEC.md` y una pieza de ejemplo del mismo tipo en `public/piezas/<tipo>/`.
> 2. Crea `public/piezas/<tipo>/<slug>.js` (o el mapa) con `autor: '@sim-<slug>'` y un comentario arriba que diga qué hace.
> 3. Ejecuta `node scripts/validar.mjs --base dev --autor sim-<slug>` en tu worktree hasta que salga en verde.
> 4. `git add` de tu archivo y `git commit -m "<tipo>: <slug>"`.
> 5. Responde con el resumen del informe y el hash del commit. Si te llegan comentarios de revisión, corrígelos, valida, haz otro commit y responde igual.

La trampa (si la hay) recibe el mismo brief con la tarea cambiada; no se lo digas al revisor.

## 3. Revisor (uno por rama terminada)

Agente nuevo (`general-purpose`), sin ver lo que dijo el estudiante. Brief:

> Revisas como Jorge en el taller de Arena 42. Lee `.claude/skills/revisar-pr/SKILL.md` y aplica sus pasos 3, 5 y 6 sobre la rama `feature/<slug>` (no hay PR: el «diff» es `git diff dev...feature/<slug>` desde `<ruta del repo>`, y la CI es ejecutar `node scripts/validar.mjs --base dev --autor sim-<slug>` dentro de `<ruta del worktree>`). No modifiques nada. Responde con `APROBAR` o `CAMBIOS`, y el texto de la revisión que dejarías en la PR.

## 4. Ciclo de cambios

- `CAMBIOS`: reenvía la revisión al estudiante (SendMessage al mismo agente) y, cuando haga commit, lanza otra revisión. Máximo 2 vueltas; si sigue sin pasar, déjala sin fusionar y apúntalo.
- `APROBAR`: pasa a 5. Fusiona de una en una, en el orden en que se aprueban.

## 5. Merge en dev

Desde la raíz del repo (rama `dev`):

```bash
git merge --squash feature/<slug>
git commit -m "H-XXX · <título de la tarea> (simulación)" --author "sim-<slug> <sim-<slug>@arena42.local>"
```

Cada commit en `dev` cambia la versión: los navegadores abiertos recargan y la pieza aparece. Di a Jorge en una línea qué acaba de entrar, para que lo busque en la partida.

## 6. Cierre

- `git worktree remove ../Arena42-sim/<slug>` y `git branch -D feature/<slug>` de todas.
- Tabla final: tarea · estudiante · vueltas de revisión · resultado (fusionada / rechazada / atascada) · qué paró el revisor o el validador.
- Las piezas fusionadas quedan en `dev`. Pregunta a Jorge si las quiere conservar o deshacer los commits de simulación (`git reset --hard <commit anterior>`, solo con su sí).
