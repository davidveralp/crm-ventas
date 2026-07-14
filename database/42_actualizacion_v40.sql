-- =====================================================================
-- ACTUALIZACIÓN v40 · Campañas de recordatorio de mantención
-- ---------------------------------------------------------------------
-- Reutiliza los criterios 'mant_proxima' y 'mant_vencida' ya definidos en
-- audiencia_campana (desde la v22/v29/v29-3): clientes cuya ÚLTIMA
-- mantención (y último servicio de cualquier tipo) ocurrió hace:
--   · mant_proxima: 150–180 días (5–6 meses)  → recordatorio preventivo
--   · mant_vencida: 181–365 días (6–12 meses) → mantención atrasada
-- Canal 'tareas' (llamada/WhatsApp personal del asesor), igual que la
-- campaña de fidelización de junio–julio. Idempotente.
-- Requiere migraciones 1–41.
-- =====================================================================

insert into campanas (empresa_id, nombre, descripcion, estado, prioridad, canal, criterio)
select '00000000-0000-0000-0000-000000000001',
       'Recordatorio · Próxima mantención (5–6 meses)',
       'Contacto personal (llamada/WhatsApp del asesor) a clientes cuya última mantención fue hace 5 a 6 meses: recordarles que se acerca la fecha de su próxima mantención.',
       'activa', 10, null,
       '{"tipo":"mant_proxima","canal":"tareas","dias_min":150,"dias_max":180}'::jsonb
where not exists (
  select 1 from campanas
   where empresa_id = '00000000-0000-0000-0000-000000000001'
     and criterio->>'tipo' = 'mant_proxima' and criterio->>'canal' = 'tareas'
);

insert into campanas (empresa_id, nombre, descripcion, estado, prioridad, canal, criterio)
select '00000000-0000-0000-0000-000000000001',
       'Recordatorio · Mantención atrasada (6–12 meses)',
       'Contacto personal (llamada/WhatsApp del asesor) a clientes cuya última mantención fue hace 6 a 12 meses: su mantención ya está atrasada, ofrecer agendar.',
       'activa', 10, null,
       '{"tipo":"mant_vencida","canal":"tareas","dias_min":181,"dias_max":365}'::jsonb
where not exists (
  select 1 from campanas
   where empresa_id = '00000000-0000-0000-0000-000000000001'
     and criterio->>'tipo' = 'mant_vencida' and criterio->>'canal' = 'tareas'
);

-- ---- Diagnóstico: tamaño de audiencia de cada campaña recién creada ----
select c.nombre, c.criterio->>'tipo' as tipo,
       (select count(*) from audiencia_campana(c.id)) as clientes_coincidentes
  from campanas c
 where c.empresa_id = '00000000-0000-0000-0000-000000000001'
   and c.criterio->>'tipo' in ('mant_proxima', 'mant_vencida')
   and c.criterio->>'canal' = 'tareas'
 order by c.criterio->>'tipo';
