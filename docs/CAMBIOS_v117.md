# v117 · Bloque Tareas con tres listas

**Fecha:** 18 de agosto de 2026
**Requiere:** **migración 75** (actualizada) · redesplegar `clickup-sync`

---

## La reorganización

Justo bajo **Trabajo a realizar** hay ahora un bloque **Tareas** con tres listas desplegables. Reemplaza tanto al antiguo "Detalle de la orden" como a la casilla "El cliente solicita presupuesto".

| Lista | Destino en ClickUp | Ticket de cotización |
|---|---|---|
| **Mano de obra** | Subtareas | No |
| **Repuestos** | Lista de control | Sí |
| **Lubricantes e insumos** | Lista de control | Sí |

Cada encabezado indica a dónde va, así el asesor sabe qué está alimentando.

### El ticket "cotizar"
Cada repuesto o insumo tiene una casilla al costado. Marcarla lo envía al encargado de presupuestos; dejarla vacía significa que no hace falta cotizar — porque el cliente lo trae, porque está en bodega o porque el precio ya se conoce.

Cuando hay ítems marcados aparece el conteo, y al registrar el ingreso se genera el presupuesto solo con esos.

**La mano de obra no lleva ticket:** no se cotiza a un proveedor, se ejecuta. Su precio lo pone el encargado directamente en la valorización.

---

## Persona asignada desde ClickUp

La sincronización ahora extrae el asignado de cada subtarea probando **dos vías**:

1. **Por correo** — el único identificador estable entre ambos sistemas
2. **Por nombre completo**, si el correo no coincide

Y guarda **todos los asignados** cuando hay más de uno, con el primero como responsable. También conserva siempre el nombre que muestra ClickUp, aunque haya cruce: si alguien se elimina del CRM, el registro histórico mantiene quién hizo el trabajo.

**Por qué importa:** sin saber quién ejecutó cada tarea no se puede calcular comisión ni seguir reprocesos, que son las dos cosas que definiste como clave para medir calidad.

---

## Recordatorio

Sigue pendiente el problema de los **dos Felipe** —Codoceo y Alcota, 46% de la carga— y las cuatro cuentas genéricas "Tecnico N". El cruce por correo funcionará para quienes tengan ficha; el resto quedará solo con el nombre de ClickUp.

---

## Qué hacer

1. Ejecuta la **migración 75** (se le agregó una columna; vuelve a correrla si ya lo hiciste)
2. Redespliega **`clickup-sync`**
3. Sube la v117
4. Registra un ingreso con líneas en las tres listas y marca algunas para cotizar
5. En ClickUp: mano de obra como subtareas, las otras dos como listas de control
6. Asigna una subtarea a un técnico allá y sincroniza: debería volver con su nombre
