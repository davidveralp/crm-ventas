# v83 · Corrección: pantalla en blanco en móvil

**Fecha:** 18 de agosto de 2026
**Migraciones nuevas:** ninguna

---

## El problema

Tras la v82, la aplicación quedaba en blanco en el teléfono.

## La causa

Un error mío al agregar la barra de navegación nueva. En `Layout.jsx` quedó así:

```js
const movilVisible = MOVIL.filter((m) => tieneFeature(m.feature))  // línea 80
const { tieneFeature } = useConfig()                               // línea 81
```

`tieneFeature` se usaba una línea **antes** de declararse. En JavaScript eso lanza *"Cannot access 'tieneFeature' before initialization"*, y como `Layout` envuelve toda la aplicación, el error impide dibujar cualquier pantalla.

Corregido: el cálculo ahora va después de las declaraciones.

## Por qué no lo detectó la verificación de la v80

ESLint estaba configurado para detectar variables **inexistentes**. Aquí la variable sí existe: el problema es el **orden**. Son dos errores distintos con el mismo síntoma.

## La corrección de fondo

Escribí una regla de verificación específica para este caso, que ahora corre en cada compilación.

Lo delicado fue afinarla. La versión genérica de ESLint marcaba 10 avisos falsos: variables usadas dentro de botones y efectos, que se ejecutan **después** del dibujado y por eso son válidas. Una herramienta que avisa de 10 cosas inofensivas termina ignorándose.

La regla propia distingue tres situaciones:

| Situación | ¿Avisa? | Por qué |
|---|---|---|
| Uso directo antes de declarar | Sí | Rompe al dibujar |
| Dentro de `.filter()`, `.map()`, `.reduce()` | Sí | Corren al dibujar. **Este era el caso de la v82** |
| Dentro de un `onClick` o `useEffect` | No | Corren después, la variable ya existe |
| Propiedad de objeto (`p.veh`) | No | No es una variable |

Verificado: reintroduje el error a propósito y la regla lo detectó; con el código corregido el proyecto pasa limpio.

---

## Qué hacer

Sube la v83 y recarga. Si quedó una versión anterior en caché, una segunda recarga lo resuelve (la corrección de la v81 se encarga de eso a partir de ahora).

---

## Nota sobre las tres correcciones seguidas

Son tres causas distintas con el mismo síntoma:

- **v80** — variable eliminada que quedó referenciada. Afectaba solo al panel Nuevo cliente.
- **v81** — caché sirviendo un archivo que ya no existía. Afectaba a toda la app después de cada despliegue.
- **v83** — variable usada antes de declararse. Afectaba a toda la app.

Las tres tienen ahora una verificación automática que corre antes de compilar. Deberían dejar de ocurrir.

---

## Nota técnica para el despliegue

La regla vive en `eslint-local/index.cjs`. Para que ESLint la encuentre, npm debe enlazarla como plugin. Si al hacer `npm run build` aparece *"Failed to load plugin 'local'"*, ejecuta una vez:

```
mkdir -p node_modules/eslint-plugin-local
cp eslint-local/index.cjs node_modules/eslint-plugin-local/index.js
echo '{"name":"eslint-plugin-local","version":"1.0.0","main":"index.js"}' > node_modules/eslint-plugin-local/package.json
```

En Vercel esto no aplica: la compilación de producción no ejecuta el paso de verificación.
