# v105 · Cierre de OT con detalle por línea

**Fecha:** 18 de agosto de 2026
**Requiere:** **migración 68**

---

## El cambio

El cierre guardaba montos agregados: *"repuestos $85.000"*. Con eso **no se puede saber qué repuesto se usó ni a qué precio**, que es justamente lo que se necesita para calcular margen, descontar de bodega y explicarle el cobro al cliente.

Ahora cada línea se detalla.

---

## Qué vas a ver

En **Mis vehículos → Pendientes de cierre**, al abrir un vehículo listo:

### Cuatro grupos, cada uno con sus líneas
| Grupo | Qué se registra |
|---|---|
| **Repuestos** | Código + descripción + cantidad + precio unitario |
| **Mano de obra y servicios** | Descripción + cantidad + precio |
| **Insumos y lubricantes** | Descripción + cantidad + precio |
| **Servicios externos** | Descripción + cantidad + precio |

Cada línea muestra su total y el grupo muestra el subtotal. **La cantidad admite decimales**, para los 4,5 litros de aceite.

Solo Repuestos tiene campo de código: es donde va a servir cuando exista bodega.

### Correlativo automático
Al cerrar se genera el **número de OT**. Usa una secuencia de la base, no un conteo de filas: dos asesores cerrando al mismo tiempo obtendrían el mismo número si se contara.

**Parte en 13600** para continuar la numeración de Dimasoft sin chocar con las ya emitidas — la OT 13544 es de agosto.

### Dos salidas automáticas
Al registrar la salida:

1. **Se abre el PDF de la OT** con el detalle completo, subtotales por grupo, descuento, total y bloques de firma para quien retira y quien entrega.
2. **Se envía a la planilla de Google**, que sigue siendo la base histórica del negocio.

Si la planilla falla, **la entrega no se bloquea**: el cliente se va con su documento igual.

---

## Detalles de implementación

**El total se calcula desde las líneas**, no se escribe a mano. Los montos por grupo que se guardan en el trabajo salen de sumar sus líneas, así cabecera y detalle no pueden contradecirse.

**El detalle se reemplaza completo al guardar.** Es más simple y seguro que conciliar altas, bajas y ediciones una por una.

**Si el cierre queda a medias**, las líneas ya guardadas se recuperan al volver a abrir.

**El total de cada línea lo calcula la base** (`generated always as`), no el frontend: un error de redondeo dejaría el documento descuadrado.

---

## Instructivo

1. **Mis vehículos** → pestaña **Pendientes de cierre** → toca el vehículo.
2. Documento y número.
3. En cada grupo, **+ Agregar** y completa las líneas. Sé específico en repuestos: *"Filtro de aceite Toyota 90915-YZZE1"* sirve; *"filtro"* no.
4. Descuento si corresponde. El total se calcula solo.
5. Quién retira y observaciones.
6. **✓ Registrar salida** → se abre el PDF y la OT va a la planilla.

---

## Lo que esto habilita

- **Margen por línea**, cuando se cargue el costo (la columna ya existe).
- **Consumo de bodega**: al construir ese módulo, cada repuesto usado ya está identificado.
- **Historial real por vehículo**: qué se le cambió y cuándo, no solo cuánto se cobró.
