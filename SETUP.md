# Uso diario — DIDIAL CRM

## Roles

- **Administrador (David Vera):** ve toda la cartera, gestiona usuarios y campañas, recibe el reporte diario.
- **Vendedor:** ve y trabaja solo sus clientes asignados.

## Flujo de trabajo recomendado

1. **Cada mañana** revisa el Dashboard (embudo, conversión, actividad reciente) y la Agenda del día.
2. **Trabaja el pipeline:** arrastra clientes entre etapas a medida que avanzan (Lead → Contactado → Propuesta → Agendado → Vendido).
3. **Registra cada contacto** desde la ficha del cliente (botón "Registrar" en Seguimiento): tipo (llamada/propuesta/agendamiento), resultado y próxima acción.
4. **Agenda:** las actividades con fecha futura aparecen en la sección Agenda; expórtalas a Outlook con el botón ".ics".
5. **Campañas:** abre una campaña para ver el mensaje plantilla y la lista de clientes que coinciden. El administrador la activa.

## Segmentos de valor

| Segmento | Quiénes | Foco |
|----------|---------|------|
| Flota / Empresa | Empresas o 3+ vehículos | Convenio de mantención |
| VIP Activo | Top facturación, recientes | Retención premium |
| Alto Valor en Riesgo | Alto monto pero no vienen | **Win-back (máxima prioridad)** |
| Leal Recurrente | Vienen seguido | Subir ticket |
| Prometedor | 1-2 visitas recientes | Lograr 2ª/3ª visita |
| Dormido Recuperable | Monto medio-bajo, fríos | Reactivar a bajo costo |
| Ocasional | Bajo monto y frecuencia | Automático |

## Importar clientes

Google Sheets → Archivo → Descargar → CSV/Excel → en el CRM, Importar/Exportar → subir.
El sistema reconoce columnas comunes (nombre, teléfono, correo, facturación, segmento) automáticamente.

## Cambiar contraseña

Cada usuario puede pedir reseteo desde el login, o el administrador la cambia en
Supabase → Authentication → Users.
