# v94 · Generador de piezas dentro del CRM (fase 1)

**Fecha:** 18 de agosto de 2026
**Migraciones nuevas:** ninguna

---

## Qué vas a ver distinto

Nueva sección **"Generador de piezas"** en el menú, dentro del bloque COMERCIAL, junto a Campañas.

Funciona **exactamente igual que antes**: mismo catálogo de 61 modelos y 193 versiones de Toyota, Nissan y Mazda, mismo tarifario, mismas campañas. La diferencia es que ya no hay que abrir un archivo aparte.

También hay un botón **"Abrir en pestaña aparte"**, útil cuando quieres trabajar en la pieza con más espacio.

---

## Cómo se integró

El generador es una aplicación estática independiente (HTML + JS sin dependencias). **Se embebió en un iframe en lugar de reescribirlo en React**, por tres razones:

- **Funciona hoy.** Reescribirlo introduciría errores sin agregar nada.
- Su catálogo y su motor de composición sobre canvas son un activo probado.
- **Actualizarlo es reemplazar la carpeta**, sin tocar el CRM.

Vive en `public/generador/`. Para actualizarlo: reemplazar esa carpeta completa y volver a desplegar.

---

## Un detalle que había que resolver

El generador pesa **2,4 MB** entre 49 fotos y 3 tipografías. La aplicación funciona como PWA y precachea sus archivos para andar sin conexión — lo que significaba que **todos los usuarios descargarían esos 2,4 MB al abrir la app**, aunque nunca hicieran una pieza.

Se excluyó del precacheo (`globIgnores`). El generador sigue disponible; simplemente se descarga cuando alguien entra a la sección. La app pasó de precachear 5,2 MB a 2,7 MB.

---

## Instructivo

1. Menú → **Generador de piezas**.
2. Elige marca, modelo y versión.
3. Elige la campaña: el precio se calcula solo según categoría de vehículo y combustible.
4. Descarga la pieza desde el propio generador.

Para editar precios o agregar fotos, las instrucciones están en `public/generador/README.md`.

---

## Lo que viene (fases acordadas)

| Fase | Qué agrega |
|---|---|
| **1 · lista** | El generador dentro del CRM |
| **2** | Elegir un segmento de la cartera y generar **una pieza por cliente con su propio vehículo** |
| **3** | Seguimiento: qué se envió, quién abrió y **quién volvió al taller** |
| **4** | Envío por WhatsApp, cuando esté resuelta la API |

**La fase 2 es donde está el valor.** Hoy la pieza es un afiche de modelo; ahí pasa a ser una oferta dirigida al dueño de ese auto en particular.

---

## Pendiente antes de la fase 2

Los catálogos no coinciden del todo:

| Marca | Generador | CRM |
|---|---|---|
| Toyota | 30 modelos | 21 |
| Nissan | 14 | 18 |
| Mazda | 12 | 11 |

**El generador tiene el catálogo más completo y mejor estructurado** (con categoría de vehículo y foto por modelo). Conviene que sea la fuente y que el CRM lo lea de ahí, en vez de mantener dos listas. Es trabajo de horas, pero hay que hacerlo antes de cruzar cartera con piezas.

Y siguen abiertas las cuatro preguntas de la conversación anterior: WhatsApp API, qué medir exactamente en el seguimiento, quién genera y envía, y si el precio de la pieza es firme o referencial.
