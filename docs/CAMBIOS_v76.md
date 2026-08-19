# v76 · Presupuestos por vehículo

**Fecha:** 18 de agosto de 2026
**Requiere:** ejecutar la **migración 60** antes de usar
**Depende de:** migraciones 56, 57 (roles) y 59 (RADAR)

---

## El problema que resuelve

Hasta ahora **solo se podía cotizar sobre un vehículo que estaba en el taller**. La tabla exigía un trabajo de taller abierto, así que tres situaciones frecuentes no tenían salida en el sistema:

- El cliente llama a preguntar un precio y su auto no está ingresado.
- Se quiere hacer seguimiento a una alerta roja de RADAR detectada en una visita anterior.
- Se quiere cotizar algo preventivo sobre un vehículo conocido.

En esos casos la cotización se hacía por fuera —papel, WhatsApp, memoria— y no quedaba registrada ni medida.

---

## Qué vas a ver distinto

### 1. Botón "💰 Solicitar presupuesto" en la ficha del vehículo
En **Vehículos → [patente]**, bajo el nombre del cliente.

Al tocarlo se abre una ventana con dos partes:

- **"¿Qué necesita el cliente?"** — texto libre. Se escribe tal como lo pidió el cliente.
- **Alertas del último RADAR** — si el vehículo tiene rojos o amarillos vigentes, aparecen como lista marcable. Se eligen las que se quieran cotizar.

Al enviar, la solicitud le llega al **coordinador de adquisiciones** como notificación, y aparece en el módulo Presupuestos en estado *solicitado*.

### 2. La pestaña Presupuestos del vehículo ahora muestra todo
Antes mostraba solo los presupuestos que colgaban de un trabajo de taller. Ahora incluye también los que nacieron desde la ficha, con una columna **Origen** que distingue:

| Origen | Significa |
|---|---|
| **Taller** | Nació de un trabajo en curso |
| **Consulta** | Cotización sin OT, a pedido del cliente |
| **RADAR** | Seguimiento de alertas de una inspección |

### 3. El módulo Presupuestos recibe las solicitudes nuevas
El coordinador ve las cotizaciones sin trabajo asociado junto a las de taller, con la patente y el cliente igual que siempre.

---

## Instructivo

### Cotizar a un cliente que llama a preguntar
1. Menú → **Vehículos**, busca la patente.
2. Toca **💰 Solicitar presupuesto**.
3. Escribe qué te pidió, en tus palabras. Ejemplo: *"consulta precio de kit de embrague completo, incluir mano de obra"*.
4. **Enviar a cotizar**.
5. El coordinador recibe la notificación, valoriza los ítems y lo envía al cliente con el PDF de siempre.

### Dar seguimiento a una alerta de RADAR
1. Ficha del vehículo → **💰 Solicitar presupuesto**.
2. Marca las alertas que quieras cotizar de la lista que aparece.
3. Puedes agregar texto además de las alertas marcadas.
4. **Enviar a cotizar**.

Los ítems llegan al coordinador **con el detalle técnico y sin precio** —incluida la observación que escribió el técnico— para que solo tenga que valorizar.

### Ver el estado de lo solicitado
Ficha del vehículo → pestaña **Presupuestos**. Ahí está todo el historial de cotizaciones de esa patente, con su origen, estado y monto.

---

## Detalles que conviene saber

**Quién hace qué.** El asesor describe, el coordinador valoriza y envía. Es el mismo reparto que ya funciona en taller: quien conoce al cliente no tiene que saber precios de repuestos, y quien conoce los precios no tiene que adivinar qué pidió el cliente.

**Los ítems nacen sin precio.** Aparecen en $0 hasta que el coordinador los complete. Es a propósito: un precio puesto por quien no cotiza genera expectativas que después hay que desdecir.

**Si después el vehículo entra al taller**, el presupuesto previo se puede enganchar al trabajo nuevo en vez de rehacerlo, mediante la función `presupuesto_vincular_trabajo`. Todavía no tiene botón en la interfaz; por ahora se hace desde la base.

**Estas cotizaciones también generan oportunidad**, así que entran en el panel de Venta cruzada. Si no, una venta nacida de una alerta RADAR no se contaría.

**Los presupuestos que ya existían** quedaron vinculados a su vehículo automáticamente al ejecutar la migración, así que el historial aparece completo desde el primer día.

---

## Lo que todavía no hace

- **No hay botón para vincular** un presupuesto previo a un trabajo nuevo. La función existe en la base; falta la interfaz.
- **La vigencia no se aplica sola.** Se agregó el campo `vigencia_dias` (15 por defecto) pero nada marca todavía los presupuestos vencidos.
- **El asesor no puede valorizar**, ni siquiera de forma referencial. Si se necesita que dé un rango en el momento de la llamada, hay que decidirlo: hoy el sistema lo impide a propósito.
