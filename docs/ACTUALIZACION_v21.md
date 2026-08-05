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


---

# ACTUALIZACIÓN v23 · Presupuestos por el encargado, cotización rápida, email personalizado

## Migración
Ejecutar **`database/29_actualizacion_v23.sql`** (requiere 1–28): contacto de empresa en clientes, presupuestos con cliente/vehículo propios (cotización rápida) y campo de compra gestionada, RUT/contacto/anulación en `ordenes_trabajo`, `audiencia_campana` v2 (marca, modelo, último servicio, contacto Toyota/multimarca) y plantillas v2 (logo real, slogan y personalización).

## Flujo de presupuestos redefinido
1. Asesor: **Solicitar servicio** (ficha) → taller diagnostica → "Pasar a presupuesto".
2. **El ENCARGADO DE PRESUPUESTOS elabora desde el módulo Presupuestos → pestaña Taller** (rol coordinador de adquisiciones o admin). Ve la revisión completa (servicio solicitado, observaciones del cliente, diagnóstico con severidades y tareas) y cotiza con la base de precios (MO por tipo de vehículo, insumos, rango eco/premium de repuestos). El taller ahora ve los presupuestos en **solo lectura**.
3. "Enviar al asesor" → aparece en la ficha del cliente (editable, PDF con logo, WhatsApp).
4. Asesor con aprobación del cliente: **"Cliente aprueba → continuar reparación"** — exige confirmar el respaldo de garantía (OT firmada ✓ + video ✓), registra la autorización, notifica a presupuestos (gestionar compra) y al taller.
5. Encargado: botón **"Compra gestionada → espera de repuestos"** — el trabajo pasa a la etapa "Compra de repuestos" en el taller y se notifica a jefe de taller y asesor.

## Cotización rápida (ticket)
En la ficha del cliente, botón **"Cotizar"** por vehículo: servicios planos desde la base de precios (filtrados por tipo de vehículo), precios editables e ítems libres, **ticket imprimible formato boleta** con logo y el contacto según marca. Se guarda como presupuesto "rápida" (queda en la ficha para PDF/WhatsApp y en el módulo Presupuestos).

## Nueva OT
- Obligatorios: RUT, correo, dirección, teléfono y propietario (mismos criterios que "Nuevo cliente").
- Tipo Empresa → pide **Razón social + RUT de la empresa + nombre/teléfono/correo del contacto** (también en "Nuevo cliente" y en la ficha).
- **MO $0 solo con garantía o anulación**: si no es garantía y la MO es 0, aparece "Solicitar anular OT" al final — la OT se guarda con los datos del cliente y montos en cero, y se **notifica a administración** para registrarla como nula.
- Control de OT → OT faltantes: el motivo "Pendiente de ingreso" ahora es **"OT nula"** (las clasificaciones históricas se muestran con la nueva etiqueta) y **"Otro motivo" exige detallar** antes de continuar.

## Email marketing
- Las 6 campañas viven ahora en **Email marketing → pestaña Campañas** (ya no aparecen junto a las campañas comerciales). Audiencia en vivo, vista previa y envío masivo con un botón.
- **Personalización por destinatario**: {nombre}, {vehiculo} (marca+modelo de su última visita), {servicio} (último servicio) y contacto según marca — Toyota: serviciotoyota@didial.cl · +56 9 3740 1051 / Multimarca: serviciotecnico@didial.cl · +56 9 8974 8626.
- **Logo real** en el header (https://crm-ventas-neon.vercel.app/logo-didial.png, servido por el propio deploy) y slogan en header y firma.

### Pasos para dejar operativo el envío (una sola vez)
1. Subir el zip al repo y verificar el deploy (el logo del correo se sirve desde ahí).
2. Ejecutar la migración 29.
3. Crear cuenta en **Brevo** (brevo.com) si no existe; en Senders & Domains **verificar el remitente** (ideal: autenticar el dominio didial.cl con los registros DKIM que Brevo indica — mejora mucho la entrega; mínimo: verificar serviciotecnico@didial.cl como sender).
4. Copiar la **API key** de Brevo (SMTP & API → API Keys).
5. Supabase → Edge Functions → **Deploy new function** → nombre exacto `enviar-email` → pegar `supabase/functions/enviar-email/index.ts` → Deploy. En **Secrets** agregar `BREVO_API_KEY`.
6. (Para métricas de apertura/clic) Desplegar también `brevo-webhook` (con Verify JWT desactivado), agregar el secret `BREVO_WEBHOOK_TOKEN` y configurar el webhook en Brevo apuntando a la URL de la función. Sin esto los envíos funcionan igual; solo no llegan los eventos a Reportes.
7. Probar: Email marketing → Campañas → elegir una con audiencia chica → Enviar. Verificar recepción y personalización.
8. Límite a considerar: el plan gratuito de Brevo permite ~300 correos/día — para "Recupero masivo" probablemente necesites enviar por tandas en días distintos o un plan pago.

## Otros
- **Redondeo defensivo del "peso perdido"**: los precios antiguos calculados con margen automático podían quedar con decimales (ej: 39.999,9999…) y mostrarse/guardarse con $1 menos. Ahora todo monto se redondea al cargar y al guardar (ficha, taller, Nueva OT). Si lo vuelves a ver, indica en qué pantalla exacta para rastrear otra fuente.
- **"Eliminar" cliente ya estaba restringido a administradores** — tú lo ves porque tu perfil es admin; un vendedor no lo ve.
- Slogan institucional propuesto e integrado: **"Cuidamos lo que te mueve"** (alternativas por si prefieres otro: "Expertos en tu tranquilidad", "Tu auto en las mejores manos", "Mantención que se nota"). Cambiarlo = editar las plantillas (un UPDATE) y dos textos en PDF/ticket.


---

# ACTUALIZACIÓN v24 · Revisión técnica bien definida y tipo de vehículo en cotizaciones

## Migración
Ejecutar **`database/30_actualizacion_v24.sql`** (agrega los requerimientos de repuestos e insumos al trabajo de taller).

## Revisión ≠ ejecución
- Al **solicitar servicio** desde la ficha, el taller recibe la revisión con el servicio solicitado, las observaciones del cliente y las tareas de referencia — pero **las tareas quedan bloqueadas** (▶ Iniciar deshabilitado) hasta que el trabajo esté en "En reparación" o etapas posteriores. El técnico primero EVALÚA: puede confirmar el servicio solicitado o determinar que la causa real es otra (diagnóstico con hallazgos y severidades).
- Nueva sección **"Requerimientos para la reparación"**: el técnico registra **uno a uno los repuestos** y **uno a uno los insumos** necesarios. Al usar "Pasar a presupuesto", estos requerimientos **prellenan la cotización ítem por ítem** y la notificación al encargado indica cuántos repuestos e insumos se requieren.
- El **respaldo de garantía salió del taller**: es tarea del asesor y se solicita en la ficha del cliente al aprobar el presupuesto, antes de continuar con la reparación. En el taller solo se muestra su estado (✓/○) y quién autorizó.

## La decisión es del asesor
Los botones "Cliente aprueba / Entrega parcial / Cliente rechaza" se eliminaron de las tarjetas de presupuesto (taller y módulo Presupuestos). La decisión se registra **solo en la ficha del cliente** durante la negociación: el asesor elige **Aprueba completo** o **Aprueba parcial (entrega parcial)** — ambas exigen el respaldo de garantía — o **Cliente rechaza**. Las notificaciones a presupuestos distinguen aprobado completo de parcial.

## Tipo de vehículo: requisito para cotizar
Los precios de MO varían por tipo (AUTO / SUV / PICK UP / VAN-FURGÓN-CAMIÓN), por eso ya no se muestran las 4 variantes:
- El buscador de la base de precios (cotización rápida y módulo Presupuestos) **filtra por el tipo del vehículo que se está cotizando** y muestra el tipo en cada resultado.
- Si el vehículo **no tiene tipo definido, se solicita ahí mismo** antes de poder buscar (el buscador queda deshabilitado hasta seleccionarlo) y la selección **queda guardada en la ficha del vehículo**.
- El selector de tipo también está al **ingresar un vehículo** (alta de cliente y "+ Agregar vehículo") y al **editarlo** (ya existía desde v21).


---

# ACTUALIZACIÓN v25 · Planilla de precios viva, vista de asesores y Nueva OT afinada

## Migración
**`database/31_actualizacion_v25.sql`** (solo agrega motivo_anulacion a ordenes_trabajo).

## Planilla de precios vinculada (tratamiento tipo Base_OT)
Nuevo **`integraciones/sincronizar_precios.gs`**: se pega en el Apps Script de la **planilla de precios** (Extensiones → Apps Script), con las mismas credenciales del script de la base de OT, y se le pone un **activador por tiempo** (ej. cada hora). Desde ahí la planilla es la **fuente de verdad**: cualquier precio, servicio o código que agregues o modifiques llega solo al CRM y alimenta la búsqueda de servicios en cotizaciones, la elaboración de presupuestos y los rangos eco/premium. Maneja celdas combinadas y filas `Aplica=No`, y hace recarga completa (si borras un servicio de la planilla, desaparece del CRM). Importante: las ediciones manuales directas en la tabla `precios_base` se pierden en el siguiente sync — todo se edita en la planilla. Nota de diseño: la lista de servicios del formulario **Nueva OT** se mantiene con el catálogo fijo de la app original (esos valores exactos son los que espera la planilla Base_OT); la planilla de precios alimenta todo lo relacionado con precios y cotizaciones.

## Vista limitada para asesores
**Taller y Presupuestos** (fase preliminar) quedan **ocultos para el rol vendedor**: no aparecen en el menú y si acceden por URL ven un aviso. **Control OT sí queda disponible** para asesores (mantener alimentada la base es parte de sus funciones). Los presupuestos que les corresponden siguen llegando a la ficha de cada cliente.

## Control OT
Las OT **sin patente** ya no ofrecen "vincular a cliente": primero deben completarse en la planilla base (varias aparecen también en "OT faltantes en la base"); el sync las tomará con su patente y ahí se crean/vinculan.

## Nuevo cliente
Segmento **fijo en "Nuevo cliente"** (no editable; el sistema reclasifica después). Campo **"Comuna / Sector"**.

## Nueva OT
- **"Solicitar anular OT" al final del formulario**, en el lugar del texto "Se enviará a la planilla…" (que se eliminó). Solo aparece cuando los montos de reparación quedan en $0 (y no es garantía), y exige **escribir el motivo de la anulación** (queda en la OT y en la notificación a administración).
- **Notificación verde** al guardar: "OT N guardada ✓ enviada correctamente a la planilla DIDIAL_Base_OT".
- **Validación de duplicados**: antes de guardar se verifica contra el historial completo (tabla servicios, que incluye lo sincronizado de la planilla); si el N° de OT ya existe, se bloquea con un aviso.

## Cotización rápida
El **ticket ahora imprime en papel continuo de 80mm**: la página mide exactamente lo que mide el contenido (se acabó la hoja larga).


---

# ACTUALIZACIÓN v27 · Calendario interactivo, perfiles y roles, Nueva OT viva

## Migraciones (en orden y en ejecuciones separadas)
1. **`database/33_actualizacion_v27.sql` — PASO 1 SOLO** (roles nuevos en el enum; regla de Postgres: los `alter type` deben ir solos).
2. **PASO 2** de la misma migración (columna `segmento` en precios_base + backfill).
3. **`database/32_seed_precios_v26.sql`** regenerado (982 precios con segmento propio) — o el sync del Apps Script v4.
4. **Re-desplegar la Edge Function `gestionar-usuario`** con el index.ts del repo (agrega la acción `actualizar` y los roles nuevos).

## Calendario
- **Clic en una cita → popup de detalle estilo Outlook**: fecha/hora, tipo con su color, recordatorio y notas, teléfono del cliente; botones **Editar** (fecha, hora, tipo, recordatorio, notas), **Eliminar**, **Marcar realizada** y **Ver ficha**.
- **Vencidas / Para hoy** ahora van **abajo** del calendario. El glosario de colores se eliminó.
- **Solo tu agenda**: cada usuario ve únicamente sus propias gestiones (admin ve todo).
- **📅 Exportar a mi calendario**: descarga un `.ics` con toda tu agenda (recordatorio 30 min antes) para importar/suscribir en Gmail u Outlook. La sincronización bidireccional automática con la cuenta de correo de cada usuario requiere OAuth por usuario (Google/Microsoft) — queda como siguiente etapa; el .ics es el puente disponible hoy.

## Usuarios y perfiles
- **Mi perfil** (clic en tu avatar, abajo a la izquierda): cada usuario cambia su propia contraseña.
- **Editar** en la tabla de Usuarios (admin): nombre, rol, estado y restablecer contraseña.
- **Roles nuevos**: Asistente Administrativo, Asistente de Bodega, Asesor Toyota, Asesor Multimarca (el rol "solo Vendedor" ya existía como Vendedor). Los asesores Toyota/Multimarca se comportan como vendedores (misma vista limitada) y además fijan su sucursal en Nueva OT.

## Nueva OT
- **Técnicos** (principal y secundarios) = usuarios **activos** con rol Técnico o Jefe de Taller (si aún no hay usuarios técnicos creados, se usa el catálogo fijo de respaldo).
- **Sucursal fija por asesor**: Diego Leyton → Toyota; David Rivera y Matías Ponce → Multimarca (por nombre), y de forma permanente por los roles Asesor Toyota / Asesor Multimarca. Admin puede elegir.
- **Tipo de Vehículo** en Datos del Vehículo (se precarga si la patente existe y se guarda en la ficha del vehículo → asocia con la lista de precios).
- **Nombre(s) y Apellido(s) separados** para Particular; Empresa pide razón social + contacto (v23). **Comuna / Sector**. **"El cliente no aporta correo"**: checkbox que exime el correo obligatorio.
- **Tipos de servicio desde la planilla de precios** (agrupados por segmento Taller Mecánico / Servicio Rápido / DyP), también en "Solicitar servicio" de la ficha. ⚠️ Implicancia: los nombres que viajan a la planilla Base_OT ahora son los de la planilla de precios — mantén esa planilla como catálogo oficial.

## Ficha del cliente
- Texto explicativo de la marca eliminado del modal de contacto.
- La cabecera muestra **chips con todas las marcas** de los vehículos asociados. Sobre los isologos: los logos de marcas automotrices son propiedad intelectual de terceros y usarlos en el CRM sin licencia es riesgoso — quedaron los chips de texto, como acordamos de alternativa.

## Control OT
- **Fecha estimada** por cada OT faltante (tomada de la OT anterior con registro en el historial, o la posterior si no hay) + **filtros de Mes y Año** por esa fecha estimada, para trabajar por períodos.

## Ticket de cotización
- Imprime **solo cuando el logo terminó de cargar** (antes salía en blanco), con respaldo de texto "DIDIAL" si la imagen falla.
- **Alto contraste** para térmicas (tipografía negra y gruesa, líneas más marcadas) y contenido centrado en los 80mm.

## OT que no aparecen en la búsqueda (ej. 13245)
El buscador resuelve por el historial sincronizado (tabla `servicios`). Si una OT no aparece, casi siempre es una de estas dos: (a) la fila aún no llega desde la planilla — el sync del Apps Script corre por activador; puedes forzarlo ejecutando `crmSyncServicios()` a mano — o (b) la fila existe pero quedó huérfana/sin patente — revísala en Control de OT → "OT sin cliente". Diagnóstico directo en Supabase: `select * from servicios where ot_numero = '13245';` — si no devuelve filas, es (a); si devuelve sin `cliente_id`, es (b).


---

# ACTUALIZACIÓN v28 · Tipos de servicio = categorías (no servicios individuales)

Sin migraciones nuevas: todo es frontend. Diseño confirmado en conjunto:

## Dropdown "Tipo de Servicio" (Nueva OT y Solicitar servicio)
Vuelve a ser una lista corta de tipos/categorías — **la lista anterior FUSIONADA con las categorías de la planilla de precios**, una sola entrada por concepto (FRENOS = Frenos; A/C RECARGA y A/C REPARACION siguen separadas pero ambas apuntan a la categoría "A/C y Calefacción"). Se agregaron solo las categorías realmente nuevas: SUSPENSION, ENCENDIDO, ELECTRONICA MOTOR, ABS, AIR BAG, DIRECCION, TREN TRASERO, EJES, TRACCION 4X4 (Taller) y FILTROS, AMPOLLETAS, PLUMILLAS, ACCESORIOS (Servicio Rápido). **No** se listan los 921 servicios individuales: eso se desglosa después.

## El desglose por categoría (mapa OT_SVC_CATEGORIA en helpers)
- **Solicitar servicio (ficha):** al elegir el tipo, si mapea a una categoría, aparecen los servicios específicos de esa categoría como chips clicables para agregarlos como tareas (filtrados por el tipo del vehículo).
- **Taller:** el campo "+ Nueva tarea" sugiere (autocompletado) los servicios de la categoría del servicio solicitado del trabajo, filtrados por el tipo del vehículo.
- **Presupuestos y cotización rápida:** el buscador de la base de precios tiene un **selector de categoría** (en presupuestos viene precargado con la categoría del servicio solicitado); con categoría activa se puede explorar sin escribir texto.

## Tipo de vehículo
Filtra los servicios/precios **dentro** de cada categoría (las categorías siempre están visibles), ahora con **match flexible**: un vehículo PICK UP también encuentra los servicios tarificados como "PICK UP/VAN/FURGON", y un VAN/FURGON/CAMION encuentra los "…DOBLE RODADO" (antes esos combos no calzaban nunca por comparación exacta).

Los tipos sin categoría equivalente en la planilla (MAN X PAUTA, MAN BASICA, REFRIGERACION, DPF, ADMISION EGR, OTROS…) siguen funcionando igual: sin filtro, muestran toda la base al buscar. MAN X PAUTA conserva sus 31 tareas predefinidas del documento oficial.


---

# ACTUALIZACIÓN v29 · Campañas personalizadas desde el CRM

## Migración
**`database/34_actualizacion_v29.sql`**: audiencia_campana v3 (criterio 'personalizada' por rango de fechas de servicio + filtros opcionales) y **seed de la campaña solicitada**: "Fidelización · Servicios Junio – 6 Julio 2026" (canal tareas, ya activa). El diagnóstico final de la migración te dice cuántos clientes entran.

## Tu campaña de junio – 6 de julio (lista para usar)
1. Ejecuta la migración 34.
2. Campañas → selecciona "Fidelización · Servicios Junio – 6 Julio 2026" → verás la audiencia calculada en vivo (todos los clientes con algún servicio entre 01-06 y 06-07).
3. **"Cargar a asesores"** → crea una tarea de campaña por cliente, asignada al vendedor de su cartera (los sin vendedor quedan para reasignar). Cada asesor las trabaja en **Clientes → pestaña Tareas** (llamada/WhatsApp, comentarios, estados).

## Constructor de campañas (botón "➕ Nueva campaña")
Criterios simples, como definiste: **rango de fechas del servicio** (obligatorio), **tipo de servicio** (todos / solo mantenciones / solo reparaciones), **visitas mínimas** y **monto histórico mínimo** (opcionales), y **canal**:
- **Tareas para asesores** → la campaña queda en esta misma página, activa, lista para "Cargar a asesores". Para canal tareas la audiencia exige teléfono o email (no solo email).
- **Email masivo** → la campaña aparece en **Email marketing → Campañas** con la plantilla genérica de fidelización (logo, slogan y personalización {nombre}/{vehiculo}/{servicio}); defines el asunto al crearla.

Las campañas personalizadas se distinguen con una etiqueta "Personalizada · fecha→fecha" en la lista.


---

# ACTUALIZACIÓN v30 · Asignación de campañas y auto-asignación de clientes

Sin migración (solo frontend).

## Al cargar una campaña a los asesores
En el panel de la campaña (admin) aparece **"Asignar a:"** con dos modos:
- **Vendedor de cada cliente (cartera)** — el comportamiento por defecto: cada tarea va al asesor dueño del cliente. Clientes nuevos → quien subió la OT (se asigna solo al crear la OT). Clientes antiguos sin vendedor quedan sin asignar y el resultado te dice cuántos fueron.
- **Asignar todo a un asesor** — toda la audiencia de la campaña se carga a un único asesor que eliges de la lista. Útil para campañas puntuales o para repartir manualmente.

## Auto-asignación de clientes (asesores)
Los asesores ya ven la **lista completa de clientes**. Ahora además:
- Filtro rápido **"Sin asignar"** (para todos) que muestra solo los clientes sin asesor.
- En la columna Vendedor, botón **"+ Tomar cliente"** en cada cliente sin dueño: el asesor se lo auto-asigna (quien gestiona el registro se queda con él). El admin puede además "tomar" o reasignar cualquiera.

Regla de negocio implementada: **quien sube la OT es el dueño por defecto** (asignación automática al crear la OT); para los **clientes antiguos sin dueño, quien los gestione los toma** con el botón.


---

# ACTUALIZACIÓN v31 · Solicitar presupuesto desde la ficha + botones unificados

## Migración
**`database/35_actualizacion_v31.sql`**: agrega a la tabla `presupuestos` (comercial) las columnas `items` (jsonb), `solicitado_por` y `origen`.

## Botones de acción de la ficha (por vehículo)
Ahora son cuatro, ordenados y con **formato unificado** (clase `btn-accion`): **Nueva OT · Solicitar revisión · Cotizar · Solicitar presupuesto**. El botón "Solicitar servicio" pasó a llamarse **"Solicitar revisión"** (coherente con que el taller primero evalúa antes de ejecutar).

## Solicitar presupuesto (nuevo)
Abre un modal donde el asesor **describe lo que necesita cotizar** y puede **pre-cargar servicios de la base de precios** (buscador filtrado por el tipo del vehículo; montos referenciales). Al enviar:
- Crea un registro en la tabla `presupuestos` con `origen = 'solicitud_ficha'`, estado `borrador`, los ítems sugeridos y el vínculo cliente/vehículo.
- **Aparece en Presupuestos → pestaña Comerciales**, con la etiqueta "Solicitud del asesor" y la cuenta de ítems sugeridos.
- Notifica al encargado de presupuestos (rol coordinador_adquisiciones).
- El encargado hace clic en la fila → modal con la descripción y los servicios sugeridos → "Tomar solicitud (en seguimiento)" o "Abrir ficha para cotizar".

## Dónde se guardan las cotizaciones (tu consulta)
Aclaración importante: las **cotizaciones rápidas** (botón "Cotizar") se guardan en la tabla `presupuestos_taller` con `origen = 'rapida'`, y se ven en **Presupuestos → pestaña Taller** (no en Comerciales) y en la propia ficha del cliente, sección "Presupuestos del taller para conversar". No se movieron: conforme a lo que definiste, la cotización rápida se queda en Taller y solo la nueva "Solicitar presupuesto" va a Comerciales.


---

# ACTUALIZACIÓN v32 · Roles de asesores y cartera multimarca compartida

## Migración
**`database/36_actualizacion_v32.sql`** (en crm-ventas, requiere los roles nuevos del PASO 1 de la migración 33):
- Diego Leyton → rol **asesor_toyota**; David Rivera y Matías Ponce → **asesor_multimarca**.
- Ángel Yáñez → **inactivo** (reemplazado por Matías).
- **Reparto 50/50** de la cartera multimarca sin dueño válido (clientes con marca ≠ Toyota, sin vendedor o con vendedor inactivo como Ángel) entre David y Matías.
- Diagnóstico final: cuántos clientes quedó con cada asesor.
Si algún nombre no coincide exactamente en la base, edita los `like` de la migración antes de ejecutarla.

## Cartera multimarca compartida (frontend)
- En **Clientes → pestaña Tareas**, los asesores con rol **asesor_multimarca** ven y gestionan **todas** las tareas de clientes multimarca (marca ≠ Toyota), no solo las suyas — cartera compartida entre David y Matías.
- En la lista de **Clientes** se agregó el filtro rápido **"Multimarca"** (junto a "Sin asignar") para trabajar solo esa cartera. Todos los asesores ya veían la lista completa (v30); esto solo facilita el foco.

## Nota sobre los botones nuevos (v31)
Los 4 botones (Nueva OT · Solicitar revisión · Cotizar · Solicitar presupuesto) y el renombre ya están en el código. Si en producción sigues viendo los antiguos ("Solicitar servicio", sin "Solicitar presupuesto"), es que el deploy de v31 aún no se aplicó: vuelve a subir el zip al repo, espera el build "Ready" en Vercel y recarga con Ctrl+Shift+R.


---

# ACTUALIZACIÓN v33 · Facturas de repuestos → presupuestos + presupuesto sin solicitud

## Migración
**`database/37_actualizacion_v33.sql`** (crm-ventas): tablas `facturas_repuestos` (cabeceras), `repuestos_facturados` (detalle por línea, con cantidad asignada parcial), `margenes_repuestos` (config de margen por categoría, %30 por defecto). El origen 'sin_solicitud' reusa `presupuestos_taller` (sin cambio de esquema).

## Apps Script
**`integraciones/sincronizar_facturas.gs`** → en la planilla de captura de facturas (Extensiones → Apps Script). Sube pestañas FACTURAS y DETALLE al CRM. Control de duplicados doble: idempotente por id (id_factura / id_factura-linea) y marca `sync_crm='SINCRONIZADO'` en la planilla. Sube TODAS las facturas — la validación y la confianza se revisan en el CRM. Actívalo por tiempo.

## En el CRM · módulo Presupuestos (encargado / admin)
Nueva pestaña **Facturas** con dos sub-vistas:
- **Facturas**: cada factura capturada con su nivel de **confianza** (alta/media/baja) y alertas de Vision. El encargado la revisa y **Valida** (o Descarta) dentro del CRM. Puede fijar una patente sugerida.
- **Repuestos por asignar**: una vez validada la factura, sus líneas aparecen aquí. Por cada repuesto el encargado **asigna a una patente** (sugerida por la planilla si vino, siempre editable y verificada contra el CRM), elige **cantidad** (parcial: 1 unidad a una patente, el resto a otra) y fija el **precio de venta** con **margen sugerido** (editable). El repuesto entra al presupuesto de esa patente (área Repuestos); en el presupuesto solo va el precio de venta.

## Nuevo presupuesto sin solicitud
Botón **"➕ Nuevo presupuesto"**: busca cliente/vehículo y crea un presupuesto en blanco con las 3 áreas (Repuestos · Mano de Obra · Lubricantes e Insumos), que se completa en la pestaña Taller. Etiqueta "Sin solicitud".

## Cierre (ya existente, reutilizado)
El presupuesto se **envía al asesor** ("Enviar al asesor" en la tarjeta) → aparece en la **ficha del cliente**, con **PDF** descargable (formato oficial DIDIAL con logo) y **notificación al asesor**. La decisión (aprobado/parcial/rechazado) la registra el asesor en la ficha (v24).

## Pendiente acordado
La asociación fina repuesto→servicio→área (que ya incluiste en la planilla de precios) queda para una etapa posterior: cuando la conectemos, el margen podrá venir por categoría real del repuesto en vez del % por defecto.


---

# ACTUALIZACIÓN v33.1 · Correcciones del flujo de presupuestos

- **Fix botones Guardar/Enviar en presupuestos sin solicitud**: la tarjeta fallaba cuando el presupuesto no tenía trabajo de taller asociado (t = null) al intentar leer t.asesor_id. Ahora usa el cliente/vehículo/vendedor del propio presupuesto.
- **PDF y WhatsApp en el módulo Presupuestos**: la tarjeta de taller ahora tiene botón "📄 PDF" (formato oficial DIDIAL con logo) y "WhatsApp", además de los que ya estaban en la ficha del cliente.
- **Solicitud comercial → presupuesto cotizable**: al abrir una solicitud del asesor (pestaña Comerciales) el botón "Crear presupuesto para cotizar" genera un presupuesto de taller (3 áreas) con los ítems sugeridos pre-cargados y marca la solicitud "en seguimiento", en vez de solo navegar a la ficha.
- **Enviar al asesor** notifica correctamente (a la ficha del cliente) también para presupuestos sin solicitud y de factura.


---

# ACTUALIZACIÓN v34 · PDF oficial, WhatsApp solo en ficha, solicitud→presupuesto

## Migración
**`database/38_actualizacion_v34.sql`**: agrega la columna `color` a `vehiculos` (la usa el PDF oficial). Idempotente.

## PDF con el formato oficial DIDIAL
El botón "📄 PDF" del módulo Presupuestos ahora genera el documento con el **formato físico real** de DIDIAL: cabecera con datos de la empresa (SERVICIO AUTOMOTRIZ DIDIAL LTDA, dirección, correo, teléfono) + logo centrado + "PRESUPUESTO Nº / FECHA / Página"; datos del vehículo y cliente (Patente, R.U.T., Nombre, Color, Año, Marca, Modelo); "Cliente Solicita:"; y las tres secciones **Repuestos**, **Lubricantes y Otros Insumos** (con CÓDIGO/DETALLE/CANTIDAD/PRECIO/TOTAL y subtotal) y **Mano de Obra** (DETALLE/TOTAL con subtotal), cerrando con NETO / I.V.A. / TOTAL. Tipografía serif como el original.

## WhatsApp solo en la ficha del cliente
Se quitó el botón de WhatsApp del módulo Presupuestos: el envío por WhatsApp lo administra el **asesor** desde la ficha del cliente (que es quien tiene el trato directo). El módulo conserva solo el PDF.

## Clic en solicitud comercial → crea presupuesto
Desde la pestaña Comerciales, al abrir una solicitud del asesor, el botón "Crear presupuesto para cotizar" genera el presupuesto de taller (3 áreas) con los ítems sugeridos y marca la solicitud "en seguimiento", en vez de solo abrir la ficha.


---

# ACTUALIZACIÓN v34 · WhatsApp solo en la ficha + PDF con formato oficial

## Migración
**`database/38_actualizacion_v34.sql`**: agrega `color` a `vehiculos` (usado en el PDF oficial).

## WhatsApp: solo en la ficha del cliente (gestionado por el asesor)
Se quitó el botón WhatsApp del módulo Presupuestos — el trato con el cliente es del asesor, no del encargado de presupuestos. El módulo conserva únicamente el botón **📄 PDF**. WhatsApp sigue disponible donde corresponde: en la ficha del cliente (sección de presupuestos del taller), gestionado por el asesor.

## PDF con el formato oficial DIDIAL
Reescribí `verPDF()` en la tarjeta del módulo para replicar exactamente el presupuesto físico que compartiste (Nº 6268): cabecera con datos de la empresa (SERVICIO AUTOMOTRIZ DIDIAL LTDA, dirección, correo, teléfono) + logo centrado + número de presupuesto/fecha/página; datos del vehículo y cliente (Patente, RUT, Nombre, Color, Año, Marca, Modelo); "Cliente Solicita"; las 3 secciones (Repuestos y Lubricantes e Insumos con Código/Detalle/Cantidad/Precio/Total + subtotal; Mano de Obra con Detalle/Total + subtotal); y NETO/I.V.A./TOTAL. Tipografía Times New Roman como el original.

Para esto, la carga de presupuestos en el módulo ahora trae también los datos de cliente (nombre, apellidos, RUT) y vehículo (patente, marca, modelo, año, color) cuando el presupuesto no viene de un trabajo de taller (sin_solicitud, factura, cotización rápida).

## Solicitud comercial → presupuesto (confirmado, ya en v33.1)
El botón "Crear presupuesto para cotizar" en el detalle de una solicitud comercial sigue creando el presupuesto de taller cotizable con los ítems sugeridos — reconfirmado en esta entrega.


---

# ACTUALIZACIÓN v35 · Limpieza de pruebas + "Eliminar ficha" en cascada real

## Migración
**`database/40_actualizacion_v35.sql`** (crm-ventas):
1. Corrige las FK `trabajos_taller.cliente_id` y `presupuestos_taller.cliente_id` de "on delete set null" a **"on delete cascade"**. Antes, al eliminar una ficha, esas dos tablas quedaban con filas huérfanas (cliente_id en null) en vez de borrarse. El resto (vehículos, presupuestos comerciales, tareas de campaña, actividades/agenda) ya cascadeaba bien.
2. **Limpieza única**: vacía todo lo existente hoy en `trabajos_taller`, `presupuestos_taller` y `presupuestos` (comercial) — confirmado que era todo prueba. **No toca** clientes, vehículos, ni las facturas de repuestos (se dejan intactas por si ya hay sincronización real).

## "Eliminar ficha" (admin) — función única, ya reforzada
No requirió cambios de frontend: al arreglar las FK, el mismo botón "Eliminar" de la ficha (ya restringido a admin) ahora borra en cascada de verdad: vehículos, trabajos de taller, presupuestos (taller y comerciales), tareas de campaña y actividades (agenda y gestiones) de ese cliente. Se actualizó el texto de confirmación para que sea explícito sobre el alcance.

## De ahora en adelante
Trabajarás con clientes de prueba reales dentro del CRM; cuando termines de probar algo, "Eliminar ficha" en la ficha del cliente de prueba se encarga de limpiar todo lo asociado en Taller y Presupuestos sin dejar residuos.


---

# ACTUALIZACIÓN v36 · Ingreso nuevo = dueño automático + calendario de fidelización

Sin migración (solo frontend). Hallazgo tras revisar permisos y el flujo de ingreso:

## Permisos entre asesores (verificado, sin cambios necesarios)
Los tres roles de asesor (Vendedor genérico, Asesor Toyota, Asesor Multimarca) ya tienen exactamente las mismas capacidades en menú y páginas. Las únicas diferencias existentes son intencionales: sucursal fija en Nueva OT (v27) y cartera compartida multimarca en Tareas (v32). No se encontró ninguna condición de permisos que discriminara entre ellos por error.

## El problema real encontrado
Cuando en Nueva OT la patente NO existía todavía en el CRM, el cliente y el vehículo se creaban **después, de forma asíncrona**, vía la sincronización con la planilla (Apps Script → función SQL `crm_aplicar_datos_ot`). Esa función **nunca asignaba un asesor dueño** (el nombre del asesor no viaja por ese canal) y, como el seguimiento de fidelización solo se disparaba si el vehículo ya existía al momento de guardar la OT, los clientes genuinamente nuevos quedaban sin dueño y sin su recordatorio en el calendario.

## La solución
**Nueva OT ahora crea el cliente y el vehículo de inmediato**, en el momento del envío, cuando la patente no existe — asignados al asesor que está ingresando la información (`vendedor_id = perfil.id`). Esto activa automáticamente, para cualquier ingreso (nuevo o existente), el seguimiento de fidelización que ya existía: una actividad en el calendario del asesor para el día siguiente ("Llamar al cliente por su experiencia de servicio"), visible en Calendario y en Clientes → Tareas.

La sincronización posterior con la planilla ya no necesita crear el cliente (lo encuentra por patente y solo completa datos vacíos), evitando duplicados.

## Alcance y una limitación honesta
Esto cubre el ingreso a través del formulario Nueva OT del CRM, que es el canal principal. Las OT que se registran fuera del CRM (directamente en la app de terreno / planilla, sin pasar por este formulario) seguirán creando el cliente sin dueño asignado, porque ese canal no identifica qué asesor la registró — es una limitación de origen de datos, no del CRM. Si se necesita resolver ese caso también, requeriría agregar la identidad del asesor a esa app externa, lo cual queda fuera del alcance de esta actualización.


---

# ACTUALIZACIÓN v37 · Nueva OT ya no bloquea las OT "faltantes" de Control de OT

Sin migración (solo frontend).

## El problema
La validación de "OT ya cargada" (v25) bloqueaba el guardado si **cualquier** fila existía en `servicios` con ese número — sin distinguir entre un duplicado real (con patente, monto y cliente) y una fila **vacía**, que es exactamente lo que significa una OT marcada como "faltante" en Control de OT: el número quedó registrado en el historial sin datos reales asociados. Por eso, precisamente las OT que aparecían en Control de OT → Faltantes eran las que NO se podían registrar — la validación las trataba como si ya existieran de verdad.

## La corrección
Ahora la validación revisa si esa fila **tiene datos** (patente, monto > 0 o cliente asociado):
- **Si tiene datos reales** → sigue bloqueando, mostrando además qué patente/fecha/monto ya está cargado, para que sea fácil verificar si es un error de tipeo del número de OT.
- **Si está vacía** (el caso de las "faltantes") → deja continuar. El guardado final ya usaba `upsert` por (empresa_id, ot_numero), así que esa misma fila se completa con los datos reales en vez de bloquear o duplicar.

Con esto, las OT que ves en Control de OT → Faltantes ya se pueden registrar normalmente desde Nueva OT.


---

# ACTUALIZACIÓN v38 · Fix: reasignar una campaña a un asesor específico

Sin migración (solo frontend).

## El bug
En "Cargar a asesores" (Campañas), el guardado usaba `upsert(..., { ignoreDuplicates: true })`. Eso significa que si la campaña ya se había cargado antes (por ejemplo en modo "cartera"), un segundo intento eligiendo un **asesor específico** para reasignar no cambiaba nada en las tareas que ya existían — quedaban silenciosamente ignoradas, aunque el mensaje decía "asignado". Solo funcionaba correctamente la primera vez, cuando ninguna tarea existía aún para esa campaña.

## La corrección
Ahora "Cargar a asesores" separa dos casos:
- **Tareas nuevas** (clientes de la campaña que aún no tenían tarea): se insertan como antes, según el destino elegido (cartera o asesor fijo).
- **Tareas que ya existían**: si se eligió un **asesor específico** (no "cartera"), se **reasignan de verdad** — se actualiza su vendedor_id a ese asesor, sin tocar el estado ni los comentarios que el asesor anterior ya hubiera registrado (para no perder el trabajo hecho). Si el modo elegido es "cartera", las existentes no se tocan (se respeta lo ya asignado, igual que antes).

El resultado ahora informa por separado cuántas son nuevas y cuántas fueron reasignadas.


---

# ACTUALIZACIÓN v38.1 · Dos bugs más en la asignación de campañas a un asesor

Revisión más profunda de la misma función, sin migración.

## Bug 2: el destino elegido se arrastraba entre campañas
El selector "Asignar a:" no se reiniciaba al abrir una campaña distinta. Si elegías un asesor específico para la Campaña A y luego abrías la Campaña B sin fijarte, el selector seguía mostrando ese mismo asesor — un clic distraído en "Cargar a asesores" habría asignado la Campaña B también a él. Ahora, cada vez que se abre una campaña, el destino vuelve a "Vendedor de cada cliente (cartera)" por defecto.

## Bug 3: truncamiento silencioso a 1000 clientes
Al calcular la audiencia de una campaña personalizada, la consulta que trae el vendedor_id de cada cliente (necesaria para el modo "cartera") tenía un `.slice(0, 1000)` que cortaba la lista ahí. Con campañas de más de 1000 clientes coincidentes, los que quedaban fuera del corte se habrían tratado como "sin vendedor" aunque sí tuvieran uno. Se corrigió con una consulta por lotes que cubre a todos, sin límite.

## Verificación de la política de permisos (RLS)
Se confirmó que `tareas_campana` tiene su política RLS en modo "for all" (cubre update), por empresa — no hay restricción que bloquee la reasignación agregada en v38.


---

# ACTUALIZACIÓN v38.2 · Batching para campañas grandes (asignar a asesor)

Sin migración.

## Bug 4: URL demasiado larga con campañas de varios cientos de clientes
Tanto la consulta de "tareas ya existentes" como el update de reasignación armaban un único `.in('cliente_id', [...])` con TODA la lista de clientes de la campaña de una sola vez. Con campañas grandes, esa lista de UUIDs (36 caracteres cada uno) puede generar una URL demasiado larga para el servidor, fallando en silencio o con error. Se corrigió consultando y actualizando **en lotes de 200** clientes por vez.

## Estado de la revisión
Van 4 correcciones sobre esta misma función tras 3 revisiones (ignoreDuplicates que bloqueaba la reasignación, el selector que no se reiniciaba entre campañas, el corte silencioso a 1000 en el merge de vendedor_id, y ahora el riesgo de URL larga). Todas fueron encontradas por revisión de código; no he podido probarlas contra tu base real. Si después de este despliegue la función sigue sin funcionar como esperas, necesito que me digas exactamente qué ves — ¿aparece algún error en pantalla?, ¿el mensaje dice "listo" pero el cliente no cambia de asesor en Clientes → Tareas?, ¿el selector no aparece?, ¿algo distinto? — para dejar de conjeturar y resolverlo directo.


---

# ACTUALIZACIÓN v39 · Causa real encontrada: RLS bloqueaba los datos del cliente

## Migración
**`database/41_actualizacion_v39.sql`** (crm-ventas) — imprescindible para que la reasignación de campañas funcione de verdad.

## La causa raíz (por fin identificada con evidencia, no por síntomas)
El sistema tiene DOS "dueños" distintos y separados:
- El dueño de la **tarea de campaña** (`tareas_campana.vendedor_id`) — el que reasignamos en v38.
- El dueño de la **ficha del cliente** (`clientes.vendedor_id`) — la cartera real, que la reasignación de campañas NUNCA toca (y no debe tocar: reasignar una campaña no significa transferir la cartera completa del cliente).

La política de seguridad (RLS) de `clientes` solo permite leer un cliente a su dueño de cartera o a admin. Cuando reasignas una tarea de campaña a un asesor que **no** es el dueño de cartera de ese cliente, la fila de `tareas_campana` sí es visible para él (su política solo filtra por empresa), pero el join embebido a `clientes(...)` queda bloqueado por RLS — PostgREST lo devuelve como `null` en silencio. De ahí las rayas "—" en nombre, teléfono y segmento que viste en la captura, y por qué el buscador no encontraba a esos clientes (para Matías, esos campos literalmente llegaban vacíos).

## El fix
Se amplía el permiso de lectura de `clientes`: además del dueño de cartera y admin, ahora también puede leer los datos básicos del cliente cualquier asesor que tenga una **tarea de campaña activa** sobre él. La cartera real (`clientes.vendedor_id`) no se toca — esto es solo una ventana de visibilidad para trabajar la campaña, no una transferencia de dueño.

## Nota sobre las revisiones anteriores (v38, v38.1, v38.2)
Esas correcciones (ignoreDuplicates, selector no reiniciado, cortes de 1000 filas, URLs largas) eran reales y siguen siendo necesarias para que la reasignación en sí funcione correctamente — pero ninguna de ellas era la causa de lo que reportaste en la captura. Esta migración 41 es la que resuelve específicamente el síntoma de "filas en blanco / no carga completo".


---

# ACTUALIZACIÓN v40 · Campañas de recordatorio de mantención (5–6 y 6–12 meses)

## Migración
**`database/42_actualizacion_v40.sql`** (crm-ventas). No es una funcionalidad nueva: reutiliza los criterios `mant_proxima` y `mant_vencida` que ya existían en `audiencia_campana` desde hace varias versiones, pero que nunca se habían usado porque el constructor visual solo exponía el criterio de rango de fechas ("personalizada").

## Las dos campañas creadas
- **"Recordatorio · Próxima mantención (5–6 meses)"** — clientes cuya última mantención (y último servicio de cualquier tipo) ocurrió hace 150 a 180 días. Pensada para recordarles que se acerca su próxima mantención, antes de que se atrase.
- **"Recordatorio · Mantención atrasada (6–12 meses)"** — clientes cuya última mantención fue hace 181 a 365 días. Su mantención ya está vencida.

Ambas usan canal **tareas** (llamada/WhatsApp personal del asesor), igual que la campaña de fidelización de junio–julio, y quedan **activas** de inmediato en el módulo Campañas — no en Email marketing.

## Un matiz importante del criterio (ya construido, no nuevo)
Ambas campañas exigen que esa mantención haya sido el **último** servicio del cliente (no ha vuelto por otra razón desde entonces). Esto evita recontactar a alguien que, por ejemplo, tuvo su mantención hace 7 meses pero volvió la semana pasada por una reparación — a esa persona no le corresponde este recordatorio todavía.

## Cómo usarlas
Igual que la de junio-julio: entra a Campañas, selecciona la campaña, revisa la audiencia calculada en vivo (la migración ya te muestra el conteo en su diagnóstico final), y usa "Cargar a asesores" con el destino que prefieras (cartera o un asesor específico).


---

# ACTUALIZACIÓN v41 · "Nueva campaña" solo para administración

Sin migración (el permiso ya existía en la base de datos vía RLS `campanas_admin`; solo faltaba ocultar el botón en la interfaz). Ahora el botón "➕ Nueva campaña" solo se muestra a usuarios con rol admin. Los asesores siguen viendo y trabajando las campañas ya creadas (audiencia, Cargar a asesores según corresponda), pero no pueden crear nuevas.


---

# ACTUALIZACIÓN v41 · Detalle de Taller restyleado (imitación ClickUp)

## Migración
**`database/43_actualizacion_v41.sql`** (crm-ventas): agrega `servicio_externo_requerido` (jsonb) a `trabajos_taller`, y convierte los ítems existentes de `repuestos_requeridos`/`insumos_requeridos` (antes texto plano) al nuevo formato `{texto, hecho, tecnico_id}`.

## Cabecera del modal reorganizada
Dos columnas: **Estado** y **Fecha límite** a la izquierda; **Personas asignadas** (chips con los técnicos involucrados en tareas y checklist), **Prioridad** a la derecha. **"Solicitud del cliente"** como encabezado en mayúsculas seguido del texto. Tarjeta **"Datos del cliente"** (nombre + teléfono) junto a una **barra de progreso %** — calculada combinando tareas terminadas + ítems de checklist marcados, sobre el total de ambos.

## Listas de control (antes "Requerimientos de la reparación")
Ahora son checklist de verdad, con tres categorías — **Repuestos**, **Lubricantes e Insumos** y **Servicio Externo** (nueva) — donde cada ítem tiene:
- **Casilla marcable** (hecho/pendiente, con tachado visual al completar).
- **Responsable asignado** por ítem (selector de técnico), visible como su nombre para quien no puede editar.

Al usar "Pasar a presupuesto", los tres checklists se informan al encargado (Servicio Externo ahora también prellena su sección correspondiente en la cotización).

## Lo que NO se replicó de la referencia
"Duración estimada" y "Etiquetas" no se agregaron por no existir aún como datos en el modelo del CRM — se prefirió no fabricar campos sin uso real en vez de imitar la interfaz de forma superficial. "Registrar el tiempo" ya existe funcionalmente vía el cronómetro por tarea (⏱ en Línea de tiempo), que se mantuvo tal como estaba.


---

# ACTUALIZACIÓN v42 · Cierra el ciclo de las OT "faltantes"

Sin migración (solo frontend).

## Lo que faltaba
La v37 corrigió que Nueva OT permitiera registrar una OT marcada como "faltante" en Control de OT. Pero una vez registrada, esa OT seguía apareciendo como **pendiente de revisión** en Control de OT → Faltantes, porque nada le avisaba al sistema que ya se había resuelto — el admin tenía que acordarse de ir a clasificarla manualmente.

## El cierre
Al guardar exitosamente cualquier OT desde Nueva OT, ahora se marca automáticamente en `control_ot_revision` con el nuevo motivo **"Registrada"** (verde), indicando quién y cuándo. Así, si esa OT figuraba pendiente en Control de OT, pasa a "Revisadas" sola, sin trabajo manual extra. Se agregó el motivo "Registrada" a la leyenda de Control de OT.


---

# ACTUALIZACIÓN v42 · Integración bidireccional CRM ↔ ClickUp (Taller)

Diseñada sobre tu espacio real de ClickUp (consultado vía MCP): space **SERVICIO TECNICO**, lista **Vehiculos en Taller** (id `901324296305`, team `90132937173`). Confirmé que tus 10 estados de taller en el CRM calzan casi textual con los 11 estados de esa lista en ClickUp.

## Migración
**`database/44_actualizacion_v42.sql`**: agrega `clickup_task_id` y `clickup_synced_at` a `trabajos_taller`.

## Edge Function nueva
**`supabase/functions/clickup-sync/index.ts`** — maneja las DOS direcciones:
- **CRM → ClickUp**: al "Solicitar revisión" desde la ficha (nace el trabajo_taller), se crea automáticamente la tarjeta espejo en ClickUp con nombre, prioridad, fecha límite y los campos personalizados "Datos del cliente" y "Observaciones". Al cambiar estado, prioridad o fecha límite en el CRM, se empuja la actualización a ClickUp.
- **ClickUp → CRM**: un webhook (se registra una sola vez, ver más abajo) notifica a esta función cuando cambian estado/prioridad/fecha en ClickUp, y actualiza `trabajos_taller` en Supabase.

**No se sincronizan** los checklists (Repuestos/Insumos/Servicio Externo) — quedan independientes en cada sistema, tal como definiste.

## Mapeo de estados (CRM ⇄ ClickUp)
| CRM | ClickUp |
|---|---|
| por_designar | por designar |
| en_reparacion | en reparación |
| servicio_externo | en rep. servicio externo |
| compra_repuestos | compra de repuestos |
| pintura_dyp | pintura/desabolladura |
| lavado | lavado |
| alineacion | alineacion |
| prueba_ruta | prueba en ruta |
| retroceso | retroceso |
| listo_entrega | listo para entrega |
| *(sin equivalente)* | complete → se lee como listo_entrega |

**revision** y **esperando_aprobacion** (diagnóstico y presupuesto, antes de que el vehículo entre a reparación física) no tienen equivalente en ClickUp — durante esas etapas la tarjeta espejo se queda en "por designar" y no se empuja cambio de estado. Prioridad: normal→3, alta→2, urgente→1 (y viceversa).

## Despliegue (instrucciones completas dentro del propio archivo .ts)
1. Ejecutar la migración 44 en crm-ventas.
2. Subir el zip (incluye la nueva Edge Function).
3. Desplegar la función: `supabase functions deploy clickup-sync`.
4. Configurar 2 secrets en Supabase → Edge Functions → Secrets: `CLICKUP_API_TOKEN` (tu token personal de ClickUp) y `CLICKUP_LIST_ID` (`901324296305`).
5. Registrar el webhook **una sola vez** con el comando curl que está documentado al final de `clickup-sync/index.ts` (usa tu token y la URL de tu función desplegada).

## Diseño anti-loop
La sincronización CRM→ClickUp se dispara solo cuando un humano actúa en el CRM (Taller.jsx llama a la función explícitamente). La sincronización ClickUp→CRM actualiza Supabase directamente vía service role, sin volver a llamar a ClickUp — así no hay ping-pong infinito entre ambos sistemas.

## Limitación conocida
Si en ClickUp alguien mueve manualmente una tarjeta a "por designar" mientras el CRM está en `revision` o `esperando_aprobacion` (estados que ClickUp no puede distinguir, ambos se ven como "por designar" allá), el webhook no tiene forma de saber cuál de los dos era — en este caso no debería pasar porque esos dos estados nunca llegan a pisar el estado en ClickUp (se omiten al empujar), así que ClickUp seguiría mostrando lo que tenía antes, no "por designar" a menos que alguien lo cambie ahí manualmente.


---

# ACTUALIZACIÓN v42.1 · Fix CORS en clickup-sync (causaba el 4xx)

Sin migración. La función clickup-sync no incluía el manejo del preflight `OPTIONS` ni las cabeceras `Access-Control-Allow-*` — cuando el navegador intenta hacer un POST a una función distinta, primero envía una petición OPTIONS de verificación; sin esas cabeceras, el navegador bloquea la petición real antes de que llegue el POST (coincide exactamente con lo visto en el dashboard: 1 invocación, 100% 4xx). Se corrigió agregando el mismo bloque CORS que ya usa `gestionar-usuario`. **Requiere volver a desplegar la función**: `supabase functions deploy clickup-sync`.


---

# ACTUALIZACIÓN v43 · Tareas creadas directo en ClickUp → bandeja de revisión

## Migración
**`database/45_actualizacion_v43.sql`**: tabla `clickup_tareas_pendientes` (título, descripción, patente sugerida, estado).

## El problema real (confirmado con un caso real vía MCP)
Al revisar una tarea creada directo en ClickUp, encontramos que el título era texto libre sin formato fijo: `"JS WW 16 TOYOTA HILUX NELSON VALLEJO OT 12902/TRAS 1667"` — patente, marca, modelo, cliente y OT todo mezclado, y la "Solicitud del cliente" en la descripción en vez del campo Observaciones. Automatizar la creación del cliente/vehículo desde ese texto sería poco confiable y arriesgaría ensuciar la base con datos mal interpretados.

## La solución: bandeja de revisión (no auto-creación)
El webhook ahora también escucha el evento **taskCreated**. Cuando alguien crea una tarea directo en ClickUp (sin pasar por el CRM), se registra en una bandeja visible en el módulo Taller (solo jefe de taller/admin) — **no se crea nada automáticamente**. Desde ahí, cada tarea se revisa y:
- **Vincular a vehículo existente**: busca por patente y crea el trabajo de taller ya conectado a esa tarjeta de ClickUp.
- **Crear cliente y vehículo nuevo**: formulario con los datos sugeridos (la patente se intenta extraer del título por patrón, siempre editable) — nada se guarda sin que alguien lo revise primero.
- **Descartar**: si es una tarea de prueba o duplicada.

## Registrar el evento nuevo en el webhook
El webhook que ya registraste solo escucha `taskStatusUpdated`, `taskPriorityUpdated`, `taskDueDateUpdated`. Para que la bandeja funcione, hay que agregar `taskCreated`. Lo más simple: bórralo y créalo de nuevo con los 4 eventos:
```
curl.exe -X POST "https://api.clickup.com/api/v2/team/90132937173/webhook" -H "Authorization: TU_TOKEN" -H "Content-Type: application/json" -d '{\"endpoint\": \"https://ehpstxrzsjwcevcafxgk.supabase.co/functions/v1/clickup-sync\", \"events\": [\"taskCreated\", \"taskStatusUpdated\", \"taskPriorityUpdated\", \"taskDueDateUpdated\"], \"list_id\": 901324296305}'
```
(primero elimina el webhook anterior con el `id` que guardaste: `DELETE /webhook/{id}`).


---

# ACTUALIZACIÓN v44 · Subtareas de ClickUp + "Solicitar revisión" nace en reparación

## Corrección del diagnóstico anterior
Las 31 tareas de MAN X PAUTA no aparecían en ClickUp porque la función de sincronización nunca las contemplaba — no era por el paso de "revisión previa" como se sospechaba. Confirmado revisando el código: las tareas sí se creaban bien en el CRM, solo no se empujaban a ClickUp.

## Migración
**`database/46_actualizacion_v44.sql`**: agrega `clickup_subtask_id` a `tareas_taller`.

## Tareas de reparación → Subtareas de ClickUp (bidireccional)
- Al crear el trabajo ("Solicitar revisión"), TODAS sus tareas (las 31 de MAN X PAUTA u otras) se crean automáticamente como **Subtareas** de la tarjeta en ClickUp.
- Agregar una tarea nueva después (botón "+ Nueva tarea" en el taller) también crea su subtarea espejo.
- Marcar una tarea como **terminada** en el CRM la marca "complete" en ClickUp.
- Marcar una subtarea como completada en ClickUp la refleja como "terminada" en el CRM (webhook).
- Se blindó el webhook para que las subtareas que el propio CRM crea no se confundan con "tareas nuevas sueltas" de la bandeja de revisión (v43).

## "Solicitar revisión" nace directo en reparación
Por decisión tuya, se eliminó el paso previo de diagnóstico/presupuesto (`revision`/`esperando_aprobacion`) de este flujo: el trabajo ahora se crea directamente en estado **`en_reparacion`**, igual que en ClickUp (que no distingue esa etapa). Esto solo afecta el estado INICIAL al usar este botón — el resto de estados y el flujo de diagnóstico/presupuesto en otras partes del sistema no se tocaron.

## Nota que dejo pendiente de tu confirmación
El botón sigue llamándose "Solicitar revisión", pero ya no hay ninguna revisión previa — nace directo en reparación. Si te parece que el nombre ya no calza con lo que hace, dime y lo cambio (por ejemplo a "Enviar a taller").

## Webhook: agregar el evento taskCreated (si aún no lo hiciste)
Recuerda que para que la bandeja de tareas sueltas (v43) y el reconocimiento de subtareas funcionen, el webhook debe incluir el evento `taskCreated` además de los 3 anteriores — usa el script `registrar_webhook.ps1` que ya tienes.


---

# ACTUALIZACIÓN v45 · Inspección de ingreso (paso previo a Nueva OT)

Módulo nuevo completo, diseñado sobre las 13 capturas de referencia y las 7 siluetas que compartiste.

## Migración
**`database/47_actualizacion_v45.sql`**: tabla `inspecciones_ingreso` (datos generales, luces, inventario, combustible, daños marcados, checklist, fotos, firma). Incluye las políticas RLS para el bucket de Storage.

## Paso manual obligatorio: crear el bucket de Storage
Las fotos y la firma se guardan en Supabase Storage, algo que este CRM no usaba hasta ahora. **Debes crearlo a mano, una sola vez**:
1. Supabase → Storage → **New bucket**.
2. Nombre exacto: `inspecciones`.
3. Público: **NO** (privado).
4. Guardar.

Sin este paso, los pasos de Fotos y Firma del asistente fallarán al intentar subir archivos.

## El flujo
Desde **Nueva OT**, botón **"📋 Iniciar con inspección de ingreso"** abre el asistente de 7 pasos:
1. **Datos**: patente (busca vehículo existente o detecta que es nuevo y pide datos del cliente), kilometraje, fechas, ingreso en grúa, trabajo a realizar, observaciones del cliente.
2. **Luces e inventario**: 10 luces de advertencia (toggle) + 18 ítems de inventario (checkbox), tal como en tu referencia.
3. **Combustible**: control deslizante E↔F en octavos.
4. **Daños**: 7 siluetas (Sedán, Camioneta, Moto, Camión Europeo, Camión Americano, Furgón, Tractor) — se elige el tipo y se toca la imagen para marcar daños numerados, cada uno con su descripción editable.
5. **Fotos**: carga múltiple, subidas al bucket `inspecciones`, con vista previa y opción de quitar.
6. **Checklist**: ítems personalizados con 3 estados (✕ / — / ✓), más observaciones del asesor.
7. **Firma**: lienzo de firma simple (mouse o dedo), se guarda como imagen. **No es una firma electrónica certificada** — es un trazo capturado, como definimos.

Al registrar, todo se guarda en `inspecciones_ingreso`, y el formulario de Nueva OT se precarga con patente, marca/modelo, tipo de vehículo y kilometraje — quedando visible un indicador "✓ Con inspección de ingreso". Al guardar la OT finalmente, se vincula el número de OT de vuelta al registro de inspección para trazabilidad completa.

## Decisiones y limitaciones que quiero que conozcas
- **El diagrama de daños marca sobre la imagen completa** (que trae las 5 vistas combinadas: superior, frontal, laterales y trasera en un solo archivo), no vistas separadas y recortadas como en algunas referencias más sofisticadas — es una simplificación consciente para no sobre-construir esa parte; sigue capturando la ubicación aproximada del daño con su descripción.
- **"Trabajo a realizar" de la inspección no se precarga en Nueva OT** porque ese formulario usa selección de catálogo (Tipo de Servicio), no un campo de texto libre equivalente — el texto queda guardado en el registro de inspección, vinculado por `inspeccion_id`, disponible para quien necesite consultarlo.
- **La generación del PDF de la inspección** (punto 7 de tu tabla original) no quedó incluida en esta entrega — prioricé completar el flujo funcional de captura de datos primero. Si la quieres, es un siguiente paso natural, reusando el mismo estilo de PDF que ya tienes en Presupuestos (logo, cabecera DIDIAL).
- **Corregí un bug real durante la integración**: el asistente vive dentro del `<form>` de Nueva OT, y sin `type="button"` explícito en cada botón, un Enter en cualquier campo del asistente habría disparado el envío accidental del formulario completo de la OT. Ya está corregido en los 14 botones del componente.

---

# Actualización v46 — Panel operativo: rangos de fechas y segmento por marca

## Qué cambia
Solo frontend (`src/pages/PanelOperativo.jsx`). **No requiere migración SQL ni cambios en Edge Functions.**

### 1. Filtro de período por rango de fechas
- Nuevo selector **Mes | Rango** en la barra de controles.
  - **Mes**: comportamiento idéntico al anterior (selector de mes único).
  - **Rango**: dos campos de fecha (desde → hasta) + presets rápidos **3M / 6M / 12M / Año** (últimos N meses hasta hoy, o año en curso). Al activar Rango, se precarga con el mes que estaba seleccionado.
- El rango se refleja en **todo el panel**: gauges, los 10 KPIs, movimiento, donut por área, ventas por marca, tipo de servicio, NPS, técnicos con comisión y DyP.
- **Metas prorrateadas**: las metas mensuales (Toyota/Multimarca) se multiplican por los "meses equivalentes" del rango (con fracción para meses parciales — ej. 15 días de un mes de 30 cuentan 0,5). El gauge indica los meses en el título cuando el rango supera 1 mes. El "% Cumplimiento" y el máximo de garantías también se escalan.
- **Avance esperado**: si el rango incluye hoy, "Deberías llevar" se calcula sobre los días transcurridos del rango (no del mes calendario). Si el rango ya cerró, muestra "Período cerrado".

### 2. Segmento por marca (Toyota / Multimarca)
- Nuevo selector **Todas | Toyota | Multimarca** en la barra de controles, conectado al mismo estado que ya usaba el clic en el donut (quedan sincronizados: elegir en uno se refleja en el otro).
- Al seleccionar una marca, el gauge de la otra se atenúa visualmente (los gauges siguen mostrando ambos totales, porque son por definición por marca).

### 3. Ajustes de coherencia
- Movimiento en granularidad **Día** ahora agrupa por fecha completa: un rango que cruza meses muestra "5 jul, 12 ago…" en vez de mezclar días de meses distintos en la misma barra.
- Movimiento en **Mes/Año**: en modo Rango grafica solo el período seleccionado (respetando marca y área); en modo Mes conserva la vista histórica completa de siempre.
- Etiquetas "Garantías del mes" y "Ventas del mes" → "del período".

## Limitaciones declaradas
- El campo de fecha usa el datepicker nativo del navegador (sin calendario custom).
- "Vehículos en taller" sigue siendo un conteo sobre toda la base (estado actual), no del período — es un indicador de foto presente, no histórico.
- Los presets 3M/6M/12M parten del día 1 del mes inicial y llegan hasta hoy.

---

# Actualización v47 — Panel operativo: análisis DyP por servicio, Top 10 marcas y matriz Servicio × Marca

Solo frontend (`src/pages/PanelOperativo.jsx`). **Sin migración SQL ni cambios en Edge Functions.** Todo respeta los filtros globales (período mes/rango, marca, área, bruto/neto).

## 1. DyP · Desglose por servicio
Dentro de la tarjeta DyP, bajo la tabla de técnicos: tabla por tipo de servicio (DESABOLLADURA Y PINTURA, LAVADO, PULIDO, etc.) con OTs, Ventas, MO neta y Ticket (sobre OTs con venta > 0), ordenada por ventas. Nota: el universo DyP sigue definido por técnico principal (`tecnicos_dyp` de la config), igual que los KPIs de esa tarjeta.

## 2. Top 10 marcas (reemplaza el gráfico "Ventas por marca")
Tabla con ranking, OTs (frecuencia), % de OTs, Ventas (con barra de proporción de fondo) y Ticket promedio por marca. Toggle **Por ventas | Por frecuencia** para cambiar el criterio del ranking. El ticket se pinta verde si supera la meta mínima configurada. Pie de tabla indica qué % de las ventas concentra el Top 10. El gráfico anterior mostraba solo ventas top 8; esta tabla lo supersede con más información.

## 3. Matriz Servicio × Marca (doble entrada)
Heatmap: filas = top 10 tipos de servicio por ventas, columnas = las marcas del Top 10 (siguen el orden elegido en la tabla). Toggle **Ventas | OTs** como métrica de celda. Intensidad de color relativa al mayor cruce; hover muestra OTs y ventas exactas del cruce; columna Total por servicio. Montos en formato compacto ($1,2M / $850k). Scroll horizontal con la columna de servicio fija si no cabe.

## Limitaciones declaradas
- La matriz corta en 10×10 por legibilidad; cruces fuera de esos tops no se muestran (el Total de fila solo suma las columnas visibles).
- En DyP, "SIN SERVICIO" agrupa OTs del área sin tipo de servicio informado en la hoja.

---

# Actualización v48 — Matriz Servicio × Marca: Ticket promedio en vez de Ventas

Solo frontend (`src/pages/PanelOperativo.jsx`). Sin migración SQL.

- El toggle de la matriz pasa de **Ventas | OTs** a **Ticket promedio | OTs**, con Ticket promedio como vista por defecto.
- Cada celda muestra el ticket promedio de ese cruce servicio×marca = ventas del cruce ÷ OTs con venta > 0 (mismo criterio del KPI global de ticket).
- **Total de fila**: ticket ponderado del servicio (suma de ventas ÷ suma de OTs con venta de las columnas visibles), no un promedio de promedios — que distorsionaría dando el mismo peso a una marca con 1 OT y a otra con 40.
- La intensidad del color ahora es relativa al mayor ticket de la tabla, no al mayor monto de ventas: la lectura cambia de "dónde está el volumen" a "dónde está el valor por OT".
- El tooltip de cada celda muestra las tres cifras: OTs, ventas y ticket.

## Nota de interpretación
Con ticket promedio, un cruce con 1 sola OT cara se pinta igual de intenso que uno con 40 OTs del mismo ticket. Conviene alternar al modo OTs para verificar el respaldo estadístico de un cruce llamativo.

---

# Actualización v49 — Panel operativo: ingresos por Centro de ingreso × naturaleza del ingreso

Solo frontend (`src/pages/PanelOperativo.jsx`). Sin migración SQL.

## Solicitud reformulada
Análisis de composición de ingresos con **dos dimensiones cruzadas**, no una jerarquía:
- **Centro de ingreso** (Toyota / Multimarca / DyP): una columna categórica de la hoja, un valor por OT. Es la clasificación *contable oficial*, distinta de cómo el resto del panel infiere las áreas (marca del vehículo para Toyota/Multimarca, técnico principal para DyP). Pueden no coincidir, y esa discrepancia es información útil.
- **Naturaleza del ingreso** (mano de obra / repuestos / lubricantes e insumos / servicios externos): son *columnas de monto* separadas dentro de la misma OT.

Cada OT aporta su total a un centro, y ese total se descompone en las cuatro naturalezas.

## Qué se entrega
1. **Peso por centro**: tarjeta por cada centro con % sobre el total de la empresa, monto, OTs, ticket y barra de proporción.
2. **Matriz centro × naturaleza**: montos y % de composición interna de cada centro, con fila de Total empresa y columna "% empresa".
3. **Evolución de la mezcla**: barras apiladas con toggle **Por centro | Por naturaleza**. Se agrupa por día si el período cae en un mismo mes, por mes si lo cruza.
4. **Columna "Sin desglosar"**: residuo = total de la OT − suma de las cuatro naturalezas. Explícito a propósito: si las partes no suman el todo, el panel lo muestra en vez de esconderlo.

## Detección automática de columnas
El panel lee la hoja por **nombre de encabezado**, no por letra de columna (una referencia tipo "columna BH" no es utilizable). Por eso las columnas se detectan por tokens en el encabezado, sin acentos ni mayúsculas:
- Centro: encabezado que contenga "centro" + "ingreso".
- Mano de obra: "mano" + "obra" · Repuestos: "repuesto" · Lubricantes: "lubricante" (o "insumo") · Servicios externos: "externo".
- Respeta el toggle Bruto/Neto: prefiere la variante que empieza con "Neto" cuando el panel está en Neto.

Si **no** encuentra la columna de centro, en vez de fallar muestra una tarjeta de diagnóstico con la lista completa de encabezados detectados en la hoja. Si falta alguna naturaleza, avisa cuáles y esos montos caen en "Sin desglosar". Un `<details>` "Columnas usadas" permite auditar qué encabezado tomó cada concepto.

## Limitaciones declaradas
- **Independiente de los filtros de marca y área**: usa solo el filtro de período (y Bruto/Neto). Cruzar centro con marca/área sería doble filtrado sobre la misma realidad — el centro *es* esa clasificación, en versión contable.
- **Bases mezcladas**: si una naturaleza solo existe en versión Neto, en modo Bruto se usa igual y el panel lo advierte en amarillo en "Columnas usadas".
- Los valores del centro se homologan por texto (TOYOTA/MULTI/DYP-PINTURA-DESABOLL). Cualquier valor no reconocido aparece tal cual, para que se vea qué hay realmente en la hoja en lugar de ocultarlo en "Otros".
- El % de composición se calcula sobre el total del período; con períodos muy cortos, un solo trabajo grande puede dominar la mezcla.

---

# Actualización v50 — Fuente de datos: de Dashboard_Data a Hoja 1 (habilita Centro de Ingreso)

## Diagnóstico (verificado leyendo la planilla real vía Zapier)
El análisis de Centro de Ingreso de la v49 mostraba la tarjeta de diagnóstico ("19 columnas detectadas") porque **el panel no estaba leyendo la hoja que contiene la columna**.

Planilla `DIDIAL_Base_OT` (`1UTgOhJ5…`), pestañas:

| Pestaña | gid | Columnas | Tiene Centro de Ingreso |
|---|---|---|---|
| **Hoja 1** | `0` | 60 | **Sí** (col. BH) |
| Tabla dinámica 1 | 1129531022 | 26 | no |
| Log_Errores | 171637413 | 26 | no |
| **Dashboard_Data** | `174121810` | 19 | **no** ← lo que leía el panel |
| Map_Areas | 1099465507 | 3 | no |
| Control_OTs | 330354306 | 8 | no |

`Dashboard_Data` (A–S) es un subconjunto derivado: `N° Orden Trabajo, F. Ingreso, Marca, Tipo de Ingreso, Total Reparación, Neto Total Reparación, Tipo Servicio 1, Tipo Documento, N° Presupuesto, N.P.S, Permanencia, Días Recomendados Reparación, Técnico Principal, Técnicos Secundarios, Neto Mano de Obra, Neto Repuestos, Neto Lubricantes, Neto Descuento, Estado Vehículo`.

Le faltan: **Centro de Ingreso** (BH), **Monto Servicio Externo** (W) y las versiones brutas de repuestos / lubricantes / mano de obra (T, U, V).

`Hoja 1` es **superconjunto** de todas las columnas que el panel ya usaba, así que el cambio no rompe nada existente.

## Cambios
- `DEFAULTS.gid` pasa de `174121810` a `0` (Hoja 1).
- Timeout de carga gviz de 15 s → 40 s (Hoja 1 son ~4.400 filas × 60 columnas, payload bastante mayor).
- **Migración `48_fuente_hoja1.sql`**: actualiza `empresa_config` (clave `dashboard`) si existe una fila con el gid antiguo guardado, ya que la config de base de datos *pisa* los valores por defecto del código. Si esa fila no existe, no hay que hacer nada.
- Fix de la advertencia de "bases mezcladas": ahora cubre las dos direcciones. El caso real de esta planilla es el inverso al previsto — `Monto Servicio Externo` existe **solo en bruto**, sin columna `Neto Servicio Externo`, así que en modo Neto se usa el bruto y el panel lo advierte.

## Columnas que ahora alimentan el análisis de centros
- Centro: `Centro de Ingreso` (BH) — valores observados: `Toyota`, `Multimarca`.
- Mano de obra: `Monto Mano de Obra` (V) / `Neto Mano de Obra` (BC)
- Repuestos: `Monto Repuestos` (T) / `Neto Repuestos` (BA)
- Lubricantes e insumos: `Monto Lubricantes` (U) / `Neto Lubricantes` (BB)
- Servicios externos: `Monto Servicio Externo` (W) — sin versión neta

## Observación importante sobre DyP
En las muestras revisadas de la columna BH solo aparecen **Toyota** y **Multimarca**; no se observó ningún valor **DyP**. Si DyP no se registra como centro de ingreso en la planilla, el análisis mostrará solo dos centros y la separación de DyP que se pidió no será posible desde esta columna — habría que empezar a poblarla con ese tercer valor en el origen. Cualquier valor distinto que exista aparecerá en la tabla tal cual, sin agruparse en "Otros".

---

# Actualización v51 — Fix: la tarjeta DyP contaba servicios que no son de DyP

## Causa raíz
La tarjeta DyP definía su universo **por técnico principal**, no por servicio:

```js
const dypRows = rows.filter((r) => matchTec(r['Técnico Principal'], cfg.tecnicos_dyp))
```

Con `tecnicos_dyp = ['Wilson', 'Gabriel']`, cualquier OT atendida por ellos entraba a DyP sin importar el trabajo hecho. Por eso el desglose por servicio mostraba MAN BASICA (50 OTs), MAN X PAUTA (11), CAMBIO DE ACEITE (7), FRENOS (5), VULCANIZACION, MOTOR REPARACION, etc. — trabajos de Taller y Servicio Rápido facturados dentro del área equivocada. En el caso reportado, de 132 OTs solo 16 eran DESABOLLADURA Y PINTURA.

Verificado contra la pestaña `Map_Areas` de la planilla (la fuente oficial de la clasificación): el área DyP la componen DESABOLLADURA Y PINTURA, SINIESTRO ROBO, LIMPIEZA VEHICULO, LIMPIEZA DE MOTOR, LAVADO DE TAPIZ, LAVADO, PULIDO Y ENCERADO y OTROS DYP. Ninguno de los otros servicios listados pertenece al área.

## Corrección
- **Universo por defecto = área del servicio**, no el técnico. `dypRows` ahora filtra por `areaDe(r) === 'DyP'`.
- **`areaDe()` prioriza la columna `Área Servicio` (BF) de la hoja**, que es la clasificación oficial calculada desde `Map_Areas`. Solo si viene vacía cae al mapeo incrustado en el código. Antes siempre usaba el mapeo incrustado, que podía quedar desfasado respecto de la planilla. Esto también corrige el filtro de área del panel completo.
- **Toggle "Por servicio | Por técnico"**: la vista por técnico se conserva porque mide algo distinto y legítimo (carga de trabajo del equipo de DyP). Lo que estaba mal era usarla como si fuera ingreso del área.
- **Aviso de descuadre**: cuando hay OTs hechas por técnicos de DyP cuyo servicio no es de DyP, la tarjeta indica cuántas son y cuánto facturan. Esa brecha es justamente el error que se estaba reportando como ingreso del área.

## Observación pendiente (no corregida, requiere decisión)
`matchTec` compara por subcadena, así que `'Gabriel'` también captura a **Gabriel Cayo**, que según el equipo es técnico de mecánica, no de DyP. Lo mismo con `'Wilson'` y `Wilson Araya`. En el reporte revisado aparecían las cuatro variantes como filas separadas (Gabriel 108, Wilson 22, Wilson Araya 1, Gabriel Cayo 1), lo que además indica **nombres inconsistentes en el origen**: el mismo técnico se registra a veces con nombre y a veces con nombre y apellido. Con el universo definido por servicio esto ya no contamina el ingreso del área, pero sí afecta la vista "Por técnico". Conviene normalizar los nombres en la planilla y luego usar nombres completos en `tecnicos_dyp`.

---

# Actualización v52 — DyP: se elimina por completo la definición por técnico

Continuación de la v51. Se retira el toggle "Por servicio | Por técnico" introducido en esa versión: el área es una propiedad del **trabajo realizado**, no de quién lo ejecuta, así que mantener dos definiciones solo abría la puerta a volver a leer el dato equivocado.

## Cambios
- `dypRows` se define única y exclusivamente por `areaDe(r) === 'DyP'`.
- Eliminados: el toggle, el estado `dypModo`, el aviso de descuadre entre definiciones, y el cálculo `dypPorTecnico` / `dypSoloTecnico`.
- Eliminado `tecnicos_dyp` de `DEFAULTS` — ya no se usa en ninguna parte. Si la fila de `empresa_config` (clave `dashboard`) todavía lo trae, queda como campo inerte y no afecta nada; no requiere migración.
- `matchTec` se conserva porque sigue siendo necesario para `tecnicos_comision` (cálculo de MO comisionable), que sí es un concepto ligado a la persona.

## Lo que se mantiene
La tabla de técnicos **dentro** de la tarjeta DyP sigue existiendo, pero ahora responde a otra pregunta: ya no define qué OTs son de DyP, sino que muestra quién ejecutó los trabajos que efectivamente son de DyP. Es un desglose del universo, no el criterio que lo construye.

---

# Nota de estado — clickup-sync v48.1 incorporado al repo (v53)

Se reemplazó `supabase/functions/clickup-sync/index.ts` (313 líneas) por la versión **v48.1** aportada por David (377 líneas). Diferencias respecto de lo que estaba versionado:

1. **Verificación de firma HMAC del webhook (seguridad).** Antes la rama del webhook era un endpoint público que escribía en `trabajos_taller` con service role: cualquiera con la URL podía cambiar estados, prioridades y fechas. Ahora se valida `X-Signature` (HMAC-SHA256 del cuerpo crudo) contra `CLICKUP_WEBHOOK_SECRET`, con comparación de tiempo constante.
2. **Lectura del cuerpo crudo.** Se pasó de `req.json()` a `req.text()` + `JSON.parse`, porque la firma se calcula sobre el texto exacto recibido; re-serializar el JSON rompería la validación.
3. **Falla cerrada.** Si `CLICKUP_WEBHOOK_SECRET` no está configurado, la función responde 500 y rechaza el webhook en vez de procesarlo sin verificar.
4. **Guard anti-eco.** El SELECT ahora también trae `fecha_limite`, y antes de actualizar se descartan los campos cuyo valor ya coincide con el de la base. Evita el rebote CRM → ClickUp → webhook → CRM y las escrituras redundantes. Cuando no queda ningún cambio real, responde `{ ok: true, ignorado: 'sin cambios reales (eco del propio CRM)' }`.

## Requisitos de despliegue (no se cubren con un push a GitHub)
- Crear el secret **`CLICKUP_WEBHOOK_SECRET`** en Supabase → Edge Functions → Secrets, con el valor que devuelve ClickUp al registrar el webhook (`registrar_webhook.ps1`). **Sin este secret la integración ClickUp → CRM deja de funcionar por completo**, porque ahora falla cerrada por diseño.
- Redesplegar la función (`supabase functions deploy clickup-sync` o pegar el código en el dashboard). Un push a GitHub NO despliega Edge Functions.
- Sigue vigente: **Verify JWT en OFF** para esta función.
- Sigue pendiente de confirmar: que el webhook incluya el evento `taskCreated`.

---

# Actualización v54 — "Sin desglosar": causa identificada y corregida (faltaba restar los descuentos)

## Diagnóstico
En el reporte de julio 2026 la columna "Sin desglosar" mostraba montos **negativos** (Multimarca −$5.208, Toyota −$48.739, DyP −$40.336, total −$94.284). Un residuo negativo significa que las partes suman **más** que el total, lo que descartaba de entrada la hipótesis de "columnas no leídas" (esa haría el residuo positivo).

Verificado contra la planilla: la ecuación real de `Hoja 1` es

```
Total Reparación = Repuestos + Lubricantes + Mano de Obra + Servicio Externo − Descuento
```

Existen las columnas **`Descuento` (Y)** y **`Neto Descuento` (BD)**, que el análisis no estaba restando. Por eso el residuo era exactamente el descuento con signo invertido: los $94.284 "sin desglosar" eran $94.284 de descuentos otorgados.

Comprobación fila a fila (modo Neto, filas 4455-4459):
- 21.429 + 68.326 + 20.167 = 109.922 = Neto Total ✓
- 374.790 + 15.714 + 325.714 = 716.218 ✓
- 178.151 + 13.445 + 93.445 = 285.041 vs 285.042 → diferencia de $1 por redondeo

## Cambios
- Nueva columna **Descuentos** en la matriz, mostrada en negativo y en rojo, con su % sobre el total del centro. Es un dato de gestión por derecho propio, no un ajuste técnico escondido.
- El residuo pasa a calcularse como `total − (MO + repuestos + lubricantes + serv. externos − descuentos)`, con lo que debería quedar cercano a cero.
- La serie "Por naturaleza" incluye los descuentos como serie negativa (se dibuja bajo el eje, que es como corresponde leer una deducción).
- Nota al pie reescrita: explica la ecuación y que el residuo remanente es redondeo de la planilla (cada columna neta se redondea por separado, ±1 peso por OT).
- El desplegable "Columnas usadas" ahora incluye la columna de descuento y la ecuación completa.

## Fix secundario: detección de "Servicios externos"
El token era `EXTERNO`, que también coincide con **`Desc Servicio Externo` (X)**. Funcionaba por accidente (el orden de columnas hacía que ganara `Monto Servicio Externo`, W), pero era frágil. Ahora exige `SERVICIO` + `EXTERNO` y descarta explícitamente los encabezados que empiezan con `DESC`.

## Observaciones para gestión
- **`Monto Servicio Externo` viene en 0** en todas las filas muestreadas; por eso esa columna aparece vacía en el panel. No es un fallo de detección: el concepto no se está registrando en la planilla.
- **DyP concentra el descuento**: $40.336 sobre $583.697 es un 6,9% del centro, frente a 0,03% en Multimarca. Con solo 12 OTs en el período conviene revisar si es un caso puntual o una práctica del área.
- No existe `Neto Servicio Externo`; en modo Neto se usaría la columna bruta y el panel lo advertiría. Hoy no tiene efecto porque los valores son 0.

---

# Actualización v55 — Exportación del panel operativo a PDF y Excel

Solo frontend (`src/pages/PanelOperativo.jsx` + `src/index.css`). Sin migración SQL ni dependencias nuevas.

Dos botones nuevos en la barra de controles: **📄 PDF** y **📊 Excel**.

## PDF (visual)
Se implementó con `window.print()` + hoja de estilos `@media print`, el mismo enfoque que ya usan Presupuestos y Cotización Rápida. **No se agregó html2canvas ni jsPDF**: los gráficos de recharts son SVG, y el navegador los imprime en **vectorial**, lo que da mejor calidad que rasterizarlos como imagen y evita ~600 KB de dependencias.

Comportamiento:
- Se oculta toda la aplicación salvo el panel (`#panel-print`), incluidos menú, cabecera y pestañas.
- Se ocultan los controles interactivos (`.no-print`): selectores de período, marca, área, Bruto/Neto, y los toggles internos de las tarjetas (orden del Top 10, métrica de la matriz, granularidad del movimiento, vista de la mezcla).
- Se añade una **cabecera solo visible al imprimir** con empresa, período, base de monto, filtros aplicados y fecha/hora de generación — sin esto el PDF no dice a qué corresponde.
- `break-inside: avoid` en tarjetas, tablas y gráficos para que no se corten entre páginas.
- `print-color-adjust: exact` para que se impriman los fondos del heatmap, las barras de proporción y los avisos.
- A4 apaisado (el panel es ancho; en vertical las tablas de la matriz quedaban comprimidas).
- Los `<details>` se omiten (auditoría de columnas, diagnóstico) por ser información de depuración.

El usuario elige "Guardar como PDF" en el diálogo del navegador.

## Excel (detalle)
Usa `xlsx`, que **ya era dependencia** del proyecto (se usa en Datos.jsx). Genera `panel-operativo-didial-<período>.xlsx` con una hoja por análisis:

| Hoja | Contenido |
|---|---|
| Resumen | Contexto del reporte (período, filtros, fecha) + los 20 indicadores del panel |
| Marcas | **Todas** las marcas (no solo el Top 10): OTs, % OTs, ventas, % ventas, ticket |
| Servicio x Marca | Matriz **desnormalizada**: una fila por cruce con OTs, ventas, OTs con venta y ticket |
| Tipo de servicio | Ventas por tipo de servicio |
| DyP servicios | Desglose del área por servicio |
| DyP tecnicos | Quién ejecutó los trabajos de DyP |
| Centros de ingreso | Matriz centro × naturaleza, con descuentos, residuo, total, % empresa y ticket |
| Centros evolucion | Serie temporal de la mezcla |
| Tecnicos comision | MO neta y comisión estimada |
| Movimiento | Vehículos y ventas por período |
| Detalle OTs | **Todas las OTs del período** con las columnas relevantes — la base que sustenta los demás análisis |

Decisiones de formato:
- Los montos se exportan como **números**, no como texto con "$", para que sean calculables y admitan tablas dinámicas.
- La matriz servicio × marca va desnormalizada (una fila por cruce) en vez de como tabla cruzada: es el formato que Excel necesita para construir dinámicas.
- "Marcas" incluye el universo completo, no el Top 10 recortado de la pantalla; el recorte existe por legibilidad visual, no porque el dato sobre.
- La hoja Detalle OTs solo incluye las columnas que realmente existen en la hoja conectada (se validan contra `cols.keys`), así que no falla si cambia la fuente de datos.

## Limitaciones declaradas
- El PDF depende del diálogo de impresión del navegador; el resultado varía levemente entre Chrome, Firefox y Safari. Chrome da el mejor resultado.
- El PDF refleja **lo que está en pantalla**: si el Top 10 está ordenado por frecuencia o la matriz está en modo OTs, así saldrá. El Excel, en cambio, siempre lleva el detalle completo.
- El Excel exporta lo calculado en el navegador con el período y los filtros activos; no vuelve a consultar la planilla.

---

# Actualización v56 — Informe comercial exportable, portadas con logo, KPIs con alerta y análisis de mercado

Frontend (`PanelOperativo.jsx`, `Informes.jsx`, `index.css`) + módulo nuevo `src/lib/kpiBenchmarks.js`. Sin migración SQL ni dependencias nuevas.

## 1. Metas por sucursal — columna `Sucursal` (AH)
Hallazgo: `Sucursal` (AH) contiene **"Toyota" y "Multimarca"**, no ubicaciones geográficas. Es la asignación operativa, distinta de la marca del vehículo y de `Centro de Ingreso` (BH).

- Gauges, metas, filtro de segmento y tabla de sucursales pasan a usar `normSucursal()` sobre AH. Si AH viene vacía se cae a la marca para no perder la OT.
- Nueva tabla **Desempeño por sucursal**: OTs, ventas, meta prorrateada, % cumplimiento, ticket, garantías y estado.
- Se expone el **contador de discrepancia**: OTs cuya marca de vehículo no coincide con su sucursal asignada. No se corrige en silencio; se informa, porque afecta comisiones.
- Las ventas de sucursales distintas de Toyota/Multimarca se contabilizan aparte (`ventasOtras`) y se advierte que no tienen meta definida.

## 2. Métricas nuevas solicitadas
- **Q de presupuestos del período**: conteo de generados, con aprobados y % como subtítulo.
- **Q de garantías**: el tope de 3 se aplica **por sucursal**, no al total, y se prorratea por los meses del período. Estado por sucursal en la tabla.
- **Permanencia**: KPI de *cantidad de vehículos sobre 5 días*, más el conteo entre 2 y 5 días. El promedio se evalúa con los umbrales indicados (sobre 5 malo, desde 2 alerta). Se agrega tabla de detalle con OT, patente, marca, sucursal, servicio, días y venta.

## 3. KPIs con alerta contra referencia de industria
Nuevo módulo `src/lib/kpiBenchmarks.js` con 15 indicadores, cada uno con meta, zona de alerta, función de evaluación y nota de gestión. Los umbrales provienen del archivo **DIDIAL_KPI_Comercial_Operativo.xlsx** aportado por David (copiado a `docs/` para trazabilidad).

**La advertencia del archivo viaja con el dato** y se imprime en pantalla y en el PDF: los rangos son órdenes de magnitud de gestión, no percentiles calculados sobre una muestra de talleres chilenos comparables.

Indicadores evaluados: cumplimiento de metas, ticket promedio, permanencia, vehículos detenidos, MO sobre venta, repuestos sobre venta, cobertura de kilometraje, cobertura de contacto, OTs sin tipo de servicio, frecuencia de visita, vehículos de una sola visita, peso del cliente empresa, concentración top 5, mix por centro y garantías por sucursal.

**Conversión de presupuestos se marca deliberadamente como "No medible"**: sin registro de rechazos, un 100% aparente no significa nada. La recomendación es habilitar el campo, no maquillar el indicador.

Verificación: los umbrales reproducen exactamente los estados declarados en el archivo de origen para los valores reales de DIDIAL (MO 45,5% → En meta; cobertura km 35,1% → Fuera de meta; una sola visita 65,9% → Fuera de meta; frecuencia 1,40 → Vigilar).

## 4. Observaciones y recomendaciones al pie
Componente `<Observaciones>` al pie de cada sección analítica. Solo lista los indicadores que **no** están en meta, cada uno con su acción concreta; si todos cumplen, lo dice en una línea. Con `break-inside: avoid` para que nunca se separen de la sección que explican.

## 5. Análisis de mercado nuevos
- **Retención y recurrencia** — calculado sobre **toda la historia** de la base, no sobre el período: preguntar si un cliente volvió exige mirar más allá del rango. Incluye vehículos de una sola visita, frecuencia, distribución de visitas, retención por cohorte (patentes estrenadas en el período que volvieron después) y concentración top 5.
- **Parque vehicular** — antigüedad y kilometraje por tramos, con lectura de qué tipo de demanda implica el perfil de edad.
- **Origen y geografía** — cómo conoció DIDIAL, ciudad y tipo de cliente.
- **Rendimiento por asesor** — OTs, venta, ticket y participación.

## 6. Portada con logo y encabezado en cada página
- **Portada a página completa** con logo, título, período, filtros aplicados, cifras de contexto, los cinco indicadores rectores y la advertencia sobre el origen de los rangos. Usa `break-after: page`.
- **Encabezado con logo y pie de página repetidos en todas las hojas** mediante `position: fixed` dentro de `@media print`, técnica que el navegador replica en cada página. Márgenes de página ampliados a 18mm/16mm para alojarlos.
- Aplica a los dos informes.

## 7. Informe comercial exportable
La vista Comercial (fuente Supabase: cartera, campañas, gestiones) recibe el mismo tratamiento: botones PDF y Excel, portada propia, encabezado/pie con logo, y un bloque de **4 indicadores comerciales con alerta** (conversión de campaña, tiempo de cierre, días entre contactos, gestiones abiertas) con sus observaciones.

Excel comercial: Resumen, KPIs con alerta, Embudo estados, Segmentos, Servicios solicitados, Embudo campañas, Vendedores.

## Ampliación del Excel operativo
Hojas nuevas: Sucursales, KPIs con alerta (con meta, zona de alerta, estado y para qué sirve de cada indicador), Mercado retención, Mercado parque, Mercado clientes, Mayores clientes, Asesores y Permanencia (listado **completo**, no los 20 de pantalla).

## Limitaciones declaradas
- **La retención por cohorte es estructuralmente pesimista en períodos recientes**: un cliente que estrenó el mes pasado casi no ha tenido oportunidad de volver. Solo es concluyente a 12 meses de distancia. Se advierte en la propia sección.
- **Ticket promedio contra IPC**: el archivo de origen exige comparar contra inflación. El sistema no tiene serie de IPC, así que el indicador se evalúa solo contra la meta interna y la observación recuerda hacer el contraste manualmente.
- Los análisis de origen, ciudad, tipo de cliente y asesor dependen de campos con baja completitud en la base; cuando vienen vacíos la tabla lo dice explícitamente en vez de mostrar un cero engañoso.
- El logo usado es `public/logo-didial.png`, que ya existía en el repo y es idéntico al archivo aportado (mismo MD5). No se agregó un duplicado.

---

# Actualización v57 — Corrección de superposiciones en el PDF, promedios por centro y auditoría del "Sin desglosar"

Frontend (`PanelOperativo.jsx`, `index.css`). Sin migración SQL.

## 1. Superposiciones en el informe impreso — corregidas

Se identificaron cuatro causas distintas, todas reales:

**a) Encabezado y pie sin espacio reservado.** Los elementos `position: fixed` viven dentro del margen de página, pero el margen era menor que su altura, así que invadían el área de contenido. Corregido: margen de página de 18/16mm a **24/18mm**, altura acotada (`height` + `overflow: hidden`), fondo blanco opaco y `z-index` para que nunca queden bajo el texto.

**b) Grillas de Tailwind colapsadas.** Las clases `lg:grid-cols-6` dependen del ancho de *ventana*, que en impresión no aplica. Las 12 tarjetas de KPI caían a 2 columnas, generando bloques altísimos que desbordaban la hoja. Se fuerzan las columnas explícitamente dentro de `@media print`.

**c) Gráficos de recharts montados sobre el texto.** `ResponsiveContainer` posiciona el SVG en absoluto dentro de un contenedor cuya altura se calcula en JavaScript; al imprimir esa altura puede quedar en 0 y el gráfico se dibuja encima del párrafo siguiente. Se fuerza `position: relative`, `height: auto` y `min-height: 55mm` en impresión.

**d) Tablas anchas y celdas largas.** Las tablas con `min-w-[720px]` y scroll horizontal se salían del papel. En impresión se anula el ancho mínimo, se libera el `overflow`, se compacta la tipografía a 7,5pt y las celdas `truncate` se recortan con elipsis en vez de invadir la columna vecina.

También se ajustó la barra de proporción del Top 10 (dibujada en absoluto) para que quede detrás del texto y no encima, y la portada bajó de 165mm a 155mm por los nuevos márgenes.

## 2. Centros de ingreso: venta promedio y vehículos promedio

Ambos indicadores son **por mes**, calculados sobre los meses equivalentes del período (con fracción para meses parciales). Se eligió la base mensual porque el panel permite rangos de duración arbitraria: sin normalizar, comparar un rango de 3 meses con uno de 20 días no significa nada.

- En cada tarjeta de centro: venta promedio mensual y vehículos promedio mensual, además del ticket que ya estaba (que es venta por OT, otra pregunta distinta).
- En la matriz: dos columnas nuevas con la fila de Total empresa incluida.
- En el Excel: ambas columnas en la hoja "Centros de ingreso".

## 3. A qué corresponde el "Sin desglosar"

Nueva subsección que descompone el residuo. Se calcula por OT (`total − (MO + repuestos + lubricantes + serv. externos − descuentos)`) y se clasifica en dos naturalezas que no deben confundirse:

- **Redondeo de la planilla** — OTs con diferencia de ±$2 o menos. Es inevitable: cada columna neta se redondea por separado y las fracciones se acumulan. No hay nada que corregir.
- **Diferencias reales** — OTs cuya suma de partes no coincide con el total. Esto **sí es un error de captura** en la planilla y se lista con OT, patente, centro, servicio, documento, total, suma de partes, descuento y diferencia, ordenado por magnitud.

En pantalla se muestran las 15 mayores; el listado completo, con el desglose de las cuatro naturalezas por OT, va en la hoja **"Residuo"** del Excel, que además trae dos filas de resumen arriba.

Si ninguna OT difiere por más de $2, la sección lo dice explícitamente en vez de mostrar una tabla vacía.

## Limitación declarada
El umbral de $2 para separar redondeo de error es una convención: con cuatro columnas redondeadas por separado, la desviación máxima teórica por OT es de ±2 pesos. Una OT con un error de captura de exactamente $1 o $2 quedaría clasificada como redondeo y no aparecería en la tabla.

---

# Actualización v58 — Incorporación de 6 archivos v53 (búsqueda por `patente_norm`) + migración 49

## Archivos incorporados al repositorio

| Archivo | Ubicación |
|---|---|
| `Presupuestos.jsx` | `src/pages/` |
| `Clientes.jsx` | `src/pages/` |
| `NuevaOT.jsx` | `src/pages/` |
| `FacturasRepuestos.jsx` | `src/components/` |
| `InspeccionIngreso.jsx` | `src/components/` |
| `BandejaClickUp.jsx` | `src/components/` |

Los seis ya existían; se reemplazaron por las versiones aportadas. Build verde.

## Qué cambia en ellos
Un único refactor coherente: la búsqueda de vehículos pasa de la columna `patente` a **`patente_norm`**.

- **Clientes.jsx** era el caso más costoso: hacía **dos consultas** a `vehiculos` (una con la patente reformateada con espacios y otra con el texto crudo) porque la patente podía estar guardada de ambas formas. Ahora es una sola consulta.
- **Presupuestos.jsx** cambia el `.or()` para buscar por `patente_norm` con el valor ya limpio.
- **NuevaOT.jsx**, **BandejaClickUp.jsx**, **FacturasRepuestos.jsx** e **InspeccionIngreso.jsx** cambian `formatPatente(...)` por `patenteLimpia(...)` en el `ilike`.

Verificado: los cuatro archivos que usan `patenteLimpia` ya la importan correctamente (en NuevaOT viene dentro del import multilínea), y la función ya existía en `src/lib/helpers.js`.

## ⚠️ Migración 49 — obligatoria, no venía incluida
**La columna `patente_norm` no existe en la base.** Sin ella los seis módulos fallan con
`column vehiculos.patente_norm does not exist` y la búsqueda de vehículos deja de funcionar por completo.

`database/49_patente_norm.sql`:
1. Crea `patente_norm` como **columna generada** (`generated always as ... stored`) a partir de `patente`. Al ser generada no se puede desincronizar ni requiere backfill ni triggers.
2. Instala `pg_trgm` y crea un índice GIN sobre ella, necesario porque los `ilike '%...%'` empiezan con comodín y sin índice de trigramas harían scan completo.
3. Incluye dos consultas de verificación, una de ellas para **detectar vehículos duplicados** que el formato inconsistente venía ocultando (misma patente escrita de dos maneras). Esos duplicados no se borran automáticamente: cada ficha puede tener OTs, presupuestos e inspecciones asociadas.

Verificado que la expresión SQL `upper(regexp_replace(patente, '[^A-Za-z0-9]', '', 'g'))` produce exactamente el mismo resultado que `patenteLimpia()` del frontend en todos los formatos probados (con espacios, guiones, minúsculas y espacios al inicio o final).

---

# Nota de diagnóstico — Facturación histórica subestimada (caso INIA) + migración 50

## Qué se verificó

`ClienteDetalle.jsx` muestra `clientes.facturacion_total`, que se calcula (ControlOT.jsx y migración 23) como:

```sql
sum(servicios.monto) where servicios.cliente_id = <ficha>
```

Una OT queda fuera del total cuando **(a)** su `cliente_id` es NULL, o **(b)** apunta a otra ficha del mismo cliente real.

Consultando la planilla vía Zapier se comprobó el caso (b):

- `Propietario = "INIA"` exacto: **11 OTs, $4.288.050** — consistente con los $4.102.050 que muestra el CRM.
- Existe al menos una variante de escritura del mismo cliente: **`"INS. INV. AGROPECUARIA"`** (OT 12374, $33.500), con el **mismo correo** `WILSON.ROJAS@INIA.CL`.

La causa raíz es que la identidad del cliente en la base de OT es el **texto libre** de la columna Propietario (L), sin RUT. La misma base muestra el fenómeno en otros registros: `UNVERSIONES GASTRONIMICAS SPA`, `RAFEL VALDERRAMA`, y la misma patente escrita `GR WW76` y `GR WW 76`.

**No se pudo cuantificar el total real de INIA desde aquí**: la búsqueda de la planilla es por coincidencia exacta, así que enumerar todas las variantes de escritura exigiría recorrer las ~4.450 filas. La migración 50 resuelve esto del lado correcto — la base del CRM, que es donde se muestra el número equivocado — y encuentra todos los casos, no solo INIA.

## `database/50_clientes_duplicados.sql`

**No fusiona nada automáticamente.** Fusionar por parecido de nombre sin revisión humana puede unir a dos personas distintas y es irreversible.

1. **Columnas normalizadas** en `clientes` (generadas, no se desincronizan): `nombre_norm` (sin acentos ni puntuación), `telefono_norm`, `email_norm`, con índices.
2. **Diagnóstico A** — OTs huérfanas (`cliente_id is null`): dinero que hoy no está sumado en la ficha de nadie, con su detalle para vincularlas desde Control de OT.
3. **Diagnóstico B** — fichas que comparten teléfono o correo. Es el criterio **fuerte**: el nombre puede escribirse de mil maneras, el contacto no.
4. **Diagnóstico C** — fichas con nombres parecidos (similitud de trigramas > 0,55). Criterio **débil**, encuentra "INIA" / "INS. INV. AGROPECUARIA" pero también da falsos positivos (hermanos, empresa y filial). Revisar una a una.
5. **Función `fusionar_clientes(principal, secundarios[])`** — repunta `servicios`, `vehiculos`, `presupuestos`, `presupuestos_taller`, `trabajos_taller`, `gestiones`, `actividades`, `inspecciones_ingreso` y `tareas_campana` (borrando antes las que colisionarían por la restricción campaña+cliente), completa los campos vacíos de la ficha principal con datos de las secundarias, las elimina y recalcula totales. Devuelve un resumen por tabla.
6. **Recálculo general** de `facturacion_total`, `num_ot`, `ultima_visita` y `ticket_promedio`, más una consulta de verificación que debe devolver 0 filas.

### Detalle de la normalización telefónica
Se usan los **últimos 8 dígitos**, no 9. En la base conviven `+569 92764347`, `992764347`, `56992764347` y `92764347` — este último sin el 9 inicial. Con 9 dígitos el cuarto formato no agrupa con los otros tres; con 8 sí. Contrapartida: dos números que difieran solo en el primer dígito se verían iguales, razón adicional para que este criterio alimente un diagnóstico y no una fusión automática.

## Orden de ejecución recomendado
1. Ejecutar bloques 1 a 4 y **leer** los resultados.
2. Vincular las OTs huérfanas desde el módulo Control de OT.
3. Fusionar los duplicados confirmados, uno por uno, con `fusionar_clientes`.
4. Recién entonces ejecutar el bloque 6 (recálculo general).

Ejecutar el recálculo antes de fusionar consolidaría totales que todavía están repartidos entre fichas.

## Recomendación de fondo
Mientras el Propietario siga siendo texto libre sin RUT, los duplicados se seguirán generando. La corrección estructural es capturar el RUT en la recepción y usarlo como llave del cliente — el CRM ya valida RUT con módulo 11.

---

# Consolidación de clientes en el ORIGEN (planilla) + consistencia con Supabase

Hasta ahora las correcciones de identidad de cliente vivían solo del lado de Supabase (migraciones 50 y 51). Eso deja el problema abierto: mientras la planilla siga teniendo "Rafel Valderrama" y "Rafael Valderrama" como dos textos distintos, cada nueva OT vuelve a generar fichas separadas. Se corrige el origen.

## `integraciones/normalizar_clientes.gs` (Apps Script nuevo)

Sigue el patrón que la planilla ya usa (`Map_Areas` como tabla de mapeo consultada por una columna calculada). Agrega un menú **"DIDIAL · Datos"** con tres pasos y una utilidad.

### Paso 1 · `mapaClientesGenerar()` — no modifica nada
Recorre la columna Propietario y agrupa variantes usando dos niveles de evidencia:
- **Fuerte**: mismo teléfono (últimos 8 dígitos, para que `+569 92764347`, `992764347`, `56992764347` y `92764347` agrupen) o mismo correo.
- **Débil**: similitud de bigramas sobre el nombre normalizado (sin acentos ni puntuación).

Escribe la pestaña **`Map_Clientes`** con: Grupo, Variante, OTs, Facturación, Evidencia, Nombre canónico sugerido y una casilla **Aplicar**. El canónico sugerido es la variante con más OTs.

Para no comparar todos contra todos en miles de valores, la comparación por nombre se hace solo entre nombres con la misma inicial.

### Paso 2 · Revisión humana
Se corrige el canónico y se marca **Aplicar** solo en los grupos confirmados. Se pueden **agregar filas a mano**: los casos que el algoritmo no detecta por nombre (ver abajo) se resuelven así.

### Paso 3 · `mapaClientesAplicar()`
Escribe el canónico en la columna Propietario, **guardando antes el original** en una columna de respaldo `Propietario Original` (solo la primera vez, para que dos pasadas no pierdan el valor real). Reversible con `mapaClientesRevertir()`.

Regenerar el paso 1 **conserva las filas ya marcadas**, incluidas las agregadas a mano.

### Utilidad · `normalizarPatentes()`
Crea la columna **`Patente Norm`** con la patente sin separadores y en mayúsculas — exactamente lo que produce la columna generada `vehiculos.patente_norm` de Supabase (migración 49). Con eso ambos lados comparten la misma llave de vehículo. Además reporta las patentes escritas de más de una forma (el caso `GR WW76` / `GR WW 76`).

## Calibración del umbral (verificada con datos reales)

| Similitud | Caso | Debe |
|---|---|---|
| 0,903 | Rafel Valderrama / Rafael Valderrama | unir |
| 0,893 | UNVERSIONES GASTRONIMICAS / INVERSIONES GASTRONOMICAS | unir |
| 0,870 | Fernnda Vega / Fernanda Vega | unir |
| 0,850 | Contreras Hermanos Ltda / Contreras Hnos Ltda | unir |
| 0,818 | Felioe Pavez / Felipe Pavez | unir |
| **0,80** | **umbral** | |
| 0,710 | Maria Elena Rojas / Maria Elena Soto | separar |
| 0,583 | Gabriel Monge / Gabriel Nuñez | separar |

Se bajó de 0,82 a 0,80 porque con 0,82 quedaba fuera "Felioe Pavez". El margen contra el falso positivo más alto (0,710) sigue siendo cómodo.

**Limitación importante y declarada**: dos de los casos conocidos **no se detectan por nombre**:
- `Katterine Rodriguez` / `Katerine` → 0,56
- `INIA` / `INS. INV. AGROPECUARIA` → 0,18

Solo se agrupan si comparten teléfono o correo en la planilla (INIA sí comparte correo). Si no, hay que agregarlos a mano en `Map_Clientes`. Ningún algoritmo de parecido de texto puede unir "INIA" con "INS. INV. AGROPECUARIA" sin unir también cosas que no corresponden.

## Modelo de consistencia entre planilla y Supabase

| Concepto | Planilla (origen) | Supabase (CRM) | Llave común |
|---|---|---|---|
| Vehículo | columna `Patente Norm` | `vehiculos.patente_norm` (generada) | patente sin separadores, mayúsculas |
| Cliente | `Propietario` consolidado vía `Map_Clientes` | fichas fusionadas con `fusionar_clientes_preservando()` | nombre canónico |
| Área de servicio | `Área Servicio` (BF), calculada desde `Map_Areas` | — | ya consistente |

El script `crm_actualizar_ot.gs` ya existente sincroniza CRM → planilla al editar un cliente, con la política "el CRM escribe siempre; la vuelta solo completa campos vacíos". Consolidar los nombres en la planilla y fusionar las fichas en Supabase deja ambos lados con la misma identidad, y esa sincronización los mantiene alineados de ahí en adelante.

⚠️ **Detectado de paso**: `crm_actualizar_ot.gs` tiene `CRM_UPD_HOJA = 'OT'`, pero la pestaña de datos se llama **`Hoja 1`**. Si ese Web App está desplegado, no está encontrando la hoja y la sincronización CRM → planilla no está ocurriendo. Verificar y corregir la constante.

## Orden recomendado
1. `normalizarPatentes()` en la planilla.
2. Migración 49 en Supabase (`patente_norm`).
3. `mapaClientesGenerar()` → revisar → `mapaClientesAplicar()`.
4. Migraciones 50 y 51: diagnosticar, vincular huérfanas, fusionar con `fusionar_clientes_preservando()`.
5. Recálculo del bloque 6 de la migración 51 (no el de la 50).

## Recomendación de fondo (sigue vigente)
Mientras el Propietario sea texto libre sin RUT, los duplicados se seguirán generando. Capturar el RUT en la recepción y usarlo como llave es la corrección estructural; el CRM ya valida RUT con módulo 11.

---

# Normalización de marcas y modelos de vehículos — `integraciones/normalizar_vehiculos.gs`

## Problemas detectados en la base (verificados sobre datos reales, columnas F/G/H)

| # | Problema | Ejemplos reales |
|---|---|---|
| 1 | Mayúsculas mezcladas | `Toyota`/`TOYOTA`, `hilux`/`HILUX`, `Kia`/`KIA` |
| 2 | Espacios sobrantes | `explorer `, `HILUX `, `F PACE `, `I 10 ` |
| 3 | Erratas y acentos en marca | `MERCEDEZ BENZ`, `CITROËN` |
| 4 | **Cilindrada dentro del modelo** | `HILUX 2.4` — y la columna H ya existe con ese dato |
| 5 | **Tracción dentro del modelo** | `NP 300 4X4`, `RANGER 4X2`, `XTRAIL 4X4` |
| 6 | Transmisión dentro del modelo | `I 10 MT`, `SANTA FE AT`, `New XV AT` |
| 7 | Versión/equipamiento en el modelo | `TUCSON GL`, `TERRITORY TITANIUM`, `grand cherokee laredo` |
| 8 | Espaciado inconsistente | `D MAX`/`DMAX`, `I 10`/`I10`, `4 runner`/`4RUNNER` |

## Estrategia: dos capas

**Capa automática (determinista, sin revisión).** Los puntos 1 a 6 son reglas exactas. Cilindrada, tracción y transmisión se **extraen del modelo y pasan a columnas propias**, que es exactamente lo pedido. Verificado que no rompe modelos que son números: `M4`, `F150`, `T60`, `BT 50`, `560 OTTO`, `VAN 700`, `Mazda 5` quedan intactos.

**Capa revisada (pestaña `Map_Vehiculos`).** Los puntos 7 y 8 exigen criterio: `GRAND NOMADE` es modelo completo pero `GRAND CHEROKEE LAREDO` lleva versión; `D MAX` y `DMAX` son lo mismo pero eso solo se sabe conociendo el catálogo del fabricante.

## Columnas que crea

| Columna | Contenido |
|---|---|
| `Marca Original`, `Modelo Original` | Respaldo para revertir |
| `Tracción` | 4X4 / 4X2 / AWD / 4WD / 2WD |
| `Transmisión` | AT / MT / CVT / DSG / AMT |
| `Versión` | GL, TITANIUM, LAREDO, SPORT, US4… |
| `Cilindrada` (H) | Solo se **rellena si está vacía**; nunca se pisa un valor existente |

## Pestañas de control
- **`Map_Marcas`** — cada marca cruda con su canónica y un aviso `REVISAR` cuando no está en el catálogo. Ampliable: lo que agregues ahí se respeta.
- **`Map_Vehiculos`** — combinaciones marca+modelo agrupadas, con modelo canónico y versión sugeridos, y casilla Aplicar por fila. En amarillo las que cambiarían.

El catálogo incluye ~55 marcas del mercado chileno con sus alias y erratas frecuentes (`MERCEDEZ`→Mercedes Benz, `VW`→Volkswagen, `GREATWALL`→Great Wall, `SSANG YONG`→SsangYong).

## Calibración del umbral de agrupación (0,85)

Verificado contra la base real:

| Similitud | Caso | Debe |
|---|---|---|
| 0,889 | MARCH / MARCHA | unir (errata) |
| 0,857 | TIIDA / TIDA | unir (errata) |
| **0,85** | **umbral** | |
| 0,625 | VITARA / GRAND VITARA | separar |
| 0,600 | NP 300 / NP 200 · ACCENT / ASCENT | separar |
| 0,500 | 206 / 207 | separar |
| 0,364 | SOLUTO / SORENTO | separar |
| 0,000 | C35 / C45 · T60 / T70 · F150 / F250 | separar |

Se bajó de 0,86 a 0,85 porque con 0,86 quedaba fuera `TIIDA`/`TIDA`. **El riesgo más caro —unir modelos que solo se distinguen por un número— está cubierto**: `NP 300`/`NP 200`, `F150`/`F250`, `C35`/`C45`, `T60`/`T70` y `206`/`207` se separan todos con amplio margen.

Además del parecido, dos reglas exactas agrupan: misma cadena sin espacios (`D MAX`=`DMAX`) y prefijo compartido (`TUCSON` ⊂ `TUCSON GL`).

## Advertencia sobre la regla de prefijo
Une `RANGER` con `RANGER RAPTOR` y `MIRAGE` con `MIRAGE G4`. En algunos casos eso es correcto (la segunda palabra es versión) pero en otros son modelos comercialmente distintos. Por eso la fila queda **marcada en amarillo y sin confirmar**: hay que desmarcarla si no corresponde.

## Verificación de la agrupación con datos reales
- Toyota: `HILUX`+`HILUX 2.4` · `4 RUNNER`+`4RUNNER` · `YARIS`+`YARIS SPORT`; separados `URBAN CRUISER`, `FORTUNNER`, `PRIUS`.
- Chevrolet: `D MAX`+`DMAX`; separados `SAIL`, `TRACKER`, `OPTRA`, `GROOVE`, `ONIX`, `CORSA`, `AVEO`, `COLORADO`.
- Hyundai: `TUCSON`+`TUCSON GL` · `SANTA FE`+`SANTA FE AT` · `I 10`+`I10`+`I 10 MT` · `STARIA`+`STARIA US4`.
- Nissan: `NP 300`+`NP 300 4X4` · `XTRAIL`+`XTRAIL 4X4`; separados `KICKS`, `TIIDA`, `MARCH`.

## Orden recomendado
1. `Analizar marcas y modelos` — no modifica nada.
2. Revisar `Map_Marcas`: completar las marcadas `REVISAR`. Volver a analizar.
3. Revisar `Map_Vehiculos`: ajustar modelo canónico y versión, marcar Aplicar.
4. `Aplicar normalización`.

La extracción de cilindrada, tracción y transmisión se aplica a **todas** las filas en el paso 4, sin necesidad de confirmar fila por fila: son reglas deterministas.

---

# Corrección · `crm_actualizar_ot.gs` — dos defectos silenciosos que anulaban la sincronización CRM → planilla

Detectados al revisar las integraciones para el trabajo de consistencia. **Ambos fallaban en silencio**: nadie recibía un error visible, simplemente la planilla nunca se actualizaba al editar un cliente en el CRM.

## Defecto 1 · Nombre de pestaña equivocado
```js
const CRM_UPD_HOJA = 'OT';   // ← la pestaña real se llama 'Hoja 1'
```
El Web App lanzaba `No encuentro la pestaña OT` en cada llamada. Evidencia de que era un error y no un diseño distinto: `sincronizar_servicios.gs`, que opera sobre **la misma planilla**, usa `const HOJA_OT = 'Hoja 1'`.

**Corregido a `'Hoja 1'`**, y además se agregó autodetección: si el nombre configurado no existe, busca la pestaña que contenga el encabezado `N° Orden Trabajo`. Así un renombrado futuro no vuelve a romperlo.

## Defecto 2 · Búsqueda de encabezados sensible a mayúsculas
```js
const col = (cands) => { const hit = cands.find(c => head.indexOf(c) >= 0); ... }
```
`head.indexOf()` es sensible a mayúsculas. El candidato para correo era `'E-mail'` y el encabezado real es **`'E-Mail'`** (M mayúscula), así que esa columna **nunca** se habría sincronizado ni con el nombre de hoja correcto. El mismo riesgo existía con `Teléfono` / `Telefono`.

**Corregido**: la búsqueda intenta primero coincidencia exacta y luego una tolerante (sin acentos, sin mayúsculas, espacios colapsados). Se agregó `'E-Mail'` a la lista de candidatos.

### Verificación contra los encabezados reales de la planilla

| Campo | Resultado |
|---|---|
| propietario | col 11 · `Propietario` |
| telefono | col 12 · `Teléfono` |
| email | col 13 · `E-Mail` ← antes fallaba |
| ciudad | col 14 · `Ciudad` |
| tipo_cliente | col 10 · `Tipo Cliente` |
| marca / modelo / año / patente | col 5 / 6 / 8 / 4 |
| direccion / rut | no existen en la planilla (se omiten, comportamiento previsto) |

## Función nueva `crmUpdDiagnostico()`
Se ejecuta a mano desde el editor de Apps Script y reporta qué pestaña encontró, cuántas filas y columnas tiene, y qué campos configurados no existen. Permite verificar el Web App **antes** de depender de él, en vez de descubrir el problema por ausencia de datos.

## Hallazgo estructural
**La planilla no tiene columna RUT.** Es exactamente la llave que evitaría los duplicados de cliente diagnosticados en las migraciones 50 y 51. Mientras la identidad del cliente sea el texto libre de `Propietario`, el problema se seguirá generando por más que se consoliden los nombres existentes. Agregar `RUT` a la recepción y a esta planilla es la corrección de fondo; el CRM ya valida RUT con módulo 11.

## ⚠️ Requiere redespliegue
Es un Web App: editar el código no basta. Hay que hacer **Implementar → Gestionar implementaciones → editar → Nueva versión**, o la implementación activa seguirá corriendo el código viejo.

---

# Actualización v63 — Captura de Versión, Tracción y Transmisión en Nueva OT

Frontend (`NuevaOT.jsx`, `helpers.js`) + **migración 52 obligatoria**.

## Por qué
Estos atributos se venían escribiendo dentro del nombre del modelo (`NP 300 4X4`, `SANTA FE AT`, `TUCSON GL`, `HILUX 2.4`), lo que fragmentaba los análisis: `HILUX`, `HILUX 2.4`, `hilux` y `HILUX ` contaban como cuatro modelos distintos en el Top 10 y en la matriz Servicio × Marca. El script `normalizar_vehiculos.gs` limpia lo histórico; esto evita que el problema se regenere.

## Campos nuevos en el formulario
- **Versión** — texto libre (GL, Sport, Titanium, Laredo).
- **Tracción** — selector: 4X2, 4X4, AWD, 4WD.
- **Transmisión** — selector con etiqueta explicativa: MT · Manual, AT · Automática, CVT · Variable continua, DSG · Doble embrague, AMT · Automatizada.

Al campo Modelo se le agregó la ayuda *"Solo el modelo: sin cilindrada, tracción ni versión"*, para que la captura correcta sea evidente en el momento de escribir.

## Comportamiento
1. **Al buscar por patente**, si el vehículo ya existe se **precargan** sus atributos conocidos; no se vuelven a pedir.
2. **Al crear un vehículo nuevo**, los cuatro atributos quedan en su ficha.
3. **Si el vehículo ya existía**, se completan **solo los atributos vacíos** de su ficha. Nunca se pisa un dato ya cargado: el formulario pudo haber venido en blanco y sobrescribir con vacío sería una pérdida silenciosa.
4. Se envían también en el payload a la planilla, para que el registro quede consistente en ambos lados.

Se corrigió además el `select` de `buscarVehiculo()`, que traía solo `id, marca, modelo, tipo_vehiculo`: sin los campos nuevos la precarga y el relleno no habrían funcionado.

## Migración 52 — obligatoria
`database/52_atributos_vehiculo.sql`. **Sin ella el guardado falla** con `column vehiculos.traccion does not exist` y no se puede registrar ninguna OT.

- Agrega `version`, `cilindrada`, `traccion`, `transmision` a `vehiculos`, y `version`, `traccion`, `transmision` a `servicios`.
- Los datos se guardan en **ambas** tablas a propósito: el maestro refleja el estado actual del vehículo, y la OT conserva lo que se registró ese día.
- Restricciones `CHECK` sobre tracción y transmisión, declaradas **`NOT VALID`**: validan lo nuevo sin bloquear filas históricas que pudieran tener otro contenido.
- Índices parciales para los análisis por atributo (ticket de 4x4 frente a 4x2, por ejemplo).

## Pendiente relacionado
El Web App de registro que recibe el payload **no está en el repositorio**. Para que Versión, Tracción y Transmisión lleguen a las columnas de la planilla hay que agregarlas allí también; si no, viajan en el JSON pero no se escriben. El resto del flujo (Supabase, precarga, análisis) funciona igual.

---

# Columnas RUT y Dirección en la planilla + migración 53 (RUT como llave del cliente)

## Columnas creadas en `Hoja 1`
Se agregaron al final, sin tocar nada existente:

| Columna | Encabezado |
|---|---|
| BI | `Dirección` |
| BJ | `RUT` |

`CRM_Sync` (BG) y `Centro de Ingreso` (BH) quedaron intactas. Como todos los scripts localizan las columnas por nombre de encabezado y no por posición, el orden en que quedaron no tiene efecto.

Con esto, los candidatos `rut: ['RUT','Rut']` y `direccion: ['Dirección','Direccion']` de `crm_actualizar_ot.gs` —que hasta ahora resolvían a "no encontrada" y se omitían— pasan a funcionar. Nueva OT ya enviaba ambos campos en el payload.

## `database/53_rut_llave_cliente.sql`

Las migraciones 50 y 51 **rescatan** duplicados existentes usando teléfono, correo y parecido de nombre. Son criterios de limpieza del pasado. El RUT es la llave que **evita** que el problema se repita.

1. **`rut_norm`** — columna generada: solo dígitos y K, sin puntos ni guion. Hace que `12.345.678-9`, `123456789` y `12345678-9` sean el mismo valor. Con índice.
2. **`rut_dv(text)`** — función de dígito verificador chileno (módulo 11). Verificada contra un cálculo de referencia independiente con ocho cuerpos, incluidos los casos canónicos `11.111.111-1` y `12.345.678-5`.
3. **`rut_valido`** — columna generada que compara el DV informado con el calculado. Permite listar los RUT mal digitados junto al dígito correcto, para corregirlos a mano.
4. **Diagnóstico de cobertura**: cuántas fichas tienen RUT, cuántos son válidos y qué porcentaje de la cartera está cubierta.
5. **Duplicados por RUT** — la evidencia más fuerte que existe. El teléfono se comparte entre familiares y el nombre se escribe de mil formas; el RUT identifica sin ambigüedad. Incluye un bloque `DO` (comentado) que fusiona todos los grupos usando `fusionar_clientes_preservando()`, conservando la ficha de mayor facturación.
6. **Índice único parcial** (comentado): impide crear dos fichas con el mismo RUT. Aplica solo a los RUT informados y bien formados, así que **no rompe el flujo actual** donde el RUT es opcional. Debe crearse **después** de fusionar los duplicados existentes, o falla.

## Orden recomendado
1. Ejecutar los bloques 1 y 2: crear columnas y ver la cobertura real de RUT.
2. Corregir los RUT inválidos que aparezcan (la consulta muestra el DV correcto).
3. Revisar los duplicados por RUT del bloque 3 y fusionarlos.
4. Recién entonces activar el índice único del bloque 4.

## Limitación declarada
La cobertura de RUT en la cartera actual es probablemente baja: el campo era opcional y la planilla ni siquiera tenía la columna. El RUT solo funciona como llave a medida que se vaya capturando. Conviene hacerlo obligatorio en la recepción para clientes empresa desde ya, y para particulares de forma progresiva.

---

# `integraciones/limpiar_fechas_entrega.gs` — limpieza de la columna Fecha de Entrega

## Nota de origen
Esta función **no existía**. El criterio se acordó en una sesión anterior, pero la corrección de `Fecha Entrega` (junto con la de `Sucursal`) quedó pendiente por problemas con el conector y nunca llegó a materializarse en código. Se busca en los Apps Script, en las migraciones y en el frontend: solo aparece `fecha_entrega` como campo de Nueva OT y de la tabla `servicios`, sin lógica de limpieza. Se escribe ahora.

## Criterio implementado
Fecha de entrega **vacía** o **falsa** → se reemplaza por la fecha de ingreso.

Lo que cuenta como falsa, reportado por separado para no mezclar causas distintas:

| Caso | Detección |
|---|---|
| Año 1900 o anterior | El artefacto clásico de las hojas de cálculo |
| Número de serie bruto (`0`, `1`) | Se convierte con época 30/12/1899, que es de donde sale el "año 1900" |
| Año anterior a 2020 | Antes del primer registro real de la base |
| Anterior a la fecha de ingreso | Un vehículo no se entrega antes de entrar |
| Más de 2 años en el futuro | Error de tipeo en el año |
| Texto no reconocible | No parsea como fecha |

Acepta `dd/mm/aaaa`, `aaaa-mm-dd`, años de dos dígitos, objetos Date nativos y números de serie.

## Lo que deliberadamente NO toca
- **Filas sin fecha de ingreso**: sin referencia no hay con qué reemplazar. Se cuentan y se informan, pero se dejan intactas. Poner una fecha inventada sería peor que dejar el vacío.
- **Fechas válidas con permanencia larga**: si la entrega es posterior al ingreso y está en rango, se respeta aunque sean 40 días. No es tarea de este script juzgar si eso es razonable — para eso está el indicador de permanencia del panel.

## Flujo
1. **Diagnosticar** — no modifica nada. Muestra cuántas filas caen en cada caso, con un ejemplo concreto de cada uno y cuántas quedarían sin corregir por falta de fecha de ingreso. Conviene correrlo primero.
2. **Limpiar** — aplica, guardando el valor original en `Fecha Entrega Original` (solo la primera vez, para que dos pasadas no pierdan el dato real). Las celdas que estaban vacías se respaldan como `(vacía)` para poder restaurarlas como vacías.
3. **Revertir** — restaura los originales.

## Verificación
Probada la clasificación contra diez casos con fecha de ingreso 15/07/2026: vacía, `30/12/1899`, `0`, `1`, `45000`, `15/07/2026`, `10/07/2026`, `2019-05-01`, `2030-01-01` y texto libre. La conversión de número de serie se contrastó de forma independiente: `45000` → `2023-03-15`.

## Pendiente relacionado
La corrección de **`Sucursal`** sigue abierta desde la misma sesión. Hoy `normSucursal()` del Panel Operativo cae a la marca del vehículo cuando la columna AH viene vacía, y se informa el contador de discrepancia entre marca y sucursal asignada. Falta decidir el criterio de relleno en el origen.

---

# Corrección · Migración 54 — atributos del vehículo en la tabla correcta

## Error reportado
```
Error al guardar la OT: Could not find the 'traccion' column
of 'ordenes_trabajo' in the schema cache
```
Al guardar cualquier OT nueva. **Bloqueaba por completo el registro de OTs.**

## Causa — error propio en la migración 52
La migración 52 agregó `version`, `traccion` y `transmision` a `vehiculos` y a `servicios`. Pero Nueva OT inserta la orden en **`ordenes_trabajo`**:

```js
const { error: e1 } = await supabase.from('ordenes_trabajo').insert(fila)
```

`servicios` recibe **después** un upsert con un subconjunto comercial —ot_numero, fecha, patente, tipo_servicio, monto, km, documento— que no incluye estos atributos. Es decir, las columnas se agregaron en una tabla que nunca las recibe.

Eso explica la secuencia exacta del fallo: la creación del vehículo sí funcionaba, porque `vehiculos` sí tenía las columnas; el error aparecía recién al insertar la orden.

## `database/54_fix_atributos_ordenes_trabajo.sql`
1. Agrega `version`, `traccion` y `transmision` a **`ordenes_trabajo`**.
2. Restricciones `CHECK` `NOT VALID` sobre tracción y transmisión, igual que en `vehiculos`.
3. `notify pgrst, 'reload schema'` — el mensaje "in the schema cache" indica que PostgREST mantiene una copia del esquema; esto la obliga a recargar sin reiniciar el proyecto, por si el error persiste tras el ALTER.
4. Consulta de verificación sobre ambas tablas.
5. Bloque comentado para eliminar las columnas sobrantes de `servicios`. Son inofensivas (quedan siempre en NULL); se pueden dejar o limpiar, es indistinto.

La migración 52 quedó anotada en su punto 2 señalando el error, para que no confunda a futuro.

## Nota
No requiere cambios en el frontend: el código ya enviaba los tres campos correctamente. Faltaba únicamente el esquema.
