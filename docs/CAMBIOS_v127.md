# v127 · Sincronización con la planilla histórica de OT

**Fecha:** 18 de agosto de 2026
**Requiere:** **migración 77** · Apps Script en la planilla · Edge Function `sync-planilla`

---

## El circuito de la información

```
RECEPCIÓN          →  crea cliente y vehículo
     ↓                 (si la patente es nueva)
NUEVO INGRESO      →  crea la OT tomando lo que ya cargó Recepción
     ↓                 → se encola para la planilla (etapa "ingreso")
MIS VEHÍCULOS      →  cierre: montos, documento, entrega
     ↓                 → se encola de nuevo (etapa "cierre")
PLANILLA           →  la MISMA fila se actualiza, no se duplica
```

**Cada dato se escribe una vez, por quien lo sabe primero.**

---

## 1. Recepción alimenta la base

Al agendar con una patente nueva, Recepción **crea el cliente y el vehículo**. Quedan marcados como ficha incompleta.

Cuando ese vehículo llega y el asesor abre Nuevo Ingreso, la patente ya existe: los datos se precargan y solo hay que completarlos con el cliente delante.

## 2. Nuevo Ingreso crea la OT

Toma cliente y vehículo de Recepción si existen. Al registrarse, la OT **se encola automáticamente** para la planilla con los datos del ingreso.

## 3. El cierre completa la misma fila

Al registrar la salida se encola otra vez, ahora con montos, documento, fecha de entrega, técnicos que participaron y datos de la encuesta.

**No se crea una fila nueva.** El Apps Script busca el N° de OT en la columna A y actualiza esa fila.

---

## Las 52 columnas

Una vista de la base (`v_planilla_ot`) arma la fila completa: datos del vehículo y cliente, técnico principal y secundarios, los cuatro montos, servicios, documento, encuesta, presupuesto y permanencia calculada.

Tenerla en la base y no en cada panel evita que Recepción, Ingreso y Cierre construyan versiones distintas de la misma fila.

**El Apps Script escribe celda por celda, solo lo que viene con valor.** Escribir la fila completa borraría las columnas calculadas de la planilla —Rentabilidad, Total Encuesta— que el CRM no produce.

---

## Por qué una cola y no envío directo

Si Google no responde —caído, sin cuota, o sin señal en el taller— un envío directo perdería el dato o dejaría al asesor esperando con el cliente delante.

La cola registra qué falta, reintenta después y **nunca bloquea la entrega**. El botón en Órdenes de trabajo muestra cuántas OT esperan, así se nota si lleva días detenida.

Tras cinco intentos fallidos una OT deja de reintentarse: si falló cinco veces, el problema no se resuelve insistiendo.

---

## Importar desde la planilla

La función también lee en sentido inverso: recorre la planilla y **completa los vehículos del CRM** con marca, modelo, año y cilindrada que ahí existan.

**Solo completa lo que falta.** Si el CRM ya tiene el dato, no lo pisa — la planilla es histórica y sobrescribir sería retroceder. El kilometraje es la excepción: se actualiza si el de la planilla es mayor.

---

## Instalación

### 1. Migración 77
Crea la cola, la vista de 52 columnas y los triggers.

### 2. Apps Script en la planilla
Extensiones → Apps Script → pegar `apps-script.gs` → cambiar el TOKEN → Implementar como aplicación web.

> **Acceso: "Cualquier usuario".** Si queda restringido, Google devuelve una página de login en vez de datos y la sincronización falla sin explicar por qué.

### 3. Secrets en Supabase
```
SHEET_WEBAPP_URL = la URL /exec del paso 2
SHEET_TOKEN      = el mismo texto del script
```

### 4. Desplegar `sync-planilla`

### 5. Probar
En **Órdenes de trabajo**, botón **⟳ Planilla**. Debería decir cuántas OT se enviaron.

---

## Recomendación

Programa el despacho automático con `pg_cron`, como se hizo con las encuestas. Así la planilla se mantiene al día sin que nadie recuerde presionar el botón.
