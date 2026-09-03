# Proceso de atención · Servicio Automotriz Didial
### Versión de Claude para corrección · 18 de agosto de 2026

> **Cómo leer este documento.** Cada afirmación va marcada:
> **[V]** verificado en el código, la base o los datos reales.
> **[?]** inferencia mía — es lo que necesito que corrijas.
> **[!]** sé que está incompleto o que hay un problema.

---

## 1. Quién es quién

| Rol | Personas | Qué hace **[V]** salvo indicado |
|---|---|---|
| **Asesor de servicio** | Diego Leyton (Toyota), David Rivera y Matías Ponce (Multimarca) | Recibe el vehículo, levanta la inspección, define qué se va a hacer, cotiza con el cliente, entrega |
| **Jefe de taller** | Andrés Aracena | Asigna técnicos, mueve el estado del trabajo, decide prioridades **[?]** |
| **Técnico** | Gabriel Cayo, Javier Guzmán, Felipe Codoceo, Ignacio Heredia, Shelmy Belyzar, Wilson Araya, Pablo Donoso, Sergio | Ejecuta el trabajo, hace el RADAR, registra hallazgos |
| **Coordinador de adquisiciones** | Víctor Tello | Valoriza presupuestos, compra repuestos |
| **Administración** | David Vera, Jessica Díaz | Metas, indicadores, control de OT, postventa |

**[?]** No sé si hay recepcionista o alguien que atienda el teléfono antes que el asesor.
**[?]** No sé si el jefe de taller también atiende clientes o es solo interno.

---

## 2. Las tres unidades de negocio **[V]**

| Unidad | Qué atiende |
|---|---|
| **Toyota** | Vehículos de la marca, con su asesor dedicado |
| **Multimarca** | Todo el resto |
| **DyP** | Desabolladura y pintura — servicios: desabolladura, siniestro robo, limpieza de vehículo, limpieza de motor, lavado de tapiz, lavado, pulido y encerado |

Cada unidad tiene meta mensual propia: Toyota $15.000.000, Multimarca $25.000.000 **[V]**. DyP no tiene meta propia **[?]** — ¿debería?

---

## 3. El flujo, fase por fase

### Fase A · Antes de que llegue el vehículo

**[?] Esto es lo que menos conozco.** Supongo que existe:
- El cliente llama o escribe pidiendo hora
- Alguien la agenda
- El vehículo queda como "agenda" en ClickUp — **[V]** es el estado más usado: 7 de 18 tarjetas

**[!]** El CRM no tiene módulo de agendamiento propio. Hay un Calendario, pero está orientado a fidelización y gestiones comerciales, no a horas de taller. **¿Cómo agendan hoy?**

### Fase B · Recepción — **el asesor**

1. Abre **Nuevo cliente → Ingreso con vehículo**
2. Escribe la patente: si existe, precarga todo; si no, pide datos de cliente y vehículo
3. Registra **qué pide el cliente** tocando los servicios del catálogo
4. Clasifica: tipo de ingreso, sucursal, tipo de cliente
5. Levanta la **inspección física**: luces del tablero, inventario, combustible, daños sobre la silueta, fotos
6. El cliente **firma** en pantalla
7. Se imprime el documento de ingreso

**Qué queda creado [V]:** ficha de cliente, ficha de vehículo, inspección, documento firmado, trabajo de taller en "Por designar", tarjeta en ClickUp.

**[?]** ¿El cliente se queda esperando o deja el auto y se va? Cambia mucho el diseño de lo que sigue.
**[!]** No hay captura de **hora de promesa de entrega** más allá de una fecha probable. En un taller eso suele ser el compromiso más importante.

### Fase C · Diagnóstico y RADAR — **el técnico**

1. El jefe de taller asigna el vehículo a un técnico **[?]** — ¿cómo decide? ¿carga, especialidad, quién esté libre?
2. El técnico hace el **RADAR** en tablet: 45 criterios en 8 categorías
3. Los rojos y amarillos pasan solos a "Diagnóstico técnico" **[V]**
4. Si hay críticos, se notifica al jefe **[V]**

**[!]** No sé en qué momento se hace el RADAR: ¿en todo vehículo que entra, o solo en mantenciones? ¿antes o después de empezar el trabajo pedido?

### Fase D · Presupuesto — **asesor + coordinador**

1. El jefe de taller pasa los hallazgos a presupuesto **[V]**
2. Llega a **Víctor Tello**, que valoriza los ítems **[V]**
3. El presupuesto vuelve al asesor, que lo envía al cliente (PDF o WhatsApp) **[V]**
4. El cliente aprueba, rechaza o aprueba parcial **[V]**
5. Si aprueba, se compran los repuestos **[?]**

**[?]** ¿Quién llama al cliente para presentarle el presupuesto: el asesor siempre?
**[?]** ¿Cuánto tiempo suele pasar entre que se detecta el hallazgo y el cliente responde?
**[!]** No hay registro del **rechazo con motivo**, por eso la conversión aparece en 100% y el indicador no sirve.

### Fase E · Ejecución — **el técnico**

Estados por los que pasa el trabajo **[V]**: en reparación → servicio externo / compra de repuestos / pintura / lavado / alineación / prueba en ruta → retroceso (si algo sale mal) → listo para entrega.

Los técnicos marcan avance en ClickUp; el porcentaje se refleja en el CRM **[V]**.

**[?]** ¿Los técnicos usan ClickUp desde tablet propia o hay una compartida?
**[?]** ¿"Retroceso" significa que el trabajo volvió atrás por un error propio?

### Fase F · Entrega — **el asesor**

1. El taller marca "listo para entrega" **[V]**
2. Aparece en **Mis vehículos → Pendientes de cierre** con notificación **[V]**
3. El asesor llama al cliente **[?]** — ¿o el cliente llama a preguntar?
4. El cliente retira; el asesor registra documento, montos y quién retiró **[V]**
5. El trabajo queda cerrado **[V]**

**[!]** El documento (boleta/factura) se emite en **Dimasoft**, no en el CRM. Hay doble digitación: el asesor escribe los montos en los dos sistemas. Es el punto de fricción más caro que veo.

### Fase G · Postventa

1. Al día siguiente sale la encuesta por correo **[V]**
2. Las respuestas llegan al panel de Postventa **[V]**
3. Un detractor genera notificación inmediata a administración **[V]**
4. **[?]** ¿Alguien llama al cliente insatisfecho? ¿Quién?
5. **[?]** ¿Hay algún seguimiento a los 3 o 6 meses para la próxima mantención?

**[V]** Existen campañas de recordatorio de mantención (5-6 meses y 6-12 meses) que corren sobre la cartera.

---

## 4. Lo que los datos me dicen del negocio

| Dato **[V]** | Lectura |
|---|---|
| 1.549 clientes, ~1.150 vehículos | Cartera mediana, con historial |
| **65,9% de vehículos con una sola visita** | La retención es el problema mayor |
| Cobertura de kilometraje: **35%** | Sin km no se puede avisar la próxima mantención |
| Cobertura de RUT: **8,7%** | El RUT existe en Dimasoft y se pierde en el traspaso |
| Ticket promedio $167.655 | |
| Permanencia real 0,3 días | La mayoría entra y sale el mismo día |
| NPS +100 | No es un dato: es el sesgo de preguntar cara a cara |
| Presupuestos: 100% aprobados | No es un dato: los rechazos no se registran |

**Mi lectura del negocio:** operación de alto volumen y ciclo corto, con la venta cruzada como oportunidad principal — el técnico ya detecta los hallazgos, pero antes no había forma de saber cuántos llegaban al cliente.

---

## 5. Los tres problemas de fondo que veo **[!]**

**1. Doble digitación con Dimasoft.** El asesor escribe los mismos datos dos veces. Es donde se pierde el RUT, donde el modelo llega con la cilindrada adentro y donde el kilometraje queda en cero.

**2. El hallazgo que no llega al cliente.** El técnico detecta, pero si el asesor no lo ofrece, la venta se pierde sin dejar rastro. El panel de venta cruzada recién ahora lo hace visible.

**3. El vehículo de una sola visita.** Dos de cada tres no vuelven. Sin kilometraje ni correo no hay forma de traerlos de vuelta.

---

## 6. Lo que necesito que corrijas

En orden de impacto sobre lo que sigue construyéndose:

1. **La fase A completa** — cómo se agenda hoy, quién contesta el teléfono, qué pasa entre la llamada y la llegada del vehículo.
2. **Cuándo se hace el RADAR** — ¿todos los vehículos? ¿solo mantenciones? ¿antes o después del trabajo pedido?
3. **Cómo asigna el jefe de taller** — qué criterio usa para elegir al técnico.
4. **Quién habla con el cliente en cada momento** — presupuesto, aviso de listo, cliente molesto.
5. **Dónde entra Dimasoft exactamente** — en qué momento del flujo y qué se digita ahí.
6. **Qué hace hoy que este mapa no menciona** — es lo que más me interesa: lo que no está acá es lo que no sé que existe.

---

*Documento para corregir, no para aprobar. Márcalo donde esté equivocado.*
