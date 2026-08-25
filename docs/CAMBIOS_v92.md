# v92 · El proceso del asesor dentro de la inspección

**Fecha:** 18 de agosto de 2026
**Requiere:** migración 65 · (más las 62, 63 y 64 si siguen pendientes)

---

## Qué cambia y por qué

La inspección capturaba el estado físico del vehículo. Pero el asesor hace más que revisar el auto: **clasifica el ingreso**, y esa clasificación define cómo se mide después.

Esos campos existían solo en Nueva OT, que se llena **después**, cuando el cliente ya se fue. El asesor tenía que recordar lo que dijo o dejarlo en blanco.

Ahora se piden en el momento en que se saben: **con el cliente al frente**.

---

## Lo que se agregó

### Clasificación del ingreso
| Campo | Por qué en el ingreso |
|---|---|
| **Tipo de ingreso** | Decide si la OT cuenta como **garantía**. Al elegir una de garantía aparece un aviso: el tope es 3 por sucursal al mes |
| **Sucursal** | Define a qué meta comercial suma la venta. Se precarga según tu rol: si eres asesor Toyota, viene Toyota |
| **Tipo de cliente** | Particular, Empresa o Interno |

### Quién es quién
Tres campos que la OT en papel distingue y el CRM mezclaba:

- **Quién trae el vehículo** — cuando no es el titular
- **Dueño del vehículo** — cuando no es quien paga. En la OT 13544, REPARATUAUTO SPA paga y Hans Duarte es el dueño
- **Aseguradora** — si aplica

### Origen del cliente
**"¿Cómo conoció DIDIAL?"** aparece **solo si el cliente es nuevo**. A alguien que viene hace años, preguntarle eso es incómodo y el dato sale falso.

Es el único momento en que se puede preguntar con naturalidad, y es lo que permite saber qué canal comercial funciona.

### Autorizaciones
- **Movilizar el vehículo para pruebas** — es la política 1 que el cliente firma en el documento
- **Contacto para recordatorios de mantención** — si se desmarca, aparece un aviso: el cliente queda fuera de las campañas de fidelización

---

## Prioridad automática

Un ingreso por **garantía** o que **llegó en grúa** entra con prioridad **alta**. Son los casos donde la demora cuesta más: en credibilidad frente a un cliente que ya tuvo un problema, o en costo directo de grúa.

---

## Lo que deliberadamente NO se agregó

Los campos de **cierre** siguen en Nueva OT: tipo de documento, número, montos, estado final del vehículo, fecha de entrega real y encuesta de satisfacción.

No es olvido. Al recibir el vehículo **todavía no ocurrieron**: no se sabe cuánto va a costar ni si el cliente quedó conforme. Pedirlos en la recepción obligaría a inventar o dejar en blanco, y un formulario que se llena con datos falsos es peor que uno que no los pide.

---

## Instructivo

### Recibir un vehículo
1. **Nuevo cliente** → **Ingreso con vehículo**.
2. Patente y kilometraje.
3. **Trabajo a realizar**: toca los servicios o escribe lo que pidió el cliente.
4. **Clasificación del ingreso**: revisa el tipo (viene "Normal"), confirma la sucursal (viene la tuya) y el tipo de cliente.
5. Si el auto lo trae otra persona o el dueño no es quien paga, complétalo.
6. Si es cliente nuevo, pregunta cómo nos conoció.
7. Confirma las autorizaciones con el cliente antes de que firme.
8. Sigue con luces, combustible, daños, fotos, checklist y firma.
9. **✓ Registrar e imprimir**.

### Lo que queda creado
Ficha de cliente · ficha de vehículo · inspección · documento firmado · trabajo en Taller con su prioridad y sucursal · tarjeta en ClickUp.

---

## Nota

El verificador de esquema detuvo el build al detectar las siete columnas nuevas antes de compilar, y por eso se escribió la migración 65 antes de entregarte esta versión. Es la herramienta que agregamos en la v87 haciendo lo que corresponde.
