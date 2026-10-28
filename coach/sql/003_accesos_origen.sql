-- Aeterion Coaches · migración 003: permite el origen 'coach' en accesos (Premium personal del coach).
-- Único cambio a una tabla existente: solo amplía la lista de orígenes válidos.
alter table public.accesos drop constraint accesos_origen_check;
alter table public.accesos add constraint accesos_origen_check check (origen = any (array['codigo','pago','admin','promo','coach']));
