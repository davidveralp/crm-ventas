# v87 · Chasis, campos de la OT en papel, y verificación automática del esquema

**Fecha:** 18 de agosto de 2026
**Requiere:** ejecutar la **migración 63** antes de registrar un ingreso

---

## El error

> No se pudo crear el vehículo: Could not find the 'chasis' column of 'vehiculos'

## La causa

En la v79 agregué el campo **Chasis** al formulario y al documento impreso. En la documentación de esa versión escribí que faltaba crear la columna en la base... y **nunca escribí la migración**. El formulario lo enviaba igual, así que fallaba.

Es el tercer error de la misma familia en pocos días:

| Versión | Columna | Tabla |
|---|---|---|
| 54 | `traccion` | ordenes_trabajo |
| 86 | `estado` | clientes (no existía, era `estado_id`) |
| 87 | `chasis` | vehiculos |

Siempre el mismo síntoma, y siempre descubierto por ti al usar la app.

---

## Migración 63

Además de `chasis`, agrega los otros campos que la auditoría v76 detectó comparando la OT en papel contra el modelo:

| Campo | Para qué |
|---|---|
| **chasis** | VIN. Identificador universal: no cambia aunque cambie la patente |
| **aseguradora** | Relevante para siniestros y trabajos de DyP |
| **dueno_nombre** | Cuando el dueño no es quien paga. En la OT 13544, REPARATUAUTO SPA paga y HANS DUARTE es el dueño |
| **dueno_telefono** | A quién llamar cuando el vehículo está listo |

El chasis lleva índice único (parcial, solo para los de 17 caracteres), porque el VIN es único por vehículo a nivel mundial. No bloquea las fichas sin chasis, que hoy son casi todas.

---

## La corrección de fondo: verificación automática

Escribí `scripts/check-schema.mjs`, que **compara cada columna que la aplicación escribe contra las que declaran las 63 migraciones**. Corre en cada `npm run build` y lo detiene si encuentra una que no existe.

Ni Vite ni ESLint miran el esquema de la base, por eso estos errores llegaban siempre a producción. Ahora se detectan antes de compilar.

### Cuatro errores que ya estaban y nadie había notado

Al ejecutarlo por primera vez encontró **cuatro inserts a `notificaciones` con la columna `rol` en vez de `rol_destino`**. Esas notificaciones **nunca se enviaron**:

| Dónde | Aviso que no llegaba |
|---|---|
| Nueva OT | Solicitud de anulación de OT → administración |
| Ficha del cliente | Nueva solicitud de presupuesto → coordinador de adquisiciones |
| Ficha del cliente | Presupuesto APROBADO · gestionar compra → coordinador |
| Ficha del cliente | Presupuesto aprobado con respaldo → jefe de taller |

Los cuatro corregidos. Si notabas que ciertos avisos no llegaban, esta es la razón.

---

## Qué hacer

1. Ejecuta la **migración 63** en Supabase.
2. Sube la v87.
3. Vuelve a intentar el registro.

Si aparece otro mensaje de "column ... in the schema cache", la migración 63 incluye al final un `notify pgrst, 'reload schema'` que fuerza a Supabase a releer el esquema sin reiniciar el proyecto.

---

## Pendientes que siguen

- **Migración 62** — para que el ingreso cree el trabajo en Taller.
- El formulario todavía **no pide aseguradora ni dueño**, aunque las columnas ya existan. Si quieres capturarlos en la recepción, se agregan al panel.
