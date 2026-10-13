-- =============================================================================
-- Добавление двух разрешённых участников (выполняет ВЛАДЕЛЕЦ проекта)
--
-- Это НЕ миграция: файл запускается вручную в Supabase Dashboard → SQL Editor
-- (роль postgres обходит RLS). Клиентский API добавить запись в allowlist
-- не может.
--
-- Порядок:
--   1. Dashboard → Authentication → Users → "Add user" → "Create new user"
--      для каждого из двух email (галочка "Auto Confirm User" включена).
--   2. Подставьте ниже настоящие email и отображаемые имена.
--   3. Выполните скрипт.
-- =============================================================================

insert into public.allowed_users (user_id, display_name)
select u.id, v.display_name
from (values
  ('partner-a@example.com', 'Имя А'),  -- ← замените email
  ('partner-b@example.com', 'Имя Б')   -- ← замените email
) as v(email, display_name)
join auth.users u on lower(u.email) = lower(v.email)
on conflict (user_id) do update set display_name = excluded.display_name;

-- Проверка: должно вернуться ровно две строки
select au.user_id, u.email, au.display_name
from public.allowed_users au
join auth.users u on u.id = au.user_id
order by au.created_at;
