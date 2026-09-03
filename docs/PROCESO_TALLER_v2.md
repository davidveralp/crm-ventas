# Proceso de atención · Servicio Automotriz Didial
### Versión 2 — corregida con tus indicaciones · 18 de agosto de 2026

---

## 1. Lo que cambió respecto de mi versión anterior

Cinco correcciones que modifican el diseño de lo que viene:

| Corregí | Consecuencia |
|---|---|
| **El RADAR se hace con el cliente presente**, en el elevador, en menos de 10 min | Deja de ser un registro técnico: es **la herramienta de venta**. Todo su diseño debe apuntar a que el cliente lo vea y lo entienda |
| **Todos los vehículos llevan RADAR** | "Pendiente de RADAR" = oportunidad de venta sin explorar. Debe ser un indicador visible, no un dato oculto |
| **El asesor habla con el cliente en todo momento** | Un solo interlocutor. Ningún otro rol contacta al cliente |
| **Dimasoft solo debe facturar** | Todo lo demás migra al CRM. Hoy duplica y degrada los datos |
| **Falta el rol Recepcionista y toda el área de bodega** | Dos módulos completos por construir |

---

## 2. Capacidad del taller — lo que dicen los datos

**Pediste este dato claro. Aquí está, y no coincide con el supuesto.**

### Lo verificado en ClickUp

| Medición | Resultado |
|---|---|
| Tarjetas cerradas analizadas | 23 |
| Cierres por día (promedio) | **4,6 vehículos** |
| Con 4 islas | **1,15 vehículos por isla por día** |
| Único caso con hora de entrada y salida medibles | **6,2 horas** |

Ese caso —RAV4 patente HH JJ 80— entró a las 18:29 y cerró a las 00:42. Su solicitud tenía **cuatro servicios**: fuga de aceite, correa de accesorios, revisión express y alineación.

### La discrepancia

Con **2 horas por trabajo y 4 islas**, la capacidad teórica en una jornada de 9 horas sería:

> 4 islas × 4,5 trabajos = **18 vehículos por día**

La realidad es **4,6**. Un cuarto de la capacidad teórica.

**Tres explicaciones posibles, y no sé cuál es:**

1. **Las 2 horas son de trabajo efectivo**, pero el vehículo ocupa la isla mucho más: espera de repuestos, espera de aprobación del presupuesto, espera de que el cliente conteste.
2. **La tarjeta de ClickUp no se cierra cuando termina el trabajo**, sino cuando el vehículo se entrega o cuando alguien se acuerda. Entonces el dato mide otra cosa.
3. **La demanda no llena las islas.** El cuello de botella no sería el taller sino la agenda.

**[!] Esto hay que resolverlo antes de construir el módulo de capacidad**, porque cada explicación lleva a una herramienta distinta: la primera pide medir esperas, la segunda pide disciplina de registro, la tercera pide agenda.

### Lo que falta medir y hoy no se puede

- **Tiempo en cada estado** — el ClickApp "Total time in Status" está **desactivado** en ClickUp. Activarlo en Settings → ClickApps daría el dato exacto de dónde se va el tiempo, sin desarrollar nada.
- **Hora de entrada real a la isla** — hoy solo existe la fecha de creación de la tarjeta.
- **Qué isla ocupa cada vehículo** — no se registra en ninguna parte.

**Sugerencia concreta:** activar ese ClickApp esta semana. En dos semanas tendrías el reparto real del tiempo y sabríamos cuál de las tres explicaciones es la correcta, antes de escribir una línea de código.

---

## 3. El proceso corregido, paso a paso

### Fase 0 · Contacto y agenda — **recepcionista** *(por construir)*
1. Entra un mensaje por **WhatsApp, Instagram o Facebook**, o una llamada
2. La recepcionista responde desde la **bandeja unificada**
3. Si es cliente nuevo, crea la ficha; si existe, la abre
4. **Agenda la visita** verificando que haya capacidad
5. El vehículo queda en estado **Agenda** *(es el más usado hoy en ClickUp: 7 de 18 tarjetas)*

### Fase 1 · Recepción — **el asesor**
1. Recibe al cliente y **lo acompaña al vehículo**
2. Levanta la **inspección de ingreso** junto a él
3. El cliente **firma**
4. El vehículo entra al taller

> **Esta fase es la primera oportunidad de venta cruzada.** Ver sección 5.

### Fase 2 · RADAR en el elevador — **el técnico, máximo 10 minutos**
1. El técnico asignado sube el vehículo y recorre los 45 criterios
2. **El cliente sigue en el taller.** El asesor está atento al resultado
3. Terminado el RADAR, **el asesor acompaña al cliente a ver el resultado**

> **Este es el momento de venta más importante del negocio.** El cliente está presente, el vehículo está en el elevador, y hay evidencia técnica de lo que necesita.

### Fase 3 · Presentación y decisión — **el asesor**
1. Le muestra al cliente los hallazgos, empezando por los críticos
2. Le indica los trabajos a realizar
3. Si el cliente quiere avanzar, **el asesor solicita el presupuesto**

### Fase 4 · Presupuesto — **Víctor Tello**
1. Recibe la solicitud y valoriza
2. Lo devuelve al asesor

**[?] Pendiente de definir:** ¿cuánto demora esto con el cliente esperando? Si son 20 minutos, el cliente espera; si es una hora, se va y hay que llamarlo. Cambia el diseño.

### Fase 5 · Negociación — **el asesor**
1. Presenta el presupuesto al cliente
2. El cliente acepta **completo o parcial**
3. El asesor completa la solicitud y **la envía al taller**

**[?] A detallar contigo:** cómo funciona la aceptación parcial. ¿Ítem por ítem? ¿El cliente elige qué sí y qué no? ¿Queda registrado lo que rechazó, y con qué motivo?

> **Registrar el rechazo es lo que hoy más falta.** Sin eso la conversión aparece en 100% y el indicador no sirve para nada.

### Fase 6 · Ejecución — **el técnico**
- El trabajo comienza
- **El cliente generalmente se retira** por la duración
- Estados: en reparación → servicio externo / compra de repuestos / pintura / lavado / alineación / prueba en ruta → listo para entrega

### Fase 7 · Entrega — **el asesor**
1. El vehículo queda listo
2. **El asesor contacta al cliente**
3. El cliente llega, se hace el cobro y sale el vehículo

### Fase 8 · Postventa
1. Encuesta por correo al día siguiente
2. Gestión de **reprocesos** *(por definir)*

**[?] Sobre reprocesos:** ¿el vehículo vuelve por garantía y se abre un trabajo nuevo, o se reabre el anterior? Importa para medir bien: hoy el tope es 3 garantías por sucursal al mes.

---

## 4. Módulos que faltan

### A · Bandeja de entrada unificada
WhatsApp, Instagram y Facebook en un solo lugar, con la conversación vinculada a la ficha del cliente.

**[!] Lo que hay que resolver primero:** WhatsApp Business API tiene costo por conversación y requiere aprobación de Meta. Instagram y Facebook van por la API de Messenger, que también exige app aprobada. **No es un desarrollo, es una integración con requisitos externos.** Conviene decidir si se empieza por WhatsApp solo, que es el canal que más se usa.

### B · Agenda de taller
Horas por día, con capacidad visible. Distinta del Calendario actual, que es comercial.

Requiere resolver antes la pregunta de capacidad de la sección 2.

### C · Capacidad y ocupación
- Cuántas islas ocupadas ahora
- Cuánto queda libre hoy
- Cuándo hay hueco para agendar

### D · Seguimiento de mecánicos
Qué está haciendo cada técnico, cuánto lleva, cuántos trabajos completó.

**[?]** ¿Es para gestión del jefe de taller, o también para calcular pago variable?

### E · Rol Recepcionista
Bandeja de entrada · alta de clientes · agenda · vista de capacidad del taller.

### F · Bodega — **el módulo más grande**
Entradas y salidas, familias de productos, códigos, ubicaciones, stock mínimo, valorización.

**[!] Es un sistema completo**, comparable en tamaño a todo lo construido hasta ahora. Conviene definir alcance por etapas antes de empezar.

---

## 5. Venta cruzada — sugerencias que pediste

El momento clave es la **Fase 2**: cliente presente, vehículo en el elevador, evidencia técnica fresca. Cuatro ideas, de más simple a más ambiciosa:

### 5.1 — Vista de RADAR para mostrarle al cliente
Hoy el RADAR está diseñado para que el técnico lo **complete**. Falta una vista para que el asesor lo **presente**: pantalla limpia, solo los rojos y amarillos, en lenguaje de cliente y no de taller.

*"Pastillas delanteras al 25%"* dicho como *"le quedan unos 3.000 km de freno"*.

Es lo más barato de construir y lo que más impacto tendría.

### 5.2 — Foto del hallazgo
Que el técnico pueda adjuntar una foto a cada criterio rojo. Un cliente que **ve** la pastilla gastada no discute el presupuesto.

### 5.3 — Precio referencial inmediato
El cliente pregunta "¿cuánto sale?" en ese momento. Si el asesor tiene que esperar al coordinador, el impulso se pierde.

Un rango referencial por servicio —basado en el histórico de las OTs, que ya está en la base— le permitiría decir "entre 80 y 110 mil" en el acto, sin comprometer el precio final.

**[?] Necesito tu opinión:** ¿te parece bien que el asesor dé un rango, o prefieres que siempre espere el presupuesto formal? Antes decidimos que no, pero con el cliente al frente el costo de esperar es distinto.

### 5.4 — Postergar en vez de rechazar
Cuando el cliente dice "ahora no", hoy eso se pierde. Si en cambio queda registrado como **postergado con fecha**, se convierte en la campaña del mes siguiente.

Es la diferencia entre una venta perdida y una venta agendada. La tabla de oportunidades ya tiene el estado `postergada`; falta usarlo.

---

## 6. Lo que necesito de ti para seguir

**Prioridad 1 — decisiones que bloquean:**
1. ¿Cuál de las tres explicaciones de capacidad es la correcta? *(o activar el ClickApp y medirlo)*
2. ¿Cómo funciona la aceptación parcial del presupuesto?
3. ¿Por dónde empezamos: bandeja, agenda o bodega?

**Prioridad 2 — para diseñar bien:**
4. ¿Cuánto demora el presupuesto con el cliente esperando?
5. ¿Los reprocesos abren trabajo nuevo o reabren el anterior?
6. ¿El seguimiento de mecánicos es para gestión o para pago variable?

**Prioridad 3:**
7. ¿WhatsApp Business API está contratada o hay que gestionarla?
8. ¿DyP debería tener meta propia?

---

*Versión 2. Sigue siendo un documento para corregir.*
