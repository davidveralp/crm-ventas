# v120 · Detalle completo de la orden de trabajo

**Fecha:** 18 de agosto de 2026
**Migraciones nuevas:** ninguna

---

## Por qué seguía viéndose incompleta

Las secciones que agregué en la v119 **estaban condicionadas a tener datos**. Esa OT del Mazda no tiene observaciones ni inspección vinculada, así que se ocultaban todas y quedaba solo el detalle valorizable.

El efecto era engañoso: parecía que faltaba la funcionalidad, cuando faltaban los datos.

**Ahora todas las secciones se muestran siempre**, con un estado vacío explícito:

> *"Sin observaciones."*
> *"Esta orden no tiene inspección de ingreso vinculada."*
> *"Sin tareas registradas. Se cargan al ingresar o se sincronizan desde ClickUp."*

Así se ve qué tiene la orden y qué le falta.

---

## Qué muestra ahora

**Contexto en cuatro columnas**, arriba: cliente con teléfono y RUT · fecha de ingreso, kilometraje y sucursal · estado y fecha de entrega comprometida · avance de taller con barra.

**Trabajo solicitado.**

**Observaciones del cliente** y **del asesor**, lado a lado. Son datos distintos: el cliente describe el síntoma, el asesor el criterio técnico.

**Hallazgos de la recepción**, con su severidad en rojo o ámbar.

**Detalle de la orden** — las cuatro áreas, editables con el lápiz.

**Tareas del taller** — con contador de terminadas, el técnico de cada una en etiqueta y la observación que escribió.

**Entrega** — observaciones y quién retiró, cuando corresponde.

**Resumen** — total y estado del documento, en ámbar mientras falte valorizar.

El modal se ensanchó para que todo eso se lea sin apretarse.

---

## Sobre esa OT en particular

La del Mazda aparece sin inspección vinculada. Eso ocurre con las órdenes creadas **antes** de que el ingreso empezara a guardar `inspeccion_id`, o cuando el trabajo se creó desde ClickUp en vez de desde el panel.

Las nuevas, registradas desde **Nuevo cliente**, sí quedan vinculadas y mostrarán las observaciones y los hallazgos.
