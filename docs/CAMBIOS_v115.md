# v115 · Presupuestos por línea, notificaciones y OT editable

**Fecha:** 18 de agosto de 2026
**Requiere:** **ejecutar la consulta 74** para diagnosticar las notificaciones

---

## 1. Por qué no llegó la notificación

Encontré la causa, y es concreta.

La campanita lee las notificaciones así:

```js
.or(`usuario_id.eq.${perfil.id}, rol_destino.eq.${perfil.rol}`)
```

Si **nadie tiene el rol `coordinador_adquisiciones`**, el aviso se guarda en la tabla pero **no lo ve ninguna persona**. Se crea, existe, y desaparece.

Es lo que pasa si la **migración 55** —la que crea a Víctor Tello— no se ha ejecutado.

### Cómo confirmarlo
Ejecuta `74_verificar_usuarios.sql`. No cambia nada, solo muestra:
- Quién tiene cada rol
- Qué roles no tienen a nadie
- **Cuántas notificaciones se enviaron a roles vacíos** — esos son los avisos perdidos

### La protección agregada
`avisarRol()` verifica si hay alguien con el rol antes de enviar. Si no lo hay, **el aviso va a administración** con el prefijo `[sin coordinador_adquisiciones]`.

Así una solicitud nunca se pierde en silencio por un usuario que falta.

---

## 2. Solicitud de presupuesto línea por línea

El campo de texto libre se reemplazó por una lista: se elige el área, se escribe el ítem, cantidad y se agrega.

**Por qué importa:** cotizar *"los frenos"* es ambiguo. Cotizar *"pastillas delanteras"* y *"discos delanteros"* por separado permite que el cliente **acepte una parte** — que es justo lo que definimos para la aceptación parcial.

Cada ítem se guarda como línea del presupuesto, lista para que el encargado la valorice una por una.

---

## 3. Órdenes de trabajo editables

Ahora el detalle se parece al Nuevo Ingreso, con las cuatro áreas.

**Cada área tiene su lápiz ✏️.** Al tocarlo, esa área pasa a modo edición y las demás quedan como estaban. Editar una OT de veinte líneas todo de una vez es incómodo y arriesga cambios accidentales.

En modo edición se puede corregir el detalle, la cantidad, agregar líneas nuevas, borrar, y completar **costo y precio**:

| Área | Campos |
|---|---|
| Mano de obra | detalle, cantidad, **precio** |
| Repuestos | código, detalle, cantidad, **costo**, **precio** |
| Lubricantes e insumos | detalle, cantidad, **costo**, **precio** |
| Servicio externo | detalle, cantidad, **costo**, **precio** |

La mano de obra no lleva costo: no se compra, se ejecuta.

### Lo que falta valorizar salta a la vista
Cada área muestra **"N por valorizar"** en ámbar, y el resumen del pie cambia de color mientras quede algo pendiente. El total se calcula **con lo que hay en pantalla**, no con lo guardado, así el asesor ve el efecto de cada precio que escribe.

### Guardado selectivo
Solo se envían las líneas que cambiaron. Recorrer todas en cada guardado sobrescribiría lo que otro usuario pudo modificar entremedio.

Al guardar, cada línea valorizada registra **quién puso el precio y cuándo**.

---

## 4. Y al registrar la salida

El cierre toma este detalle ya completo. Si la OT quedó valorizada desde aquí, el asesor solo confirma el documento y emite.

---

## Qué hacer

1. **Ejecuta `74_verificar_usuarios.sql`** y pásame el resultado del punto 2 — ahí veremos si falta crear usuarios
2. Si falta Víctor, ejecuta la **migración 55** (necesita su cuenta creada antes en Authentication)
3. Sube la v115
4. Prueba: solicita un presupuesto con tres líneas y revisa si llega el aviso
5. Abre una OT desde **Órdenes de trabajo** y valoriza con el lápiz
