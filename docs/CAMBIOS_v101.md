# v101 · Nuevo Ingreso: orden, servicios y venta cruzada

**Fecha:** 18 de agosto de 2026
**Requiere:** **migración 67** (actualizada — vuelve a ejecutarla si ya la corriste)

---

## Los cambios que pediste

### 1. Patente arriba, kilometraje con el vehículo
La **patente** queda como primer campo: es la llave que decide si todo lo demás se precarga o hay que pedirlo. El **kilometraje** se movió a Datos del vehículo, junto a marca, modelo y año.

### 2. Fecha de ingreso automática y no editable
Es la fecha de hoy y se muestra bajo la patente, sin campo que editar. Es el dato que fija el inicio del cómputo de permanencia; poder cambiarlo solo genera inconsistencias.

### 3. Fecha probable de entrega, después del servicio
El campo está **deshabilitado hasta elegir el tipo de servicio**, con un aviso que lo explica. Antes de saber qué se va a hacer, prometer una fecha es adivinar.

### 4. Grúa una sola vez
Se eliminó la casilla duplicada. Queda el selector **Sí / No** original, y debajo va **Trabajo a realizar**.

### 5. Sin agrupación por unidad de negocio
Desaparecieron los encabezados TALLER MECÁNICO / SERVICIO RÁPIDO / DYP del trabajo a realizar. Ahora **el tipo de servicio determina la unidad**, y el formulario lo muestra al elegirlo:

> *Unidad de negocio: **Servicio Rápido***

"Trabajo a realizar" quedó como texto libre: lo que pide el cliente, en sus palabras.

### 6. Pack Mantención 360° primero
Encabeza la lista de servicios. **El orden de una lista influye en lo que se elige**, así que el servicio que el negocio quiere empujar va arriba.

### 7. Venta cruzada
Al elegir el servicio principal aparece un bloque con **los mismos servicios menos el ya elegido**. Todo lo que se marque ahí es venta adicional sobre el motivo de la visita.

El bloque se pone verde y muestra el contador cuando hay algo marcado. Se filtran los servicios que no aplican al tipo de vehículo.

---

## Por qué esto importa

Es la diferencia entre registrar lo que el cliente vino a pedir y **registrar lo que se le vendió además**.

Hasta ahora la venta cruzada solo se medía después del RADAR, con los hallazgos técnicos. Este bloque captura la que ocurre **en el mostrador**, cuando el asesor ofrece una alineación junto al cambio de aceite.

Se guarda en `servicios_extra`, separado del servicio principal, para poder medir cuánto se suma sobre el motivo del ingreso.

---

## Instructivo

1. **Patente** → si existe, valida los datos; si no, complétalos.
2. Datos del cliente y del vehículo, incluyendo kilometraje.
3. **¿Ingresó en grúa?**
4. **Trabajo a realizar**: lo que dijo el cliente.
5. **Tipo de servicio principal** → se muestra la unidad de negocio y se habilita la fecha de entrega.
6. **Venta cruzada**: marca los adicionales que el cliente acepte.
7. Presupuesto si lo pide, clasificación, revisión de recepción, testigos, daños y firma.

---

## Nota sobre la migración

La 67 **cambió**: se agregó la columna `servicios_extra`. Si ya la ejecutaste, vuelve a correrla — los `add column if not exists` no repiten lo ya creado y solo agrega la nueva.
