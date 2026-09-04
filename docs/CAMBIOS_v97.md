# v97 · Corregido: Nuevo cliente en blanco

**Fecha:** 18 de agosto de 2026
**Migraciones nuevas:** ninguna

---

## El error, encontrado

El mensaje de la consola fue lo que faltaba:

```
Minified React error #31 ... args[]=object with keys {v, e}
```

**React error #31** significa: *"intentaste mostrar un objeto donde va texto"*. Y el objeto tenía las claves **`{v, e}`** — eso lo identifica sin ambigüedad.

## La causa

`OT_CONOCIO` no es una lista de textos, es una lista de objetos con **valor** y **emoji**:

```js
export const OT_CONOCIO = [
  { v: 'Recomendación', e: '🗣️' },
  { v: 'Facebook', e: '📘' },
  ...
]
```

En la v92, al agregar "¿Cómo conoció DIDIAL?" a la inspección, lo usé como si fueran textos simples:

```js
{OT_CONOCIO.map((x) => <option key={x}>{x}</option>)}   // ← muestra el objeto
```

React encuentra un objeto donde espera texto, aborta el render, y como `InspeccionIngreso` es todo el contenido de Nuevo cliente, la pantalla queda vacía.

**Corregido:** ahora muestra el emoji y el texto, y guarda solo el valor.

Revisé los otros dos catálogos de objetos del proyecto —`OT_ENCUESTA` y `OT_SVC_GRUPOS`— y están bien usados.

---

## Por qué ninguna verificación lo detectó

- **Vite** compila sin problema: sintácticamente es válido.
- **ESLint** tampoco: renderizar `{x}` es correcto en general, depende de qué sea `x`.
- **Mi regla de orden de declaración** no aplica: no hay nada declarado fuera de tiempo.

Era un error de **tipo**, no de sintaxis ni de orden.

## Verificación nueva

Agregué al verificador una comprobación específica: detecta cuando un catálogo que es lista de objetos se renderiza directamente como texto. Probada reintroduciendo el error a propósito.

Con esto, el build verifica ahora cuatro cosas antes de compilar:

| Verificación | Desde | Detecta |
|---|---|---|
| Variables inexistentes | v80 | `ReferenceError` |
| Uso antes de declarar | v83, ampliada en v95 | Pantalla en blanco por orden |
| Columnas que no existen en la base | v87 | `schema cache` |
| **Objetos renderizados como texto** | **v97** | **React error #31** |

---

## Qué hacer

Sube la v97 y entra a Nuevo cliente. Debería cargar.

**Sobre el CSS 404 del final de tu mensaje:** `index-CGFnwvKP.css` no encontrado es residuo de caché de un despliegue anterior. Se resuelve solo al recargar con la versión nueva; si persiste, Ctrl+Shift+R.

---

## Nota

El capturador de errores de la v96 se queda. No sirvió esta vez porque el error ocurrió en un punto donde React ya había abortado el árbol, pero para la mayoría de los fallos de render sí va a mostrar el detalle en pantalla en lugar del blanco.

Lo que resolvió el caso fue el mensaje de la consola. Gracias por mandarlo: con `args[]=object with keys {v, e}` la causa quedó identificada en un minuto.
