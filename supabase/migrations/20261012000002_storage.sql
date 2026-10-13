-- =============================================================================
-- Приватное хранилище фотографий
--
-- Bucket "memories" — ПРИВАТНЫЙ (public = false). Публичных ссылок нет:
-- просмотр только через временные signed URL, которые приложение выдаёт после
-- проверки прав пользователя (и сама выдача требует прохождения SELECT-политики).
--
-- Структура путей: <user_id>/<uuid>.<ext> и <user_id>/<uuid>_thumb.webp
-- Загрузка разрешена только в собственную папку; перезапись (UPDATE) запрещена.
-- Ограничения bucket (размер, MIME) — второй уровень защиты поверх проверки
-- сигнатуры файла на сервере приложения.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'memories',
  'memories',
  false,
  15728640, -- 15 МБ
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Чтение (в том числе выдача signed URL) — только участникам allowlist
create policy "memories bucket: members read"
  on storage.objects for select to authenticated
  using (bucket_id = 'memories' and public.is_allowed());

-- Загрузка — только участникам и только в папку со своим user_id
create policy "memories bucket: members upload to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'memories'
    and public.is_allowed()
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Удаление — участникам (архив общий; удаляем и файлы партнёра при удалении
-- воспоминания). Политики UPDATE нет: файлы неизменяемы.
create policy "memories bucket: members delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'memories' and public.is_allowed());
