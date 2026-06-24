# Puesta en marcha — DIDIAL CRM

Tiempo estimado: **30–40 minutos**. No necesitas saber programar; es seguir pasos y copiar/pegar.

---

## Paso 1 · Subir el código a tu GitHub

1. Entra a [github.com](https://github.com) con tu cuenta y crea un repositorio nuevo llamado **`didial-crm`** (público).
2. No marques "Add README" (ya viene uno).
3. En tu computador, dentro de la carpeta del proyecto:

```bash
git init
git add .
git commit -m "DIDIAL CRM - versión inicial"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/didial-crm.git
git push -u origin main
```

> Si no tienes git, puedes arrastrar los archivos en la web de GitHub (botón "uploading an existing file").

---

## Paso 2 · Crear el proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com) y crea una cuenta gratis (puedes usar tu GitHub).
2. **New project** → nombre `didial-crm`, define una contraseña de base de datos (guárdala), región **South America (São Paulo)**.
3. Espera ~2 minutos a que se aprovisione.

---

## Paso 3 · Crear la base de datos

1. En Supabase, ve a **SQL Editor** (icono `</>` en la barra izquierda).
2. Abre el archivo `database/01_schema.sql`, copia **todo** su contenido, pégalo y pulsa **Run**.
3. Repite con `database/02_rls.sql` y luego `database/03_seed.sql`, en ese orden.

Deberías ver "Success. No rows returned" en cada uno. Con esto quedan creadas todas las tablas, la seguridad y la empresa DIDIAL con sus 7 campañas.

---

## Paso 4 · Crear los usuarios

1. Ve a **Authentication → Users → Add user → Create new user**.
2. Crea estos 4 usuarios (marca "Auto Confirm User" en cada uno) con una contraseña temporal:

| Correo | Persona | Rol |
|--------|---------|-----|
| administracion@didial.cl | David Vera | Admin |
| asesordidial@hotmail.com | Diego Leyton | Vendedor |
| vendedordidial@outlook.com | Ángel Yáñez | Vendedor |
| lubricentrodidial@hotmail.com | David Rivera | Vendedor |

3. Vuelve al **SQL Editor**, abre `database/04_vincular_usuarios.sql`, pégalo y pulsa **Run**.
   Esto conecta cada correo con su perfil y rol. Al final verás las 4 filas.

> Cada persona puede cambiar su contraseña después desde la pantalla de login (o tú las reseteas en Authentication).

---

## Paso 5 · Conectar el frontend con Supabase

1. En Supabase ve a **Project Settings → API** y copia:
   - **Project URL** (algo como `https://xxxx.supabase.co`)
   - **anon public** key
2. En la carpeta del proyecto, copia `.env.example` como `.env` y rellena:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
```

3. Prueba en local:

```bash
npm install
npm run dev
```

Abre la dirección que aparece (normalmente `http://localhost:5173`), inicia sesión con `administracion@didial.cl` y la contraseña que pusiste. Si entras al dashboard, ¡funciona!

---

## Paso 6 · Cargar tu base de clientes

1. En tu Google Sheets de clientes: **Archivo → Descargar → Valores separados por comas (.csv)** o **Excel (.xlsx)**.
2. En el CRM, ve a **Importar / Exportar → Subir CSV/Excel** y selecciona el archivo.
3. Revisa la vista previa (cuántos clientes válidos detectó) y pulsa **Importar**.

El sistema detecta automáticamente columnas como nombre, teléfono, correo, facturación y segmento. Si alguna columna tiene un nombre raro, renómbrala en el Sheets antes de exportar (ej: "Cliente" → "Nombre").

---

## Paso 7 · Publicar en internet (opcional pero recomendado)

Para que el equipo entre desde el celular sin tu computador encendido, sigue **[DEPLOY.md](DEPLOY.md)**. Es gratis con Vercel y toma 5 minutos.

---

## Replicar para otra empresa

1. Crea **otro proyecto** en Supabase (Paso 2).
2. Corre los mismos `01`, `02` y para el `03_seed.sql`, cambia el nombre, RUT y ciudad de la empresa antes de ejecutarlo.
3. Crea los usuarios de esa empresa (Paso 4, adaptando correos y nombres en `04`).
4. Despliega otra instancia del frontend en Vercel con las credenciales del nuevo proyecto.

El código fuente es exactamente el mismo. Cada empresa queda aislada en su propia base de datos.
