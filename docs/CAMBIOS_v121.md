# v121 · Correcciones del formulario de ingreso

**Fecha:** 18 de agosto de 2026
**Migraciones nuevas:** ninguna

---

## 1. Eliminada la casilla "El cliente solicita presupuesto"

Quedó viva en la v117 aunque ya no hacía falta: el ticket **cotizar** de cada línea la reemplaza.

Ahora la solicitud se arma sola con los ítems marcados. Es más preciso: antes la casilla decía *que* se pedía presupuesto pero no *de qué*, y el encargado tenía que deducirlo del texto libre.

## 2. Restauradas las observaciones del asesor

Se perdieron al eliminar la sección 6. Ahora están **junto a las del cliente**, en dos campos separados:

| Campo | Qué va ahí |
|---|---|
| **Observaciones del cliente** | Lo que dice, en sus palabras: *"suena adelante al frenar"* |
| **Observaciones del asesor** | El criterio técnico: *"pastillas al 20%, recomiendo cambio"* |

**Están separados a propósito.** El cliente describe el síntoma y el asesor la evaluación. Mezclarlos pierde información que después sirve para el diagnóstico, y es justamente lo que Dimasoft hace mal: en la OT 13696 que revisamos, ambas cosas terminan en el mismo cuadro de texto junto con los precios.

Verifiqué el circuito completo: se captura, se guarda en la inspección, se imprime en el acta y se muestra en el detalle de la orden.
