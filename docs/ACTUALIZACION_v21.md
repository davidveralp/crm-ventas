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
