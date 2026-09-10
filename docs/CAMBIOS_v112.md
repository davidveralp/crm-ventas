# v112 · Checklist pasa a ser Tareas y sube a ClickUp

**Fecha:** 18 de agosto de 2026
**Requiere:** redesplegar `clickup-sync` · migraciones 71 y 72 si están pendientes

---

## El cambio

La sección **6 · Checklist** del Nuevo Ingreso ahora se llama **Tareas**, y lo que se anota ahí **sube a ClickUp como subtareas del vehículo**.

El nombre importaba: "checklist" sugiere una lista de verificación del asesor. Lo que en realidad son es **el trabajo que hay que hacerle al auto** — y ese trabajo debe llegar al mecánico, no quedarse en el acta.

Antes esas líneas quedaban solo en el documento y había que dictárselas al taller.

---

## El circuito completo

```
El asesor anota las tareas en el ingreso
  → suben a ClickUp como subtareas del vehículo
    → el mecánico las ve en su tablero y las marca
      → vuelven al CRM con quién las hizo y sus observaciones
        → precargan el cierre de OT, ya clasificadas
          → el asesor solo agrega los valores
```

Ninguna de esas líneas se escribe dos veces.

---

## Un error que encontré al revisarlo

La subida de subtareas **ya existía desde la v44**, pero guardaba el identificador en `clickup_subtask_id`, mientras la importación que agregamos en la v109 lee `clickup_task_id`.

Al no coincidir, **una subtarea creada por el CRM volvía a importarse como si fuera nueva** y quedaba duplicada. Ahora se escriben ambas columnas.

Es el tipo de desajuste que aparece cuando dos partes del sistema se construyen en momentos distintos, y que solo se nota al conectarlas.

---

## Qué hacer

1. Redespliega **`clickup-sync`**
2. Sube la v112
3. Registra un ingreso anotando dos o tres tareas
4. Revisa la tarjeta en ClickUp: deberían aparecer como subtareas
5. Marca una como completa allá y sincroniza: debería volver marcada
