# Publicar en internet — DIDIAL CRM

## Frontend en Vercel (gratis)

1. Entra a [vercel.com](https://vercel.com) y conéctate con tu cuenta de GitHub.
2. **Add New → Project** → elige el repo `didial-crm`.
3. Vercel detecta Vite automáticamente. En **Environment Variables** agrega:
   - `VITE_SUPABASE_URL` = tu Project URL de Supabase
   - `VITE_SUPABASE_ANON_KEY` = tu anon key
4. **Deploy**. En ~1 minuto tendrás una URL pública (ej: `didial-crm.vercel.app`).

Cada vez que hagas `git push`, Vercel actualiza la app sola.

### Instalar como app en el celular

Abre la URL en el navegador del teléfono → menú → **"Agregar a pantalla de inicio"**.
Queda como una app nativa y funciona offline (los datos vistos quedan en caché).

---

## Reporte diario automático (8:00 hrs)

El reporte vive en `supabase/functions/reporte-diario`. Para activarlo:

### 1. Crear cuenta Brevo (envío de correos, gratis hasta 300/día)
- Regístrate en [brevo.com](https://www.brevo.com), ve a **SMTP & API → API Keys** y crea una clave.
- Verifica el remitente `administracion@didial.cl` en **Senders**.

### 2. Cargar las variables en Supabase
En **Project Settings → Edge Functions → Secrets**, agrega:
```
BREVO_API_KEY=xkeysib-...
REPORTE_DESTINATARIOS=administracion@didial.cl,gerencia@didial.cl
```

### 3. Desplegar la función
Instala el CLI de Supabase y ejecuta:
```bash
npm install -g supabase
supabase login
supabase link --project-ref TU-PROJECT-REF
supabase functions deploy reporte-diario
```

### 4. Programar a las 8:00 (UTC-4 = 12:00 UTC)
En el **SQL Editor** de Supabase:
```sql
select cron.schedule(
  'reporte-diario-didial',
  '0 12 * * *',   -- 12:00 UTC = 08:00 La Serena
  $$ select net.http_post(
       url := 'https://TU-PROJECT-REF.supabase.co/functions/v1/reporte-diario',
       headers := '{"Authorization": "Bearer TU-ANON-KEY"}'::jsonb
     ); $$
);
```

> Si tu zona pasa a horario de verano (UTC-3), ajusta a `'0 11 * * *'`.

Listo: cada mañana a las 8:00 el administrador y gerencia reciben el resumen.
