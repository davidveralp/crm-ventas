# CRM Comercial + Postventa — Guía de instalación desde cero

Esta guía permite levantar el sistema completo para **cualquier negocio** (taller,
servicio, retail con postventa, etc.) sobre la misma arquitectura. Está pensada para
una instalación limpia y para personalizar la app por negocio sin tocar la lógica.

El sistema es **multi‑empresa**: cada instalación usa una fila en la tabla `empresas`
y todos los datos quedan aislados por `empresa_id` mediante RLS.

---

## 1. Arquitectura

- **Frontend:** React 18 + Vite 5 + Tailwind 3, desplegado en **Vercel**.
- **Backend / datos:** **Supabase** (PostgreSQL + Auth + Row Level Security + Edge Functions).
- **Email marketing:** **Brevo** (envío transaccional + webhook de eventos).
- **Sin servidor propio:** toda la lógica vive en Supabase (SQL, RLS, triggers, Edge Functions).

```
Navegador (React/Vite)  ──►  Supabase  ──►  PostgreSQL (RLS por empresa)
        │                       │
        │                       ├─ Edge Functions: gestionar-usuario, enviar-email,
        │                       │                   brevo-webhook, (enviar-campana legado)
        └─ Brevo (email) ◄──────┘   Webhook de eventos ─► email_envios
```

### Estructura del repositorio

```
src/
  pages/        Dashboard, Clientes, ClienteDetalle, Pipeline, Gestiones,
                Calendario, Campanas, Email, Presupuestos, Datos, NuevaOT,
                Informes, Usuarios, Login
  components/   Layout (sidebar), UI (Modal, Pill, TimePicker…), Recordatorios
  context/      AuthContext (sesión + perfil + rol)
  lib/          supabase.js (cliente + fetchAllRows), helpers.js (catálogos y formato)
database/       Esquema y migraciones SQL en orden (01 … 16)
supabase/functions/   Edge Functions (Deno/TypeScript)
integraciones/  sincronizar_servicios.gs (Apps Script opcional para planillas)
```

---

## 2. Requisitos previos

- Node.js 20 LTS y npm.
- Cuenta en **GitHub** (repositorio del proyecto).
- Cuenta en **Supabase** (un proyecto por negocio, o uno multi‑empresa).
- Cuenta en **Vercel** (conectada a GitHub).
- Cuenta en **Brevo** con un dominio remitente verificado (SPF/DKIM) — solo si se usará email.
- **Supabase CLI** para desplegar funciones: `npm i -g supabase`.

---

## 3. Clonar y preparar el proyecto

```bash
git clone https://github.com/<tu-usuario>/<tu-repo>.git
cd <tu-repo>
npm install
```

Verifica que compila localmente antes de seguir:

```bash
npm run build      # debe terminar con "✓ built in …"
```

---

## 4. Crear el proyecto en Supabase

1. Crea un proyecto nuevo en Supabase y anota: **Project URL** y, en *Settings → API*,
   las claves **anon** (pública) y **service_role** (secreta).
2. Abre **SQL Editor**.

### 4.1. Ejecutar el esquema y las migraciones EN ORDEN

Los archivos son idempotentes (se pueden re‑ejecutar). Córrelos uno por uno, en orden:

| Archivo | Qué hace |
|---|---|
| `01_schema.sql` | Tipos, tablas base (empresas, usuarios, clientes, vehículos, actividades, campañas, pipeline, auditoría) |
| `02_rls.sql` | Políticas Row Level Security (aislamiento por empresa) |
| `03_seed.sql` | **Empresa, etapas de pipeline y campañas de ejemplo** (personalizar — ver §9) |
| `04_vincular_usuarios.sql` | Trigger que crea el perfil al registrarse un usuario |
| `05`–`07` | Mejoras incrementales (segmentos, tipos de servicio, dirección/comuna) |
| `08_actualizacion_v4.sql` | Etapas de pipeline + clave/activo |
| `09`–`10` | RUT, tipo de servicio en actividades/presupuestos |
| `11_actualizacion_v7.sql` | Tabla `servicios` (historial de OT) + índice único **normal** |
| `12_actualizacion_v8.sql` | Triggers: enlazan servicios ↔ vehículos por patente (ambos sentidos) |
| `13_actualizacion_v9.sql` | Hora de agendamiento + roles supervisor/postventa |
| `14_actualizacion_v10.sql` | Tabla `gestiones` (ciclo de vida) + enlaces + respaldo |
| `15_actualizacion_v11.sql` | Motivo de cierre + estados de campaña (finalizada/archivada) |
| `16_actualizacion_v12.sql` | Tablas de email marketing (`email_blasts`, `email_envios`) |

> **Importante con enums:** las líneas `ALTER TYPE … ADD VALUE` (migraciones 13 y 15)
> no pueden usarse en la misma ejecución donde se crean. Si el editor reclama
> (`unsafe use of new value`), ejecuta primero solo los `ALTER TYPE`, dale Run, y
> luego corre el resto del archivo en una segunda ejecución.

> **Si ves error `42P10` (ON CONFLICT):** el índice de `servicios` debe ser único
> **normal**, no parcial. La migración 11 ya lo crea correctamente; re‑ejecútala.

---

## 5. Variables de entorno

Crea un archivo `.env` en la raíz (para desarrollo local) y configura las mismas
variables en **Vercel → Settings → Environment Variables** (Production y Preview):

```
VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<clave anon>
# Opcional: si usas un formulario de OT externo en vez del interno
VITE_REGISTRO_OT_URL=
```

> Nunca subas la clave **service_role** al frontend ni al repositorio. Solo vive en
> los *secrets* de las Edge Functions (paso 7).

---

## 6. Desplegar las Edge Functions

```bash
supabase login
supabase link --project-ref <ref-del-proyecto>

supabase functions deploy gestionar-usuario
supabase functions deploy enviar-email
supabase functions deploy brevo-webhook --no-verify-jwt
```

Configura los *secrets* (la URL y las claves de Supabase suelen estar disponibles
automáticamente; defínelas explícitamente si hiciera falta):

```bash
supabase secrets set BREVO_API_KEY=<tu-api-key-de-brevo>
supabase secrets set BREVO_WEBHOOK_TOKEN=<una-cadena-larga-secreta-inventada>
# Si no estuvieran ya disponibles para las funciones:
supabase secrets set SUPABASE_URL=https://<tu-proyecto>.supabase.co
supabase secrets set SUPABASE_ANON_KEY=<clave anon>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<clave service_role>
```

| Función | Rol |
|---|---|
| `gestionar-usuario` | Crea/elimina usuarios (auth + perfil). Solo admin. |
| `enviar-email` | Envía email marketing por Brevo y registra cada envío para medición. Solo admin. |
| `brevo-webhook` | Recibe eventos de Brevo (entregado/abierto/clic/rebote) y actualiza el estado de cada envío. Público con token. |
| `enviar-campana` | (Legado) Envío simple sin tracking. Opcional. |

---

## 7. Configurar Brevo (solo si se usará email)

1. Verifica tu **dominio remitente** en Brevo (SPF + DKIM). Sin esto, los correos caen en spam y las métricas no son fiables.
2. Ajusta el remitente en el código de las funciones de email (ver §9, "Remitente").
3. En **Transactional → Settings → Webhooks**, crea un webhook hacia:
   ```
   https://<tu-proyecto>.supabase.co/functions/v1/brevo-webhook?token=<BREVO_WEBHOOK_TOKEN>
   ```
   Marca los eventos: *delivered, opened, click, hard bounce, soft bounce, unsubscribed*.

Desde ese momento, la pestaña **Email marketing → Reportes** se llena sola con
aperturas, clics y rebotes.

---

## 8. Desplegar el frontend en Vercel

1. En Vercel, **Add New → Project** e importa el repositorio de GitHub.
2. Framework preset: **Vite**. Build command `npm run build`, output `dist`.
3. Agrega las variables de entorno del paso 5.
4. Deploy.

> **Si el build falla con "no es un JSON válido" o errores de parseo en `index.html`:**
> es señal de que al subir los archivos a GitHub se **cruzó el contenido** entre
> archivos (típico al subir uno por uno por la web). Solución: reemplaza el repo
> completo de una sola vez (GitHub Desktop o `git push` desde tu máquina con el
> proyecto íntegro), nunca archivo por archivo.

---

## 9. Personalización por negocio (white‑label)

Todos los puntos a cambiar para un negocio nuevo:

**Empresa (en `database/03_seed.sql`)**
- Genera un UUID nuevo para la empresa o reutiliza el de ejemplo si es instalación única.
- Cambia nombre, RUT/ID fiscal, ciudad, email, zona horaria.
- Ajusta las **etapas de pipeline** (`pipeline_estados`) y elimina/edita las campañas de ejemplo.

**Marca visual**
- `tailwind.config.js`: paleta de colores (`didial.red`, `ink`, `deep`, `steel`, `sky`…). Renómbralos o cambia los valores.
- `src/index.css`: clase `.carbon-sidebar` (textura/oscuro del menú).
- `src/components/Layout.jsx`: nombre/inicial del logo ("DIDIAL").
- `src/pages/Login.jsx`: título y bajada del login.

**Catálogos (en `src/lib/helpers.js`)**
- `SEGMENTOS`: segmentos de clientes y colores.
- `TIPOS_SERVICIO`: catálogo de servicios del negocio.
- `MARCAS_VEHICULO`: marcas (si no es rubro automotriz, reemplaza por tu catálogo de productos/equipos o vacíalo).
- `formatTelefono`: prefijos de país (por defecto +56/+54).

**Remitente de email (en `supabase/functions/enviar-email/index.ts` y `enviar-campana/index.ts`)**
- Cambia `sender: { name, email }` por el remitente verificado del negocio.

**Tipos de agendamiento y estados de gestión** (`helpers.js`: `TIPOS_AGENDA`, `ESTADOS_GESTION`):
ya son genéricos; ajústalos si el flujo comercial difiere.

---

## 10. Crear el primer usuario administrador

1. En Supabase → **Authentication → Users → Add user**, crea el usuario (email + contraseña).
2. El trigger de `04_vincular_usuarios.sql` crea su perfil. Asegúrate de que su fila en
   `usuarios` tenga `empresa_id` correcto y `rol = 'admin'`:
   ```sql
   update usuarios set rol = 'admin', activo = true,
     empresa_id = '<uuid-de-tu-empresa>'
   where email = '<email-del-admin>';
   ```
3. Ingresa a la app con ese usuario. Desde **Usuarios** ya puedes crear al resto del equipo
   (vendedor, supervisor, postventa) con su estado.

---

## 11. Módulos del sistema

- **Clientes / Ficha de cliente:** datos de contacto, vehículos, pipeline del cliente, historial de servicios (OT), y **Gestiones**.
- **Gestiones (proceso comercial):** una gestión agrupa contactos, presupuestos y agendamientos, con estado propio (Pendiente → En seguimiento → Agendada → Asistió → Presupuesto entregado → Pendiente decisión → Cerrada ganada/perdida) y motivo de cierre. Se mantiene abierta y editable hasta cerrarse. La página **Gestiones** controla abiertas/pendientes/vencidas/cerradas.
- **Calendario:** vista Mes y Semana (por horas), coloreado por **tipo de agendamiento**, con avisos emergentes 15 min antes (configurable) y notificación del navegador.
- **Pipeline:** estado comercial del cliente (separado del estado de la gestión).
- **Campañas:** ciclo de vida Borrador → Activa → Pausada → Finalizada → Archivada. Solo una campaña **activa** asigna clientes y envía emails.
- **Email marketing:** redacción con personalización `{nombre}`, envío por segmento y **reportería** (enviados, entregados, aperturas, clics, rebotes, no suscritos).
- **Informes (admin):** embudo por campaña, desempeño por vendedor y métricas de gestión (tiempo de cierre, tiempo entre contactos).
- **Usuarios (admin):** alta/baja, rol y estado.
- **Datos:** importación/exportación.
- **Nueva OT:** ver §12.

---

## 12. Órdenes de trabajo (OT) dentro de la app

El historial de OT vive en la tabla **`servicios`**. Hay dos formas de alimentarlo:

### 12.1. Creación directa en la app (recomendado)
La página **Nueva OT** escribe directo a Supabase, sin latencia. Captura N° OT, fecha,
patente, marca/modelo, tipo de servicio (y un segundo), kilometraje, monto y detalle.
Los **triggers** (migración 12) enlazan automáticamente la OT con su vehículo y cliente
por patente, y el kilometraje del vehículo se actualiza. Si la patente aún no existe
como vehículo, la OT queda guardada y se enlaza sola cuando se cree ese vehículo.

> Esta es la "unificación" del formulario de OT con el CRM: una sola fuente de verdad
> en Supabase. Para capturar más campos (rentabilidad, NPS, horas, etc.) basta con
> agregar columnas a `servicios` y campos al formulario `src/pages/NuevaOT.jsx`.

### 12.2. Sincronización desde una planilla existente (opcional)
Si el negocio ya gestiona OT en Google Sheets, `integraciones/sincronizar_servicios.gs`
(Apps Script) sube las filas a `servicios` por `upsert` (clave `empresa_id + ot_numero`).
Configura en el script: `SB_URL`, `SB_KEY` (service_role), `HOJA_OT` (nombre exacto de
la pestaña) y el mapeo de columnas. El parser tolera fechas inválidas, formato chileno
de números y deduplica por N° de OT.

> A futuro, si Supabase es la fuente de verdad, conviene **invertir** el flujo: el CRM
> escribe la OT y un proceso espeja un resumen plano de vuelta a la planilla para no
> romper fórmulas/dashboards existentes.

---

## 13. Importación inicial de datos

- **Clientes / vehículos:** vía la página **Datos** (CSV) o con un script SQL de carga
  (ver `06_carga_clientes.sql` como ejemplo de formato).
- **Historial de OT:** por la página Nueva OT, por la planilla (§12.2), o carga masiva en `servicios`.
- **Deduplicación:** al importar clientes/vehículos desde OT, cruza por patente, RUT y
  teléfono para no duplicar registros existentes.

---

## 14. Mantenimiento y nuevas migraciones

- Cada cambio de esquema se agrega como un archivo numerado nuevo en `database/`, idempotente.
- Re‑desplegar el frontend: `git push` (Vercel redepliega solo).
- Re‑desplegar una función: `supabase functions deploy <nombre>`.

---

## 15. Seguridad y multi‑empresa

- **RLS** aísla los datos por `empresa_id`; el frontend nunca ve datos de otra empresa.
- La clave **service_role** solo se usa dentro de Edge Functions (servidor), nunca en el navegador.
- Las funciones sensibles (`gestionar-usuario`, `enviar-email`) **verifican que quien llama sea admin**.
- El webhook de Brevo se protege con un **token** en la URL.

---

## 16. Solución de problemas frecuentes

| Síntoma | Causa / solución |
|---|---|
| Build de Vercel falla por `index.html`/`package.json` con código cruzado | Subida archivo por archivo. Reemplaza el repo completo de una vez (GitHub Desktop o `git push`). |
| `unsafe use of new value` al correr migración | `ALTER TYPE … ADD VALUE` y su uso en la misma ejecución. Corre el `ALTER TYPE` solo y luego el resto. |
| `42P10 ON CONFLICT` al sincronizar OT | El índice único de `servicios` quedó parcial. Re‑ejecuta la migración 11 (índice único normal). |
| Email envía pero no hay aperturas/clics | Falta configurar el webhook de Brevo o el dominio remitente no está verificado. |
| Crear usuario falla | Falta desplegar `gestionar-usuario` o sus secrets. |
| Avisos de agenda no aparecen | Son del lado del cliente: requieren la app abierta y permiso de notificaciones del navegador. |

---

### Resumen de "primer arranque"

1. `git clone` + `npm install` + `npm run build`.
2. Supabase: correr `01`…`16` en orden.
3. Editar `03_seed.sql` (empresa, pipeline) y personalizar catálogos/branding (§9).
4. `.env` + variables en Vercel.
5. Desplegar Edge Functions + secrets.
6. (Opcional) Brevo: remitente + webhook.
7. Deploy en Vercel.
8. Crear admin y entrar.
