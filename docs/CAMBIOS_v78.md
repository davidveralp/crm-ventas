# v78 · Interfaz adaptada a celular

**Fecha:** 18 de agosto de 2026
**Migraciones nuevas:** ninguna
**Alcance:** toda la aplicación

---

## Qué vas a ver distinto

### 1. La barra inferior ahora depende de tu rol
Antes la barra de 5 accesos en celular era puramente comercial —Inicio, Clientes, Gestiones, Agenda, Campañas— así que quien trabaja en el taller no llegaba a su pantalla sin abrir el menú.

Ahora:

| Perfil | Accesos en la barra |
|---|---|
| **Taller** (jefe, técnico, adquisiciones, bodega) | Inicio · Taller · Vehículos · Nueva OT · Presupuestos |
| **Comercial** (asesores, admin) | Inicio · Clientes · Vehículos · Gestiones · Agenda |

La barra quedó **fija abajo**, así que no se pierde al desplazar, y respeta el área de seguridad de los iPhone con notch.

### 2. Taller abre en Lista, no en Tablero
En celular el kanban obligaba a desplazarse lateralmente entre 10 columnas. Ahora, **en pantallas chicas la vista por defecto es Lista**, que es vertical y se lee de corrido. El tablero sigue disponible si lo eliges, y en computador nada cambia.

### 3. Vehículos se ve como tarjetas
La tabla de 6 columnas se convirtió en **tarjetas** en celular: patente destacada, vehículo, cliente y las alertas de RADAR a la derecha. Sin desplazamiento horizontal. En computador sigue siendo tabla.

### 4. Los formularios ya no se aplastan
Todos los campos que iban en 2, 3 o 4 columnas ahora ocupan **una sola columna en celular** y vuelven a su disposición original en pantallas grandes. Afecta a 21 pantallas, entre ellas Inspección de ingreso, Ficha del cliente, Clientes, Nueva OT y Panel operativo.

### 5. La inspección ocupa toda la pantalla
En celular el formulario de inspección deja de ser una ventana con márgenes y pasa a **pantalla completa**, aprovechando cada pixel. Se desplaza hacia abajo como en computador.

### 6. Detalles que se notan al usar
- **Se acabó el zoom automático al tocar un campo.** iOS hacía zoom en cualquier campo con letra menor a 16px y después había que alejar a mano. Todos los campos son de 16px en celular.
- **Botones más grandes**: mínimo 44px de alto, que es el tamaño con el que se acierta al primer toque.
- **Los textos largos ya no desbordan**: correos, patentes y URLs se cortan dentro de su tarjeta en vez de estirarla.
- **Desplazamiento con inercia** en las tablas que aún lo necesitan.

---

## Instructivo

### Trabajar desde el celular
No hay que hacer nada especial: entra a la misma dirección de siempre desde el navegador del teléfono. La interfaz se adapta sola al tamaño de pantalla.

**Sugerencia:** agrega la aplicación a la pantalla de inicio. En Chrome, menú → "Agregar a pantalla de inicio". En Safari, compartir → "Agregar a inicio". Queda como una app, sin la barra del navegador, con más espacio útil.

### Recibir un vehículo desde el celular
1. Barra inferior → **Nueva OT**.
2. **📋 Iniciar con inspección de ingreso**.
3. El formulario ocupa toda la pantalla. Baja llenando las siete secciones.
4. Para marcar daños, toca directamente sobre la silueta del vehículo.
5. El cliente firma con el dedo en el recuadro.
6. **✓ Registrar e imprimir**.

### Revisar el taller desde el celular
1. Barra inferior → **Taller**.
2. Se abre en **Lista**: los trabajos aparecen uno bajo otro con su estado.
3. Toca un trabajo para ver su detalle, el panel de salud del vehículo y el RADAR.

### Consultar un vehículo con el cliente al teléfono
1. Barra inferior → **Vehículos**.
2. Escribe la patente. Aparecen tarjetas, no una tabla.
3. Toca la tarjeta para ver historial, alertas y presupuestos.

---

## Detalles que conviene saber

**El kanban sigue existiendo en celular**, solo que no es lo primero que ves. Si lo eliges, las columnas quedan un poco más angostas para que se vea algo de la siguiente.

**Las tablas de detalle (presupuestos, servicios) siguen siendo tablas** incluso en celular, con desplazamiento lateral. Convertirlas todas a tarjetas habría sido mucho cambio de una vez; si alguna te resulta incómoda de usar, dímelo y la convierto.

**El Panel operativo es el más denso de todos.** Se adapta, pero un informe de 15 indicadores y varias matrices se lee mejor en computador. Para revisar en celular conviene exportar el PDF.

**La impresión no se vio afectada.** Las reglas de impresión del Panel operativo apuntan a las clases de escritorio, así que los PDF salen igual que antes.

---

## Lo que todavía no hace

- **No hay modo sin conexión.** Si se cae la señal en medio de una inspección, se pierde lo no guardado. El RADAR sí tiene cola local; la inspección de ingreso no.
- **La firma en pantallas muy pequeñas** es cómoda pero angosta. Girar el teléfono a horizontal da más espacio.
- **Los gráficos del Panel operativo** se encogen bastante en celular. Son legibles, pero no es su mejor formato.
