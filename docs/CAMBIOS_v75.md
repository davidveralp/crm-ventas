# v75 · Panel de Vehículos

**Fecha:** 18 de agosto de 2026
**Requiere:** migración 59 ejecutada (para que se vean los RADAR)
**Migraciones nuevas:** ninguna

---

## Qué vas a ver distinto en la aplicación

### 1. Nueva sección "Vehículos" en el menú
Aparece en el bloque **OPERACIÓN**, entre Taller y Control OT.

Hasta ahora el CRM estaba organizado por **cliente**. Pero en un taller la unidad de trabajo real es el **vehículo**: es lo que entra, lo que se inspecciona y lo que tiene historial técnico. Un cliente con tres autos tenía la información de los tres mezclada en una sola ficha.

### 2. Listado de vehículos
Al entrar ves cuatro contadores y una tabla:

- **Total** · **Con críticos** · **Por atender** · **Sin RADAR**
- Cada contador es un filtro: tócalo y la tabla se reduce a esos vehículos.
- La tabla muestra patente, vehículo (con tracción y transmisión), cliente, año, kilometraje y **estado de salud** en forma de dos números: rojos y amarillos pendientes.

El buscador acepta **patente, marca, modelo o nombre del cliente**, y la patente la encuentra la escribas como la escribas: `GRWW76`, `GR WW 76` o `gr-ww-76` dan el mismo resultado.

### 3. Ficha del vehículo
Al tocar una fila se abre la historia completa de esa patente, con cinco pestañas:

| Pestaña | Qué contiene |
|---|---|
| **Resumen** | Panel de salud (alertas rojas y amarillas) + todos los datos del vehículo |
| **RADAR** | Cada inspección con su semáforo, y la opción de desplegar **los 45 criterios** con lo que respondió el técnico |
| **Presupuestos** | Todos los presupuestos de taller de ese vehículo, con estado, ítems y monto |
| **Servicios** | Historial de OTs: fecha, servicio, km, documento y monto |
| **Taller** | Trabajos con su estado, prioridad y si están sincronizados con ClickUp |

Arriba, cuatro cifras de contexto: **visitas, facturado, ticket promedio y última visita**.

---

## Instructivo

### Buscar un vehículo
1. Menú → **Vehículos**.
2. Escribe la patente en el buscador. No importa el formato ni las mayúsculas.
3. Toca la fila para abrir su ficha.

### Ver qué respondió el técnico en el RADAR
1. Abre la ficha del vehículo.
2. Pestaña **RADAR**.
3. Cada inspección muestra el resumen: cuántos críticos, por atender y correctos.
4. Toca **"Ver los 45 criterios"** para desplegar el detalle completo, agrupado por categoría, con la opción elegida y la observación que escribió el técnico.

Esto responde la pregunta que antes no se podía: *"¿qué revisó exactamente el técnico y qué anotó?"*. En Taller solo se ven los rojos y amarillos; acá está todo, incluidos los criterios que salieron bien.

### Encontrar los vehículos que necesitan atención
1. En el listado, toca el contador **"Con críticos"**.
2. La tabla queda solo con los vehículos que tienen alertas rojas vigentes.
3. Úsalo para preparar llamadas: cada uno es una venta pendiente y un riesgo para el cliente.

El contador **"Sin RADAR"** sirve para lo contrario: vehículos que pasaron por el taller y nunca se inspeccionaron.

### Ir del vehículo al cliente
En la cabecera de la ficha, el nombre del cliente es un enlace. Un toque y estás en su ficha comercial.

---

## Detalles que conviene saber

**Las alertas mostradas son de la inspección más reciente.** Las anteriores quedan como historial, colapsadas en el panel de salud. Si la última inspección tiene más de 6 meses, el panel lo advierte: conviene confirmar que las alertas siguen vigentes antes de ofrecerlas al cliente.

**El listado muestra hasta 200 vehículos por vez.** Con ~1.150 en la base, cargar todos haría la tabla lenta sin que nadie los lea. Si el que buscas no aparece, afina la búsqueda.

**Los servicios se cruzan por patente**, no por identificador de vehículo, porque el histórico importado desde la planilla no tiene el vínculo. Si una patente está escrita de dos formas distintas en el histórico, podrían faltar visitas. La migración 49 y el script `normalizar_clientes.gs` reducen ese riesgo, pero no lo eliminan del todo.

---

## Lo que todavía no hace

- **No permite editar** los datos del vehículo desde esta pantalla; sigue haciéndose desde Nueva OT o la ficha del cliente.
- **No exporta** a Excel ni PDF. Si te sirve tenerlo, se puede agregar con el mismo mecanismo del Panel Operativo.
- **No muestra el gasto proyectado** ni recordatorios de próxima mantención por kilometraje. Es el paso natural siguiente, aprovechando que ya está el km y el historial.
