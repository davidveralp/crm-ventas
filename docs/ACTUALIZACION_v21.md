# ACTUALIZACIÓN v21 · Guía de despliegue
**CRM DIDIAL / Plataforma VPAI · 03-07-2026**

Esta versión incluye: separación Nueva OT / Solicitar servicio, tareas predefinidas por servicio, presupuestos en 4 secciones con PDF oficial DIDIAL, base de precios integrada, nombres/apellidos separados, sincronización bidireccional con la planilla base de OT, corrección del bug del historial de servicios ("—" sin descripción ni monto) y boleta/factura por OT.

---

## 1. Migraciones SQL (SQL Editor de Supabase, en orden)

1. **`database/25_actualizacion_v21.sql`** — columnas nuevas (apellidos, tipo_vehiculo, documento en servicios), tabla `tareas_servicio` con las 32 tareas de MAN X PAUTA, tabla `precios_base`, función `crm_aplicar_datos_ot` y re-vinculación de servicios por patente.
2. **`database/26_seed_precios_v21.sql`** (v21.1) — carga las 985 filas de la base de precios (servicios aplicables por tipo de vehículo + 55 precios fijos + 9 insumos, precios 09-04-2026). Idempotente: borra y recarga. **Fix**: propaga nombres de servicios en celdas combinadas del xlsx. **Ojo**: el código **AC13** (A.C-CALEFACCION, MO $238.000, Aplica=Sí) no tiene nombre en ninguna fila de tu Excel; quedó cargado como "A.C-CALEFACCION AC13 (nombre por completar)" — corrígelo en el xlsx y vuelve a pedir el seed, o edítalo directo en la tabla `precios_base`.
3. **`database/27_actualizacion_v21_1.sql`** — corrige la búsqueda por N° de OT (ej. OT 13199): las OT de clientes que nunca existieron en el CRM quedaban sin cliente vinculado y no aparecían en el buscador. Ahora `crm_aplicar_datos_ot` v2 **crea automáticamente el cliente y el vehículo** cuando la patente no existe (reutiliza clientes por teléfono o nombre para no duplicar), vincula todas sus OT y recalcula facturación/N° OT/última visita. La migración además vincula de inmediato lo ya sincronizado y muestra cuántas OT siguen huérfanas. **Después de ejecutarla, corre `crmSyncServicios()` una vez**: ahí se crean los clientes faltantes.

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

## 4b. OT sin cliente (v21.2 · pestaña nueva en Control de OT)
El diagnóstico arrojó **2.929 OT sin cliente vinculado**. El módulo **Control de OT** ahora tiene dos pestañas:
- **OT sin cliente**: agrupa esas OT por patente (con total facturado, rango de fechas y lista de OT), con buscador por patente o N° de OT. Por cada patente puedes **crear la ficha del cliente** (formulario de contacto + datos del vehículo; solo el nombre es obligatorio aquí para poder recuperar la ficha) o **vincularla a un cliente existente** (búsqueda por nombre/RUT/teléfono, evita duplicados). Al guardar se enlazan todas las OT de esa patente y se recalculan facturación, N° de OT, ticket y última visita; luego te lleva a la ficha.
- **OT faltantes en la base**: la funcionalidad original (hoja Control_OTs).

Importante: ejecuta primero **`crmSyncServicios()` v2** — las OT cuya fila en la planilla trae nombre de propietario se crean solas, y las 2.929 deberían bajar bastante. Lo que quede (filas sin propietario en la planilla) se resuelve a mano en esta pestaña.

## 5. Pendiente conocido
- Los encabezados opcionales de la planilla (documento, propietario, teléfono…) se detectan por nombre; verificar con `crmVerificarColumnas()` y ajustar `COL_OPC`/`CRM_UPD_COLS` si tu planilla usa otros títulos.
- Otros servicios con tareas predefinidas: cuando tengas los listados, se cargan como filas en `tareas_servicio` (o pídelo en una sesión y se genera el SQL).


---

# ACTUALIZACIÓN v22 · Campañas bien definidas + email marketing precargado

## Migración
Ejecutar **`database/28_actualizacion_v22.sql`**. Hace tres cosas:
1. **Limpia el calendario y las gestiones**: las tareas que la activación de la campaña insertó como actividades (las 696 "vencidas" y los eventos con texto plantilla en Gestiones) se **migran** a la nueva tabla `tareas_campana` y se eliminan del calendario. No se pierde nada: quedan como tareas pendientes de la campaña. Las que un asesor ya gestionó se conservan como historial real.
2. Crea `tareas_campana` y la función `audiencia_campana` (audiencias calculadas desde el historial de servicios).
3. Precarga **6 campañas de email marketing** en borrador, con asunto, plantilla HTML institucional DIDIAL y criterio de audiencia.

## Nuevo flujo de campañas (definición corregida)
- **Activar** una campaña no carga nada a nadie: solo la habilita.
- **"Cargar a asesores"** asigna una **tarea de campaña** por cliente al vendedor de su cartera (los sin vendedor quedan "Sin asignar" para que administración los reparta). NO toca el calendario ni las gestiones.
- El vendedor trabaja su lista en **Clientes → pestaña Tareas** (vista tipo tabla con filtros por estado/campaña/vendedor, búsqueda, comentarios y export CSV). Al marcar una tarea como **Agendado**, ahí sí se crea el agendamiento y aparece en el Calendario.
- Las **Gestiones** vuelven a ser exclusivamente lo que el asesor registra en la ficha del cliente.

## Campañas de email precargadas (listas para enviar con un botón)
| Campaña | Audiencia (calculada del historial) | Gancho |
|---|---|---|
| Mantención próxima | Última mantención hace 150–180 días, sin visitas posteriores | 10% dcto · código MANT10-DIDIAL |
| Fidelización post-reparación | Última visita (60–180 días) fue reparación, no mantención | Encuesta + inspección de cortesía |
| Mantención vencida | Última mantención hace 181–365 días, sin visitas posteriores | 10% dcto · código MANT10-DIDIAL |
| Fidelizados | 3+ visitas en los últimos 12 meses | Tips de mecánica preventiva + inspección de cortesía |
| Recupero importante | +1 año sin venir y (3+ visitas históricas o facturación ≥ $500.000) | "Te extrañamos" + 10% dcto · VUELVE10-DIDIAL |
| Recupero masivo | +1 año sin venir, pocas visitas y montos menores | Revisión general con diagnóstico honesto |

Detección de mantención: tipo de servicio que comienza con "MAN". Los umbrales (días, visitas, montos) viven en el campo `criterio` (jsonb) de cada campaña y se ajustan por SQL sin tocar código. Los códigos de descuento van escritos en la plantilla (edítalos ahí si cambian).

En **Campañas**, al abrir una de email verás su audiencia calculada en vivo, la vista previa HTML y el botón **Enviar email**. Requisito para enviar: desplegar la Edge Function `enviar-email` (v22, ahora acepta audiencia explícita y HTML) con el secret `BREVO_API_KEY`, y activar la campaña.

## Nuevo cliente
El segmento entra predefinido como **Nuevo cliente** (el sistema lo reclasifica después) y el vendedor por defecto es quien lo ingresa; administración puede reasignarlo desde la ficha.

## Usuarios (bug pendiente de tu lado)
"Failed to send a request to the Edge Function" significa que **`gestionar-usuario` sigue sin desplegarse** en Supabase — no es un bug del código del CRM, y no puedo desplegarla por ti. Pasos exactos: Dashboard de Supabase → **Edge Functions → Deploy new function** → nombre exacto `gestionar-usuario` → pegar el contenido de `supabase/functions/gestionar-usuario/index.ts` → Deploy (los secrets se configuran solos). El modal ahora te muestra estas instrucciones cuando detecta ese error.
