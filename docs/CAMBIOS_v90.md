# v90 · Servicios y marcas en la inspección · diagnóstico de ClickUp

**Fecha:** 18 de agosto de 2026
**Migraciones nuevas:** ninguna

---

## 1. Trabajo a realizar: catálogo de servicios

El campo dejó de ser solo texto libre. Ahora arriba aparecen **los mismos servicios que en "Solicitar revisión"** de la ficha del cliente, agrupados por unidad de negocio:

- **Taller Mecánico**
- **Servicio Rápido**
- **DyP**

Se toca un servicio y se agrega al texto; se toca de nuevo y se quita. **El campo de texto sigue editable**, así que el asesor puede matizar lo que dijo el cliente: *"Cambio de aceite · Frenos, dice que suena adelante al frenar"*.

Los servicios que no aplican al tipo de vehículo elegido en Daños no se muestran.

## 2. Marca y modelo desplegables

**Marca**: lista con las 29 marcas de Nueva OT, más la opción "Otra…" que abre un campo de texto.

**Modelo**: para **Toyota, Nissan y Mazda** se despliega el catálogo de modelos de cada una —Hilux, Yaris, Corolla, RAV4; Versa, Kicks, X-Trail, NP300; CX-5, Mazda 3, BT-50, entre otros—. Para el resto de las marcas sigue siendo texto libre, y en las tres con catálogo hay una opción "Otro…" por si falta alguno.

Los modelos van **sin cilindrada, tracción ni versión**: esos son campos propios desde la v63.

---

## 3. ClickUp: por qué probablemente sigue sin llegar

Hice un cambio que debería aclararlo: **el error ahora se muestra en pantalla**, no solo en la consola. Antes, si ClickUp rechazaba el ingreso, el registro se completaba y nadie se enteraba.

Al registrar un ingreso ahora vas a ver, junto a los botones, un aviso amarillo con el motivo exacto si algo falla. **Ese mensaje es lo que necesito para resolverlo.**

### Las cuatro causas posibles, en orden de probabilidad

**1. La Edge Function no se ha redesplegado.** Es lo más probable. El cambio que envía el estado "por designar" está en el código de la función, y **un push a GitHub no la actualiza**. Hay que hacerlo a mano:

Supabase → Edge Functions → `clickup-sync` → Code → pegar `supabase/functions/clickup-sync/index.ts` → **Deploy**

**2. Falta la migración 62.** Sin las columnas `km_ingreso` e `inspeccion_id`, el trabajo de taller no se crea, y si no hay trabajo no hay nada que enviar. El aviso diría algo sobre una columna.

**3. Falta el secret `CLICKUP_API_TOKEN`.** La función responde con un mensaje explícito indicándolo.

**4. Verify JWT está en ON.** La función usa su propia autenticación; con JWT activado rechaza la llamada con un 401.

### Cómo verificarlo rápido
Registra un ingreso de prueba y mira el aviso amarillo. Si no aparece ninguno pero tampoco llega a ClickUp, abre la consola (F12 → Console) y pásame lo que salga en rojo.

---

## Instructivo

### Registrar el trabajo a realizar
1. En la sección 1, bajo los datos, están los servicios agrupados.
2. Toca los que correspondan: se marcan con ✓ y se agregan al texto.
3. Si el cliente dio detalles, escríbelos directamente en el cuadro de texto.

### Elegir marca y modelo
1. Despliega **Marca**. Si no está, elige "Otra…" y escríbela.
2. Si es Toyota, Nissan o Mazda, se despliega la lista de modelos. Si no está el que buscas, elige "Otro…".
3. La cilindrada, tracción y transmisión van en sus propios campos, no en el modelo.
