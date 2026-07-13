-- =====================================================================
-- PLATAFORMA VPAI · ACTUALIZACIÓN v14
-- Siembra los catálogos por empresa (cat_*) con los valores actuales del
-- tenant Didial. Idempotente. Habilita la edición self-service desde la
-- página de Configuración.
-- Ejecutar en el SQL Editor de Supabase.
-- =====================================================================

-- Claves únicas por empresa (para upsert idempotente)
create unique index if not exists uq_seg  on cat_segmentos(empresa_id, clave);
create unique index if not exists uq_tsrv on cat_tipos_servicio(empresa_id, clave);
create unique index if not exists uq_eges on cat_estados_gestion(empresa_id, clave);
create unique index if not exists uq_tag  on cat_tipos_agenda(empresa_id, clave);

-- ---- Segmentos -----------------------------------------------------
insert into cat_segmentos (empresa_id, clave, nombre, color, orden) values
 ('00000000-0000-0000-0000-000000000001','nuevo','Nuevo cliente','#0E7490',1),
 ('00000000-0000-0000-0000-000000000001','flota_empresa','Flota / Empresa','#1C4357',2),
 ('00000000-0000-0000-0000-000000000001','vip_activo','VIP Activo','#1D9E75',3),
 ('00000000-0000-0000-0000-000000000001','alto_valor_riesgo','Alto Valor en Riesgo','#A32D2D',4),
 ('00000000-0000-0000-0000-000000000001','leal_recurrente','Leal Recurrente','#534AB7',5),
 ('00000000-0000-0000-0000-000000000001','prometedor','Prometedor','#185FA5',6),
 ('00000000-0000-0000-0000-000000000001','dormido_recuperable','Dormido Recuperable','#C98A1B',7),
 ('00000000-0000-0000-0000-000000000001','ocasional','Ocasional','#73726c',8)
on conflict (empresa_id, clave) do nothing;

-- ---- Tipos de servicio ---------------------------------------------
insert into cat_tipos_servicio (empresa_id, clave, nombre, orden) values
 ('00000000-0000-0000-0000-000000000001','mantencion_basica','Mantención básica',1),
 ('00000000-0000-0000-0000-000000000001','mantencion_intermedia','Mantención intermedia',2),
 ('00000000-0000-0000-0000-000000000001','mantencion_mayor','Mantención mayor',3),
 ('00000000-0000-0000-0000-000000000001','frenos','Frenos',4),
 ('00000000-0000-0000-0000-000000000001','embrague','Embrague',5),
 ('00000000-0000-0000-0000-000000000001','suspension','Suspensión / dirección',6),
 ('00000000-0000-0000-0000-000000000001','distribucion','Distribución / correa',7),
 ('00000000-0000-0000-0000-000000000001','motor','Motor',8),
 ('00000000-0000-0000-0000-000000000001','diagnostico','Diagnóstico / escáner',9),
 ('00000000-0000-0000-0000-000000000001','electrico','Sistema eléctrico',10),
 ('00000000-0000-0000-0000-000000000001','aire','Aire acondicionado',11),
 ('00000000-0000-0000-0000-000000000001','neumaticos','Neumáticos / alineación',12),
 ('00000000-0000-0000-0000-000000000001','dyp','Desabolladura y pintura',13),
 ('00000000-0000-0000-0000-000000000001','revision_tecnica','Revisión técnica',14),
 ('00000000-0000-0000-0000-000000000001','otro','Otro',15)
on conflict (empresa_id, clave) do nothing;

-- ---- Estados de gestión --------------------------------------------
insert into cat_estados_gestion (empresa_id, clave, nombre, color, orden, es_cierre, es_ganada) values
 ('00000000-0000-0000-0000-000000000001','pendiente_contacto','Pendiente de contacto','#94a3b8',1,false,false),
 ('00000000-0000-0000-0000-000000000001','en_seguimiento','En seguimiento','#5B9BB5',2,false,false),
 ('00000000-0000-0000-0000-000000000001','agendada','Agendada','#B07A2E',3,false,false),
 ('00000000-0000-0000-0000-000000000001','asistio','Cliente asistió','#185FA5',4,false,false),
 ('00000000-0000-0000-0000-000000000001','presupuesto_entregado','Presupuesto entregado','#7A5C8E',5,false,false),
 ('00000000-0000-0000-0000-000000000001','pendiente_decision','Pendiente decisión','#C98A1B',6,false,false),
 ('00000000-0000-0000-0000-000000000001','cerrada_ganada','Venta cerrada','#1D9E75',7,true,true),
 ('00000000-0000-0000-0000-000000000001','cerrada_perdida','Finalizada sin éxito','#A32D2D',8,true,false)
on conflict (empresa_id, clave) do nothing;

-- ---- Tipos de agendamiento -----------------------------------------
insert into cat_tipos_agenda (empresa_id, clave, nombre, color, orden) values
 ('00000000-0000-0000-0000-000000000001','llamada','Llamada','#2C5A72',1),
 ('00000000-0000-0000-0000-000000000001','visita_taller','Visita al taller','#1D7A5F',2),
 ('00000000-0000-0000-0000-000000000001','entrega_presupuesto','Entrega de presupuesto','#7A5C8E',3),
 ('00000000-0000-0000-0000-000000000001','revision_cortesia','Revisión de cortesía','#C77D2E',4),
 ('00000000-0000-0000-0000-000000000001','whatsapp','WhatsApp','#9AA4B2',5),
 ('00000000-0000-0000-0000-000000000001','email','Email','#334155',6)
on conflict (empresa_id, clave) do nothing;

-- ---- Permisos de escritura para administradores del tenant ---------
do $$
declare t text;
begin
  foreach t in array array['cat_segmentos','cat_tipos_servicio','cat_estados_gestion',
    'cat_tipos_agenda','empresa_branding','empresa_config','plantillas_email'] loop
    execute format('drop policy if exists %I_adm on %I', t, t);
    execute format(
      'create policy %I_adm on %I for all '
      || 'using (empresa_id = empresa_actual() and exists('
      || 'select 1 from usuarios u where u.id = auth.uid() and u.rol = ''admin'' '
      || 'and u.empresa_id = empresa_actual())) '
      || 'with check (empresa_id = empresa_actual())', t, t);
  end loop;
end $$;

-- Listo. Refresca el CRM tras ejecutar.
