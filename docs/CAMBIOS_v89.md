# v89 · Corrección del despliegue en Vercel

**Fecha:** 18 de agosto de 2026
**Migraciones nuevas:** ninguna

---

## El error

```
✖ Columnas escritas que NO existen en ninguna migración:
   notificaciones.rol      src/src/pages/NuevaOT.jsx
Error: Command "npm run build" exited with 1
```

## La causa

Fíjate en la ruta: **`src/src/pages/NuevaOT.jsx`**. Hay un `src` dentro de otro `src`.

En tu repositorio de GitHub quedó un directorio **`src/src/`** con una copia antigua del código. Probablemente se creó al descomprimir un zip dentro de la carpeta `src/` en lugar de la raíz del proyecto.

Esa copia vieja **sí tenía** el error `rol` en vez de `rol_destino`, que ya estaba corregido en el código real. El verificador nuevo lo encontró y detuvo el despliegue, con razón desde su punto de vista: encontró un archivo con un error. El problema es que ese archivo **no lo usa nadie** — Vite compila desde `src/pages`, no desde `src/src/pages`.

Los zips que te entregué están limpios: el directorio duplicado existe solo en el repositorio.

---

## Qué hacer

### 1. Borrar el directorio duplicado

En GitHub, entra a `src/src` y elimínalo. O desde la terminal:

```
git rm -r --cached src/src
rm -rf src/src
git commit -m "Elimina directorio src/src duplicado"
git push
```

**Revisa también si hay otros duplicados**: `database/database`, `docs/docs`, `public/public`. El mismo descuido pudo repetirse.

### 2. Subir la v89

Trae el verificador endurecido: ahora **ignora los directorios duplicados o de respaldo** (`src/src`, `backup`, `old`, `copia`) y avisa que los omitió en vez de fallar. Así un residuo en el repositorio no vuelve a frenar un despliegue.

---

## Al subir el zip, para no repetirlo

Descomprime siempre en la **raíz del proyecto**, no dentro de una carpeta. La estructura correcta es:

```
crm-ventas/
├── src/          ← no src/src/
├── database/
├── docs/
├── public/
└── package.json
```

Si al descomprimir aparece una carpeta con el nombre del zip, el contenido va **dentro** de esa carpeta y hay que mover los archivos un nivel arriba.
