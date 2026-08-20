# v81 · Corrección: pantalla en blanco al entrar por primera vez

**Fecha:** 18 de agosto de 2026
**Migraciones nuevas:** ninguna

---

## El problema

Al abrir el enlace de la aplicación, la primera vez quedaba la pantalla en blanco. Recargando aparecía normalmente.

## La causa

La aplicación está instalada como PWA, con un **service worker** que guarda los archivos en el teléfono o computador para que cargue rápido y funcione sin conexión.

Cuando se publica una versión nueva, Vite renombra los archivos JavaScript con un identificador distinto: `index-a3f9.js` pasa a ser `index-b721.js`. Pero el service worker seguía entregando el `index.html` guardado, **que apunta al archivo viejo**. Ese archivo ya no existe en el servidor, la carga falla y no se dibuja nada.

Al recargar, el navegador ya había actualizado el HTML, y por eso "funcionaba a la segunda".

Es decir: **pasaba justamente después de cada versión que te entregué.**

## Qué se corrigió

**1. El HTML siempre se pide al servidor.** Ahora `index.html` se busca en la red primero y solo se usa la copia guardada si no hay conexión (con 3 segundos de espera). Así nunca apunta a archivos que ya no existen.

**2. Las cachés viejas se borran solas.** `cleanupOutdatedCaches` elimina los archivos de versiones anteriores en vez de acumularlos.

**3. La versión nueva toma el control de inmediato.** Antes el service worker nuevo esperaba a que cerraras todas las pestañas para activarse.

**4. Red de seguridad.** Si aun así falla la carga de un archivo, la aplicación **borra la caché y recarga sola una vez**, en vez de dejarte la pantalla vacía. Tiene un control para no entrar en bucle si el problema es otro.

---

## Qué esperar al actualizar

**Esta vez todavía puede pasar una última vez.** El service worker que tienes instalado es el antiguo, así que la corrección recién actúa cuando el nuevo se instale. Si al subir la v81 ves la pantalla en blanco, recarga una vez más: de ahí en adelante no debería repetirse.

Si quieres asegurarte de partir limpio:
- **Computador:** Ctrl+Shift+R (o Cmd+Shift+R en Mac).
- **Celular:** cierra la app, borra los datos del sitio en el navegador y vuelve a entrar.

---

## Nota

Este problema es distinto del de la v80. Aquel era una variable eliminada que quedó referenciada en el código y afectaba solo al panel Nuevo cliente. Este es de caché y afectaba a toda la aplicación después de cada despliegue.
