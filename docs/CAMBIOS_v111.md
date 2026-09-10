# v111 · Tarjetas de ClickUp y precarga del cierre

**Fecha:** 18 de agosto de 2026
**Requiere:** **migración 72** · redesplegar `clickup-sync`

---

## 1. Título de las tarjetas

Formato nuevo, todo en mayúsculas:

```
RJ SS 23 HYUNDAI TUCSON · OT 13736
```

La patente va **primero** porque es lo que el jefe de taller busca de un vistazo en el tablero. El número de OT permite cruzar la tarjeta con el papel y con Dimasoft.

La patente se normaliza a **XX XX XX** aunque esté guardada como `rjss23` o `RJ-SS-23`.

---

## 2. El cierre llega precargado desde ClickUp

**El cambio de mayor impacto de esta versión.**

En tu captura del TUCSON vi que el taller agrupa las subtareas con separadores:

```
*** MANO DE OBRA ***
   ALINEACION
   BALANCEO
   ROTACION DE NEUMATICOS
```

La sincronización ahora **detecta esos separadores** y clasifica las tareas que vienen después. Reconoce cuatro grupos y varios formatos de separador (`***`, `---`, `===`).

Al abrir el cierre, las líneas aparecen **ya escritas y ya separadas** por tipo. **El asesor solo agrega los valores.**

| Antes | Ahora |
|---|---|
| Transcribir todo el trabajo a mano | Ya está escrito |
| Decidir a qué grupo va cada línea | Ya está clasificado |
| Escribir descripción, cantidad y precio | Solo el precio |

Un aviso en pantalla lo indica: *"Las líneas vienen del trabajo registrado en ClickUp… Solo falta agregarles el valor."*

### Dos decisiones

**Lo no terminado no se precarga.** Si una tarea quedó pendiente en ClickUp, no aparece en el cierre: si el taller no lo hizo, no se cobra.

**Por defecto va a mano de obra.** Cuando no hay separador previo, es la categoría más frecuente y la que el asesor menos tendría que corregir.

**Todo es editable**: la clasificación es una ayuda, no una imposición. Si algo quedó en el grupo equivocado se corrige en el momento.

---

## Qué hacer

1. Ejecuta la **migración 72**
2. Redespliega **`clickup-sync`**
3. Sube la v111
4. **⟳ Sincronizar ClickUp** en Taller
5. Abre un vehículo listo en **Mis vehículos → Pendientes de cierre**: las líneas deberían estar ahí

---

## Nota sobre las tarjetas existentes

El título nuevo se aplica a las tarjetas que el CRM cree o actualice de ahora en adelante. Las que ya están en ClickUp conservan su nombre hasta que cambien de estado desde el CRM.

Si quieres renombrarlas todas de una vez, es un recorrido corto sobre la lista — dime y lo agrego a la acción de sincronizar.
