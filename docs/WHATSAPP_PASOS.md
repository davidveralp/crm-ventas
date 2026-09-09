# WhatsApp · lo que falta, en orden

Los identificadores ya están. Quedan cinco pasos.

```
TOYOTA      +56 9 3740 1051
  WABA:             230575228519735
  phone_number_id:  3497109847078636

MULTIMARCA  +56 9 8974 8626
  WABA:             2450883918497727
  phone_number_id:  2420274461403051
```

---

## 1 · Token permanente

El token que ves en la app **vence en 24 horas**. Para producción:

1. **business.facebook.com** → **Configuración del negocio**
2. **Usuarios** → **Usuarios del sistema** → **Agregar**
3. Nombre `CRM Didial`, rol **Administrador**
4. **Generar nuevo token** → tu app → vencimiento **Nunca**
5. Permisos: **`whatsapp_business_messaging`** y **`whatsapp_business_management`**
6. Cópialo: no se vuelve a mostrar

**Importante:** en la misma pantalla del usuario del sistema, asigna **las dos cuentas de WhatsApp** como activos. Si solo asignas una, la otra sucursal no podrá enviar.

## 2 · Secrets en Supabase

Edge Functions → Secrets:

```
WA_TOKEN              = el token del paso 1
WA_PHONE_TOYOTA       = 3497109847078636
WA_PHONE_MULTIMARCA   = 2420274461403051
WA_VERIFY_TOKEN       = didial2026wa      (o el texto que prefieras)
```

## 3 · Desplegar la función

Edge Functions → New function → nombre **`whatsapp`** → pega `whatsapp-v2.ts` → Deploy.

**Verify JWT: OFF.**

## 4 · Webhook, en las DOS cuentas

Como son dos cuentas separadas, el webhook se configura **dos veces** — una por cada app de WhatsApp Business.

En cada una:
```
URL:    https://ehpstxrzsjwcevcafxgk.supabase.co/functions/v1/whatsapp
Token:  didial2026wa
```
Verificar y guardar → suscribir el campo **`messages`**.

Si solo configuras una, los mensajes de la otra sucursal no llegan.

## 5 · Publicar la app

En el panel de la app, cambia de **Desarrollo** a **Activo**. En modo desarrollo solo llegan webhooks de prueba.

---

## Después de eso

Manda un WhatsApp a cualquiera de los dos números desde tu teléfono. Debería aparecer en **Recepción → WhatsApp** en segundos, y llegarle una notificación a recepción.

Si el teléfono está en la cartera, el mensaje queda asociado al cliente automáticamente.

---

## Dos pendientes administrativos

**Método de pago** en ambas cuentas. Sin él, los mensajes que inicia el negocio fallan. Los que inicia el cliente funcionan gratis.

**Verificación del negocio.** Sin ella el límite es ~250 destinatarios únicos al día; con 1.549 clientes se queda corto. Toma de 1 a 3 semanas, conviene iniciarla ya.

---

## Cómo elige el CRM el número

Por el vehículo, no por el cliente: un Toyota se responde desde el número de Toyota aunque el dueño tenga también una camioneta de otra marca. Si no hay vehículo asociado, usa Multimarca.

Y cuando el cliente escribe, la respuesta sale **por el mismo número al que escribió**.

---

## Sobre las plantillas

Se aprueban **por cuenta**, así que cada una hay que crearla dos veces. Empieza por **"vehículo listo"**: hoy el asesor llama uno por uno, y es donde más tiempo se recupera.
