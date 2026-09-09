# v109 · Detalle de taller: tareas y asignados desde ClickUp

**Fecha:** 18 de agosto de 2026
**Requiere:** **migración 70** · redesplegar `clickup-sync`

---

## El error corregido

> ReferenceError: PanelVehiculo is not defined

`PanelVehiculo` se usaba en el detalle del trabajo **sin estar importado**. El archivo compilaba porque Vite no valida componentes JSX, y solo fallaba al abrir el detalle.

**Y había un segundo caso igual:** `RadarInspeccion`. El botón del RADAR habría dado el mismo error.

### La corrección de fondo

`no-undef` de ESLint **no revisa componentes JSX**. Se activó **`react/jsx-no-undef`**, que sí los detecta — es la regla que encontró el segundo caso. Ahora corre en cada compilación.

Con esta van seis verificaciones antes de compilar:

| Verificación | Detecta |
|---|---|
| Variables inexistentes | ReferenceError |
| Uso antes de declarar | Pantalla en blanco por orden |
| Columnas que no existen | Error de schema cache |
| Objetos renderizados como texto | React error #31 |
| Índices sobre columnas inexistentes | Migración que falla |
| **Componentes JSX sin importar** | **Este error** |

---

## Lo que ahora llega desde ClickUp

**El vacío real era otro:** la sincronización nunca traía las **subtareas**. El jefe asigna trabajo en ClickUp y los mecánicos marcan avance ahí, pero el CRM solo recibía la tarjeta del vehículo. Al abrir el detalle no se veía el trabajo real.

Ahora la importación trae:

- **Las subtareas** como tareas del trabajo
- **Quién está asignado** a cada una
- **Las observaciones** que escribió el mecánico
- **El estado** de cada tarea (pendiente o terminada)

### Cómo se cruzan las personas

El asignado de ClickUp se busca en `usuarios` **por correo**, que es el único identificador estable entre ambos sistemas.

Cuando no hay coincidencia —una cuenta genérica "Tecnico 1", o alguien sin ficha en el CRM— **se guarda igual el nombre que muestra ClickUp** y aparece como *"Felipe Alcota (ClickUp)"*.

Es preferible a un "Sin asignar" vacío: saber quién hizo el trabajo importa para las comisiones y el seguimiento de reprocesos, aunque la ficha no exista todavía.

Las tareas sincronizadas se marcan con **CU** al costado.

---

## Recordatorio pendiente

Sigue sin resolverse el problema de los **dos Felipe** (Codoceo y Alcota, 46% de la carga del taller entre ambos) y las cuatro cuentas genéricas. Mientras el catálogo del CRM tenga un solo `'Felipe'`, el cruce por correo funcionará pero la atribución quedará incompleta.

---

## Qué hacer

1. Ejecuta la **migración 70**
2. Redespliega **`clickup-sync`**
3. Sube la v109
4. En Taller, presiona **⟳ Sincronizar ClickUp** — ahora traerá también las subtareas
5. Abre un trabajo: deberían verse las tareas con su asignado y observaciones
