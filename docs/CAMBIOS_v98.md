# v98 · Campañas: ver el motivo real del error de envío

**Fecha:** 18 de agosto de 2026
**Requiere:** **redesplegar la Edge Function `enviar-email`**

---

## El problema

> Error: Edge Function returned a non-2xx status code

Ese mensaje **no dice nada**. La función sí devuelve el motivo, pero el frontend no lo estaba leyendo.

### Por qué

Cuando una Edge Function responde 4xx o 5xx, `supabase.functions.invoke` deja `data` en **null** y `error.message` trae solo ese texto genérico. **El motivo real viene en el cuerpo de la respuesta**, accesible en `error.context`, que nadie consultaba.

Corregido en Campañas y en Email marketing, con un helper compartido.

---

## Además: la función perdía información

Encontré dos cosas al revisarla:

**Si Brevo rechazaba un lote**, se marcaba como "rebote" y se seguía adelante **sin registrar el motivo**. Remitente no validado, cuota agotada o clave inválida daban todos el mismo resultado silencioso. Ahora el motivo se captura y se devuelve.

**Si no salía ni un correo, respondía "ok" con cero enviados.** Eso no es un éxito, es un fallo. Ahora responde con error y el motivo de Brevo.

También se agregó aviso de **envío parcial**: si de 58 destinatarios salen 50, ahora lo dice.

---

## Qué hacer

### 1. Redesplegar la función
Supabase → Edge Functions → `enviar-email` → Code → pegar `supabase/functions/enviar-email/index.ts` → **Deploy**.

Un push a GitHub no la despliega.

### 2. Subir la v98 y reintentar
El mensaje ahora dirá el motivo concreto.

---

## Las cuatro causas probables

Mientras redespliegas, estas son las candidatas, en orden:

**1. Remitente no validado en Brevo.** La función envía desde `administracion@didial.cl` (o el que esté en la tabla `empresas`). Brevo **rechaza cualquier envío desde un remitente no verificado**. Se revisa en Brevo → Settings → Senders.

**2. Cuota agotada.** El plan gratuito de Brevo son 300 correos al día. La campaña tiene **58 destinatarios**; si ya se enviaron otros hoy, se pudo pasar.

**3. `BREVO_API_KEY` ausente o vencida.** La función lo dice explícitamente si falta; si está pero es inválida, el rechazo viene de Brevo.

**4. La plantilla usa parámetros que Brevo no reconoce.** La vista previa muestra nombre, vehículo y contactos personalizados. Si la plantilla usa `{{params.x}}` con nombres distintos a los que envía la función, Brevo puede rechazarla.

---

## Una observación sobre la vista previa

La pieza que muestra la pantalla —logo, saludo con nombre, marca del vehículo, contacto según sucursal— es bastante más elaborada que lo que arma la función.

Vale la pena confirmar que **lo que se ve en la vista previa es exactamente lo que se envía**. Si la plantilla vive en Brevo y la función manda otra cosa, el cliente recibiría algo distinto a lo que aprobaste.

Cuando tengas el mensaje de error concreto, lo revisamos.

---

## Nota

Existe también una función `enviar-campana` en el repositorio que **nadie llama** — el frontend usa `enviar-email` para todo. Conviene eliminarla para que no confunda en la próxima revisión.
