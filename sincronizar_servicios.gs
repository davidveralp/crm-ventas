# Sincronizar Google Sheets → CRM (Zapier)

Tu base viva está en Google Sheets (`DIDIAL_Base_OT`). Hay dos formas de mantener el CRM al día.

## Opción A — Reimportación manual (simple, recomendada para empezar)
La base de OT cambia por día/semana. No necesitas tiempo real:
1. En Google Sheets: Archivo → Descargar → CSV.
2. En el CRM → Importar / Exportar → Subir CSV.
Hazlo, por ejemplo, cada lunes. Es la vía más confiable y sin costo.

## Opción B — Sincronización automática con Zapier
Para que cada fila nueva del Sheet entre sola al CRM:

1. Entra a [zapier.com](https://zapier.com) y crea un Zap.
2. **Trigger:** "Google Sheets → New Spreadsheet Row". Conecta tu cuenta de Google y elige la planilla `DIDIAL_Base_OT` (Hoja 1).
3. **Action:** "Supabase → Create Row" (o "API Request by Zapier" apuntando a tu tabla).
   - Conecta Supabase con tu Project URL y la clave `service_role` (NO la anon).
   - Tabla destino: `clientes`.
   - Mapea: Propietario → nombre, Teléfono → telefono, E-Mail → email, Ciudad → ciudad, Tipo Cliente → tipo, Marca → marca_principal.
   - Campo fijo: empresa_id = `00000000-0000-0000-0000-000000000001`.
4. Publica el Zap.

> Nota: la base de OT es por *orden de trabajo* (un cliente puede repetirse). Para no duplicar clientes, conviene una planilla intermedia "1 fila por cliente" como origen del Zap. Si quieres, te la armo.

**Recomendación honesta:** parte con la Opción A. La sincronización en vivo agrega complejidad (deduplicado, claves) que conviene resolver una vez que el equipo ya use el CRM con soltura.
