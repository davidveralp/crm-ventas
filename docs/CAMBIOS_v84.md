# v84 · Inspección: formatos, testigos del tablero, combustible y siluetas

**Fecha:** 18 de agosto de 2026
**Migraciones nuevas:** ninguna

---

## 1. Las siluetas estaban intercambiadas

**Encontrado y corregido.** Al revisar las imágenes una por una aparecieron **dos pares cruzados**:

| Archivo | Contenía |
|---|---|
| `camioneta.png` | un furgón |
| `furgon.png` | una camioneta |
| `moto.png` | un camión americano |
| `camion_americano.png` | una moto |

Los cuatro archivos se intercambiaron. Ahora las seis siluetas corresponden a su nombre: sedán, camioneta, moto, camión europeo, camión americano y furgón.

**El tractor se eliminó** de la lista y del proyecto.

---

## 2. Testigos del tablero con icono y color

La sección "Luces de advertencia encendidas" dejó de ser una lista de botones con texto. Ahora cada testigo tiene **su icono dibujado**, y al tocarlo **se enciende con el color que tiene en un tablero real**:

| Color | Testigos | Significa |
|---|---|---|
| 🔴 Rojo | Falla motor, aceite, temperatura, batería, freno, airbag | Detener el vehículo |
| 🟡 Ámbar | Check engine, ABS, presión de neumáticos | Revisar pronto |
| 🔵 Azul | Luces altas | En uso |

Los iconos se dibujan con trazos, no son imágenes: por eso pueden cambiar de color al encenderse y no agregan peso a la carga.

---

## 3. Indicador de combustible como el del tablero

El deslizador con "4/8" se reemplazó por un **medidor de aguja**: arco de E a F, zona de reserva marcada en rojo, marcas en los cuartos, símbolo del surtidor y aguja que se mueve con el nivel.

Debajo queda el deslizador para ajustarlo y el nivel en palabras: *Vacío, 1/8, 1/4, 3/8, 1/2, 5/8, 3/4, 7/8, Lleno*.

Se lee de un vistazo, igual que el tablero que el técnico está mirando.

---

## 4. Mismas reglas de formato que Nueva OT

| Campo | Se escribe | Queda |
|---|---|---|
| **Patente** | `ghty34` | `GH TY 34` — se formatea mientras escribes |
| **Teléfono** | `992764347` | `+56 9 9276 4347` — al salir del campo |
| **RUT** | `772055285` | `77.205.528-5` — al salir del campo |

Se usan exactamente las mismas funciones que Nueva OT, así que el dato queda idéntico venga de donde venga. Eso importa para la búsqueda: una patente guardada con otro formato no se encuentra igual.

---

## Instructivo

### Registrar los testigos encendidos
Mira el tablero y toca los iconos que estén prendidos. El que marcas se pinta con su color; para desmarcarlo, tócalo otra vez.

### Marcar el combustible
Mueve el deslizador bajo el medidor hasta que la aguja quede donde está en el tablero. La palabra bajo el medidor confirma el nivel.

### Escribir la patente
Escribe de corrido, sin espacios ni guiones: `ghty34`. Los espacios se agregan solos y las letras pasan a mayúscula.

---

## Detalle que conviene saber

**Un teléfono de 8 dígitos que no empiece con 9** queda mal formateado (`92764347` da `+56 9 2764 347`). Es un comportamiento que ya existía en Nueva OT y se replicó tal cual para que ambos formularios se comporten igual. Si te topas con números así, conviene corregir la función en `helpers.js` para los dos a la vez.
