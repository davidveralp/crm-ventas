# Email marketing automático (Brevo) — Roadmap Fase 2

Objetivo: enviar correos a un segmento de clientes (ej. Ocasionales y Dormidos)
de forma automática, con bajo costo.

## Por qué Brevo
- Plan gratis: 300 correos/día (9.000/mes). Suficiente para campañas segmentadas.
- API simple, ya dejé preparada la función de envío en el proyecto.

## Paso 1 — Crear cuenta y remitente
1. Regístrate en [brevo.com](https://www.brevo.com).
2. Ve a **Senders, Domains & Dedicated IPs → Senders** y agrega/verifica
   `administracion@didial.cl` (te llega un correo de verificación).
3. Ve a **SMTP & API → API Keys** y crea una clave. Cópiala.

## Paso 2 — Cargar la clave en Supabase
En Supabase → **Project Settings → Edge Functions → Secrets**, agrega:
```
BREVO_API_KEY = xkeysib-...
```

## Paso 3 — Función de envío de campaña
El proyecto incluye la función `reporte-diario`. Para campañas masivas usaremos
la misma cuenta Brevo. El flujo recomendado para DIDIAL:

1. En el CRM, abre la campaña (ej. "Reactivación de Dormidos") y revisa los
   clientes que coinciden y que tengan correo.
2. Exporta esa lista (Importar/Exportar → Descargar Excel, filtrando el segmento).
3. En Brevo: **Contacts → Import**, sube la lista como una "Lista".
4. **Campaigns → Email → Create**: diseña el correo con el mensaje del segmento
   (los tienes en la Guía del Vendedor), elige la lista y programa el envío.

## Paso 4 — Automatización real (opcional, más adelante)
Cuando quieras envío 100% automático desde el CRM (sin exportar), conectamos:
- Un botón "Enviar campaña" en la pantalla de Campañas →
- que llame a una Edge Function `enviar-campana` →
- que tome los clientes del segmento con email y los envíe vía Brevo API.

Esto requiere un poco más de desarrollo; cuando llegues aquí, lo armamos.

## Buenas prácticas
- Empieza por segmentos masivos de bajo costo (Ocasional, Dormido).
- A los VIP y Alto Valor NO los metas en correo masivo: esos van por llamada/WhatsApp personal.
- Incluye siempre opción de "no recibir más correos" (Brevo lo agrega solo).
