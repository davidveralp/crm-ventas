-- =====================================================================
-- MÓDULO OT · ACTUALIZACIÓN v16
-- Guarda la URL del Apps Script (backend de la planilla DIDIAL_Base_OT)
-- en la configuración de la empresa. El CRM la lee y envía allí cada OT
-- creada, reutilizando el mismo backend que la app de registro.
-- Idempotente. Ejecutar en el SQL Editor de Supabase.
-- =====================================================================

insert into empresa_config (empresa_id, clave, valor) values
 ('00000000-0000-0000-0000-000000000001', 'ot_sheet_url',
  '"https://script.google.com/macros/s/AKfycbyDbfNHIoL70hP_mDzR0pHo8OmrPTDVveeYG-NWylEYa9lZAwuWiRgB40-iT9znlgJ4hA/exec"'::jsonb)
on conflict (empresa_id, clave) do update set valor = excluded.valor;

-- Si en el futuro cambias la implementación del Apps Script y obtienes
-- otra URL, basta con re-ejecutar este insert con la nueva URL.
