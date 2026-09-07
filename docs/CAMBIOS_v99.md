# v99 · Reenviar solo a quienes no recibieron

**Fecha:** 18 de agosto de 2026
**Requiere:** **redesplegar la Edge Function `enviar-email`**

---

## Para qué

En el envío anterior, Brevo aceptó **50 correos y rechazó 64** por la restricción de IP. Reintentar la campaña completa habría enviado el correo **dos veces a los primeros 50**.

Ahora hay un botón que envía solo a los que faltan.

---

## Qué vas a ver

En el detalle de una campaña de email, junto a "Enviar por email (Brevo)", aparece un segundo botón:

> **Reenviar solo a los que faltan**

**Solo aparece si la campaña ya tuvo envíos exitosos.** Si nunca se envió, no tiene sentido y no se muestra. Al pasar el cursor indica cuántos ya la recibieron.

El resultado detalla lo omitido:

> *Enviados: 64 de 64 correos. Se omitieron 50 que ya la habían recibido.*

Y si ya recibieron todos:

> *Todos los destinatarios (114) ya habían recibido esta campaña*

---

## Cómo decide a quién omitir

Consulta `email_envios` con estado **`enviado`** para esa campaña, y excluye esos correos de la lista.

**Se comparan correos normalizados** —sin espacios y en minúsculas— no identificadores de cliente. La razón: el mismo cliente puede figurar con el correo escrito de otra forma en un envío anterior, y comparar por `cliente_id` dejaría pasar duplicados.

**Los rebotes no se omiten.** Si Brevo rechazó un correo, ese cliente **no lo recibió**, así que entra en el reenvío. Es justamente el caso de tus 64.

---

## Qué hacer ahora

1. **Desactiva la restricción de IP en Brevo**, si no lo has hecho: [app.brevo.com/security/authorised_ips](https://app.brevo.com/security/authorised_ips). Autorizar direcciones una por una no sirve: cambian en cada invocación, como confirmó tu último envío.
2. **Redespliega `enviar-email`** con el código de esta versión.
3. Sube la v99.
4. En la campaña, usa **"Reenviar solo a los que faltan"**. Deberían salir los 64 pendientes sin repetir a nadie.

---

## Dos cosas que conviene revisar

**El total cambió de 58 a 114 destinatarios.** Puede ser un segmento distinto o un criterio que se modificó. Vale la pena confirmar a quiénes está llegando antes de reenviar.

**Cuota de Brevo.** El plan gratuito son 300 correos diarios. Entre los 50 que salieron y los 64 pendientes vas en 114 hoy.
