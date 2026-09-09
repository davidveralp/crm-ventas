# v102 · Precarga, servicios en cascada y sincronización ClickUp

**Fecha:** 18 de agosto de 2026
**Requiere:** migración 67 · Edge Function `clickup-sync` desplegada

---

## 1. La patente conocida ahora precarga, no oculta

Antes, si el vehículo existía, **los campos desaparecían**. Se veía un ✓ verde y nada más, así que si el cliente había cambiado de teléfono o el auto tenía otro color, esa información no se actualizaba nunca.

Ahora los campos **se muestran llenos y editables**, con la nota *"verifica con el cliente"*. Se precarga marca, modelo, versión, cilindrada, año, color, chasis, tracción, transmisión, tipo, combustible, y del cliente nombre, RUT, teléfono, correo, ciudad y dirección.

**El kilometraje no se precarga a propósito:** es el dato que cambia en cada visita, y arrastrarlo del registro anterior lo dejaría permanentemente desactualizado. Hoy la cobertura de km es 35%; precargarlo la volvería inútil.

## 2. Trabajo a realizar en cascada

**Trabajo a realizar** pasó de texto libre a **lista desplegable** de servicios, con Pack Mantención 360° primero.

Al elegir uno aparece **Servicio adicional**, con el mismo catálogo menos el ya seleccionado. Cada selección se agrega como etiqueta verde y la lista queda lista para otra: en una visita se pueden sumar varios.

Bajo el servicio principal se muestra la unidad de negocio que le corresponde.

## 3. Sumar desperfectos al servicio desde la revisión

En cada punto de la revisión de recepción, **cuando hay hallazgo** aparece un botón **"+ Sumar al servicio"**. Al tocarlo, ese desperfecto se agrega a la venta de la visita con su detalle: *"Estado de plumillas (Gastadas)"*.

Es el flujo natural: el asesor encuentra algo, se lo comenta al cliente, el cliente acepta, y queda registrado sin salir de la revisión.

## 4. Lo que ve el cliente y lo que queda interno

| | Aparece en el documento firmado | Se guarda para medir |
|---|---|---|
| Servicio principal | **Sí** | Sí |
| Servicios adicionales | **No** | Sí, en `servicios_extra` |
| Desperfectos sumados | **No** | Sí, en `servicios_extra` |
| Hallazgos de la revisión | Solo los que tienen observación | Sí |

Como pediste: la venta cruzada es información interna y no se imprime en el acta de recepción.

## 5. Sincronización con ClickUp

**Botón "⟳ Sincronizar ClickUp"** en Mis vehículos, junto al que ya existía en Taller. Trae las tarjetas creadas directamente en ClickUp, vincula por patente las que puede y deja el resto en la bandeja.

**Y se corrigió el diagnóstico:** el aviso de error usaba el mismo patrón que fallaba en campañas — no leía el cuerpo de la respuesta y mostraba solo *"non-2xx status code"*. Ahora dice el motivo real.

### Sobre el vehículo que no llega a ClickUp

Revisé la cadena completa y **el código está correcto**: el trabajo nace en `por_designar`, se invoca la función, y ésta envía el estado explícito.

Si sigue sin llegar, ahora el aviso amarillo al registrar dirá cuál de estos falta:

1. **`clickup-sync` sin redesplegar** — el envío del estado se agregó en la v88 y un push a GitHub no la actualiza.
2. **`CLICKUP_API_TOKEN`** ausente en los secrets.
3. **Verify JWT en ON** — debe estar en OFF.
4. **Migración 62** sin ejecutar: sin `km_ingreso` e `inspeccion_id` el trabajo no se crea, y sin trabajo no hay nada que enviar.
