# v122 · Servicios adicionales y ubicación de las observaciones

**Fecha:** 18 de agosto de 2026
**Migraciones nuevas:** ninguna

---

## 1. Lista de servicios adicionales

Aparece **justo después de elegir el servicio solicitado**, como lista desplegable propia con los 18 servicios:

Airlife · Nitrofil · Adblue · Limpieza tapiz · Limpieza motor · Lavado chasis · Sellado chasis · Pulido de foco · Pulido de carrocería · Sellado cerámico · Recarga de extintores · Pisaderas · Antivuelco · Lona marítima · Instalación de alarmas · Instalación de corta corriente · Instalación de GPS · Instalación de láminas de seguridad

Cada selección se agrega como etiqueta verde y desaparece de la lista, así no se repite. El bloque se pone verde con el contador cuando hay algo agregado.

### Por qué en lista aparte

**Miden algo distinto.** El servicio solicitado es el motivo de la visita — lo que el cliente vino a buscar. Los adicionales son lo que **el asesor logró sumar** con el cliente presente.

Mezclarlos en un solo catálogo hacía imposible separar una cosa de la otra. Ahora se guardan en `servicios_extra`, aparte del servicio principal, y eso permite medir **la venta cruzada por asesor**: cuántos ingresos suman adicionales, cuáles se venden más, quién convierte mejor.

Es el dato que el panel de venta cruzada necesitaba y no tenía.

---

## 2. Observaciones del asesor, antes de la firma

Se movieron al final del formulario, justo antes de la sección de firma.

**Tiene sentido operativo:** el asesor escribe sus observaciones **después** de haber recorrido el vehículo, revisado los siete puntos y marcado los testigos. Con todo a la vista. Pedirlas al principio obligaba a volver a subir cuando encontraba algo.

El campo quedó de tres líneas, con la nota de que va en el acta que firma el cliente y en el detalle de la orden.

---

## Qué probar

1. Elige un servicio solicitado
2. Debe aparecer **Servicios adicionales** con la lista de 18
3. Agrega dos o tres: aparecen como etiquetas verdes
4. Baja hasta el final: las observaciones del asesor están antes de la firma
5. Registra y revisa que los adicionales aparezcan en el documento impreso
