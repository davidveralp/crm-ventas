# Botón "Enviar campaña por email" — activación

El CRM ahora tiene un botón para enviar una campaña por correo a todos los
clientes de su segmento (con email registrado), directo desde la pantalla
Campañas. Para activarlo hay que conectar Brevo una sola vez.

## Requisitos previos (una vez)
1. Cuenta Brevo + remitente `administracion@didial.cl` verificado.
2. API Key de Brevo (SMTP & API → API Keys).

## Paso 1 — Instalar el CLI de Supabase (en tu PC)
```bash
npm install -g supabase
supabase login
supabase link --project-ref ehpstxrzsjwcevcafxgk
```
(El project-ref es el código de tu URL de Supabase.)

## Paso 2 — Cargar los secrets
```bash
supabase secrets set BREVO_API_KEY=xkeysib-TU_CLAVE
```

## Paso 3 — Desplegar la función
```bash
supabase functions deploy enviar-campana
```

## Cómo se usa
1. En el CRM → Campañas, abre una campaña cuyo canal sea **Email**.
2. Revisa los clientes que coinciden.
3. Botón **"Enviar por email (Brevo)"** → confirma. Se envían los correos y
   te muestra cuántos salieron.

## Importante
- Solo envía a clientes con email válido en su ficha.
- Los segmentos masivos (Ocasional, Dormido) son los ideales para email.
- VIP y Alto Valor: contáctalos por llamada/WhatsApp personal, NO por correo masivo.
- Brevo gratis: 300 correos/día. Si un segmento supera eso, divídelo en días.
