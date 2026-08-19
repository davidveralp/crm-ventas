# Auditoría funcional · CRM DIDIAL

**Fecha:** 18 de agosto de 2026 · **Versión auditada:** v76 · 61 migraciones

---

## Alcance de esta auditoría

**Lo que sí pude verificar:** compilación, existencia y coherencia del código, trazado del flujo completo, cruce entre lo que el código escribe y lo que las migraciones crean, y contraste del modelo contra una OT real (la 13544).

**Lo que no:** no tengo credenciales de Supabase, ni un navegador, ni la app corriendo. **No puedo ejecutar pruebas end-to-end reales.** Puedo afirmar que el código llama a la función correcta; no puedo afirmar que la función devuelva lo esperado con tus datos.

El guion de la sección final está para que las ejecutes tú. Es la parte que falta.

---

## 1. El proceso completo, como lo entiendo

### A · Entrada del vehículo
1. El asesor abre **Nueva OT**. Opcionalmente parte con **Inspección de ingreso** (7 pasos: datos, luces e inventario, combustible, daños sobre silueta, fotos, checklist, firma), que precarga patente, marca, modelo, tipo y km.
2. Al escribir la patente, el sistema busca el vehículo por `patente_norm` y precarga lo que ya sabe: versión, cilindrada, tracción, transmisión, cliente.
3. Si es patente nueva, crea cliente y vehículo de inmediato y los asigna al asesor que registra, lo que activa la fidelización en el calendario.
4. Guarda en `ordenes_trabajo`, hace upsert en `servicios` y envía el registro a la planilla vía Web App.

### B · Trabajo en taller
5. El jefe de taller ve el vehículo en el kanban de **Taller**. Al "Solicitar revisión" nace la tarjeta espejo en ClickUp y el trabajo entra en `en_reparacion`.
6. Las tareas de reparación se crean como subtareas de ClickUp, bidireccionales: terminar en un lado marca en el otro.
7. Las listas de control (repuestos, lubricantes, servicio externo) llevan responsable por ítem.

### C · RADAR de salud
8. El técnico abre **🔧 Hacer RADAR de salud** desde el detalle del trabajo, en tablet. Recorre 8 categorías con 45 criterios, tocando la opción correspondiente. La observación solo aparece en los rojos y amarillos.
9. Cada respuesta se guarda al momento; lo que no alcanza a enviarse queda en cola local y se reintenta.
10. Al completar: los rojos y amarillos se vuelcan a `diagnosticos_taller`, y si hay críticos se notifica al jefe de taller.

### D · De hallazgo a venta
11. El jefe usa **"Pasar a presupuesto"**: los hallazgos se convierten en ítems y nace un `presupuestos_taller` en estado *cotizando*. Simultáneamente se crea **una oportunidad por hallazgo**, marcada como ofrecida.
12. Se notifica al **coordinador de adquisiciones** (Víctor Tello), que valoriza los ítems.
13. El presupuesto se envía al cliente en PDF con formato oficial, o por WhatsApp desde la ficha.
14. Cuando el cliente responde, el estado del presupuesto cambia y **el estado de la oportunidad se recalcula solo** por trigger. No pueden desincronizarse.

### E · Cotización sin vehículo en taller *(v76)*
15. Desde **Vehículos → [patente] → 💰 Solicitar presupuesto**, el asesor describe qué pide el cliente y marca alertas RADAR vigentes. Llega al coordinador como *solicitado*.

### F · Medición
16. **Informes → Venta cruzada**: detectadas, ofrecidas, aprobadas y —lo importante— **sin ofrecer**, que es la pérdida que antes no se veía.
17. **Informes → Panel operativo**: 15 KPIs con alerta contra referencias de industria, metas por sucursal, centros de ingreso, matriz servicio × marca, exportable a PDF y Excel.

---

## 2. Resultado del trazado

Los 17 pasos tienen su código correspondiente y compilan. Verificado eslabón por eslabón:

| Paso | Estado |
|---|---|
| Nueva OT → `ordenes_trabajo` (con tracción/versión) | OK |
| Trabajo de taller → ClickUp bidireccional | OK |
| RADAR: catálogo 45 criterios sembrado | OK |
| RADAR → `radar_volcar_hallazgos()` → diagnósticos | OK, la RPC se llama desde el front |
| Diagnóstico → presupuesto → oportunidad | OK |
| Estado de oportunidad calculado por trigger | OK |
| Panel de venta cruzada | OK |
| Panel de vehículos + ruta + menú | OK |
| Solicitud de presupuesto sin trabajo | OK |

**No se encontraron referencias rotas**: todas las tablas que el código usa están creadas por alguna migración, y todas las columnas que escribe están declaradas.

---

## 3. Hallazgos

### 3.1 Riesgo alto · Migraciones sin confirmar
El código de v76 depende de migraciones que no sé si ejecutaste. El impacto es muy distinto según cuál falte:

| Migración | Si falta |
|---|---|
| **54** | **Bloquea Nueva OT por completo.** Ningún ingreso se puede registrar |
| **60** | Bloquea solicitar presupuesto desde el vehículo |
| **59** | Bloquea el RADAR (avisa en pantalla, no rompe el resto) |
| **58** | Degrada: el presupuesto se crea igual, la oportunidad no. Error solo en consola |

La 54 es la crítica. Si no la has ejecutado, el sistema está caído para operación diaria.

### 3.2 Riesgo alto · Dependencias externas sin verificar
- **`CLICKUP_WEBHOOK_SECRET`** — la Edge Function v48.1 falla cerrada. Sin el secret, **toda** la sincronización ClickUp → CRM está muerta y no hay error visible en la app.
- **Evento `taskCreated`** en el webhook — sin él, la autovinculación de tareas nunca se dispara. Pendiente desde v43.
- **Bucket Storage `inspecciones`** — sin él fallan las fotos y la firma de la inspección de ingreso. Pendiente desde v45.

### 3.3 Riesgo medio · Lo que revela la OT 13544

Contrasté el documento real contra el modelo:

| Dato del OT | Situación |
|---|---|
| `Modelo: BERLINGO 1.5` | La cilindrada sigue viniendo dentro del modelo. Confirma que `normalizar_vehiculos.gs` es necesario, y que **Dimasoft lo sigue generando así** — normalizar el histórico no basta |
| `Kilometraje: 0` | Con km en cero no se puede calcular la próxima mantención. Explica la cobertura de 35% |
| `R.U.T.: 77.205.528-5` | **El RUT existe en el documento de Dimasoft**, pero solo el 8,7% de las fichas lo tienen. El dato está en origen y se está perdiendo en el traspaso |
| `Chasis: VR7EDYHT2SJ516678` | **No existe campo VIN** en `vehiculos` ni en la planilla. Es el identificador universal del vehículo |
| Cliente ≠ Dueño | `REPARATUAUTO SPA` paga, `HANS DUARTE` es el dueño. **El modelo no distingue ambos roles**: se pierde a quién llamar |
| `Cía. Aseguradora` | No existe el campo. Relevante para DyP y siniestros |

El más accionable es el RUT: el dato ya se captura en Dimasoft, así que el problema es de traspaso, no de captura.

### 3.4 Riesgo bajo · Cobertura de errores desigual
`Taller.jsx` tiene 12 escrituras y solo 2 menciones de manejo de error. Varias operaciones fallan en silencio si la RLS las rechaza — y una política mal escrita **no lanza excepción, devuelve cero filas**. Es el mismo modo de falla del incidente `ii_tenant`.

---

## 4. Guion de pruebas end-to-end (para ejecutar tú)

Orden pensado para que cada prueba dependa de la anterior. **Anota en cuál falla**, porque eso localiza el problema.

### Bloque 0 · Prerrequisitos
1. En SQL Editor: `select count(*) from radar_criterios;` → debe dar **45**. Si da error, falta la migración 59.
2. `select column_name from information_schema.columns where table_name='ordenes_trabajo' and column_name='traccion';` → debe devolver una fila. Si no, **ejecuta la 54 antes de seguir**.
3. `select count(*) from oportunidades;` y `select count(*) from presupuestos_taller where vehiculo_id is not null;` → si dan error, faltan la 58 y la 60.

### Bloque 1 · Ingreso
4. Nueva OT con una patente que no exista. Completa marca, modelo (**sin cilindrada**), versión, tracción y transmisión. Guarda.
   - *Esperado:* guarda sin error, aparece en Taller y en Vehículos.
   - *Si falla con "column ... does not exist":* falta la migración 54.
5. Nueva OT con esa **misma patente**.
   - *Esperado:* precarga versión, tracción y transmisión sin que los escribas.

### Bloque 2 · RADAR
6. Taller → abre el trabajo → **🔧 Hacer RADAR de salud**.
   - *Esperado:* 8 pestañas de categoría, botones grandes, sin desplegable de "Radar a Revisar".
7. Responde algunos criterios en rojo y amarillo, escribe observaciones. **Cambia una respuesta ya dada.**
   - *Esperado:* el contador de progreso sube, no aparece "sin sincronizar" de forma permanente.
8. Prueba deliberada: **desactiva el WiFi de la tablet**, responde tres criterios, vuelve a activarlo.
   - *Esperado:* aparece "N sin sincronizar" y desaparece al reconectar. **Esta es la prueba que más me interesa** — es la única forma de saber si hace falta desarrollo offline completo.
9. **Completar RADAR**.
   - *Esperado:* los hallazgos aparecen en "Diagnóstico técnico" del mismo trabajo, y las alertas en el panel de salud del vehículo.

### Bloque 3 · Hallazgo a venta
10. En el trabajo, **"Pasar a presupuesto"**.
    - *Esperado:* se crea el presupuesto en *cotizando* y llega notificación a Víctor Tello.
11. `select count(*) from oportunidades where trabajo_id is not null;` → debe haber una por hallazgo.
12. Entra como Víctor, valoriza los ítems y marca el presupuesto como **aprobado**.
13. `select estado from oportunidades where presupuesto_id = '...';` → debe decir **aprobada** sin que nadie la tocara. *Esta prueba valida el trigger.*
14. Informes → **Venta cruzada** → deben aparecer las cifras.

### Bloque 4 · Permisos (pendiente desde F1a)
15. Entra como **técnico** e intenta editar un presupuesto → **debe rechazar**.
16. Entra como **Víctor Tello** y edita el mismo → **debe permitir**.
    - Si el técnico puede editar, hay una política ALL sobreviviente.

### Bloque 5 · Vehículo y cotización
17. Vehículos → busca la patente escrita **con espacios y sin espacios** → mismo resultado.
18. Ficha → pestaña RADAR → **"Ver los 45 criterios"** → deben verse todos, incluidos los que salieron bien.
19. **💰 Solicitar presupuesto**, marca alertas, envía.
    - *Esperado:* llega a Víctor y aparece en la pestaña Presupuestos con origen **RADAR**.

### Bloque 6 · ClickUp
20. Crea una tarea en ClickUp con una patente existente en el título.
    - *Esperado:* se crea el trabajo solo y llega aviso al jefe de taller.
    - *Si no pasa nada:* falta `taskCreated` en el webhook o el secret.

---

## 5. Recomendación de prioridad

1. **Ejecutar la migración 54** si no está. Es lo único que bloquea la operación diaria.
2. **Confirmar `CLICKUP_WEBHOOK_SECRET`** y el evento `taskCreated`. Hoy la sincronización podría estar caída sin que nadie lo note.
3. **Crear el bucket `inspecciones`.** Pendiente desde v45.
4. **Correr el bloque 4** (permisos). Es la prueba que quedó sin hacer al cerrar F1a.
5. **Prueba 8** (WiFi). Decide si hace falta invertir 1-2 semanas en offline.
6. **Traspasar el RUT desde Dimasoft.** El dato existe en el documento; conseguirlo en la planilla sube la cobertura del 8,7% de golpe y habilita la deduplicación real.
