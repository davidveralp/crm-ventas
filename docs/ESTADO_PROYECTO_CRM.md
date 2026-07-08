# ESTADO DEL PROYECTO · CRM DIDIAL / PLATAFORMA VPAI
**Documento de traspaso** · Actualizado: 03-07-2026 (v21)
Para continuar el desarrollo en otro chat: entrega este archivo + el zip `didial-crm-v5-github.zip`.

---

## 1. QUÉ ES

CRM comercial y operativo para **Servicio Automotriz Didial Ltda.** (La Serena, Chile), construido como **plataforma SaaS multi-tenant** bajo la marca **VPAI** (Vera Pezo + AI). Didial es el primer tenant; la arquitectura permite dar de alta nuevas empresas **insertando filas, sin tocar código** (config sobre código).

- **Repo GitHub:** `davidveralp/crm-ventas` (rama `main`) → deploy en **Vercel**
- **Backend:** Supabase (Postgres + RLS + Auth + Edge Functions)
- **Stack:** React 18 · Vite 5 · Tailwind 3.4 · react-router-dom 6 · recharts · leaflet · papaparse · xlsx · @supabase/supabase-js · vite-plugin-pwa
- **NO está instalado lucide-react** — todos los íconos son SVG embebidos
- **ID de empresa Didial:** `00000000-0000-0000-0000-000000000001`
- **Colores por variables CSS** (branding runtime): `--c-deep`, `--c-red`, `--c-sky`, `--c-ink`, `--c-steel`, `--c-mist`, `--c-paper`, `--c-carbon` definidas en `index.css`; Tailwind las consume con `rgb(var() / alpha)`.

### Flujo de trabajo con Claude
1. Claude desarrolla en `/home/claude/crm/didial-crm/`, compila con `npm install && npm run build` (siempre debe quedar limpio).
2. Entrega `didial-crm-v5-github.zip` (archivos EN LA RAÍZ del zip, sin carpeta envolvente; excluye node_modules/dist/.env/.git).
3. David reemplaza **todo el repo de una vez** (GitHub Desktop o git push; nunca archivo por archivo por la web — históricamente eso cruzó archivos y rompió el deploy).
4. Migraciones SQL: David las ejecuta en el SQL Editor de Supabase, en orden.

---

## 2. MÓDULOS DE LA APLICACIÓN (todos funcionando y compilando)

### Comercial
- **Dashboard**: clientes, **“Mis ventas del mes”** (OTs del asesor logueado; admin ve equipo), **Tasa de reconversión**, actividades recientes.
- **Clientes** (v22: pestaña **Tareas** con las tareas de campaña asignadas — tabla con filtros estado/campaña/vendedor, búsqueda, comentarios, export CSV; marcar "Agendado" crea la actividad en el Calendario; segmento por defecto 'Nuevo cliente' y vendedor = quien ingresa): búsqueda por **nombre, RUT, teléfono, patente y N° OT**; ordenamiento (facturación ↑↓, ingreso reciente/antiguo, nombre); filtros por segmento/marca/vendedor/estado.
- **Ficha de cliente (ClienteDetalle)**: cabecera con KPIs, **Estado de gestión** (incluye “En taller”), **Gestiones** (junto a estado), vehículos con historial de servicios **con N° OT**, **línea de tiempo operativa del taller** por vehículo (stepper de etapas con fechas), botón **“→ Revisión”** (deriva al taller con checklist de tareas), botón “+ Nueva OT” (navega a /nueva-ot con datos precargados por URL), y **“Presupuestos del taller para conversar”**: el asesor ajusta precios dentro del rango autorizado, genera **PDF con el formato oficial DIDIAL** (v21: secciones Repuestos / Lubricantes y Otros Insumos / Mano de Obra / Servicios Externos con subtotales y desglose NETO/IVA/TOTAL, IVA 19% incluido en los precios) y **envía por WhatsApp** (wa.me con resumen).
- **Pipeline** (8 etapas), **Gestiones** (página con filtros abiertas/pendientes/vencidas/cerradas), **Calendario** (mes/semana, colores por tipo de agendamiento, recordatorios; **“vencidas” solo cuenta últimos 14 días** — las 696 históricas eran ruido de la base importada), **Campañas** (ciclo borrador→activa→pausada→finalizada→archivada; v22: "Cargar a asesores" crea `tareas_campana` asignadas por cartera — ya NO inserta actividades al calendario ni eventos en gestiones; 6 campañas de email precargadas con plantilla HTML institucional, asunto y `criterio` jsonb de audiencia calculada del historial vía `audiencia_campana`; envío con un botón — requiere Edge Function `enviar-email` v22 desplegada + BREVO_API_KEY), **Email marketing** (Brevo, tracking por destinatario, remitente por tenant).

### Operación (grupo nuevo del menú)
- **Taller**: pipeline operativo con 13 etapas (`por_designar, revision, esperando_aprobacion, en_reparacion, servicio_externo, compra_repuestos, pintura_dyp, lavado, alineacion, prueba_ruta, retroceso, listo_entrega, completada`). Vistas: **Tablero kanban con drag&drop** (jefe/admin), **Lista** agrupada, **Técnicos** (tareas del día por técnico), **Indicadores** (tareas completadas/en curso, tiempo promedio por trabajo, atrasados, **tiempo promedio por etapa** desde el historial, rendimiento por técnico). Tarjetas con cronómetro vivo, subtareas x/y, prioridad, avatares.
  - **Detalle del trabajo**: etapa/prioridad/fecha límite, **Diagnóstico técnico** (hallazgos con severidad crítico/pronto/preventivo/ok + recomendación + botón **“→ Pasar a presupuesto”**), **Respaldo de garantía** (checks “OT firmada” y “Video enviado”), tareas (iniciar ▶ con cronómetro, terminar ✓ con **observación obligatoria**; técnico con todas listas → “Terminar tareas” pasa a prueba en ruta), presupuestos de taller.
  - **Compuerta a “En reparación”**: exige presupuesto aprobado/parcial + OT firmada ✓ + video ✓; registra **quién autorizó y cuándo**.
  - **Presupuestos de taller**: ítems con **Cód. producto, descripción, cantidad, costo y precio**; v21: ítems en 4 secciones (Repuestos · Lubricantes y Otros Insumos · Mano de Obra · Servicios Externos); el coordinador ingresa **costo (interno, no sale en el PDF) y precio de venta** por separado (sin margen automático: el margen de repuestos lo aplica el asesor), con **buscador de la base de precios** que inserta la MO según el tipo de vehículo, insumos con precio establecido y el rango eco/premium de repuestos como referencia; flags de **stock en bodega** por ítem de repuesto; flujo solicitado→cotizando→enviado→aprobado/rechazado/parcial con notificaciones.
- **Presupuestos**: pestañas **Comerciales** y **Taller** (detalle de ítems, aprobado/rechazado).
- **Control OT** (v21.2, dos pestañas): (1) **OT sin cliente**: agrupa por patente las OT del historial sin cliente vinculado (diagnóstico inicial: 2.929), con buscador por patente/N° OT y acciones "Crear ficha de cliente" (contacto + vehículo, solo nombre obligatorio) o "Vincular a cliente existente" (búsqueda por nombre/RUT/teléfono); al guardar enlaza todas las OT de la patente y recalcula facturación/num_ot/ticket/última visita del cliente. (2) **OT faltantes en la base**: lee en vivo la hoja `Control_OTs` (gviz) y lista OT faltantes para clasificar: en taller / pendiente de ingreso / otro + nota (tabla `control_ot_revision`).

### Registro de OT
- **Nueva OT** (/nueva-ot): réplica fiel de la app de registro v5.6 (GitHub Pages). 7 secciones, mismas opciones (tipo ingreso con garantías → MO puede ser $0, 29 marcas + Otra, 16 ciudades + Otra, servicios por unidad de negocio Taller/SR/DyP, encuesta con escalas 1-7 y “cómo conoció” con las opciones exactas de marketing). Formatos: patente “XX XX XX”, fono “+56 9 XXXX XXXX”, miles es-CL, total = rep+lub+MO+SE−desc. Técnico principal (lista 9 técnicos + Otro) y secundarios multi-chip. **Precarga por URL**. Si el vehículo tiene **presupuesto de taller pendiente**, muestra los ítems con casillas para tomarlo **completo o parcial punto a punto** (llena los montos y marca el presupuesto aprobado/parcial). Al guardar: inserta en `ordenes_trabajo` (columnas A→AU), upsert en `servicios`, actualiza km, **envía SIEMPRE el payload a la planilla DIDIAL_Base_OT** por el mismo Apps Script de la app (form POST + iframe, URL en `empresa_config.ot_sheet_url`), y **crea seguimiento de fidelización** para el día siguiente asignado al asesor a cargo del cliente.

### Informes (solo admin)
- **Panel operativo**: portado del dashboard HTML — conexión en vivo a hoja `Dashboard_Data` (gviz JSONP), gauges Toyota/Multimarca con ritmo del mes, KPIs con semáforo (cumplimiento, ticket, garantías, NPS, presupuestos), movimiento día/mes/año, donut por área **interactivo** (filtra por marca), ventas por marca/servicio, comisiones por técnico (MO dividida entre principal/secundarios), panel DyP. **Auto-refresh 15 min** + botón. Config en `empresa_config.dashboard` (sheet, metas, técnicos, % comisión).
- **Comercial**: embudo por campaña, desempeño por vendedor, tiempos de gestión.
- **Mapa de clientes**: Leaflet + OSM, densidad por comuna (15 comunas Región de Coquimbo) con ranking lateral. (Nivel dirección exacta requiere geocodificación — pendiente, plan definido.)

### Plataforma / SaaS
- **ConfigContext**: al iniciar sesión carga branding (colores runtime), features del plan y **catálogos del tenant** (cat_segmentos/tipos_servicio/estados_gestion/tipos_agenda) que reemplazan EN SITIO los objetos de `helpers.js` con fallback a defaults. Gating de render hasta cargar el tenant.
- **Configuración** (admin): pestañas Marca (nombre/login/colores con vista previa en vivo), Catálogos (CRUD), Plan (read-only).
- **Menú gated por features** (`crm, agenda, ot, campanas, marketing, informes, taller`); planes starter/professional/enterprise; `tiene_feature()` con gating real en RLS; Didial = Enterprise.
- **Usuarios** (admin, vía Edge Function `gestionar-usuario`): 8 roles — admin, vendedor/asesor, supervisor, postventa, **jefe_taller, tecnico, coordinador_adquisiciones, encargado_bodega**.
- **Notificaciones**: tabla `notificaciones` (por usuario o rol), **campanita** en sidebar/móvil con badge, polling 30 s y **sonido de alerta** (WebAudio) al llegar nuevas. Cada hito del flujo de taller notifica al responsable.


### Novedades v30 (07-07-2026)
- **Selector de asesor destino** al "Cargar a asesores": por cartera (vendedor de cada cliente) o todo a un asesor elegido; el resultado reporta cuántos quedaron sin asignar.
- **Auto-asignación**: asesores ven toda la lista de clientes, filtro rápido "Sin asignar", botón "+ Tomar cliente" (quien gestiona el registro lo toma); admin puede reasignar cualquiera.

### Novedades v29 (07-07-2026)
- **Constructor de campañas** en Campañas (➕ Nueva campaña): criterios simples (rango de fechas de servicio, tipo mantención/reparación, visitas y monto mín) + canal tareas o email (plantilla genérica). Personalizadas de tareas viven en Campañas; de email en Email marketing.
- **Campaña seed**: Fidelización · Servicios Junio – 6 Julio 2026 (canal tareas, activa) → "Cargar a asesores" → Clientes → Tareas.

### Novedades v28 (07-07-2026)
- **Tipo de Servicio = lista fusionada** (anterior + categorías nuevas de la planilla; una entrada por concepto), NO los servicios individuales. Mapa `OT_SVC_CATEGORIA` en helpers.
- **Desglose por categoría**: chips de servicios sugeridos en Solicitar servicio, datalist en "+ Nueva tarea" del taller, selector de categoría en buscadores de presupuestos (precargado) y cotización rápida.
- **Match flexible de tipo de vehículo** (`svcAplicaAVehiculo`): cubre combos "PICK UP/VAN/FURGON" y "…DOBLE RODADO"; categorías siempre visibles, el tipo solo filtra servicios/precios.

### Novedades v27 (06-07-2026)
- **Calendario**: popup detalle de cita (editar/eliminar/recordatorio/realizada), vencidas abajo, sin glosario, agenda solo del usuario, export .ics (sync OAuth con Gmail/Outlook = backlog).
- **Perfiles**: /perfil para cambiar la propia clave (avatar del footer); edición de usuarios por admin vía Edge Function `gestionar-usuario` acción `actualizar` (⚠️ re-desplegar); roles nuevos: asistente_administrativo, asistente_bodega, asesor_toyota, asesor_multimarca (helpers: ROLES_USUARIO, ROLES_ASESOR, sucursalDeAsesor).
- **Nueva OT**: técnicos = usuarios activos (rol técnico/jefe), sucursal fija por asesor, tipo de vehículo (precarga+guarda), nombres/apellidos, sin correo, servicios desde precios_base por segmento (también en Solicitar servicio).
- **Ficha**: chips de todas las marcas (texto, sin isologos por PI); texto de marca eliminado. **Control OT**: fecha estimada por OT vecina + filtros mes/año. **Ticket**: espera del logo, alto contraste, centrado.

### Novedades v25 (05-07-2026)
- **Planilla de precios vinculada**: `integraciones/sincronizar_precios.gs` (activador por tiempo) mantiene `precios_base` viva desde la planilla (fuente de verdad; recarga completa; celdas combinadas y Aplica=No manejados).
- **Vista de asesores**: Taller y Presupuestos ocultos para rol vendedor (menú + guarda de ruta); Control OT visible.
- **Nueva OT**: solicitud de anulación al final con motivo obligatorio (solo si montos $0 y no garantía), validación de duplicados contra `servicios`, notificación verde de éxito; texto de planilla eliminado.
- **Control OT**: OT sin patente no se vinculan (primero completarlas en la base). **Nuevo cliente**: segmento fijo "Nuevo cliente", campo Comuna/Sector. **Ticket** 80mm continuo.

### Novedades v24 (05-07-2026)
- **Revisión ≠ ejecución**: tareas bloqueadas hasta "En reparación"; el técnico evalúa (diagnóstico) y registra **requerimientos de repuestos e insumos uno a uno**, que prellenan la cotización del encargado. Respaldo de garantía fuera del taller (solo estado): lo gestiona el asesor en la ficha al aprobar.
- **Decisión del presupuesto solo del asesor** (ficha): aprueba completo / aprueba parcial (con respaldo obligatorio) / rechaza; botones eliminados de las tarjetas de taller y Presupuestos.
- **Tipo de vehículo requisito para cotizar**: el buscador de precios filtra por tipo y lo exige (selector inline que guarda en la ficha del vehículo); selector agregado al alta de vehículo en "Nuevo cliente"; resultados muestran el tipo.

### Novedades v23 (04-07-2026)
- **Presupuestos de taller elaborados por el ENCARGADO** desde Presupuestos → pestaña Taller (contexto de la revisión: servicio, observaciones, diagnóstico, tareas; base de precios integrada); el taller queda en solo lectura. Aprobación del cliente desde la ficha con respaldo de garantía obligatorio → notifica compra; "Compra gestionada" mueve el trabajo a "Compra de repuestos" y notifica al taller.
- **Cotización rápida del asesor** (botón "Cotizar" por vehículo): base de precios + ítems libres, ticket imprimible 80mm con logo y contacto por marca; se guarda como presupuesto "rápida".
- **Nueva OT**: RUT/correo/dirección obligatorios, modo Empresa (razón social + contacto), MO $0 solo garantía o "Solicitar anular OT" (notifica a administración); Control OT: motivo "OT nula" y "Otro" exige detalle.
- **Email marketing**: campañas movidas a Email → pestaña Campañas; personalización {nombre}/{vehiculo}/{servicio} + contacto Toyota/multimarca; logo real y slogan "Cuidamos lo que te mueve"; envío masivo con un botón (Edge Function v23 con destinatarios explícitos).
- Redondeo defensivo de montos (bug del peso perdido) y clientes tipo Empresa con contacto en ficha/alta.

### Novedades v21 (03-07-2026)
- **Ficha de cliente**: Nueva OT y Solicitar servicio separados; formulario de contacto con **Nombre(s)/Apellido(s)** y obligatorios (RUT, teléfono, correo, dirección, comuna, ciudad, tipo Persona/Empresa/Interno); **Marca eliminada del contacto** (es segmentación por vehículos). Aplica de aquí en adelante.
- **Vehículos**: nuevo campo **tipo de vehículo** (AUTO/SUV/PICK UP/VAN-FURGÓN-CAMIÓN) que selecciona el precio de MO en la base de precios.
- **Base de precios** (`precios_base`): 985 filas cargadas desde `Base_Datos_Precios_DIDIAL.xlsx` (precios 09-04-2026) — 921 servicios por tipo de vehículo (MO fija + rango repuestos eco/premium + insumos), 55 precios fijos, 9 insumos. Seed en `26_seed_precios_v21.sql`.
- **Tareas predefinidas por servicio** (`tareas_servicio`): MAN X PAUTA cargada (32 tareas); catálogo editable por tenant para agregar más servicios.
- **Presupuestos**: 4 secciones oficiales, PDF imprimible formato DIDIAL, asesor ajusta precios con indicador de rango (ámbar fuera de rango, sin bloqueo).
- **Sincronización bidireccional**: editar contacto/vehículo en el CRM actualiza las filas de la base de OT (Apps Script nuevo `crm_actualizar_ot.gs`, URL en `empresa_config.sheet_update_url`); la planilla → CRM solo completa campos vacíos (no pisa ediciones del CRM).
- **Fix búsqueda por N° de OT** (v21.1): las OT de clientes nunca importados quedaban huérfanas (sin cliente_id) y no aparecían en el buscador; el sync ahora crea cliente+vehículo automáticamente y los vincula. El buscador avisa cuando encuentra una OT huérfana pendiente de sync.
- **Bug del historial corregido**: OT con "—" sin descripción/monto era causado por OT duplicadas en la planilla cuya fila más reciente venía incompleta y pisaba a la completa; `sincronizar_servicios.gs` v2 fusiona duplicados prefiriendo el dato no vacío. Re-ejecutar el sync repara el historial.
- **Boleta/factura por OT**: el historial de servicios muestra tipo y N° de documento (respaldo de garantía), sincronizado desde la planilla y guardado también por la Nueva OT del CRM.
- Guía completa de despliegue: `docs/ACTUALIZACION_v21.md`.

---

## 3. FLUJO OPERATIVO IMPLEMENTADO (proceso real de Didial)

Asesor atiende → **“Enviar a Revisión”** (servicio + checklist tareas + observaciones del cliente; notifica a jefe_taller; gestión pasa a “En taller”) → jefe asigna técnico → **diagnóstico estructurado** (hallazgos con severidad) → **“Pasar a presupuesto”** (notifica coordinador + bodega) → coordinador cotiza (**costo → precio con margen** de administración; bodega marca stock) → **“Enviar al asesor”** → asesor en la ficha del cliente **ajusta precios (±% autorizado), PDF, WhatsApp** → cliente decide → en **Nueva OT** toma el presupuesto **completo o parcial punto a punto** → checks **OT firmada + video enviado** → **“En reparación”** (compuerta valida y registra quién autorizó) → técnicos ejecutan tareas (cronómetro + observación obligatoria) → “Terminar tareas” → **Prueba en ruta** (jefe) → **Listo para entrega** (notifica al asesor) → Completada. Fidelización: seguimiento automático al asesor al día siguiente de cada OT.

---

## 4. BASE DE DATOS — MIGRACIONES (carpeta `database/` del zip)

Idempotentes, se ejecutan en orden en el SQL Editor. Estado según lo conversado:

| # | Contenido | Estado |
|---|-----------|--------|
| 01–07 | Schema base, RLS, seed, usuarios, mejoras | ✅ ejecutadas |
| 08 (v4) | 8 etapas pipeline | ✅ |
| 11 (v7) | Tabla `servicios` + índice único `uq_servicios_ot` | ✅ |
| 12 (v8) | Triggers servicios↔vehiculos por patente | ✅ |
| 13 (v9) | `proxima_hora` + roles supervisor/postventa | ⚠️ verificar |
| 14 (v10) | Tabla `gestiones` + backfill | ⚠️ verificar |
| 15 (v11) | motivo_cierre + estados campaña | ✅ (en 2 pasos) |
| 16 (v12) | email_blasts/envios | ⚠️ verificar |
| 17 (v13) | **Capa SaaS**: planes/features/branding/config/cat_* + `tiene_feature()` | ⚠️ pendiente confirmar |
| 18 (v14) | Seed catálogos Didial + RLS escritura admin | ⚠️ pendiente confirmar |
| 19 (v15) | Tabla `ordenes_trabajo` (A→AU) | ⚠️ **daba error “table not found” → probablemente ya ejecutada después** (confirmar) |
| 20 (v16) | `empresa_config.ot_sheet_url` (URL Apps Script OT) | ⚠️ |
| 21 (v17) | `empresa_config.dashboard` (panel operativo) | ⚠️ |
| 22 (v18) | **Módulo Taller**: roles nuevos (⚠️ PASO 1 aparte: 4× `alter type`), trabajos_taller, tareas_taller, presupuestos_taller, notificaciones, estado en_taller, feature taller | ⚠️ |
| 23 (v19) | `control_ot_revision` + config `control_ots` (**reemplazar GID_CONTROL_OTS por el gid real**) + **recálculo facturacion_total desde servicios** | ⚠️ |
| 24 (v20) | `diagnosticos_taller`, respaldos/autorización en trabajos, config `margenes` | ⚠️ |
| 25 (v21) | apellidos, tipo_vehiculo, documento en servicios, `tareas_servicio` (seed MAN X PAUTA), `precios_base`, RPC `crm_aplicar_datos_ot`, re-vinculación por patente | 🆕 pendiente |
| 26 (v21.1) | Seed base de precios (985 filas, precios 09-04-2026; fix celdas combinadas; AC13 quedó "(nombre por completar)") | 🆕 pendiente |
| 34 (v29) | audiencia_campana v3 (criterio 'personalizada': rango fechas + tipo servicio + visitas/monto mín; canal tareas no exige email) + seed campaña Fidelización Junio–6 Julio 2026 (tareas, activa) | 🆕 pendiente |
| 33 (v27) | Roles nuevos (enum, PASO 1 solo) + precios_base.segmento (PASO 2) | 🆕 pendiente |
| 32 (v27) | Seed base de precios v2 con segmento (982 filas) | 🆕 pendiente |
| 31 (v25) | motivo_anulacion en ordenes_trabajo (resto de v25 es frontend + sincronizar_precios.gs) | 🆕 pendiente |
| 30 (v24) | `repuestos_requeridos` / `insumos_requeridos` en trabajos_taller (revisión técnica) | 🆕 pendiente |
| 29 (v23) | Presupuestos: elaboración por encargado + cotización rápida (trabajo_id nullable, cliente/vehículo/origen/compra_gestionada), empresa (contacto_nombre), OT (rut/contacto/anulación), audiencia_campana v2 + plantillas v2 (logo/slogan/personalización/contactos por marca) | 🆕 pendiente |
| 28 (v22) | Limpieza calendario/gestiones (migra actividades de campaña a `tareas_campana`), función `audiencia_campana`, campos asunto/criterio en campañas, seed 6 campañas de email con plantillas HTML | 🆕 pendiente |
| 27 (v21.1) | `crm_aplicar_datos_ot` v2: crea clientes/vehículos faltantes desde la base de OT, vincula servicios huérfanos (fix búsqueda por N° OT, ej. 13199) y recalcula facturación/num_ot/última visita | 🆕 pendiente |

**Regla de enums en Postgres:** `ALTER TYPE ... ADD VALUE` debe correr solo, en una ejecución separada del resto del script (error 55P04 si no).

### Claves de `empresa_config` (config por tenant)
- `ot_sheet_url`: URL del Apps Script de la planilla DIDIAL_Base_OT (v16)
- `dashboard`: `{sheet_id, gid, meta_toyota, meta_multimarca, meta_ticket, max_garantias, refresh_min, comision_pct, tecnicos_comision[], tecnicos_dyp[]}` (v17)
- `control_ots`: `{sheet_id, gid}` de la pestaña Control_OTs (v19, **falta gid real**)
- `margenes`: `{repuesto:35, lubricante:30, filtro:30, consumible:25, ajuste_asesor_pct:10}` (v20; en v21 el ajuste del asesor pasó a ser referencia visual, no tope duro)
- `sheet_update_url`: URL del Web App `crm_actualizar_ot.gs` con `?token=` (v21, CRM → planilla)

---

## 5. EDGE FUNCTIONS (carpeta `supabase/functions/` del zip)

| Función | Rol | Estado |
|---|---|---|
| `gestionar-usuario` | Crear/eliminar usuarios (solo admin), roles validados (8) | ❌ **NO desplegada — causa del error “Failed to send a request to the Edge Function”**. Instrucciones en `DESPLEGAR_FUNCIONES.md`: Dashboard → Edge Functions → Deploy new function → nombre exacto `gestionar-usuario` → pegar `gestionar-usuario.ts` → Deploy (secrets automáticos). Plan B manual: Auth → Add user + `insert into usuarios(...)`. |
| `enviar-email` | Envío Brevo con tracking; remitente por tenant | ⚠️ pendiente desplegar + secret `BREVO_API_KEY` |
| `brevo-webhook` | Eventos delivered/opened/click/bounce/unsub | ⚠️ pendiente (desactivar Verify JWT) + `BREVO_WEBHOOK_TOKEN`, configurar webhook en Brevo |

## 6. INTEGRACIONES
- **Sheet de precios → Supabase**: `integraciones/sincronizar_precios.gs` (v25) — recarga `precios_base` desde la planilla de precios con activador por tiempo. ⚠️ pegar en el Apps Script de esa planilla + credenciales + activador.
- **Sheet → Supabase**: `integraciones/sincronizar_servicios.gs` **v2 (v21)**: fusiona OT duplicadas prefiriendo el dato no vacío (fix del historial), sube boleta/factura y aplica contacto/vehículo al CRM solo en campos vacíos (RPC `crm_aplicar_datos_ot`). ⚠️ reemplazar el script y re-ejecutar `crmSyncServicios()` (antes `crmVerificarColumnas()` para validar encabezados opcionales).
- **CRM → Sheet (edición)**: `integraciones/crm_actualizar_ot.gs` (Web App nuevo, v21): al editar contacto o vehículo en el CRM actualiza las filas de la base de OT por patente/N° OT. ⚠️ desplegar y guardar URL+token en `empresa_config.sheet_update_url`.
- **CRM → Sheet**: Nueva OT envía el mismo payload que la app de registro al Apps Script existente (fire-and-forget; no hay confirmación de recepción — limitación aceptada).
- **Panel operativo / Control OT**: lectura gviz JSONP de pestañas públicas (“Cualquiera con el enlace · Lector”).
- **App de registro OT original**: https://davidveralp.github.io/didial-ot/ (v5.6) — su formato es la referencia fiel del módulo Nueva OT.

---

## 7. PENDIENTES OPERATIVOS (David)
1. **Desplegar `gestionar-usuario`** (bloqueante para crear usuarios). Luego crear: Jefe de Taller (Andrés Aracena), técnicos, coordinador, bodega.
2. Ejecutar migraciones pendientes **en orden** (verificar 13→24; la 22 en 2 pasos; la 23 con el gid real de Control_OTs).
3. Subir el zip al repo (reemplazo total) → verificar deploy Vercel (histórico: nunca se confirmó un deploy exitoso tras los errores de archivos cruzados).
4. Compartir pestañas `Dashboard_Data` y `Control_OTs` como públicas de lectura.
5. Desplegar funciones de email cuando se active el marketing.
6. Probar el flujo de taller completo con un caso real y traer fricciones.
7. **v21**: ejecutar migraciones 25 y 26; reemplazar `sincronizar_servicios.gs` (v2) y re-ejecutar el sync (repara el historial "—"); desplegar `crm_actualizar_ot.gs` y guardar su URL en `sheet_update_url`; definir el **tipo de vehículo** en los vehículos activos. Guía: `docs/ACTUALIZACION_v21.md`.

## 8. BACKLOG DE DESARROLLO (próximos pasos sugeridos)
- Edición de **márgenes** desde Configuración (hoy por SQL).
- **Geocodificación** de direcciones (Edge Function + Nominatim, columnas lat/lng) → heat map por punto.
- Panel plataforma VPAI: gestionar planes/features por empresa desde UI; **provisioning** de tenant end-to-end (POC seed de Castellanos Automotriz existe); billing; export/borrado Ley 21.719; roles/permisos finos.
- WhatsApp Business API (adjuntar PDF automático) — evaluado, de pago.
- Distribución de MO por unidad de negocio en Nueva OT (comportamiento avanzado de la app original, no portado).
- Sub-subtareas estilo ClickUp (hoy 1 nivel de tareas).
- Cargar tareas predefinidas de más servicios en `tareas_servicio` (hoy solo MAN X PAUTA; David reunirá los listados).
- UI de administración de la base de precios (hoy se recarga por SQL desde el xlsx).
- Numeración correlativa oficial de presupuestos (hoy el PDF usa un identificador corto derivado del id).
- Importación masiva clientes/vehículos con deduplicación (patente/RUT/teléfono).
- Revista/diario personal curado (proyecto personal aparte, en pausa).

## 9. ARCHIVOS ENTREGADOS EN ESTE CIERRE
- `didial-crm-v5-github.zip` — **código completo y actual** (compila limpio; incluye `database/` con las 24 migraciones, `supabase/functions/`, `integraciones/`, `INSTALACION.md` y docs).
- `ESTADO_PROYECTO_CRM.md` — este documento.
- `gestionar-usuario.ts` + `DESPLEGAR_FUNCIONES.md` — para destrabar usuarios.
- SQLs sueltos 22/23/24 también entregados aparte en la conversación.

**Para retomar en otro chat**: sube este MD + el zip y di “continuemos el CRM DIDIAL desde este estado”. Con eso cualquier sesión nueva tiene el contexto completo.
