# v119 · Orden de trabajo completa y numeración

**Fecha:** 18 de agosto de 2026
**Requiere:** **migración 76**

---

## 1. "OT s/n" — por qué pasaba

En tu captura la orden aparece sin número. Eso significa que **el trigger de la migración 71 no está activo**: o no se ejecutó esa migración, o la orden se creó antes.

### La migración 76 resuelve las dos cosas
- **Crea el trigger de nuevo**, por si la 71 no se corrió
- **Numera todas las órdenes que quedaron sin número**, respetando el orden de creación para que el correlativo siga la cronología real

### Y un respaldo en la aplicación
Si al registrar un ingreso el trabajo sale sin número, el sistema lo pide igual y lo asigna. Así el documento nunca sale "s/n" aunque falte la migración.

### El documento
El acta de ingreso ahora se titula **"NUEVO INGRESO · OT N° 13736"**.

---

## 2. El detalle ahora muestra la orden completa

Antes se veía solo el detalle valorizado. Ahora incluye:

**Cabecera** — patente, marca, modelo, versión, año y color.

**Cliente** — nombre, RUT, teléfono y correo.

**Ingreso** — fecha, kilometraje, sucursal y, si ya salió, la fecha de entrega.

**Observaciones del cliente** y **observaciones del asesor**, en bloques separados. Son cosas distintas: el cliente describe el síntoma, el asesor el criterio técnico. Mezclarlos pierde información.

**Hallazgos de la recepción** — los rojos y amarillos de la revisión, con su severidad. Los que salieron bien no aparecen: no aportan a una orden de trabajo.

**Avance en taller** — la barra de progreso que reporta ClickUp.

**Las cuatro áreas** con sus líneas, editables con el lápiz.

**Tareas** — cada una con su técnico en etiqueta, el ✓ si está terminada, y debajo la observación que escribió el mecánico.

**Observaciones de entrega** y quién retiró, cuando la OT está cerrada.

---

## Qué hacer

1. Ejecuta la **migración 76** — numerará las órdenes existentes
2. Sube la v119
3. Abre la OT del Mazda: debería tener número y mostrar todo el contexto
4. Registra un ingreso nuevo y verifica que el documento diga **OT N° …**

---

## Nota sobre la numeración de las existentes

Las órdenes que hoy están sin número recibirán uno desde 13736 en adelante, por orden de creación. Si prefieres que las antiguas queden sin numerar y el correlativo empiece solo con las nuevas, dímelo antes de ejecutar: es cambiar una línea del script.
