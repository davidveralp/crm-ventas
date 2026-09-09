# v103 · Correcciones: precarga y servicios adicionales

**Fecha:** 18 de agosto de 2026
**Migraciones nuevas:** ninguna

---

## Error 1 · Toda patente aparecía como nueva

**Causa:** en la v102 agregué `combustible` a la consulta de vehículos, pero esa columna está en **`inspecciones_ingreso`**, no en `vehiculos`.

Supabase rechaza la consulta completa cuando una columna no existe, así que **devolvía vacío siempre** y cualquier patente parecía nueva. La precarga que agregué en la v102 nunca llegó a funcionar.

**Corregido**, y además: si la consulta falla, ahora se muestra el motivo en pantalla en vez de asumir que la patente no existe. Ese silencio era lo que hacía el error invisible.

## Error 2 · Los recuadros desaparecían sin patente

Puse los bloques de cliente y vehículo condicionados a que hubiera patente. **Ahora están siempre visibles**: con patente conocida se precargan para validar, y sin ella se llenan a mano.

## Corrección 3 · Los servicios adicionales sí van en la OT

Entendí mal: pensé que no debían imprimirse. Lo que no debe aparecer es **el término "venta cruzada"**, que es lenguaje interno y no corresponde mostrarle al cliente.

Ahora:

| Dónde | Qué aparece |
|---|---|
| **Formulario** | "Servicios adicionales" — ningún rótulo interno |
| **OT impresa** | Sección **Servicios adicionales** numerada, bajo "Cliente Solicita" |
| **ClickUp** | Servicio principal y adicionales juntos, separados por · |
| **Medición interna** | `servicios_extra`, para el panel de conversión |

El cliente ve y firma todo lo que aceptó. La etiqueta de venta cruzada queda solo en los informes.

---

## Qué probar

1. Escribe **PY BD 81** u otra patente conocida → deben cargarse marca, modelo, cliente, teléfono y RUT, editables.
2. Sin escribir patente → los recuadros deben estar visibles y vacíos.
3. Elige un servicio, agrega un adicional, suma un desperfecto desde la revisión, e imprime: los tres deben salir en el documento.
