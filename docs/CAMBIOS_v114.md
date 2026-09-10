# v114 · Estructura en ClickUp y pestaña Órdenes de trabajo

**Fecha:** 18 de agosto de 2026
**Requiere:** redesplegar `clickup-sync` · migraciones 71, 72 y 73 si están pendientes

---

## 1. Cómo llega ahora a ClickUp

| Área del CRM | Dónde queda en ClickUp |
|---|---|
| **Mano de obra** | Subtareas |
| **Repuestos** | Lista de control "Repuestos" |
| **Lubricantes e insumos** | Lista de control "Lubricantes e insumos" |
| **Servicio externo** | Lista de control "Servicio externo" |

La distinción tiene sentido operativo: **una subtarea tiene responsable y estado**; un ítem de lista de control solo se marca. Los materiales no se "ejecutan", se verifican. Poner todo como subtarea llenaba el tablero del mecánico de cosas que no puede hacer.

Los repuestos incluyen su código si lo tienen: *"90915-YZZE1 · Filtro de aceite"*.

## 2. Las cuatro áreas son desplegables

Cada una se abre y cierra, con su contador al costado. Se abren solas cuando tienen contenido, para que nada quede escondido sin querer.

Además cada encabezado indica **a dónde va en ClickUp**, así el asesor sabe qué está alimentando.

El orden cambió: **mano de obra primero**, porque es lo que más se carga.

---

## 3. Nueva pestaña "Órdenes de trabajo"

Reemplaza a "Solo cliente".

### Tres estados
| Estado | Qué significa |
|---|---|
| **Abierta** | El vehículo está en el taller |
| **Cerrada** | Entregada y documentada |
| **Sin documento** | Entregada, pero sin boleta ni factura |

**El tercero es el que interesa vigilar.** Son trabajos hechos que todavía no se facturaron, y sin distinguirlos se pierden entre las cerradas. Aparece en rojo y con aviso al filtrar.

### Buscador
Por número de OT, patente (en cualquier formato), cliente, marca o modelo.

### Detalle
Al tocar una fila se abre la ficha completa: cliente, ingreso, kilometraje, trabajo solicitado, las cuatro áreas con sus líneas y montos, las tareas con quién las hizo, y el documento emitido.

Las líneas sin valorizar se marcan con un guion ámbar, así se ve de inmediato qué falta.

**Si la OT está abierta**, hay un botón para editarla o registrar la salida. **Si está cerrada**, el detalle es de solo lectura y lo explica: para corregir un monto hay que reabrirla desde administración.

---

## Qué hacer

1. Redespliega **`clickup-sync`**
2. Sube la v114
3. Registra un ingreso con líneas en las cuatro áreas
4. En ClickUp: la mano de obra debe verse como subtareas y los materiales como tres listas de control
5. Entra a **Nuevo cliente → Órdenes de trabajo** y revisa el listado

---

## Nota

El alta de cliente sin vehículo desapareció junto con la pestaña. Si en algún momento necesitas registrar un cliente que no trae auto, se puede seguir haciendo desde el listado de Clientes, o lo reincorporamos como una opción dentro del mismo ingreso.
