# Proceso de atención · Servicio Automotriz Didial
### Versión 3 · 18 de agosto de 2026

---

## 1. Técnicos: el dato que pediste, y dos problemas que bloquean comisiones

Comparé los **20 miembros de ClickUp** con el catálogo del CRM.

### Carga real de trabajo (28 tarjetas asignadas de 40)

| Técnico | Tarjetas | | % |
|---|---|---|---|
| **Felipe Codoceo** | 10 | ██████████ | 36% |
| **Ignacio Heredia** | 7 | ███████ | 25% |
| **Felipe Alcota** | 3 | ███ | 11% |
| **Javier Guzmán** | 3 | ███ | 11% |
| **Shelmy Belyzar** | 2 | ██ | 7% |
| **Wilson Araya** | 2 | ██ | 7% |
| **Andrés Aracena** | 1 | █ | 4% |
| *sin asignar* | 12 | | *30% del total* |

**Lectura:** el 61% de la carga recae en dos personas. Las 12 sin asignar están casi todas en "agenda", lo que tiene sentido: aún no llegan.

### ⚠ Problema 1 — Hay **dos** personas llamadas Felipe

```
Felipe Codoceo  →  felipecdidial@gmail.com
Felipe Alcota   →  sergiogdidial@gmail.com    ← el correo dice "sergio"
```

**El CRM tiene un solo `'Felipe'` en su catálogo.** Entre los dos suman **46% de la carga del taller**, y hoy es imposible saber a cuál corresponde cada trabajo.

**Esto bloquea directamente lo que pediste:** no se puede calcular comisión ni seguir reprocesos por mecánico si el 46% de los trabajos van a un nombre ambiguo.

**Además:** el correo de Felipe Alcota es `sergiogdidial@gmail.com`, y el CRM tiene un técnico `'Sergio'` que **no existe** en ClickUp. Sospecho que la cuenta de Sergio se reasignó a Felipe Alcota sin cambiar el correo. **Confírmame si es así.**

### ⚠ Problema 2 — Cuatro cuentas genéricas

```
Tecnico 1  ·  Tecnico 2  ·  Tecnico 3  ·  Tecnico 4
```

Si alguien trabaja bajo estas cuentas, ese trabajo **no se puede atribuir a nadie**. Sin nombre real no hay comisión ni medición de calidad.

### Lo que hay que hacer (y es rápido)

1. Renombrar las cuatro cuentas genéricas con nombres reales, o desactivarlas.
2. Aclarar el caso Sergio / Felipe Alcota.
3. **Cambiar el catálogo del CRM de nombres de pila a nombres completos**, y vincularlo por correo con ClickUp en vez de por texto.

Sin esto, cualquier cálculo de comisión o de reprocesos sale mal. Es el prerrequisito de esas dos funciones.

---

## 2. Cuellos de botella — confirmados por ti

| # | Cuello | Naturaleza | Qué lo destraba |
|---|---|---|---|
| 1 | **Repuestos y compras** | Operativa | El módulo de bodega y el plazo de 15 min para el presupuesto |
| 2 | **La demanda no llena las islas** | Comercial | Agenda + campañas + el 65,9% que viene una sola vez |
| 3 | **El jefe no mueve las tarjetas a tiempo** | Disciplina | Instrucción, más recordatorio automático |

**Sobre el tercero:** explica la discrepancia de la v2. Los 4,6 vehículos por día no medían capacidad sino **registro tardío**. Con el ClickApp de tiempos ya activado, en dos semanas tendrás el dato real.

**Sugerencia para el tercero, además de la instrucción:** un aviso automático cuando una tarjeta lleva más de X horas sin moverse. La disciplina sostenida por recordatorio dura más que la sostenida por memoria.

**Y algo importante sobre el primero:** si repuestos es el cuello, entonces **bodega no es el módulo que va al final, sino el que más rápido paga**. Cambia el orden que tenía pensado.

---

## 3. La inspección como primera instancia de venta

Corregiste algo que yo tenía mal: la inspección **no es un registro del estado del vehículo**, es la primera conversación de venta. Su fin es **detectar la necesidad real e ir preguntando para conducir la negociación**.

### El formato actual no sirve del todo para eso

Lo que hay hoy está bien para constatar daños y protegerse legalmente. Pero para **descubrir necesidad**, le falta lo esencial: **preguntas**.

Hoy el asesor registra lo que ve. Lo que necesita es un guion que le ayude a preguntar.

### Qué le agregaría

**a) Preguntas de descubrimiento**, cortas y con respuesta táctil:

> ¿Ha notado algún ruido? · ¿Frena bien? · ¿Cómo lo siente en carretera? ·
> ¿Cuánto maneja al mes? · ¿Viaja fuera de la ciudad? · ¿Quién más lo maneja?

Cada respuesta positiva **sugiere un criterio del RADAR a revisar con atención** y le da al asesor la frase para volver después: *"acuérdese que me dijo que sonaba adelante — mire lo que encontró el técnico"*.

**b) Uso del vehículo**, que cambia toda la recomendación:

> Particular · Trabajo · Carga · Camino de tierra · Viaje largo frecuente

Un auto que anda en tierra necesita filtros más seguido. Eso es venta legítima, no venta forzada.

**c) Lo que el sistema ya sabe y el asesor no está viendo:**

- Alertas del RADAR anterior que quedaron sin resolver
- Presupuestos postergados
- Kilometraje desde la última mantención
- Servicios que le tocan por pauta

**Esto ya está en la base.** Falta mostrarlo al momento de recibir, que es cuando sirve.

**d) Registro de la señal, no solo del dato.** Si el cliente dice *"lo voy a vender pronto"* o *"me voy de viaje en dos semanas"*, eso decide qué se le ofrece y qué no. Hoy no tiene dónde anotarse.

**¿Te parece esta dirección?** Si sí, lo diseño en detalle antes de construir.

---

## 4. Decisiones tomadas en esta ronda

| Tema | Decisión |
|---|---|
| **Presupuesto** | 15 minutos desde la solicitud del asesor. Es un compromiso medible: el sistema debe avisar si se pasa |
| **Aceptación parcial** | Por ítem: qué aceptó y **qué quedó pendiente de reparación**. Lo pendiente alimenta postventa y seguimiento |
| **Reprocesos** | Se toma la OT ya gestionada, se registra la garantía y **se sigue al mecánico**. Alimenta calidad y comisiones |
| **Precio referencial** | **Aprobado.** El asesor puede dar un rango para que la venta no se enfríe |
| **Agenda de ClickUp** | Se sincroniza con la app para Recepción |

### Lo que cada una implica

**Los 15 minutos** convierten el presupuesto en un compromiso con reloj. Sugiero: cronómetro visible para Víctor y aviso al jefe si se pasa. Es el mismo mecanismo del cuello de botella 3.

**La aceptación parcial por ítem** es, a mi juicio, **la mejora de mayor valor de toda esta ronda**. Lo que el cliente rechaza hoy es exactamente lo que hay que ofrecerle en tres meses. Requiere que el presupuesto tenga ítems marcables uno por uno, con estado propio: aceptado, rechazado o **postergado con fecha**.

**El reproceso vinculado al mecánico** exige antes resolver el problema de los dos Felipe. Sin nombres únicos, medir calidad por técnico sería injusto.

**El precio referencial** conviene que quede registrado como tal, no como precio. Si el asesor dijo "entre 80 y 110" y el presupuesto sale 140, alguien tiene que enterarse: es la diferencia entre un rango mal calibrado y un cliente molesto.

---

## 5. El proceso completo, corregido

```
FASE 0 · CONTACTO Y AGENDA — recepcionista [POR CONSTRUIR]
  WhatsApp / Instagram / Facebook / teléfono
  → bandeja unificada → ficha del cliente → agenda (sincronizada con ClickUp)
  → estado "Agenda"

FASE 1 · RECEPCIÓN — asesor            ★ PRIMERA INSTANCIA DE VENTA
  Recibe y acompaña al vehículo
  → inspección + PREGUNTAS DE DESCUBRIMIENTO
  → detecta la necesidad real, prepara la negociación
  → firma → entra al taller

FASE 2 · RADAR — técnico, 10 min       ★ SEGUNDA INSTANCIA, LA PRINCIPAL
  Vehículo en el elevador, cliente presente
  → 45 criterios → asesor acompaña al cliente a ver el resultado
  → conecta con lo que el cliente dijo en la fase 1

FASE 3 · PRESENTACIÓN — asesor
  Muestra hallazgos → indica trabajos → PRECIO REFERENCIAL
  → si avanza, solicita presupuesto

FASE 4 · PRESUPUESTO — Víctor Tello, 15 min ⏱
  Valoriza → devuelve al asesor

FASE 5 · NEGOCIACIÓN — asesor
  Presenta → cliente acepta TOTAL o PARCIAL (ítem por ítem)
  → LO PENDIENTE QUEDA REGISTRADO para postventa
  → envía al taller

FASE 6 · EJECUCIÓN — técnico
  El cliente se retira · estados hasta "listo para entrega"
  ⚠ el jefe debe mover las tarjetas a tiempo

FASE 7 · ENTREGA — asesor
  Contacta al cliente → cobro → salida
  (Dimasoft solo factura)

FASE 8 · POSTVENTA
  Encuesta al día siguiente
  → reprocesos: se toma la OT, se registra garantía, se sigue al mecánico
  → lo postergado en fase 5 vuelve como campaña
```

---

## 6. Módulos por construir — panorama completo

| Módulo | Tamaño | Depende de |
|---|---|---|
| **Bodega** | Grande | Es el cuello #1: entradas, salidas, familias, códigos, ubicaciones, stock mínimo |
| **Bandeja unificada** | Mediano | WhatsApp Business API y app de Meta aprobada |
| **Agenda de recepción** | Mediano | Sincronización con la agenda de ClickUp |
| **Rol Recepcionista** | Chico | Depende de bandeja y agenda |
| **Capacidad e islas** | Mediano | Datos del ClickApp, 2 semanas |
| **Seguimiento de mecánicos** | Mediano | **Resolver antes los nombres duplicados** |
| **Aceptación parcial por ítem** | Chico | Nada. Se puede hacer ya |
| **Preguntas en la inspección** | Chico | Tu visto bueno al diseño |
| **Vista de RADAR para el cliente** | Chico | Nada |
| **Precio referencial** | Chico | Histórico de OTs, ya existe |
| **Cronómetro de 15 min** | Chico | Nada |
| **Aviso de tarjeta sin mover** | Chico | Nada |

**Observación sobre el orden:** hay **seis módulos chicos** que no dependen de nada y atacan directamente la venta cruzada y los cuellos. Los grandes —bodega, bandeja, agenda— tienen dependencias externas o requieren definición previa.

---

## 7. Lo que falta aclarar

1. **¿Sergio y Felipe Alcota son la misma cuenta reasignada?**
2. **¿Quién usa las cuatro cuentas "Tecnico N"?**
3. **¿Te parece bien la dirección de las preguntas de descubrimiento?**
4. **Bodega:** ¿hay stock inventariado hoy o se parte de cero?
5. **WhatsApp Business API:** ¿contratada o por gestionar?
6. **Agenda de ClickUp:** ¿en qué lista o vista está?

---

*Versión 3. Las prioridades se definen cuando el panorama esté completo, como acordamos.*
