# Backlog inicial

Cada `##` es un issue: `node scripts/crear-issues.mjs <dueño>/<repo>` los crea en GitHub con su etiqueta. Cada tarea cabe en unos 30 minutos y toca un solo archivo.

## Estado «agachado»
etiqueta: estado · fácil
Al pulsar ↓ en el suelo, el jugador se agacha: no se mueve y se dibuja más pequeño (`efecto.escala`). Entra solo con `desde` + `cuando`; vuelve a `quieto` al soltar ↓.

## Estado «aturdido»
etiqueta: estado · fácil
Tras recibir un golpe (`mundo.tiempo - j.ultimoGolpe < 0.05`), el jugador queda 1 s sin control, con `efecto: { particulas: 'estrellas' }`. Entra desde cualquier estado (`desde: ['*']`).

## Estado «deslizar-pared»
etiqueta: estado · medio
En el aire, pegado a una pared (`j.chocoPared`) y empujando hacia ella, cae despacio. Saltar desde aquí impulsa hacia el lado contrario.

## Estado «congelado»
etiqueta: estado · fácil
Lo provoca el proyectil «hielo». 1,5 s sin moverse, tinte azul claro. Pon `desde` y `cuando` según una marca que deje el proyectil en `j.datos`.

## Habilidad «rompe-muros»
etiqueta: habilidad · medio
Rompe la casilla que el jugador tiene delante (`mundo.casillaEn` + `mundo.romper`). Enfriamiento de 3 s. Anuncia en el feed qué ha roto.

## Habilidad «muro-rapido»
etiqueta: habilidad · medio
Coloca un muro en la casilla de delante con `mundo.colocar`. Desaparece solo a los 20 s.

## Habilidad «teletransporte»
etiqueta: habilidad · medio
Salta 4 casillas hacia donde mira si el destino está vacío (compruébalo con `mundo.casillaEn`: `'0'` o `'P'`). Deja humo al salir y al llegar.

## Habilidad «gancho»
etiqueta: habilidad · difícil
Dos PR, una por pieza: primero el estado `enganchado` (tira del jugador hacia el punto guardado en `j.datos`), luego la habilidad que busca un muro en diagonal hacia arriba y entra en ese estado.

## Power-up «doble-salto»
etiqueta: power-up · fácil
`mods.saltosExtra = 1` durante 10 s. Tinte rosa.

## Power-up «velocidad»
etiqueta: power-up · fácil
`mods.velocidad = 1.6` durante 6 s, con estela.

## Power-up «gigante»
etiqueta: power-up · fácil
`efecto.escala = 1.6` y `mods.dano = 2` durante 8 s.

## Power-up «luna»
etiqueta: power-up · fácil
Gravedad a la mitad y salto un poco mayor durante 8 s, con burbujas.

## Proyectil «rebote»
etiqueta: proyectil · fácil
Como la bola, pero `alChocarMuro` devuelve `'rebotar'`. Vida 3 s.

## Proyectil «granada»
etiqueta: proyectil · medio
Cae con `gravedad: 1`, rebota una vez y luego explota en partículas.

## Proyectil «hielo»
etiqueta: proyectil · medio
Al impactar, hace daño y marca al objetivo para que entre en «congelado».

## Proyectil «boomerang»
etiqueta: proyectil · difícil
Con `mover`: va, frena y vuelve al punto de salida (guárdalo en `p.datos` la primera vez que se mueve).

## Casilla «hielo»
etiqueta: casilla · fácil
Carácter `H`, sólida. Al pisarla, el jugador resbala: guarda una marca en `j.datos` que un estado pueda leer.

## Casilla «lava»
etiqueta: casilla · fácil
Carácter `L`, sólida (si no, nadie aterriza encima y `alPisar` no se llama). Al pisarla quita una vida y lanza al jugador hacia arriba.

## Casilla «muro-fragil»
etiqueta: casilla · fácil
Carácter `F`, sólida y `rompible`. Se rompe sola al aterrizar encima.

## Mapa «arena-02»
etiqueta: mapa · fácil
Un mapa nuevo de 30×17 que use al menos dos tipos de casilla. Reglas de so_long: rectangular, rodeado de muros, al menos 2 `P`.

## Pieza libre: «lluvia-de-meteoritos»
etiqueta: libre · difícil
Cada 30 s, durante 5 s, caen bolas del cielo. Cuidado: cada navegador las genera por su cuenta, así que el daño solo cuenta para el jugador local.

## Pieza libre: tu idea
etiqueta: libre
Lo que no esté en el backlog: propónlo en un comentario de este issue, y si cumple la spec, adelante.
