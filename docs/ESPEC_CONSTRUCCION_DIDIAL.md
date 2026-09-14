# CRM DIDIAL · Especificación de construcción

> Sistema de gestión para Servicio Automotriz Didial Ltda. Reemplaza a Dimasoft,
> que queda solo como facturador.
>
> El objetivo es una aplicación **funcional en producción**, no un prototipo.

---

## 1. La empresa

**Servicio Automotriz Didial Ltda.** · Avda. Cuatro Esquinas 759, La Serena, Chile
serviciotecnico@didial.cl · +56 9 8974 8626

Taller mecánico multimarca con unidad de desabolladura y pintura.

**Escala actual:** ~1.550 clientes · ~1.150 vehículos · ticket promedio $167.655 · 4 islas de trabajo · ~5 vehículos entregados por día.

### Una sola unidad de negocio

Todas las ventas entran a una unidad. Lo que se diferencia es la **categoría de servicio**:

| Categoría | Qué agrupa |
|---|---|
| **Taller Mecánico** | Frenos, suspensión, motor, embrague, dirección, tren delantero y trasero, A/C, electrónica |
| **Servicio Rápido** | Filtros, fluidos, alineación, vulcanización, ampolletas, plumillas, accesorios, inspecciones |
| **DyP** | Desabolladura, pintura y limpieza |

La categoría sirve para analizar la venta, no para separar cajas ni metas. **No construyas segmentación por unidad de negocio.**

---

## 2. Personas y roles

| Persona | Rol en el sistema |
|---|---|
| Jessica Díaz | `socia` — acceso total, visión de negocio |
| David Vera Pezo | `admin` — administración y configuración |
| Diego Leyton | `asesor` — **único asesor**, atiende a todos los clientes |
| Andrés Aracena | `jefe_taller` — asigna trabajo y mueve estados |
| Víctor Tello | `encargado_presupuestos` — valoriza y compra repuestos |
| Gabriel Cayo | `tecnico` |
| Javier Guzmán | `tecnico` |
| Felipe Codoceo | `tecnico` |
| Ignacio Heredia | `tecnico` |
| Shelmy Belyzar | `tecnico` |
| Pablo Donoso | `tecnico` |
| Wilson Araya | `detailer` — limpieza, pulido, tratamientos |
| *(por definir)* | `recepcionista` — agenda y mensajería |

**Guarda siempre el nombre completo.** Cualquier medición por persona —comisiones, retrabajos, productividad— depende de poder distinguir sin ambigüedad quién hizo qué. Usa el correo como identificador de cruce con sistemas externos, nunca el nombre de pila.

### Permisos
RLS en Postgres por rol, con funciones auxiliares (`auth_rol()`, `es_admin()`, `es_asesor()`).

- **Montos y márgenes:** socia, admin, encargado de presupuestos, jefe de taller.
- **Eliminar fichas de cliente o vehículo:** solo admin, y con borrado lógico — de un vehículo cuelgan años de historial.
- **Técnicos:** ven y completan lo suyo, no editan precios.

---

## 3. Los dos tipos de ingreso

**Esta distinción organiza todo el sistema.** El formulario y el circuito de venta cambian según el tipo.

### Tipo A · Diagnóstico
El cliente llega con un problema que no sabe nombrar: un ruido, una luz encendida, algo que "se siente raro".

```
Asesor recibe y acompaña al vehículo
  → inspección de ingreso con preguntas de descubrimiento
    → firma del cliente → el vehículo sube al elevador
      → ★ RADAR del técnico · 10 minutos · CON EL CLIENTE PRESENTE
        → el asesor acompaña al cliente a ver el resultado
          → presenta hallazgos + precio referencial
            → solicita presupuesto
```

**El RADAR es la herramienta de venta principal del negocio.** No es un registro técnico: es evidencia física que el asesor le muestra al cliente mientras el auto está arriba. Diséñalo para ser *presentado*, no solo completado.

### Tipo B · Servicio agendado
El cliente viene por algo definido —una mantención, un cambio de aceite— normalmente con hora previa.

```
Asesor recibe y acompaña al vehículo
  → inspección de ingreso + ★ REVISIÓN DEL ASESOR (tipo radar, sin técnico)
    → firma → el vehículo entra al taller
      → se ejecuta el servicio agendado
```

**Sin RADAR de técnico, pero con revisión del asesor.** Esa revisión busca lo mismo: detectar lo que el vehículo necesita además de lo que vino a buscar. Es la instancia de venta cruzada de este tipo de ingreso, y si no existe se pierde entera.

### Consecuencia de diseño
Ambos tipos alimentan el mismo circuito de hallazgos → oportunidades → presupuesto. El origen (`radar_tecnico` o `revision_asesor`) se guarda para poder comparar cuál convierte mejor.

---

## 4. El proceso completo

```
0 · CONTACTO           recepcionista   WhatsApp, redes o teléfono → agenda con capacidad por isla
1 · RECEPCIÓN          asesor          ingreso tipo A o B · firma · entra al taller
2 · DETECCIÓN          técnico/asesor  RADAR o revisión, según el tipo
3 · PRESENTACIÓN       asesor          muestra hallazgos · precio referencial · pide presupuesto
4 · VALORIZACIÓN       V. Tello        precio y costo por línea · compromiso de 15 minutos
5 · NEGOCIACIÓN        asesor          aceptación total o PARCIAL POR ÍTEM
6 · EJECUCIÓN          técnicos        en ClickUp
7 · ENTREGA            asesor          contacta · cobra · entrega
8 · POSTVENTA          automático      encuesta por correo al día siguiente
```

**Diego Leyton es el único interlocutor del cliente en todas las fases.** Ningún otro rol lo contacta.

### Reglas del proceso
- **La aceptación parcial se registra ítem por ítem**, con lo rechazado y lo postergado. Lo postergado con fecha alimenta la campaña de meses después: es una venta agendada, no una venta perdida.
- **El asesor puede dar un precio referencial** con el cliente delante, para que la venta no se enfríe. Se guarda marcado como referencia, y el sistema avisa si el presupuesto final se aleja demasiado.
- **Los retrabajos se vinculan a la OT original y al mecánico** que ejecutó. Es la base de la medición de calidad.

---

## 5. Stack

- **Frontend:** React 18 + Vite + Tailwind, PWA instalable. Interfaz en español.
- **Backend:** Supabase — Postgres con RLS, Auth, Storage, Edge Functions (Deno).
- **Taller:** ClickUp sigue siendo el tablero de jefe y mecánicos. El CRM sincroniza en ambos sentidos; **no lo reemplaza**.
- **Correo:** Brevo vía Edge Function.
- **WhatsApp:** Cloud API de Meta, dos números (+56 9 3740 1051 y +56 9 8974 8626).
- **Facturación:** Dimasoft, sin integración; el sistema registra el número de documento emitido.

---

## 6. Modelo de datos

### Núcleo
`clientes` y `vehiculos`. **Casi todo cuelga de ellos**, así que los duplicados y las patentes mal escritas contaminan el sistema completo, no solo su módulo.

Defensas obligatorias desde el inicio:

- **Patente:** columna `patente` con formato legible (`GH TY 34`) y `patente_norm` generada —solo alfanuméricos, mayúsculas—. **Toda búsqueda va contra `patente_norm`.** Índice único sobre ella.
- **RUT:** normalizado y validado con dígito verificador. Índice único, creado después de fusionar duplicados existentes.
- **Teléfono:** normalizado a formato internacional.
- **Detección de duplicados** al crear: avisar antes de insertar, no después.

### Operación
`trabajos_taller` · `ot_detalle` · `tareas_taller` · `inspecciones_ingreso` · `radar_inspecciones` · `presupuestos_taller` · `oportunidades` · `encuestas` · `citas` · `islas` · `notificaciones`

### Las cuatro áreas de la OT

| Área | Costo | Precio |
|---|---|---|
| Mano de obra | no aplica | sí |
| Repuestos | sí | sí |
| Lubricantes e insumos | sí | sí |
| Servicios externos | sí | sí |

Cada línea: código, detalle, cantidad, costo unitario, precio unitario. **El total de línea lo calcula la base**, no el frontend, para que el documento nunca quede descuadrado.

**Separación clave:** el asesor carga el **qué** al ingresar, sin precios. El encargado pone el **cuánto** después. Son dos personas y dos momentos distintos; unirlos es el error que tiene Dimasoft, donde el precio termina escrito dentro de un campo de observaciones.

### Correlativos
La numeración de OT **está por definir** — pregunta antes de implementar:
- ¿Continúa la serie de Dimasoft o parte de nuevo?
- ¿Desde qué número?
- ¿Las OT anteriores se numeran o quedan sin número?

Cuando se defina, impleméntalo con **una secuencia de Postgres**, asignada por trigger **al crear el trabajo** —no al cerrarlo—, para que el vehículo tenga número desde que entra.

Nunca uses `count(*) + 1`: dos ingresos simultáneos obtendrían el mismo número.

Los presupuestos llevan **correlativo propio** (formato `P-00001`), porque una OT puede tener varias cotizaciones y compartir número las volvería ambiguas.

---

## 7. Integración con ClickUp

Lista de trabajos: `901324296305` · Lista RADAR: `901328193477`

### Qué va a dónde

| Del CRM | A ClickUp |
|---|---|
| Mano de obra | **Subtareas** — tienen responsable y estado |
| Repuestos | Lista de control |
| Lubricantes e insumos | Lista de control |
| Servicios externos | Lista de control |

Los materiales se verifican, no se ejecutan. Ponerlos como subtareas llena el tablero del mecánico de ítems que no puede completar.

### Título de la tarjeta
`PATENTE MARCA MODELO · OT 12345` — patente primero, mayúsculas, formato `XX XX XX`.

### Requisitos de la sincronización
- **Bidireccional.** Un cambio de estado en cualquiera de los dos lados se refleja en el otro.
- **Las subtareas se importan siempre**, también para tarjetas ya vinculadas. El jefe crea trabajo directamente en ClickUp y eso debe llegar al CRM.
- **Un solo campo para el identificador** de cada subtarea, usado tanto al subir como al importar.
- **El asignado se cruza por correo.** Si no hay coincidencia, guarda igual el nombre que muestra ClickUp: saber quién lo hizo importa aunque falte la ficha.
- **Mapea todos los estados en ambos sentidos**, incluido *"agenda"*, que es el más usado.
- Los errores de la API se registran y se muestran con su causa, nunca en silencio.

> Un push al repositorio **no despliega Edge Functions**. Documenta que hay que desplegarlas manualmente.

---

## 8. Catálogo de servicios

**313 servicios en 28 categorías**, provenientes de la planilla de precios. Cada uno con precio y horas por tipo de vehículo (Auto, SUV, Pick Up, Van/Furgón/Camión).

**Selección en cascada:** categoría → servicio. Una lista plana de 313 opciones es inusable con el cliente esperando en el mostrador.

### Paquetes
El **Pack Mantención 360°** precarga sus líneas en las tres áreas al elegirlo, con dos variantes: diésel (32 líneas) y bencinero (29). El diésel suma filtro de combustible y de polen con su mano de obra.

Si cambia el combustible del vehículo después de elegir el pack, las líneas se recalculan.

### Sugerencias
Al elegir la categoría, las listas de repuestos e insumos ofrecen lo que esa categoría suele llevar. Son sugerencias marcables: **sugerir de más es preferible a olvidar**, porque quitar una línea cuesta un clic y acordarse de una que falta cuesta una llamada.

### Servicios adicionales
Lista aparte de 18 servicios —Airlife, Nitrofil, Adblue, limpiezas, pulidos, instalaciones— que **se miden separados del servicio principal**. Es la venta cruzada del mostrador y se atribuye al asesor.

---

## 9. Los indicadores que importan

Tres números definen el estado del negocio. Cada pantalla debería ayudar con alguno.

| Indicador | Situación | Qué construir |
|---|---|---|
| **65,9% de vehículos vienen una sola vez** | El problema mayor | Postventa, recordatorios, campañas por kilometraje |
| **RUT al 8,7% · kilometraje al 35%** | Sin eso no hay factura ni recordatorio | Captura obligatoria y validada en el ingreso |
| **Presupuestos: 100% aprobados** | No es real: los rechazos no se registran | Registrar rechazo y postergación con motivo |

> **Desconfía de los indicadores perfectos.** Un 100% de aprobación o una satisfacción máxima casi siempre significan que la medición está mal hecha, no que el negocio sea impecable. Diseña cada indicador pensando en cómo podría estar mintiendo.

Por eso la encuesta de satisfacción **se envía por correo al día siguiente**, nunca se pregunta en el mostrador: el cliente no le dice a la cara al asesor que lo atendió mal.

---

## 10. Calidad del código

Estas defensas son parte del entregable, no un extra. Constrúyelas **antes** de la primera pantalla: detectan al compilar lo que de otro modo aparece como una pantalla en blanco sin explicación.

### Verificación automática en cada build
Un script que falle la compilación si encuentra:

1. **Variables o funciones no definidas** — `no-undef` de ESLint.
2. **Componentes JSX usados sin importar** — `react/jsx-no-undef`. La regla anterior no los detecta.
3. **Uso antes de declarar dentro de un componente.** Regla propia que revise inicializadores, callbacks de métodos de array (`map`, `filter`, `reduce`) y hooks de React. React registra los efectos durante el render, así que un `useEffect` escrito antes de la variable que usa falla aunque su cuerpo corra después.
4. **Columnas que el código escribe y no existen en ninguna migración.** Compara los `insert` y `update` del frontend contra los `.sql`.
5. **Catálogos de objetos renderizados como texto.** Un arreglo de `{clave, valor}` usado como lista de strings compila sin problema y rompe el render.
6. **Índices SQL sobre columnas inexistentes.** Postgres solo lo detecta al ejecutar la migración.

### Captura de errores en la interfaz
Un componente que envuelva cada página y muestre el error —tipo, mensaje, componente, traza copiable— en lugar de dejar la pantalla vacía. El menú debe seguir funcionando.

### Manejo de errores de Edge Functions
Cuando una función responde con error, el cliente de Supabase deja los datos vacíos y entrega un mensaje genérico. **Lee el cuerpo de la respuesta** para obtener la causa real y muéstrala. Un error que no se puede diagnosticar cuesta días.

### Notificaciones
Antes de enviar un aviso a un rol, verifica que exista alguien con ese rol activo. Si no, envíalo a administración indicándolo. Un aviso dirigido a un rol vacío se guarda y no lo ve nadie.

### Consultas
Cuando necesites datos relacionados de una lista, tráelos en **una sola consulta** con filtro por conjunto de identificadores. Una consulta por fila hace que una tabla de 200 registros tarde varios segundos.

### Service worker
Si la aplicación funciona como PWA, excluye explícitamente del enrutamiento las rutas públicas y los archivos estáticos. Interceptar toda navegación rompe cualquier página que no sea de la aplicación.

---

## 11. Migración de datos

Migrar **todo**: clientes, vehículos y órdenes históricas.

**Antes de migrar, limpiar:**
1. Fusionar clientes duplicados — criterio por definir con el cliente
2. Normalizar patentes al formato único
3. Validar RUT y descartar los inválidos en vez de arrastrarlos
4. Normalizar marcas y modelos: hoy el modelo llega con la cilindrada adentro

**Entregar un informe de migración** con cuántos registros entraron, cuántos se fusionaron y cuántos quedaron incompletos y por qué. Esa lista es la primera tarea operativa del equipo.

---

## 12. Orden de construcción

| # | Bloque | Entregable funcional |
|---|---|---|
| 1 | Verificación, captura de errores, esquema base, auth y roles | Login funcionando con los roles reales |
| 2 | Clientes y vehículos con normalización + migración | Cartera completa y consultable |
| 3 | Nuevo Ingreso tipos A y B, con firma y documento | El taller puede recibir vehículos |
| 4 | Sincronización ClickUp bidireccional | El taller ejecuta sin cambiar de herramienta |
| 5 | Valorización y cierre de OT con documento de salida | El ciclo del dinero queda cerrado |
| 6 | RADAR y circuito de venta cruzada | Se mide lo que hoy se pierde |
| 7 | Postventa: encuestas y campañas | Ataca el 65,9% de una sola visita |
| 8 | Recepción: agenda, capacidad por isla, WhatsApp | Llena las islas vacías |
| 9 | Informes y tableros | Visión para socia y administración |
| 10 | Bodega | Es el módulo más grande y el cuello de botella actual |

**Cada bloque debe quedar usable antes de pasar al siguiente.** El taller opera todos los días; no puede esperar a que esté todo listo.

---

## 13. Cómo trabajar

- **Español en todo:** interfaz, comentarios, nombres de columnas, mensajes de error.
- **Comentarios que expliquen el porqué**, no el qué. El código dice qué hace; el comentario debe decir por qué está así.
- **Una migración numerada por cambio de esquema**, con encabezado que explique qué resuelve y consulta de verificación al final.
- **Compilar y pasar las seis verificaciones antes de entregar.** Sin excepciones.
- **Entregar en cada iteración:** el proyecto, los `.sql` a ejecutar, las Edge Functions modificadas y un registro de cambios que explique qué cambió y por qué.
- **Probar con datos reales**, no de ejemplo. Los datos de Didial tienen patentes mal escritas, clientes duplicados y kilometrajes en cero: si el sistema no los soporta, no funciona.
- **Ante un fallo, pedir el mensaje exacto de consola** antes de proponer soluciones.

---

## 14. Definiciones pendientes

Resuélvelas con el cliente antes de llegar al bloque correspondiente:

1. **Numeración de OT** — serie, número inicial, y qué pasa con las anteriores *(bloque 3)*
2. **Criterio de fusión de clientes duplicados** *(bloque 2)*
3. **Capacidad real del taller** — 5 vehículos diarios con 4 islas no cuadra con la duración estimada de los trabajos. Medir antes de construir la agenda *(bloque 8)*
4. **Alcance de bodega** — el más grande del proyecto, conviene dividirlo en etapas *(bloque 10)*

---

*VPAI · Vera Pezo + AI*
