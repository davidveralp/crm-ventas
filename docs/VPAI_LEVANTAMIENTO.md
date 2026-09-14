# Levantamiento VPAI · Ficha de empresa

> **Cómo usar este documento.** Complétalo y entrégalo al inicio de la conversación.
> Cada respuesta define cómo se configura el sistema: lo que quede vacío se
> resolverá con supuestos, y los supuestos cuestan versiones.
>
> Donde dice *"ejemplo"*, es solo para mostrar el nivel de detalle esperado.
> Borra el ejemplo y escribe lo tuyo.

---

## 1 · Identidad

| Campo | Tu respuesta |
|---|---|
| Razón social | |
| Nombre comercial | |
| RUT | |
| Dirección | |
| Ciudad y región | |
| Teléfono de contacto | |
| Correo de contacto | |
| Sitio web / redes | |
| Rubro exacto | *ejemplo: taller mecánico multimarca con desabolladura y pintura* |

---

## 2 · Unidades de negocio

Lista cada unidad que se mide por separado. Si comparten caja pero tienen metas distintas, son unidades distintas.

| Unidad | Qué atiende | Meta mensual | Responsable |
|---|---|---|---|
| | | | |
| | | | |

**¿Las metas son por unidad, por persona, o ambas?**

**¿El año comercial parte en enero?**

---

## 3 · Personas y roles

Una fila por persona. El **nombre completo** importa: si hay dos personas con el mismo nombre de pila, cualquier medición por persona se vuelve inútil.

| Nombre completo | Rol | Correo | ¿Usa el sistema? |
|---|---|---|---|
| | | | |
| | | | |

**Roles típicos:** administración · asesor de servicio · jefe de taller · técnico · encargado de presupuestos · recepcionista · bodega

**¿Quién puede ver los montos y márgenes?**

**¿Quién puede eliminar o corregir información ya registrada?**

---

## 4 · El proceso, paso a paso

Descríbelo como ocurre hoy, no como debería ser. Las diferencias entre ambos son justamente lo que hay que resolver.

**1. ¿Cómo llega un cliente?**
*(teléfono, WhatsApp, redes, llega directo, referido…)*

**2. ¿Quién lo atiende primero y qué hace?**

**3. ¿Cómo se registra el ingreso del vehículo?**

**4. ¿Quién decide qué se le hace y en qué momento?**

**5. ¿Cómo se cotiza? ¿Quién pone los precios?**

**6. ¿Cómo se aprueba? ¿Puede aprobar solo una parte?**

**7. ¿Cómo se asigna el trabajo al técnico?**

**8. ¿Cómo sabe el cliente que su vehículo está listo?**

**9. ¿Cómo se cobra y con qué documento?**

**10. ¿Qué pasa después de la entrega?**

---

## 5 · Capacidad de trabajo

| Pregunta | Respuesta |
|---|---|
| Puestos de trabajo simultáneos | |
| Horario de atención | |
| Duración típica de un trabajo | |
| Vehículos atendidos por día | |
| ¿El cliente espera o deja el vehículo? | |

**¿Cuál es el cuello de botella hoy?**
*Ordena: repuestos · demanda insuficiente · personal · espacio · aprobación del cliente · otro*

---

## 6 · Catálogos

Adjunta lo que tengas en planilla; si no existe, dilo y se construye.

- [ ] **Servicios** con precio o valor hora
- [ ] **Repuestos** con código y costo
- [ ] **Insumos y lubricantes**
- [ ] **Proveedores** de servicios externos
- [ ] **Paquetes o promociones** con su contenido
- [ ] **Marcas y modelos** que atienden

**¿Los precios varían por tipo de vehículo?**

**¿Cada cuánto cambian los precios y quién los actualiza?**

---

## 7 · Sistemas actuales

| Sistema | Para qué se usa | ¿Se reemplaza o convive? |
|---|---|---|
| | | |
| | | |

**Incluye todo:** software de gestión, planillas, grupos de WhatsApp, cuadernos, pizarras. Lo informal suele ser donde vive la información que más importa.

**¿Qué información se digita hoy más de una vez?**

**¿Qué sistema emite la boleta o factura, y puede seguir haciéndolo?**

---

## 8 · Integraciones deseadas

| Servicio | ¿Cuenta contratada? | Para qué |
|---|---|---|
| ClickUp / Trello / similar | | |
| WhatsApp Business API | | |
| Correo masivo (Brevo, Mailchimp) | | |
| Google Sheets / Drive | | |
| Facturación electrónica | | |
| Otro | | |

> **Advertencia:** WhatsApp Business API requiere verificación de empresa ante Meta (1 a 3 semanas), método de pago y plantillas aprobadas. **Conviene iniciarlo el primer día** aunque el resto avance en paralelo.

---

## 9 · Datos a migrar

| Origen | Qué contiene | Cuántos registros | ¿Migrar? |
|---|---|---|---|
| | | | |

**Calidad de los datos** — responde con sinceridad, esto define la primera etapa:

| Campo | ¿Qué % está completo? |
|---|---|
| RUT o identificador del cliente | |
| Teléfono | |
| Correo | |
| Kilometraje del vehículo | |
| Patente bien escrita | |

**¿Hay clientes duplicados? ¿Cómo se reconocen?**

---

## 10 · Qué duele hoy

La pregunta más importante del documento. Sé concreto.

**1. ¿Qué te hace perder más tiempo?**

**2. ¿Qué información necesitas y no tienes?**

**3. ¿Qué se pierde entre una etapa y otra?**
*ejemplo: "el técnico detecta algo pero no llega al cliente"*

**4. ¿Qué reclamo recibes más seguido?**

**5. Si el sistema resolviera una sola cosa, ¿cuál sería?**

---

## 11 · Qué se quiere medir

| Indicador | ¿Se mide hoy? | ¿Cómo? |
|---|---|---|
| Ventas por unidad y por persona | | |
| Clientes que vuelven | | |
| Conversión de presupuestos | | |
| Tiempo de permanencia del vehículo | | |
| Margen por trabajo | | |
| Satisfacción del cliente | | |
| Retrabajos y garantías | | |

> **Cuidado con los indicadores perfectos.** Si algo marca 100% de aprobación o satisfacción máxima, casi siempre está mal medido. Lo vimos con presupuestos al 100% —porque los rechazos no se registraban— y con NPS en +100, porque el asesor preguntaba cara a cara.

---

## 12 · Reglas del negocio

Lo que el sistema debe respetar aunque parezca ineficiente. Cada regla tiene una razón, y saltársela genera resistencia.

**Ejemplos del tipo de regla que interesa:**
- ¿Un técnico puede modificar un presupuesto?
- ¿Se puede entregar un vehículo sin documento emitido?
- ¿Quién autoriza un descuento y hasta cuánto?
- ¿Se trabaja con vehículos que traen su propio repuesto?
- ¿Hay clientes con convenio o precio especial?

**Escribe las tuyas:**

---

## 13 · Restricciones

| Pregunta | Respuesta |
|---|---|
| ¿Quiénes usarán el sistema desde el celular? | |
| ¿Hay buena señal en el taller? | |
| ¿Nivel de manejo tecnológico del equipo? | |
| ¿Hay tablets o computadores disponibles? | |
| ¿Presupuesto o plazo comprometido? | |

---

## 14 · Prioridades

Ordena del 1 al 5 lo que debe resolverse primero:

- [ ] Registrar bien lo que entra al taller
- [ ] Controlar precios y márgenes
- [ ] Que el cliente vuelva
- [ ] Coordinación interna del equipo
- [ ] Reportes para la administración

**¿Hay una fecha o evento que marque el plazo?**

---

## Lo que sigue

Con este documento completo se puede definir en la primera conversación:

1. El **modelo de datos** y los roles
2. El **orden de construcción**, empezando por lo que más duele
3. Qué **integraciones** requieren gestión externa y hay que iniciar ya
4. Qué **datos hay que limpiar** antes de migrar

**Lo que no esté acá se va a suponer.** Y en un taller, los supuestos se descubren tarde: cuando el asesor tiene al cliente delante y el sistema le pide algo que nadie le puede dar.

*VPAI · Vera Pezo + AI*
