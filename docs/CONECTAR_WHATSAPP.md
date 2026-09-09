# Cómo conectar tus dos números de WhatsApp

Ya tienes lo difícil: la cuenta de WhatsApp Business API aprobada con dos números registrados. Faltan cuatro datos y dos configuraciones.

---

## Paso 1 · Obtener los `phone_number_id`

Cada número tiene un identificador interno de Meta que **no es el número telefónico**.

1. Entra a **business.facebook.com** → menú lateral → **Administrador de WhatsApp**
2. Pestaña **Configuración de la API** (o *API Setup*)
3. En el selector **"De"** aparecen tus dos números. Al elegir uno, debajo se muestra su **Identificador del número de teléfono** — una cifra larga tipo `109371234567890`
4. Anota los dos:

```
+56 9 3740 1051  (Toyota)     → ID: ________________
+56 9 8974 8626  (Multimarca) → ID: ________________
```

---

## Paso 2 · Crear un token permanente

El token que aparece en esa pantalla **dura 24 horas**. Para producción hace falta uno de usuario del sistema:

1. **business.facebook.com** → **Configuración del negocio** (engranaje)
2. **Usuarios** → **Usuarios del sistema** → **Agregar**
3. Nombre: `CRM Didial` · Rol: **Administrador**
4. Con el usuario creado → **Generar nuevo token**
5. App: la de WhatsApp · Vencimiento: **Nunca**
6. Marca los permisos **`whatsapp_business_messaging`** y **`whatsapp_business_management`**
7. **Copia el token ahora**: no se vuelve a mostrar

---

## Paso 3 · Cargar los secrets en Supabase

Proyecto `crm-ventas` → **Edge Functions** → **Secrets** → agregar cuatro:

| Nombre | Valor |
|---|---|
| `WA_TOKEN` | el token del paso 2 |
| `WA_PHONE_TOYOTA` | el ID del +56 9 3740 1051 |
| `WA_PHONE_MULTIMARCA` | el ID del +56 9 8974 8626 |
| `WA_VERIFY_TOKEN` | **inventa un texto** cualquiera, ej. `didial2026wa`. Solo debe coincidir con el del paso 5 |

---

## Paso 4 · Desplegar la función

Supabase → **Edge Functions** → **New function** → nombre `whatsapp` → pega `supabase/functions/whatsapp/index.ts` → **Deploy**.

**Verify JWT: OFF.** Meta llama sin sesión de usuario; con JWT activado rechazaría todo.

Copia la URL que queda:
```
https://ehpstxrzsjwcevcafxgk.supabase.co/functions/v1/whatsapp
```

---

## Paso 5 · Configurar el webhook en Meta

**Administrador de WhatsApp** → **Configuración** → **Webhooks** → **Editar**:

- **URL de devolución de llamada**: la URL del paso 4
- **Token de verificación**: el mismo texto que pusiste en `WA_VERIFY_TOKEN`
- **Verificar y guardar**

Si da error, es porque la función no está desplegada o el token no coincide.

Después, en **Campos del webhook**, suscríbete a **`messages`**. Sin eso no llega nada.

---

## Paso 6 · Probar

Desde tu teléfono personal, manda un WhatsApp a cualquiera de los dos números. En segundos deberías ver:

- El mensaje en **Recepción → WhatsApp**
- Una notificación a recepción
- Si el teléfono está en la cartera, el mensaje aparece asociado al cliente

---

## Lo que conviene saber antes de usarlo

**La ventana de 24 horas.** Meta solo permite escribir libremente dentro de las 24 h desde el último mensaje del cliente. Fuera de eso hay que usar una **plantilla aprobada**. La función lo detecta y avisa en vez de fallar en silencio.

**Las plantillas se aprueban en Meta** (Administrador de WhatsApp → Plantillas de mensajes), demoran 1-2 días y son las que sirven para recordatorios de mantención o avisos de "su vehículo está listo".

**Los costos.** Las conversaciones que inicia el cliente son gratis (las primeras 1.000 al mes). Las que inicia el negocio cuestan alrededor de US$0,03–0,08 en Chile.

**Cuál número usa el CRM.** Por sucursal: Toyota responde desde el 3740 1051 y Multimarca desde el 8974 8626, igual que ya ocurre con los correos de contacto.

---

## Plantillas que conviene crear primero

| Uso | Cuándo |
|---|---|
| **Vehículo listo** | Reemplaza la llamada del asesor al terminar |
| **Recordatorio de cita** | El día anterior, reduce los "no llegó" |
| **Recordatorio de mantención** | A los 6 meses o por kilometraje |
| **Presupuesto enviado** | Avisa que hay una cotización esperando respuesta |

La primera es la de mayor impacto: hoy el asesor llama uno por uno.
