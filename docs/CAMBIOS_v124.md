# v124 · Pack Mantención 360° se carga solo

**Fecha:** 18 de agosto de 2026
**Migraciones nuevas:** ninguna

---

## Qué hace

Al elegir **PACK MANTENCIÓN 360°** en el trabajo a realizar, sus líneas se cargan solas en las tres áreas. El asesor ya no escribe 32 líneas cada vez.

Las líneas del pack se marcan con una etiqueta azul **pack**, para distinguirlas de las que se agregan a mano.

---

## Dos variantes según el combustible

Tu archivo trae dos columnas y el sistema elige la correcta:

| | Mano de obra | Repuestos | Insumos | Total |
|---|---|---|---|---|
| **Diésel** | 22 | 5 | 5 | **32 líneas** |
| **Bencinero** | 21 | 3 | 5 | **29 líneas** |

La diferencia son cuatro líneas que solo lleva el diésel:

- Cambio de Filtro de polen
- Cambio de Filtro de combustible
- Filtro de polen *(repuesto)*
- Filtro de petróleo *(repuesto)*

**Si cambias el combustible después de elegir el pack, las líneas se recalculan solas.** Es el caso de escribir la patente, elegir el servicio y recién ahí notar que el vehículo es diésel.

---

## Dos decisiones de comportamiento

**Lo que agregaste a mano se conserva.** Al cambiar de servicio se quitan las líneas del pack anterior, pero no las tuyas. No sería razonable borrar tu trabajo por cambiar una selección.

**Las líneas del pack se pueden quitar.** Si un vehículo no necesita algo del pack, se elimina con la ×. La carga automática es un punto de partida, no una imposición.

---

## Cómo agregar otros packs

El catálogo está en `helpers.js`, en `PACKS_SERVICIO`. Para sumar otro servicio con pack basta agregar su entrada con las líneas, sin tocar más código.

Si tienes el detalle de otros servicios frecuentes —una mantención simple, un servicio de frenos— pásamelos y los cargo igual.
