# v86 · Corrección: no se podía registrar el ingreso

**Fecha:** 18 de agosto de 2026
**Migraciones nuevas:** ninguna

---

## El problema

Al presionar "Registrar e imprimir" aparecía:

> No se pudo crear el cliente: Could not find the 'estado' column of 'clientes' in the schema cache

## La causa

Error mío. Al escribir el panel Nuevo cliente (v79) asumí que la tabla `clientes` tenía una columna `estado` con valores tipo `'nuevo'`. **No existe.** La columna real es **`estado_id`**, que apunta a la tabla `pipeline_estados` donde están definidos los estados comerciales de la empresa.

Es la misma clase de error que la migración 54: escribir en una columna que no existe. La diferencia es que aquí lo introduje yo al crear el panel, en vez de heredarlo.

## Qué se corrigió

- Se eliminó el campo inventado en los dos lugares donde estaba: `InspeccionIngreso.jsx` y `NuevoCliente.jsx`. El cliente se crea sin estado asignado, exactamente como lo hacía el alta desde el listado de Clientes.
- **De paso**: el RUT y el teléfono ahora se guardan ya formateados (`77.205.528-5`, `+56 9 9276 4347`). Antes se guardaban tal como se escribieran, lo que rompía las búsquedas por esos campos.

## Verificación adicional

Revisé **todas** las columnas que la aplicación escribe contra las que declaran las 62 migraciones, en las 49 pantallas y componentes. `estado` era el único caso real; los otros tres avisos resultaron ser falsos positivos de la revisión.

---

## Qué hacer

Sube la v86 y vuelve a intentar el registro. Debería completarse y abrir el documento.

Ten a mano que **la migración 62 sigue siendo necesaria** para que se cree el trabajo de taller. Si no la has ejecutado, el ingreso se guarda igual pero el vehículo no aparecerá en el tablero de Taller.
