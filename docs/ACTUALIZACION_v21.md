# ACTUALIZACIÓN v21 · Guía de despliegue
**CRM DIDIAL / Plataforma VPAI · 03-07-2026**

Esta versión incluye: separación Nueva OT / Solicitar servicio, tareas predefinidas por servicio, presupuestos en 4 secciones con PDF oficial DIDIAL, base de precios integrada, nombres/apellidos separados, sincronización bidireccional con la planilla base de OT, corrección del bug del historial de servicios ("—" sin descripción ni monto) y boleta/factura por OT.

---

## 1. Migraciones SQL (SQL Editor de Supabase, en orden)

1. **`database/25_actualizacion_v21.sql`** — columnas nuevas (apellidos, tipo_vehiculo, documento en servicios), tabla `tareas_servicio` con las 32 tareas de MAN X PAUTA, tabla `precios_base`, función `crm_aplicar_datos_ot` y re-vinculación de servicios por patente.
2. **`database/26_seed_precios_v21.sql`** — carga las 985 filas de la base de precios (921 servicios aplicables por tipo de vehículo + 55 precios fijos + 9 insumos, actualización de precios 09-04-2026). Es idempotente: borra y recarga.

## 2. Apps Script — planilla DIDIAL_Base_OT

### 2a. Reemplazar `sincronizar_servicios.gs` (v2)
En el proyecto Apps Script de la planilla, reemplaza el contenido del archivo de sincronización por el nuevo `integraciones/sincronizar_servicios.gs`. Conserva tu `SB_URL` y `SB_KEY` actuales.

- **Corrige el bug del historial**: las OT duplicadas en la planilla ahora se fusionan prefiriendo el dato no vacío (antes la fila duplicada incompleta pisaba a la completa — esa es la causa de las OT con "—" sin monto, como la 12211, 10933 y 12595).
- Sube **tipo y N° de documento** (boleta/factura) al historial.
- Aplica datos de contacto/vehículo de la planilla al CRM **solo en campos vacíos** (no pisa lo editado en el CRM).
- Ejecuta primero **`crmVerificarColumnas()`** y revisa el log: te dice qué encabezados opcionales detectó (documento, propietario, teléfono, etc.). Si alguno de tu planilla tiene otro nombre, agrégalo a la lista `COL_OPC`.
- Luego ejecuta **`crmSyncServicios()`** una vez a mano. Con esto el historial queda reparado y con documentos.

### 2b. Nuevo `crm_actualizar_ot.gs` (CRM → planilla)
1. En el mismo proyecto Apps Script, crea un archivo nuevo y pega `integraciones/crm_actualizar_ot.gs`.
2. Cambia `CRM_UPD_TOKEN` por un texto secreto propio.
3. Implementar → Nueva implementación → **Aplicación web** → Ejecutar como: tú · Acceso: **Cualquier usuario** → Implementar. Copia la URL.
4. Guarda la URL (con el token) en Supabase:
   ```sql
   update empresa_config
      set valor = to_jsonb('https://script.google.com/macros/s/…/exec?token=TU_TOKEN'::text)
    where empresa_id = '00000000-0000-0000-0000-000000000001'
      and clave = 'sheet_update_url';
   ```
Con esto, al editar los datos de contacto de un cliente o un vehículo en el CRM, se actualizan todas las filas relacionadas de la base de OT (por patente y N° de OT).

**Política de conflictos (decisión de diseño):** CRM → planilla escribe siempre al momento de editar; planilla → CRM solo completa campos vacíos. Así ninguna sincronización automática pisa lo que editaste en el CRM. Si prefieres que la planilla mande, se cambia en la función `crm_aplicar_datos_ot`.

## 3. Deploy del frontend
Reemplazo total del repo con el zip (como siempre: GitHub Desktop o git push, nunca archivo por archivo por la web). Verificar el deploy en Vercel.

## 4. Puesta en marcha funcional
1. **Definir el tipo de vehículo** (AUTO / SUV / PICK UP / VAN-FURGÓN-CAMIÓN) en los vehículos activos: es lo que selecciona el precio de MO correcto en la base de precios. Editar vehículo → "Tipo de vehículo".
2. En la ficha de cliente ahora hay dos acciones independientes por vehículo: **Nueva OT** y **Solicitar servicio** (ex "→ Revisión"). Solicitar servicio abre la misma lista de servicios de la Nueva OT; **MAN X PAUTA** autocompleta sus 32 tareas (editables).
3. En el taller, el coordinador cotiza por secciones (**Repuestos · Lubricantes y Otros Insumos · Mano de Obra · Servicios Externos**), con **costo** (interno, no sale en el PDF) y **precio de venta** separados, y un buscador de la base de precios que inserta la MO según el tipo de vehículo, más los insumos y el rango eco/premium de repuestos como referencia.
4. El asesor ajusta precios libremente para negociar; si sale del rango de referencia queda marcado en ámbar (no se bloquea). El **PDF** sale con el formato oficial DIDIAL (secciones, subtotales, NETO/IVA/TOTAL — valores IVA incluido, desglose hacia atrás con IVA 19%).
5. El formulario de contacto ahora exige: Nombre(s), Apellido(s), RUT, teléfono, correo, dirección, comuna, ciudad y tipo (Persona/Empresa/Interno). Marca ya no es dato de contacto. Aplica de aquí en adelante; los clientes antiguos conservan su nombre completo en "Nombre(s)" hasta que se editen.

## 5. Pendiente conocido
- Los encabezados opcionales de la planilla (documento, propietario, teléfono…) se detectan por nombre; verificar con `crmVerificarColumnas()` y ajustar `COL_OPC`/`CRM_UPD_COLS` si tu planilla usa otros títulos.
- Otros servicios con tareas predefinidas: cuando tengas los listados, se cargan como filas en `tareas_servicio` (o pídelo en una sesión y se genera el SQL).
