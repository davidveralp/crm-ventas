# v96 · Captura de errores en pantalla

**Fecha:** 18 de agosto de 2026
**Migraciones nuevas:** ninguna

---

## Por qué esta versión

Nuevo cliente sigue sin cargar, y **verifiqué todo lo que puedo verificar sin ejecutar la aplicación**:

| Revisé | Resultado |
|---|---|
| Orden de declaración de variables | correcto |
| ESLint con la regla ampliada | sin errores |
| Que todas las funciones importadas existan | todas presentes |
| Variables usadas en el JSX declaradas después | ninguna |
| Consultas a la base al montar el componente | no hay |
| `SILUETAS` y el valor inicial `'sedan'` | consistentes |

El error está en algo que solo se manifiesta al ejecutar. **Seguir descartando causas a ciegas te hace perder tiempo**, así que cambié de enfoque.

---

## Qué agregué

Un **capturador de errores** que envuelve todas las páginas. Cuando una falla al renderizar, en lugar de la pantalla en blanco vas a ver:

- El **tipo y el mensaje** del error
- **En qué componente** ocurrió
- Botones para **reintentar**, volver al inicio y **copiar el detalle**
- La traza completa desplegable

**El menú sigue funcionando**, así que la aplicación no queda inutilizable por una pantalla rota.

---

## Qué necesito de ti

1. Sube la v96 y entra a **Nuevo cliente**.
2. En lugar del blanco, aparecerá un recuadro rojo con el error.
3. Presiona **"Copiar detalle"** y pégamelo.

Ese texto dice exactamente qué falla y en qué línea. Con eso lo corrijo de una vez, en vez de seguir probando hipótesis.

**Si aun así ves la pantalla en blanco**, significa que el error ocurre antes de que React monte —en un import o en el arranque— y ahí la consola del navegador (F12 → Console) tendrá el mensaje en rojo.

---

## Nota

Esta es una herramienta que debí agregar hace varias versiones. Han sido cuatro pantallas en blanco (v80, v83, v92 y esta), y en todas hubo que ir descartando causas sin ver el error. De aquí en adelante el error se muestra solo.
