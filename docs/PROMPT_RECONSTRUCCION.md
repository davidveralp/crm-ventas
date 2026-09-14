# Prompt maestro · CRM DIDIAL

> Documento para reconstruir el sistema desde cero, con lo aprendido en 125 versiones.
> Entrégalo completo al inicio de la conversación.

---

## 1. Qué se construye y para quién

Un sistema de gestión para **Servicio Automotriz Didial Ltda.**, taller mecánico en La Serena, Chile. Reemplaza a **Dimasoft**, que hoy se usa solo como facturador y registra la misma información de forma vaga.

**Un solo taller, una empresa.** No es un producto multi-cliente: no gastes esfuerzo en abstracciones de tenencia más allá del `empresa_id` que ya existe por conveniencia.

**Tres unidades de negocio:** Toyota, Multimarca y DyP (desabolladura y pintura). Cada una con su meta mensual y su asesor.

**Volumen real:** 1.549 clientes, ~1.150 vehículos, ticket promedio $167.655, 4 islas de trabajo, ~4,6 vehículos cerrados por día.

---

## 2. Los tres hechos que definen el negocio

Todo el diseño responde a estos números. Si una función no ayuda con alguno, probablemente sobra.

| Dato | Qué significa |
|---|---|
| **65,9% de vehículos vienen una sola vez** | La retención es el problema mayor del negocio |
| **Cobertura de RUT: 8,7% · de kilometraje: 35%** | Sin esos datos no hay factura ni recordatorio de mantención |
| **Presupuestos: 100% aprobados** | No es un dato real: los rechazos no se registran |

El tercero es el más engañoso. Un indicador que marca perfección casi siempre está midiendo mal. Lo mismo pasaba con el NPS en +100: el asesor preguntaba cara a cara y nadie le decía la verdad.

---

## 3. El proceso, de punta a punta

```
FASE 0 · CONTACTO — recepcionista
  WhatsApp / Instagram / Facebook / teléfono → agenda con capacidad por isla
  → estado "Agenda" en ClickUp

FASE 1 · RECEPCIÓN — asesor          ★ PRIMERA VENTA
  Recibe al cliente y lo acompaña al vehículo
  → inspección con preguntas de descubrimiento
  → carga las 4 áreas de la OT (sin precios)
  → firma → entra al taller

FASE 2 · RADAR — técnico, 10 min      ★ SEGUNDA VENTA, LA PRINCIPAL
  Vehículo en el elevador, CLIENTE PRESENTE
  → 45 criterios → el asesor le muestra el resultado al cliente

FASE 3 · PRESENTACIÓN — asesor
  Muestra hallazgos → precio referencial → solicita presupuesto

FASE 4 · VALORIZACIÓN — encargado de presupuestos, 15 min ⏱
  Pone precio y costo a cada línea

FASE 5 · NEGOCIACIÓN — asesor
  Aceptación TOTAL o PARCIAL por ítem
  → LO RECHAZADO Y LO POSTERGADO SE REGISTRAN (esto hoy no existe)

FASE 6 · EJECUCIÓN — técnico en ClickUp
FASE 7 · ENTREGA — asesor: cobro y salida
FASE 8 · POSTVENTA — encuesta por correo al día siguiente + reprocesos
```

**El asesor es el único que habla con el cliente, en todas las fases.**

---

## 4. Stack

- **Frontend:** React 18 + Vite + Tailwind. PWA con service worker.
- **Backend:** Supabase — Postgres con RLS, Auth, Storage, Edge Functions (Deno).
- **Taller:** ClickUp sigue siendo el tablero donde trabajan jefe y mecánicos. El CRM sincroniza en ambos sentidos, **no lo reemplaza**.
- **Correo:** Brevo vía Edge Function.
- **WhatsApp:** Cloud API de Meta, dos cuentas (Toyota y Multimarca).
- **Histórico:** una planilla de Google recibe cada OT cerrada.

---

## 5. Modelo de datos

### Núcleo
`clientes` y `vehiculos` son el centro: casi todo cuelga de ellos. Por eso **los duplicados y las patentes mal escritas contaminan todo el sistema**, no solo su módulo.

- **Patente:** guardar `patente` (formato `GH TY 34`) y `patente_norm` (columna generada, solo alfanuméricos, mayúsculas). Toda búsqueda va contra `patente_norm`.
- **RUT:** normalizado, con índice único — pero crearlo **después** de fusionar duplicados, o falla.

### Operación
`trabajos_taller` (la OT) · `ot_detalle` (líneas) · `tareas_taller` (lo que ejecuta el mecánico) · `inspecciones_ingreso` · `radar_inspecciones` · `presupuestos_taller` · `oportunidades` · `encuestas` · `citas` · `islas`

### Las cuatro áreas de la OT
Mano de obra · Repuestos · Lubricantes e insumos · Servicios externos.
Cada línea: detalle, cantidad, **costo** (para margen) y **precio** (lo que se cobra, con IVA incluido).

**El asesor carga el QUÉ al ingresar, sin precios. El encargado pone el CUÁNTO después.** Son dos personas y dos momentos; mezclarlos fue el error de Dimasoft.

### Correlativos
- **OT:** secuencia de Postgres desde 13736, asignada por trigger **al crear el trabajo**, no al cerrarlo.
- **Presupuesto:** secuencia propia, formato `P-00001`.

> Usa `nextval()`, nunca `count(*) + 1`. Dos cierres simultáneos con conteo sacan el mismo número.

---

## 6. Roles y permisos

| Rol | Quién |
|---|---|
| `admin` | David Vera, Jessica Díaz |
| `asesor_toyota` / `asesor_multimarca` | Diego Leyton / David Rivera, Matías Ponce |
| `jefe_taller` | Andrés Aracena |
| `coordinador_adquisiciones` | Víctor Tello — hace los presupuestos |
| `tecnico` | Gabriel Cayo, Javier Guzmán, Felipe Codoceo, Felipe Alcota, Ignacio Heredia, Shelmy Belyzar, Wilson Araya, Pablo Donoso |
| `recepcionista` | *(por crear)* |

RLS por rol en cada tabla, con helpers `auth_rol()`, `es_admin()`, `es_asesor()`.

> **Dos personas se llaman Felipe** y suman el 46% de la carga del taller. El catálogo de técnicos debe usar **nombre completo**, y el cruce con ClickUp debe ser **por correo**, nunca por nombre de pila.

---

## 7. Los ocho errores que costaron versiones

Construye las defensas desde el día uno.

### 7.1 · Pantallas en blanco por orden de declaración
Un `useEffect` o un `.filter()` que usa una variable declarada más abajo lanza `Cannot access X before initialization` y borra la pantalla entera. **Pasó cuatro veces.**

### 7.2 · Objetos renderizados como texto
`OT_CONOCIO` es `[{v, e}]` y se usó como lista de strings → React error #31, pantalla en blanco. Es un error de **tipo**, invisible para ESLint y para el compilador.

### 7.3 · Columnas inexistentes en un `select`
Pedir una columna que no existe hace que Supabase **rechace la consulta completa** y devuelva vacío. El síntoma es engañoso: "toda patente aparece como nueva" cuando en realidad la consulta falla.

### 7.4 · Errores de Edge Function que no se leen
`functions.invoke` deja `data` en null y `error.message` dice solo *"non-2xx status code"*. **El motivo viene en `error.context`**, y hay que leerlo explícitamente.

### 7.5 · Notificaciones a roles sin nadie asignado
La campanita lee `rol_destino.eq.<mi rol>`. Si nadie tiene ese rol, el aviso se guarda y **no lo ve nadie**. Verifica que haya destinatario y, si no, avisa a admin.

### 7.6 · Sincronización que salta lo ya vinculado
En ClickUp, el código contaba las tarjetas ya vinculadas y seguía de largo **sin importar sus subtareas**. Como casi todas están vinculadas, las subtareas no llegaban nunca.

### 7.7 · Dos columnas para el mismo identificador
La subida guardaba `clickup_subtask_id` y la importación leía `clickup_task_id`. Al no coincidir, cada subtarea se duplicaba en cada sincronización.

### 7.8 · Service worker que intercepta todo
Hacer que toda navegación devuelva el `index.html` rompe cualquier página estática o iframe. Excluye las rutas públicas explícitamente.

---

## 8. Arnés de verificación · construir primero

Antes de la primera pantalla, monta un script que corra en cada build y falle si encuentra:

1. **Variables no definidas** (`no-undef`)
2. **Uso antes de declarar** — regla propia que revise inicializadores, métodos de array y hooks de React
3. **Componentes JSX sin importar** (`react/jsx-no-undef`) — `no-undef` no los ve
4. **Columnas que el código escribe y no existen** en ninguna migración
5. **Objetos renderizados como texto** — catálogos que son `[{...}]` usados como strings
6. **Índices sobre columnas inexistentes** en los `.sql`

Cada una nació de un error real que llegó a producción. Las seis juntas toman una tarde y ahorran semanas.

**Además:** un capturador de errores de React que envuelva cada página y muestre el error en pantalla con botón de copiar, en vez de dejar el blanco.

---

## 9. ClickUp · cómo integrar

Lista de trabajos: `901324296305`. Lista RADAR: `901328193477`.

### Reparto
| En el CRM | En ClickUp |
|---|---|
| Mano de obra | **Subtareas** (tienen responsable y estado) |
| Repuestos | Lista de control "Repuestos" |
| Lubricantes e insumos | Lista de control |
| Servicios externos | Lista de control |

**Los materiales no se ejecutan, se verifican.** Ponerlos como subtareas llena el tablero del mecánico de cosas que no puede hacer.

### Título de la tarjeta
`PATENTE MARCA MODELO · OT 13736` — patente primero, todo en mayúsculas, patente en formato `XX XX XX`.

### Reglas
- Estados: mapear ambos sentidos. **"agenda" es el estado más usado** y suele olvidarse.
- Las subtareas se importan **siempre**, incluso para tarjetas ya vinculadas.
- El asignado se cruza **por correo**; si no hay coincidencia, guardar igual el nombre de ClickUp.
- Los separadores `*** MANO DE OBRA ***` que usa el taller sirven para clasificar lo que vuelve.
- Un push a GitHub **no despliega Edge Functions**: hay que hacerlo a mano.

---

## 10. Decisiones de diseño ya tomadas

- **Precio referencial permitido.** El asesor puede dar un rango con el cliente delante para que la venta no se enfríe. Debe quedar registrado como referencia, no como precio.
- **Encuesta por correo al día siguiente**, nunca en el mostrador. El NPS va a bajar y ese número bajo es el real.
- **Aceptación parcial por ítem**, con lo pendiente registrado. Es lo que alimenta la campaña de tres meses después.
- **Los reprocesos se siguen por mecánico.** Sin eso no hay medición de calidad ni base para comisiones.
- **Borrado de fichas: lógico, no físico.** De un vehículo cuelgan años de historial.
- **Packs de servicio precargan sus líneas.** El Pack 360° tiene variante diésel (32 líneas) y bencinera (29).
- **Catálogo de servicios en cascada:** segmento → categoría → servicio. Son 313 servicios; una lista plana es inusable en el mostrador.

---

## 11. Cómo trabajar

- **Español en todo:** interfaz, comentarios, nombres de columnas, mensajes de error.
- **Comentarios que expliquen el porqué**, no el qué. `// suma 1` sobra; `// va después de declarar d: React registra el efecto durante el render` salva horas.
- **Una migración numerada por cambio de esquema**, con encabezado que explique qué resuelve y verificación al final.
- **Entregar siempre:** el zip del proyecto, los `.sql` a ejecutar, el código de las Edge Functions modificadas y un `CAMBIOS_vN.md` que diga qué cambió y por qué.
- **Compilar y pasar el arnés antes de entregar.** Siempre.
- **Cuando algo falle, pedir el mensaje de consola.** Adivinar causas cuesta versiones; el mensaje real las resuelve en un minuto.

---

## 12. Orden de construcción sugerido

| # | Bloque | Por qué en ese orden |
|---|---|---|
| 1 | Arnés de verificación + captura de errores | Todo lo demás se apoya en esto |
| 2 | Esquema base, RLS, roles, migración de datos | Sin datos limpios nada sirve |
| 3 | Clientes y vehículos con normalización | Es el núcleo del que cuelga todo |
| 4 | Nuevo Ingreso completo | Es donde nace la información |
| 5 | Sincronización ClickUp bidireccional | Conecta con quien ejecuta |
| 6 | Valorización y cierre de OT | Cierra el ciclo del dinero |
| 7 | RADAR y venta cruzada | Donde está el crecimiento |
| 8 | Postventa y encuestas | Ataca el 65,9% de una sola visita |
| 9 | Recepción, agenda y WhatsApp | Llena las islas vacías |
| 10 | Bodega | El módulo más grande; es el cuello #1 de repuestos |

---

## 13. Lo que sigue sin resolverse

Dilo de entrada para que no se descubra tarde:

- **Los dos Felipe** y cuatro cuentas genéricas "Tecnico N" en ClickUp bloquean comisiones y reprocesos.
- **La capacidad real del taller** no se conoce: 4,6 vehículos/día con 4 islas no cuadra con 2 horas por trabajo. Activar el ClickApp *"Total time in Status"* y medir dos semanas.
- **Bodega no existe** y es el cuello de botella principal.
- **El rechazo de presupuestos no se registra**, por eso la conversión marca 100%.
