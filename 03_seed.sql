# DIDIAL CRM

PWA de gestión comercial para **Servicio Automotriz Didial** (La Serena). Maneja clientes, vehículos, pipeline de ventas, campañas segmentadas, agenda, dashboard y reportes automáticos.

Construida para ser **replicable**: el mismo código sirve para otras empresas cambiando solo la base de datos y las variables de entorno.

---

## Qué incluye

- **Clientes y vehículos** con segmentación por valor (Pareto + RFM) y por kilometraje.
- **Pipeline** tipo kanban (Lead → Contactado → Propuesta → Agendado → Vendido / Perdido) con arrastrar y soltar.
- **Seguimiento** de llamadas, propuestas y agendamientos por cliente.
- **Campañas** basadas en el Plan Maestro de DIDIAL (7 campañas precargadas).
- **Agenda** con exportación a Outlook / Google Calendar (.ics).
- **Dashboard** con embudo de ventas, conversión y distribución por segmento.
- **Importar / Exportar** desde Google Sheets (CSV/Excel) con detección automática de columnas.
- **Roles**: administrador (ve todo) y vendedor (ve solo lo suyo), con seguridad a nivel de base de datos (RLS).
- **Auditoría** de cambios de estado.
- **Reporte diario** automático por correo a las 08:00.

## Arquitectura

| Capa | Tecnología |
|------|-----------|
| Frontend | React + Vite + Tailwind (PWA, funciona offline) |
| Backend / BD | Supabase (PostgreSQL + Auth + RLS + Edge Functions) |
| Gráficos | Recharts |
| Importación | PapaParse (CSV) + SheetJS (Excel) |
| Email | Brevo (reporte diario) |
| Hosting | GitHub + Vercel (gratis) |

No requiere servidor propio: la PWA habla directo con Supabase.

## Puesta en marcha

Sigue **[docs/SETUP.md](docs/SETUP.md)** paso a paso (crear Supabase, cargar la base de datos, crear usuarios y conectar el frontend). Para publicarla en internet, **[docs/DEPLOY.md](docs/DEPLOY.md)**. Para el uso diario, **[docs/USAGE.md](docs/USAGE.md)**.

### Resumen rápido (local)

```bash
npm install
cp .env.example .env      # rellena con tus credenciales de Supabase
npm run dev
```

## Estructura

```
didial-crm/
├── database/          SQL: esquema, RLS, datos iniciales, usuarios
├── src/               Frontend React (PWA)
│   ├── pages/         Dashboard, Clientes, Pipeline, Agenda, Campañas, Datos, Usuarios
│   ├── components/    Layout, UI, rutas protegidas
│   ├── context/       Autenticación
│   └── lib/           Cliente Supabase + helpers
├── supabase/functions/reporte-diario/   Edge Function del reporte diario
└── docs/              SETUP · DEPLOY · USAGE
```

## Replicar para otra empresa

Ver la sección final de [docs/SETUP.md](docs/SETUP.md): se crea un nuevo proyecto Supabase, se corre el mismo SQL cambiando el nombre de la empresa, y se despliega otra instancia del frontend. El código no cambia.

---

Licencia MIT.
