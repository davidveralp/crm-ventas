# v95 · Corrección: Nuevo cliente en blanco y generador que no carga

**Fecha:** 18 de agosto de 2026
**Migraciones nuevas:** ninguna

---

## Problema 1 · Nuevo cliente quedaba en blanco

### La causa

En la v92, al agregar la sucursal automática, escribí esto en `InspeccionIngreso.jsx`:

```js
useEffect(() => {
  if (suc && !d.sucursal) setD(...)     // línea 136
}, [perfil])

const [d, setD] = useState({ ... })     // línea 143 ← siete líneas después
```

React **registra el efecto durante el render**, y en ese momento `d` todavía no existe. Lanza *"Cannot access 'd' before initialization"* y no se dibuja nada.

Es el mismo error de la v83, en otro archivo y con otra forma: allá estaba dentro de un `.filter()`, aquí dentro de un `useEffect`.

### La corrección de fondo

La regla de verificación que escribí en la v83 **no lo detectaba**: solo revisaba inicializadores de variables, y un `useEffect` es una llamada suelta.

La amplié para que cubra los hooks de React —`useEffect`, `useLayoutEffect`, `useMemo`, `useCallback`— y revise también las sentencias de expresión.

### Dos errores más que encontró al ampliarla

| Archivo | Variable | Qué habría pasado |
|---|---|---|
| `NuevaOT.jsx` | `set` usada 12 líneas antes de declararse | Nueva OT en blanco |
| `TareasCampana.jsx` | `nomCli` usada dentro de un `useMemo` anterior a su declaración | Campañas en blanco |

Ninguno se había manifestado todavía, pero eran bombas de tiempo: bastaba un cambio en el orden de ejecución para que aparecieran. Los tres corregidos.

---

## Problema 2 · El generador no cargaba

### La causa

La corrección de la v81 —la que arregló la pantalla en blanco al entrar— hizo que **toda navegación se responda con el `index.html` del CRM**. Eso es correcto para las rutas de la aplicación.

Pero el generador es una app estática aparte, y **el iframe hace una navegación**. El service worker la interceptaba y devolvía el CRM: por eso el marco salía vacío.

### La corrección

Se excluyó `/generador` de la interceptación, en los dos lugares donde hacía falta: la lista de exclusión de navegación y la regla de caché. Verificado en el `sw.js` compilado.

---

## Qué hacer

Sube la v95 y recarga.

**Puede necesitar dos recargas.** El service worker que tienes instalado es el anterior, y la corrección recién actúa cuando se instale el nuevo. Si el generador sigue en blanco después de la segunda, fuerza la actualización con Ctrl+Shift+R.

---

## Nota

Los dos problemas venían de correcciones anteriores mías: el primero de la v92, el segundo de la v81. La regla ampliada ahora cubre las tres formas del mismo error —uso directo, dentro de métodos de array y dentro de hooks— y corre en cada compilación.
