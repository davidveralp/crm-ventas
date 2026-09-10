# v113 · Las cuatro áreas de la OT y el paso de valorización

**Fecha:** 18 de agosto de 2026
**Requiere:** **migración 73** · redesplegar `clickup-sync`

---

## Lo que muestra el documento de Dimasoft

Revisé las ocho capturas de la OT 13696. Dimasoft divide la orden en pestañas: Trabajo Solicitado, Observaciones, **Repuestos**, **Lubricantes y Otros Insumos**, **Mano de Obra/Mecánicos** y **Servicios Externos**.

Y encontré exactamente el problema que hay que resolver. En Observaciones de esa OT real está escrito:

> *"REPARACIÓN DE CAMBIO DE BIELETAS, BANDEJAS Y CORREA DE ACCESORIOS $289.000"*

**El precio va dentro de un texto libre, sin línea de detalle.** Así no hay margen por ítem, no hay consumo de bodega, y no se puede saber qué repuesto se usó ni a qué costo.

---

## Cómo queda ahora

### En el Nuevo Ingreso · el asesor carga QUÉ
Un bloque **"Detalle de la orden"** con las cuatro áreas. Se elige el área, se escribe la línea, se pone cantidad y se agrega.

**Sin precios.** El asesor sabe qué hay que hacerle al auto; cuánto cuesta no es su decisión.

Al registrar, esas líneas:
- Se guardan en la OT esperando valorización
- **Suben a ClickUp agrupadas por área**, con separadores `*** REPUESTOS ***`, `*** MANO DE OBRA ***` — el mismo formato que el taller ya usa
- Generan un aviso al encargado de presupuestos

### Nueva sección · "Valorizar OT"
Para el encargado de presupuestos, jefe de taller y admin.

Muestra las órdenes con líneas sin precio, ordenadas por antigüedad y en rojo si llevan más de un día. Al abrir una:

- Las líneas ya están escritas, agrupadas por área
- Un punto rojo marca las que faltan
- Se completa **precio** (lo que se cobra) y, opcionalmente, **costo** (para el margen)
- Repuestos admite código; servicios externos, proveedor
- El total se calcula en vivo

Al guardar, cada línea registra **quién la valorizó y cuándo**, y se avisa al asesor de que ya puede hablar con el cliente.

### Al cerrar
El detalle ya está completo. El asesor solo confirma y emite el documento.

---

## El circuito completo

```
ASESOR (ingreso)          → carga las líneas, sin precio
     ↓
CLICKUP                   → subtareas agrupadas por área
     ↓
ENCARGADO (valorizar)     → pone precio y costo
     ↓
MECÁNICO (ClickUp)        → marca lo que va haciendo
     ↓
ASESOR (cierre)           → confirma y emite la OT
```

**Cada dato se escribe una sola vez, por quien lo sabe.**

---

## Qué hacer

1. Ejecuta la **migración 73**
2. Redespliega **`clickup-sync`**
3. Sube la v113
4. Registra un ingreso cargando líneas en las cuatro áreas
5. Revisa ClickUp: deben aparecer agrupadas con sus separadores
6. Entra como Víctor a **Valorizar OT** y ponles precio

---

## Sobre la convivencia con Dimasoft

El folio de Dimasoft va en **13696** y nuestra secuencia parte en **13736**. Hay un margen de 40 números, lo que evita choques mientras ambos sistemas operen.

Conviene tenerlo presente: durante la transición habrá un salto visible en la numeración. Si prefieres que sea correlativo exacto, hay que definir el momento del corte y ajustar la secuencia.
