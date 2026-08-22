# v91 · Verificación contra ClickUp: estado "agenda" y porcentaje de avance

**Fecha:** 18 de agosto de 2026
**Requiere:** migración 64 · **redesplegar la Edge Function**

---

## Resultado de la verificación

Leí las **18 tarjetas** de la lista "Vehiculos en Taller" y los **12 estados** configurados en ClickUp, y los comparé con los 13 del CRM.

### El hallazgo: faltaba "agenda", y es el estado más usado

| Estado en ClickUp | En el CRM | Tarjetas hoy |
|---|---|---|
| **agenda** | **no existía** | **7 de 18** |
| por designar | ✓ | 2 |
| en reparación | ✓ | 2 |
| en rep. servicio externo | ✓ | 1 |
| listo para entrega | ✓ | 6 |
| compra de repuestos, pintura/desabolladura, prueba en ruta, retroceso, lavado, alineacion, complete | ✓ | 0 |

**Qué significaba:** las 7 tarjetas en "agenda" llegaban al webhook, no encontraban equivalente y **el cambio de estado se descartaba en silencio**. El CRM las mostraba con el estado anterior o no las mostraba.

Ahora existe **Agenda** como primer estado del tablero, con el mismo color que en ClickUp. Es el vehículo agendado que todavía no ingresa.

### Los otros 11 estados coinciden

El CRM tiene además `revision` y `esperando_aprobacion`, que no tienen equivalente en ClickUp. Ya estaba documentado y es intencional: son etapas internas del CRM.

---

## Información de ClickUp que ahora se aprovecha

### Porcentaje de avance
ClickUp tiene un campo **Progreso** que calcula solo, a partir de subtareas, listas de control y comentarios asignados. Ejemplo real: la tarjeta de la Hilux OT13323 va en **28,6%**.

Ese dato **no se estaba usando**. Ahora el CRM lo lee y lo muestra en el detalle del trabajo, **junto al progreso propio**:

- **Progreso · CRM** — tareas y listas de control del CRM
- **Progreso · ClickUp** — subtareas y checklists de la tarjeta

Se muestran los dos a propósito: miden cosas distintas, y **si difieren en más de 25 puntos aparece un aviso**. Esa diferencia significa que hay trabajo registrado en un lado y no en el otro, que es información útil por sí misma.

### Sugerencias
El campo Sugerencias de la tarjeta también se trae y se muestra bajo el progreso.

ClickUp no envía estos campos en el aviso del webhook, así que se consultan al recibirlo. Se hace en **cualquier** evento, porque marcar una subtarea cambia el porcentaje sin cambiar el estado de la tarjeta.

---

## Qué hacer

1. **Ejecutar la migración 64** en Supabase.
2. **Redesplegar la Edge Function**: Supabase → Edge Functions → `clickup-sync` → Code → pegar el archivo → Deploy. El estado "agenda" y la lectura del progreso están ahí.
3. Mover una tarjeta en ClickUp o marcar una subtarea, y verificar que el CRM lo refleje.

---

## Nota sobre las 18 tarjetas actuales

Las que existen hoy en ClickUp **no están vinculadas** a trabajos del CRM: se crearon directamente allá. El webhook solo actualiza tarjetas que tengan `clickup_task_id` en la base.

Para vincularlas hay dos caminos: la **bandeja de tareas pendientes** del módulo Taller (revisión manual, una por una), o la **autovinculación por patente** de la v49, que las engancha solas cuando la patente identifica un único vehículo. Esta última requiere que el webhook tenga el evento `taskCreated`, que sigue sin confirmarse.
