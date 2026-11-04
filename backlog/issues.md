# Backlog inicial

Cada `##` es una tarjeta del tablero del taller en 42Teams: `node scripts/exportar-42teams.mjs` la escribe como plantilla en `../42Teams`. Cada tarea cabe en unos 30 minutos y toca un solo archivo. El título de la PR empieza por el id de su tarjeta: `H-002 · Estado «aturdido»`.

Formato: `## H-XXX · Título`, una línea `etiqueta: tipo · dificultad`, opcionalmente `bloqueada: H-XXX` y `relacionada: H-XXX`, y la descripción. Los ids no se reutilizan.

## H-001 · Estado «agachado»
etiqueta: estado · fácil
Al pulsar ↓ en el suelo, el jugador se agacha: no se mueve y se dibuja más pequeño (`efecto.escala`). Entra solo con `desde` + `cuando`; vuelve a `quieto` al soltar ↓.

## H-002 · Estado «aturdido»
etiqueta: estado · fácil
Tras recibir un golpe (`mundo.tiempo - j.ultimoGolpe < 0.05`), el jugador queda 1 s sin control, con `efecto: { particulas: 'estrellas' }`. Entra desde cualquier estado (`desde: ['*']`).

## H-003 · Estado «deslizar-pared»
etiqueta: estado · medio
En el aire, pegado a una pared (`j.chocoPared`) y empujando hacia ella, cae despacio. Saltar desde aquí impulsa hacia el lado contrario.

## H-004 · Estado «congelado»
etiqueta: estado · fácil
relacionada: H-016
Lo provoca el proyectil «hielo». 1,5 s sin moverse, tinte azul claro. Pon `desde` y `cuando` según una marca que deje el proyectil en `j.datos`.

## H-005 · Habilidad «rompe-muros»
etiqueta: habilidad · medio
Rompe la casilla que el jugador tiene delante (`mundo.casillaEn` + `mundo.romper`). Enfriamiento de 3 s. Anuncia en el feed qué ha roto.

## H-006 · Habilidad «muro-rapido»
etiqueta: habilidad · medio
Coloca un muro en la casilla de delante con `mundo.colocar`. Desaparece solo a los 20 s.

## H-007 · Habilidad «teletransporte»
etiqueta: habilidad · medio
Salta 4 casillas hacia donde mira si el destino está vacío (compruébalo con `mundo.casillaEn`: `'0'` o `'P'`). Deja humo al salir y al llegar.

## H-008 · Estado «enganchado»
etiqueta: estado · difícil
Tira del jugador hacia el punto guardado en `j.datos.gancho` y vuelve a `en-el-aire` al llegar o a los 1,5 s. Es la primera de dos PR: la habilidad «gancho» entra en este estado.

## H-009 · Habilidad «gancho»
etiqueta: habilidad · difícil
bloqueada: H-008
Busca un muro en diagonal hacia arriba (hacia donde mira), guarda el punto en `j.datos.gancho` y entra en el estado `enganchado`.

## H-010 · Power-up «doble-salto»
etiqueta: power-up · fácil
`mods.saltosExtra = 1` durante 10 s. Tinte rosa.

## H-011 · Power-up «velocidad»
etiqueta: power-up · fácil
`mods.velocidad = 1.6` durante 6 s, con estela.

## H-012 · Power-up «gigante»
etiqueta: power-up · fácil
`efecto.escala = 1.6` y `mods.dano = 2` durante 8 s.

## H-013 · Power-up «luna»
etiqueta: power-up · fácil
Gravedad a la mitad y salto un poco mayor durante 8 s, con burbujas.

## H-014 · Proyectil «rebote»
etiqueta: proyectil · fácil
Como la bola, pero `alChocarMuro` devuelve `'rebotar'`. Vida 3 s.

## H-015 · Proyectil «granada»
etiqueta: proyectil · medio
Cae con `gravedad: 1`, rebota una vez y luego explota en partículas.

## H-016 · Proyectil «hielo»
etiqueta: proyectil · medio
Al impactar, hace daño y marca al objetivo para que entre en «congelado».

## H-017 · Proyectil «boomerang»
etiqueta: proyectil · difícil
Con `mover`: va, frena y vuelve al punto de salida (guárdalo en `p.datos` la primera vez que se mueve).

## H-018 · Casilla «hielo»
etiqueta: casilla · fácil
Carácter `H`, sólida. Al pisarla, el jugador resbala: guarda una marca en `j.datos` que un estado pueda leer.

## H-019 · Casilla «lava»
etiqueta: casilla · fácil
Carácter `L`, sólida (si no, nadie aterriza encima y `alPisar` no se llama). Al pisarla quita una vida y lanza al jugador hacia arriba.

## H-020 · Casilla «muro-fragil»
etiqueta: casilla · fácil
Carácter `F`, sólida y `rompible`. Se rompe sola al aterrizar encima.

## H-021 · Mapa «arena-02»
etiqueta: mapa · fácil
Un mapa nuevo de 30×17 que use al menos dos tipos de casilla. Reglas de so_long: rectangular, rodeado de muros, al menos 2 `P`.

## H-022 · Pieza libre: «lluvia-de-meteoritos»
etiqueta: libre · difícil
Cada 30 s, durante 5 s, caen bolas del cielo. Cuidado: cada navegador las genera por su cuenta, así que el daño solo cuenta para el jugador local.

## H-023 · Pieza libre: tu idea
etiqueta: libre
Lo que no esté en el backlog: cuéntaselo a Jorge, crea tu tarjeta en el tablero de 42Teams y, si cumple la spec, adelante.
