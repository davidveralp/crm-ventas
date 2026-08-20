# v79 · Panel Nuevo Cliente

**Fecha:** 18 de agosto de 2026
**Requiere:** ejecutar la **migración 61** antes de usar el modo "Solo cliente"

---

## Qué cambia y por qué

Hasta ahora la recepción de un vehículo estaba repartida en tres lugares que se hacían a destiempo:

- **"+ Nuevo cliente"** en el listado creaba una ficha con cuatro campos.
- **"Iniciar con inspección"** dentro de Nueva OT era opcional, así que se saltaba.
- **La ficha del vehículo** recién nacía al guardar la OT.

Ahora es **un solo recorrido**: se recibe el vehículo, se levanta la inspección, y de eso salen la ficha del cliente, la del vehículo y el documento de ingreso firmado.

---

## Qué vas a ver distinto

### 1. Nueva sección "Nuevo cliente" en el menú
En el bloque **OPERACIÓN**, antes de Vehículos.

### 2. El botón "+ Nuevo cliente" del listado ahora lleva al panel
Ya no abre una ventanita de cuatro campos: te lleva al recorrido completo.

### 3. El botón de inspección desapareció de Nueva OT
La inspección dejó de ser un paso opcional dentro de la OT. Ahora es el punto de partida.

Si vienes desde Nuevo cliente, Nueva OT muestra **"✓ Con inspección de ingreso"** y llega con patente, marca, modelo, tipo, kilometraje y datos del cliente ya cargados.

### 4. Dos modos en el panel

**Ingreso con vehículo** (el habitual): el formulario completo de inspección en una sola página. Al terminar crea las tres cosas y abre el documento.

**Solo cliente**: para quien no trae vehículo. Pide los datos de contacto y **marca la ficha como incompleta**, para poder encontrarla después y completarla.

### 5. Ahora se piden todos los datos del vehículo
Antes la inspección solo capturaba patente y kilometraje. Ahora, si la patente es nueva, aparecen dos bloques:

- **Datos del cliente**: nombre, apellidos, RUT, teléfono, correo, ciudad, dirección.
- **Datos del vehículo**: marca, modelo, versión, cilindrada, año, color, tracción, transmisión y **chasis (VIN)**.

Son los campos que aparecen en la OT en papel y que hasta ahora se perdían.

---

## Instructivo

### Recibir un vehículo de un cliente nuevo
1. Menú → **Nuevo cliente** (o el botón desde el listado de Clientes).
2. Modo **Ingreso con vehículo**.
3. Escribe la patente. Si es nueva, se despliegan los bloques de cliente y vehículo.
4. Completa **kilometraje** (obligatorio junto con la patente).
5. Baja llenando las siete secciones: luces, inventario, combustible, daños, fotos, checklist y firma.
6. **✓ Registrar e imprimir**.
7. Al terminar aparecen cuatro botones: **Continuar a Nueva OT** (recomendado, va con todo precargado), Ver vehículo, Ver cliente, o Registrar otro ingreso.

### Recibir un vehículo de un cliente que ya existe
Igual que arriba, pero al escribir la patente aparece un ✓ verde con los datos. Los bloques de cliente y vehículo no se muestran porque ya están en el sistema.

### Registrar un cliente sin vehículo
1. **Nuevo cliente** → modo **Solo cliente**.
2. Completa los datos de contacto.
3. **Crear ficha de cliente**.

La ficha queda marcada como incompleta. **Se completa sola** cuando le registres un vehículo: no hay que desmarcar nada.

---

## Detalles que conviene saber

**Un error que se corrigió de paso.** La inspección guardaba el registro pero **no creaba el cliente ni el vehículo** cuando la patente era nueva: quedaba huérfana, sin vínculo. Ahora los crea antes de guardar, y si algo falla avisa en vez de guardar a medias.

**El campo chasis (VIN) sigue sin existir en la base de datos.** Se pide en el formulario y aparece en el documento, pero para que se guarde hay que agregar la columna. Es uno de los hallazgos de la auditoría v76, junto con la aseguradora y la distinción entre cliente que paga y dueño del vehículo.

**El modo "Solo cliente" necesita la migración 61.** Sin ella falla al guardar.

**Punto de venta queda pendiente.** El caso del cliente que entra solo a comprar tendrá su propio panel, como acordamos. Por ahora, "Solo cliente" cubre el registro de la ficha.

---

## Lo que todavía no hace

- **No guarda el chasis** aunque lo pida (falta la columna).
- **No hay validación de RUT** en el panel: acepta cualquier texto. La función `rut_dv()` existe en la base desde la migración 53, pero no está conectada al formulario.
- **No detecta si el cliente ya existe** por RUT o teléfono antes de crear la ficha, así que se pueden generar duplicados. Con la cobertura de RUT en 8,7%, conectar esa validación tiene poco efecto hoy; conviene hacerlo cuando la cobertura suba.
