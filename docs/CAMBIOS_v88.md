# v88 · El ingreso llega a ClickUp al registrarse

**Fecha:** 18 de agosto de 2026
**Requiere:** migración 62 ejecutada · **redesplegar la Edge Function**

---

## El problema

Al registrar el vehículo no aparecía en ClickUp.

## La causa

Eran **dos cosas**, no una:

**1. La inspección no avisaba a ClickUp.** En la v85 hice que la inspección creara el trabajo de taller, pero solo en la base de datos. La tarjeta en ClickUp seguía naciendo recién cuando el jefe de taller presionaba "Solicitar revisión". El vehículo existía en el CRM pero no en el tablero.

**2. La creación no enviaba el estado.** Al crear una tarjeta, la función nunca mandaba el campo de estado, así que ClickUp aplicaba el primero de su lista. Aunque el trabajo llegara, no necesariamente aparecía en la columna correcta.

## Qué se corrigió

- La inspección ahora **llama a ClickUp al terminar el registro**. La tarjeta nace junto con el ingreso, no después.
- La función envía **el estado explícito**: `por designar` para un ingreso nuevo.
- Si ClickUp falla o no responde, **la recepción se completa igual**: la inspección se guarda, el trabajo se crea y el documento se imprime. El error queda en la consola. No tiene sentido que un vehículo no se pueda recibir porque una herramienta externa esté caída.

---

## Qué hacer

### 1. Redesplegar la Edge Function
El cambio del estado está en el código de la función, y **un push a GitHub no la despliega**:

Supabase → Edge Functions → `clickup-sync` → pestaña Code → pegar el contenido de `supabase/functions/clickup-sync/index.ts` → **Deploy**.

O desde la terminal: `supabase functions deploy clickup-sync`

### 2. Verificar los requisitos que siguen pendientes
Sin estos, la sincronización no funciona y **no aparece ningún error en la aplicación**:

- **Secret `CLICKUP_WEBHOOK_SECRET`** configurado en Edge Functions → Secrets.
- **Secret `CLICKUP_API_TOKEN`** — sin él la función responde con un error explícito.
- **Verify JWT en OFF** para esta función.
- **Migración 62** ejecutada, o el trabajo de taller no se crea y no hay nada que enviar.

### 3. Probar
Registra un ingreso y revisa la lista "Vehiculos en Taller" de ClickUp. Debería aparecer la tarjeta en **Por designar**, con patente, marca, modelo, datos del cliente y lo que pidió.

Si no aparece, abre la consola del navegador (F12 → Console): el mensaje dirá si fue el token, el trabajo o la conexión.

---

## Nota sobre el diseño

Que el ingreso llegue de inmediato a ClickUp es lo que pediste, y tiene sentido: el taller ve todo lo que entró aunque no tenga técnico asignado. La contrapartida es que **la lista va a tener más tarjetas**, incluidas las de vehículos que todavía no se van a trabajar. Si eso ensucia el tablero, se puede volver al comportamiento anterior con un cambio corto.
