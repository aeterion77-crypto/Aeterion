-- =====================================================================
-- Aeterion Coaches · migración 002: almacenamiento privado de documentos
-- Carpeta por coach: coach-docs/<user_id>/archivo. Solo el dueño sube y
-- ve lo suyo; los admins ven todo (para revisar). Nada es público.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('coach-docs', 'coach-docs', false, 8388608, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;

create policy coach_docs_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'coach-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy coach_docs_ver on storage.objects for select to authenticated
  using (bucket_id = 'coach-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.es_admin()));
create policy coach_docs_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'coach-docs' and (storage.foldername(name))[1] = auth.uid()::text);
