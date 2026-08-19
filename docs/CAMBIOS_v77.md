# v77 · Inspección de ingreso: página única y documento imprimible

**Fecha:** 18 de agosto de 2026
**Migraciones nuevas:** ninguna
**Requiere:** bucket Storage `inspecciones` creado (pendiente desde v45) para que funcionen fotos y firma

---

## Qué vas a ver distinto

### 1. Una sola página, hacia abajo
La inspección dejó de ser un asistente de 7 pasos con botones "Siguiente". Ahora es **un formulario continuo** que se desplaza verticalmente, con las siete secciones numeradas y separadas por un encabezado:

1. Datos del vehículo y cliente
2. Luces de advertencia e inventario
3. Combustible
4. Daños al ingreso
5. Fotografías
6. Checklist
7. Firma del cliente

Puedes llenar en el orden que quieras, volver atrás sin perder nada y ver todo lo cargado de una mirada antes de registrar. La ventana es más ancha y ocupa casi toda la pantalla.

### 2. Documento imprimible con el formato oficial
Al registrar, se abre automáticamente el documento en una ventana nueva, listo para imprimir o guardar como PDF. Replica el formato de la Orden de Trabajo en papel:

- Cabecera con datos de DIDIAL
- Cliente, RUT, dirección, correo, teléfono, dueño del vehículo
- Marca, modelo, color, año, chasis, kilometraje, patente
- **Cliente Solicita** con el trabajo pedido y las observaciones
- Políticas de Servicio (los dos párrafos textuales)
- Bloques de firma: nombre, celular, dueño o conductor, y firma de ingreso

Y agrega lo que el papel no tiene pero la inspección sí captura: **nivel de combustible** con barra, **luces de advertencia** encendidas, **inventario recibido**, **daños numerados** con su descripción, **checklist** y las **fotografías**.

### 3. Botón "Vista previa"
Junto a "Registrar e imprimir". Abre el documento **sin guardar nada**, para revisarlo antes de confirmar. Útil para corregir un dato mal escrito antes de que quede registrado.

---

## Instructivo

### Hacer una inspección
1. **Nueva OT** → botón **📋 Iniciar con inspección de ingreso**.
2. Escribe la patente. Si el vehículo existe, aparece un ✓ verde con su marca, modelo y cliente. Si es nuevo, se despliegan los campos de cliente.
3. Completa **kilometraje** (obligatorio junto con la patente) y baja llenando lo que corresponda.
4. En **Daños**, elige la silueta del tipo de vehículo y toca sobre la imagen donde haya un daño. Cada toque agrega un número; escribe la descripción al lado.
5. En **Firma**, el cliente firma con el dedo sobre el recuadro.
6. **Vista previa** si quieres revisar el documento antes.
7. **✓ Registrar e imprimir**: guarda la inspección y abre el documento.

### Imprimir o guardar el PDF
Al abrirse el documento, el navegador muestra el diálogo de impresión automáticamente. Elige tu impresora, o **"Guardar como PDF"** en el selector de destino. Si cerraste el diálogo sin querer, hay un botón **"Imprimir / Guardar PDF"** al final de la página.

---

## Detalles que conviene saber

**El documento espera a que carguen las imágenes** antes de abrir el diálogo de impresión. Si no lo hiciera, la firma y las fotos saldrían en blanco. Si alguna imagen no responde en 3 segundos, imprime igual sin ella.

**La firma aparece dos veces** en el documento —en "Nombre y apellido" y en "Firma cliente ingreso"— igual que en el formulario en papel.

**Los datos que el sistema no tiene salen vacíos.** Chasis, color, dirección y correo se llenan solo si están en la ficha del vehículo o del cliente. En el papel de Dimasoft sí vienen; en el CRM todavía no existen todos esos campos (ver la auditoría v76).

**Si el navegador bloquea la ventana emergente**, el documento no se abre. Aparece un aviso pidiendo habilitarla para este sitio.

---

## Lo que todavía no hace

- **No guarda el PDF** en Storage: se genera en el momento y depende de que lo imprimas o guardes. Si necesitas recuperarlo después, hay que agregar el archivado.
- **No incluye el diagrama de daños** como imagen en el documento, solo la lista numerada con las descripciones. La silueta con las marcas queda en el registro, no en el papel.
- **Falta el campo chasis (VIN)** en el modelo de datos, así que ese renglón sale vacío aunque el documento lo contemple.
