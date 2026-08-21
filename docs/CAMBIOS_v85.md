# v85 · Iconos del tablero e ingreso identificado en ClickUp

**Fecha:** 18 de agosto de 2026
**Requiere:** ejecutar la **migración 62** antes de usar

---

## 1. Testigos con la forma real del tablero

Los nueve iconos se redibujaron siguiendo la iconografía estándar (ISO 2575, la que usan todos los fabricantes y aparece en la referencia que enviaste):

| Testigo | Forma |
|---|---|
| Check engine / Falla motor | Bloque de motor de perfil con sus aletas |
| Aceite | Aceitera con gota cayendo |
| Temperatura | Termómetro sobre olas de refrigerante |
| Batería | Caja con bornes + y − |
| Freno | Círculo con paréntesis y signo de exclamación |
| Airbag | Ocupante con la bolsa desplegada |
| ABS | Círculo con las letras y paréntesis laterales |
| Presión de neumáticos | Neumático en corte con exclamación |
| Luces altas | Haz recto de líneas paralelas |

Siguen cambiando al color correspondiente al tocarlos: rojo para detener el vehículo, ámbar para revisar pronto, azul para luces altas. Van dibujados como trazos, no como imágenes, así que no agregan peso a la carga.

---

## 2. El vehículo ya no entra a ClickUp "por designar" sin datos

**El problema:** la inspección de ingreso guardaba su registro pero **no creaba el trabajo de taller**. El vehículo aparecía en ClickUp sin patente, sin cliente y sin lo que pidió el cliente.

**Ahora**, al completar la inspección se crea el trabajo con:

- Título con patente, marca y modelo
- Cliente y vehículo vinculados
- **Lo que pidió el cliente**, tal como se escribió en la inspección
- Observaciones del cliente
- Kilometraje de ingreso
- Enlace a la inspección que lo originó

Sigue naciendo en estado **"Por designar"**, porque el jefe de taller es quien decide el técnico. La diferencia es que ahora llega **identificado**: se ve de qué vehículo se trata y qué hay que hacerle.

---

## Instructivo

### Recibir un vehículo
1. **Nuevo cliente** → **Ingreso con vehículo**.
2. Completa el formulario. En "Trabajo a realizar" escribe lo que pide el cliente: **ese texto es el que va a ver el taller**.
3. Marca los testigos encendidos tocando sus iconos.
4. **✓ Registrar e imprimir**.

Al terminar tendrás la ficha del cliente, la del vehículo, el documento firmado **y el trabajo esperando en Taller**, en la columna "Por designar".

### Asignarlo
1. **Taller** → columna **Por designar**.
2. Abre el trabajo: ahí está la solicitud del cliente y el panel de salud del vehículo.
3. Asigna el técnico y muévelo de estado. Al solicitar revisión nace la tarjeta espejo en ClickUp, ya con toda la información.

---

## Detalles que conviene saber

**Si la creación del trabajo falla**, la inspección igual se guarda y el documento se imprime. El error queda en la consola pero no interrumpe la recepción: es preferible que el cliente se vaya con su papel a que se caiga todo el proceso por un problema secundario.

**"Por designar" es correcto como estado inicial.** No es un error que el vehículo aparezca ahí: es el estado que significa "ingresó, falta asignarle técnico". Lo que estaba mal era que llegara vacío.

---

## Lo que todavía no hace

- **No crea la tarjeta en ClickUp de inmediato.** Eso sigue ocurriendo cuando el jefe de taller presiona "Solicitar revisión". Si prefieres que la tarjeta nazca junto con el ingreso, se puede cambiar.
- **No asigna técnico automáticamente**, ni siquiera sugiere uno según carga de trabajo.
