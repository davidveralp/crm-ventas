-- =====================================================================
-- ACTUALIZACIÓN v39 · Fix RLS: ver clientes con tarea de campaña asignada
-- ---------------------------------------------------------------------
-- Causa raíz del bug reportado ("filas en blanco" / "no carga completo"
-- en Clientes → Tareas al ver una campaña reasignada a un asesor
-- específico): la política de seguridad de `clientes` solo deja leer un
-- cliente a su dueño de cartera (vendedor_id) o a admin. Al reasignar una
-- TAREA de campaña a un asesor que no es el dueño del cliente, la fila de
-- tareas_campana SÍ es visible (su propia política es solo por empresa),
-- pero el join embebido a clientes(...) queda bloqueado por RLS y
-- PostgREST lo devuelve en null — de ahí las rayas "—" en nombre,
-- teléfono y segmento, y que el buscador no encuentre a esos clientes.
--
-- Fix: se amplía el SELECT de clientes para permitir también la lectura
-- cuando el usuario tiene una tarea de campaña activa sobre ese cliente,
-- SIN cambiar el dueño real de cartera (clientes.vendedor_id se mantiene
-- intacto).
-- Idempotente. Requiere migraciones 1–40.
-- =====================================================================

drop policy if exists clientes_select on clientes;
create policy clientes_select on clientes
  for select using (
    empresa_id = empresa_actual()
    and (
      es_admin()
      or vendedor_id = auth.uid()
      or exists (
        select 1 from tareas_campana tc
         where tc.cliente_id = clientes.id and tc.vendedor_id = auth.uid()
      )
    )
  );

select 'v39 ok' as resultado;
