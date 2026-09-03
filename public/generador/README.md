# Generador de Piezas Publicitarias · Didial

Herramienta interna que genera piezas gráficas (1080×1350 px) para campañas de
mantención de vehículos. Es una app estática de un solo usuario (sin backend):
todo el catálogo, precios y activos gráficos viven en `script.js` y en la
carpeta `images/`.

## Estructura de archivos

```
index.html      Marcado HTML (encabezado, panel lateral, canvas de previsualización)
styles.css       Estilos + tipografías embebidas (Nunito, Anton) referenciadas desde fonts/
script.js        Catálogo (ASSETS/CATALOGO), datos (marcas, campañas, tarifas) y toda la lógica de la app
images/          49 fotos de vehículos + logos, en formato .webp
fonts/           3 archivos .woff2 (Nunito variable, Nunito italic, Anton)
```

Antes esta app era un único archivo `.html` con las imágenes y tipografías
incrustadas como base64. Se separó en estos archivos para integrarla al CRM,
pero el comportamiento es idéntico: basta con servir la carpeta completa
(los 5 elementos de arriba) desde cualquier servidor de archivos estáticos,
manteniendo las rutas relativas entre ellos.

## Cómo integrarla al CRM

- Es 100% estática (HTML + CSS + JS vanilla, sin dependencias externas ni
  build step). Se puede servir tal cual desde cualquier ruta del CRM
  (por ejemplo `/herramientas/generador/`) o embeber en un iframe.
- No hace llamadas de red ni requiere API: todo el estado vive en memoria del
  navegador mientras la página está abierta.
- Los únicos IDs que un contenedor externo podría necesitar enganchar son los
  del `<header>` de `index.html` (botones de navegación por pestaña) y el
  `<canvas id="lienzo">` donde se dibuja la pieza — no debería ser necesario
  tocarlos para una integración simple tipo iframe.

## Dónde editar cada cosa (todo vive en `script.js`)

| Qué | Dónde | Línea aprox. |
|---|---|---|
| Fotos/logos (mapa clave → archivo) | `const ASSETS = {...}` | línea 15 |
| Catálogo de modelos y versiones | `const CATALOGO = {...}` | línea 16 |
| Layouts de las piezas (colores, posiciones) | `const LAYOUTS = {...}` | línea 42 |
| Tarifario campaña "Pack Mantención 360°" (Toyota/Mazda/Nissan) | `const TARIFAS_360 = {...}` | línea 110 |
| Tarifario campaña "Pack mantención Pro" (marca Genérico) | `const TARIFAS_GENERICO = {...}` | línea 120 |
| Categorías de vehículo (pickup, suv-grande, etc.) | `const CATEGORIAS = {...}` | línea 128 |
| Marcas, campañas y datos de la empresa | `const DB = {...}` | línea 144 |

Estas líneas pueden variar levemente si el archivo se edita; usar el buscador
del editor (`const NOMBRE`) es más confiable que el número de línea.

### Agregar o reemplazar una foto de vehículo

1. Guardar la imagen (idealmente ya recortada/transparente) en `images/`,
   por ejemplo `images/veh_nuevo.webp`.
2. Agregar la entrada correspondiente en `ASSETS`, ej.
   `"veh_nuevo": "images/veh_nuevo.webp"`.
3. Referenciar esa clave desde el modelo correspondiente en
   `CATALOGO.modelos` (campo `"imagen"`).

Nota: la app también permite subir fotos directamente desde el panel
"Vehículos" / "Recursos" del generador — al hacerlo, la imagen se normaliza
y queda guardada como base64 en memoria (sobrescribiendo temporalmente la
ruta de archivo) hasta que se exporte/reemplace el archivo de catálogo.

### Actualizar precios

Cada campaña usa su propio tarifario (`TARIFAS_360` o `TARIFAS_GENERICO`,
según el campo `tarifaTabla` de la campaña en `DB.campanas`), indexado por
categoría de vehículo y tipo de combustible/repuesto. Basta con editar los
montos ahí; el resto de la app (redondeo, cálculo del precio "antes",
aplicación del % de descuento) no requiere cambios.

## Verificación

Se probó sirviendo esta carpeta con un servidor estático simple y cargando
`index.html` en un navegador headless: no hay errores de consola, las 49
imágenes y las 3 tipografías cargan correctamente desde sus rutas relativas,
el catálogo completo (61 modelos / 193 versiones) se lee bien, y el cambio
automático de campaña al seleccionar la marca "Genérico" (→ Pack mantención
Pro, 15%) o una marca real (→ Pack Mantención 360°, 30%) funciona igual que
en el archivo original.
