# v110 · Correlativos de OT y presupuesto · corrección de subtareas

**Fecha:** 18 de agosto de 2026
**Requiere:** **migración 71** · redesplegar `clickup-sync`

---

## 1. Por qué no llegaban las tareas de ClickUp

Encontré el error con tu caso del Hyundai TUCSON. En la importación había esto:

```js
if (yaHay) { r.ya_estaban++; continue }   // ← salta sin importar subtareas
```

Si la tarjeta **ya estaba vinculada**, el código la contaba y seguía de largo. Como la mayoría de los vehículos ya están vinculados, **las subtareas nunca se importaban para ninguno**.

Ahora, para las ya vinculadas también se traen las subtareas, y de paso se refrescan el estado y el progreso.

**Segundo arreglo:** con `subtasks=true` las subtareas venían en la misma lista y podían tratarse como vehículos. Ahora se filtran por su `parent`.

---

## 2. El número de OT se asigna al ingresar

Antes se generaba al cerrar. Eso dejaba al vehículo **sin número mientras estaba en el taller**: no se podía referenciar por teléfono, ni escribirlo en el papel, ni buscarlo.

Ahora nace con la OT, mediante un trigger en la base.

**La numeración parte en 13736**, continuando la de Dimasoft. La secuencia solo se adelanta, nunca retrocede: eso repetiría números ya emitidos.

Al terminar el ingreso, la pantalla muestra el número en grande, y va en el acta que firma el cliente.

---

## 3. Presupuestos con correlativo propio

Formato **P-00001**, distinto del de la OT.

**Por qué separados:** una misma atención puede tener varias cotizaciones —la inicial, una revisada, una parcial—. Si compartieran número serían ambiguas.

Cada presupuesto guarda además **la OT y la patente** a la que pertenece, así que se pueden encontrar todas las cotizaciones de una atención. Un trigger las hereda solo, sin que nadie las escriba.

---

## 4. Documento de salida

Mismo formato que el de ingreso, con el **mismo número de OT**, y el detalle valorizado en los cinco grupos que pediste:

| |
|---|
| Repuestos |
| Mano de obra |
| Insumos |
| Servicios externos |
| Descuentos |
| **TOTAL** |

Cada grupo lista sus líneas con código, descripción, cantidad, precio unitario y total, más su subtotal. Abajo el resumen por grupo y la leyenda **"Valores con IVA incluido"**.

---

## Qué hacer

1. Ejecuta la **migración 71**
2. Redespliega **`clickup-sync`**
3. Sube la v110
4. En Taller, **⟳ Sincronizar ClickUp** — ahora sí deberían aparecer las tareas del TUCSON con Gabriel Cayo asignado
5. Registra un ingreso de prueba: debería mostrar **OT N° 13736**

---

## Nota sobre los trabajos existentes

Los que ya están en el taller **no tienen número**, porque se crearon antes del trigger. Se les asignará al cerrarlos. Si prefieres numerarlos ahora, es una consulta corta — dime y la preparo.
