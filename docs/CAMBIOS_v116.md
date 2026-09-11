# v116 · Borrado para administración, mano de obra y repuestos

**Fecha:** 18 de agosto de 2026
**Requiere:** **migración 75**

---

## 1. Borrado de fichas y tarjetas

### Fichas de vehículo y de persona · solo admin
Botón **"Eliminar ficha"** en el detalle del vehículo. Pide un motivo y avisa qué historial queda asociado:

> *"Ficha eliminada. Conserva 4 ordenes, 2 inspecciones en el historial."*

**El borrado es lógico, no físico.** La ficha desaparece de las listas pero el historial se conserva y se puede restaurar.

**Por qué así:** de un vehículo cuelgan OTs, inspecciones, presupuestos y encuestas. Un borrado físico accidental no se recupera, y basta un clic equivocado para perder años de historial. La función `restaurar_ficha()` deshace la operación.

### Tarjetas del tablero de taller
Botón **"Eliminar esta orden"** al final del detalle, para admin y jefe de taller.

Este sí es físico: una OT mal creada no aporta historial. Va al final y separado del resto porque es la única acción sin vuelta atrás de esa pantalla.

**Las OT cerradas no se pueden borrar.** Para esas existe la anulación, que deja rastro.

---

## 2. "Tareas" pasa a ser "Mano de obra"

La sección 6 se renombró, y ya no crea tareas sueltas: **las líneas se guardan como mano de obra de la OT**.

Eso significa que quedan junto al resto del detalle, se valorizan igual que las demás áreas, y suben a ClickUp como subtareas bajo el servicio seleccionado.

Antes vivían en una tabla aparte y no participaban de la valorización.

---

## 3. Solicitud de presupuesto: lista de repuestos con check

El bloque cambió a una lista simple de **Repuestos**, sin selector de área: cotizar es, en la práctica, cotizar repuestos.

Cada línea tiene un check a la derecha:

| Estado | Qué significa |
|---|---|
| **Cotizar** | Hay que buscar precio y disponibilidad |
| **Lo trae el cliente** | No se cotiza; solo se cobra la instalación |

Cuando hay alguno marcado, aparece un aviso con el conteo.

**Por qué importa:** el cliente que trae su propio repuesto es un caso frecuente y hoy se manejaba de palabra. Sin registrarlo, el encargado cotiza algo que nadie va a comprar, y al facturar nadie recuerda que la mano de obra sí se cobra.

---

## Qué hacer

1. Ejecuta la **migración 75**
2. Sube la v116
3. Prueba el borrado con una ficha de prueba — y luego restáurala para comprobar que el historial sigue:
   ```sql
   select restaurar_ficha('vehiculos', 'id-del-vehiculo');
   ```

---

## Nota

El borrado de fichas de **persona** quedó disponible en la base (`eliminar_ficha('clientes', id)`) pero **falta el botón en la ficha del cliente**. Lo agrego en la próxima si lo necesitas ahí también.
