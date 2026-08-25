# v93 · Cierre del ciclo: seguimiento, entrega y encuesta automática

**Fecha:** 18 de agosto de 2026
**Requiere:** migración 66 · desplegar la Edge Function `enviar-encuestas`

---

## Cómo interpreté la solicitud

El ciclo del asesor estaba **abierto por el medio**: entregaba el vehículo al taller y no volvía a saber de él hasta llenar Nueva OT, donde además transcribía una encuesta que el cliente le había contestado de palabra.

Lo que pediste cierra ese ciclo en cinco piezas:

```
inspección de ingreso
  → el vehículo aparece en "Mis vehículos" del asesor
    → el taller trabaja (progreso visible desde ClickUp)
      → el taller marca "listo para entrega"
        → pasa a "Pendientes de cierre" con aviso al asesor
          → el asesor registra la salida: documento, montos, quién retira
            → al día siguiente sale la encuesta por correo, sola
              → las respuestas llegan al panel de Postventa
```

---

## 1. "Mis vehículos" — panel nuevo del asesor

En el menú y en la barra inferior del celular. Dos pestañas:

**En taller** — sus vehículos en proceso, con el estado, los días que llevan y el **porcentaje de avance que reporta ClickUp**. Sin entrar al kanban del jefe de taller.

**Pendientes de cierre** — con un contador rojo. Aquí caen los vehículos cuando el taller los marca listos.

El paso a pendiente lo hace un **trigger en la base**, no el frontend: el estado puede cambiar desde el CRM o desde ClickUp, y duplicar la lógica en la interfaz habría dejado un camino sin cubrir. Al entrar, el asesor recibe una notificación.

## 2. Datos de salida

Al tocar el vehículo se abre el formulario de cierre: tipo y número de documento, montos por línea (repuestos, lubricantes, mano de obra, servicio externo, descuento) con **total calculado**, quién retira y observaciones.

Si el vehículo sigue en taller, el mismo cuadro muestra el estado y un enlace a la ficha, sin permitir cerrar.

**Si el cliente no tiene correo, avisa antes de cerrar**: es el último momento para pedírselo, porque sin correo no hay encuesta.

## 3. La encuesta sale del mostrador

**Se eliminó la captura manual de Nueva OT.** En su lugar hay una nota explicando dónde ver los resultados.

**Por qué:** un asesor preguntando "¿cómo lo hicimos?" con el cliente al frente obtiene cortesía, no evaluación. El NPS del panel operativo marca **+100**, que no es un dato excepcional: es el sesgo de preguntar cara a cara.

Ahora se programa sola al cerrar, se envía **al día siguiente a las 10:00** y el cliente responde desde su correo, sin nadie mirándolo. Cuatro preguntas, menos de un minuto.

**Advertencia honesta: el NPS va a bajar, probablemente mucho.** Ese número más bajo es el real, y es el que permite mejorar. El +100 actual no dice nada.

### La página de la encuesta
Vive en `/encuesta?token=...`, **sin sesión**: el token del enlace es la credencial. NPS de 0 a 10 con colores, tres escalas de 1 a 5 y un comentario libre. Solo el NPS es obligatorio — cada pregunta obligatoria extra cuesta respuestas.

## 4. Panel de Postventa

En **Informes → Postventa**. Lo primero que se ve no es el promedio sino **los detractores**, porque son los únicos casos accionables: un cliente que puntúa 6 o menos tiene un problema concreto que todavía se puede resolver.

Cada detractor aparece con su comentario y un **enlace para llamarlo directo**. Y cuando alguien responde con 6 o menos, **se notifica a administración en el momento**, no a fin de mes.

También: NPS calculado, tasa de respuesta, promedios por dimensión y cuántos clientes **no se pueden encuestar por no tener correo** —cifra que justifica pedir el correo en la recepción—.

---

## Qué hacer

1. **Migración 66** en Supabase.
2. **Desplegar `enviar-encuestas`**: Supabase → Edge Functions → New function → pegar `supabase/functions/enviar-encuestas/index.ts`. **Verify JWT en OFF** (el cliente no tiene sesión).
3. **Secrets**: `BREVO_API_KEY` (ya existe si funciona el envío de campañas) y `PUBLIC_APP_URL` con la dirección de la app.
4. **Programar el envío diario**: al final de la migración 66 está el bloque de `pg_cron`, comentado. Descoméntalo reemplazando la referencia del proyecto y la clave.

**Sin pg_cron también funciona**: el panel de Postventa tiene un botón **"Despachar pendientes"** para enviarlas a mano. Menos automático, pero no depende de extensiones.

---

## Prueba sugerida

1. Toma un trabajo en taller y márcalo "Listo para entrega".
2. Debe aparecer en Mis vehículos → Pendientes de cierre, con notificación.
3. Registra la salida con un documento y montos.
4. En Postventa → filtro "Sin responder" debe aparecer la encuesta programada.
5. Presiona "Despachar pendientes" y revisa que llegue el correo.
6. Responde desde el enlace y confirma que aparece en el panel.

Prueba primero con un cliente cuyo correo sea tuyo.
