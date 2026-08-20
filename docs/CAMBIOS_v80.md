# v80 · Corrección: panel Nuevo Cliente en blanco

**Fecha:** 18 de agosto de 2026
**Migraciones nuevas:** ninguna

---

## El problema

El panel **Nuevo cliente** quedaba en pantalla en blanco al abrirlo.

## La causa

Dos variables que **eliminé en versiones anteriores quedaron referenciadas**:

| Archivo | Referencia rota | Se eliminó en |
|---|---|---|
| `InspeccionIngreso.jsx` | `paso` (línea 226) | v77, al pasar a página única |
| `NuevaOT.jsx` | `setMostrarInspeccion` (línea 210) | v79, al quitar el modal |

La primera es la que causaba la pantalla en blanco: `paso is not defined` se lanza al renderizar el componente, React aborta el árbol completo y no queda nada visible.

## Por qué el build no lo detectó

Vite compila y empaqueta, pero **no verifica que las variables existan**. Un `ReferenceError` solo aparece cuando el código se ejecuta en el navegador. Por eso las 79 versiones anteriores compilaron en verde con el error dentro.

## Qué se hizo

1. Corregidas ambas referencias.
2. **ESLint instalado y agregado al build.** Ahora `npm run build` falla si hay una variable no definida, en vez de generar un paquete roto. Verificado: el proyecto completo pasa con cero errores.

Esta es la corrección de fondo. El error puntual habría vuelto a ocurrir en la próxima refactorización; el chequeo automático lo impide.

---

## Qué hacer

Sube la v80 y recarga. El panel debería abrir normalmente.

Si vuelve a quedar en blanco, abre la consola del navegador (**F12** → pestaña *Console*) y pásame el mensaje en rojo. Ese texto dice exactamente qué falta.
