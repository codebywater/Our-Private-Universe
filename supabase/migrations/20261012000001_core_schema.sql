-- =============================================================================
-- Основная схема
--
-- Модель доступа:
--   * Приложение рассчитано ровно на двух человек. Доступ имеют только те,
--     чьи auth.users.id внесены в public.allowed_users ВЛАДЕЛЬЦЕМ проекта
--     (через SQL Editor / service role). Клиентский API не может ни добавить,
--     ни изменить, ни удалить записи allowlist.
--   * Любая политика RLS начинается с проверки public.is_allowed().
--   * service_role-ключ приложением не используется.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Служебные функции
-- -----------------------------------------------------------------------------

-- Автообновление updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- allowed_users — allowlist (ровно два участника)
-- -----------------------------------------------------------------------------
create table public.allowed_users (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
                 check (char_length(btrim(display_name)) between 1 and 40),
  created_at   timestamptz not null default now()
);

comment on table public.allowed_users is
  'Allowlist: только эти пользователи видят приватные данные. Изменять может только владелец проекта (SQL Editor / service role).';

-- Жёсткий предел: не больше двух участников.
create or replace function public.enforce_allowlist_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.allowed_users) >= 2 then
    raise exception 'allowlist is limited to two users'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger allowed_users_cap
  before insert on public.allowed_users
  for each row execute function public.enforce_allowlist_cap();

-- Проверка «текущий пользователь в allowlist».
-- SECURITY DEFINER нужен, чтобы функция могла читать allowed_users независимо
-- от RLS (иначе политики ссылались бы сами на себя). search_path пустой,
-- все объекты квалифицированы; права выданы только роли authenticated.
create or replace function public.is_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.allowed_users au
    where au.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_allowed() from public, anon;
grant execute on function public.is_allowed() to authenticated;

alter table public.allowed_users enable row level security;

-- Участники видят список (нужен, чтобы знать имя партнёра). Политик на
-- INSERT/UPDATE/DELETE нет намеренно: клиент не может самостоятельно
-- добавить себя в allowlist.
create policy "members read allowlist"
  on public.allowed_users
  for select
  to authenticated
  using (public.is_allowed());

revoke all on public.allowed_users from anon, authenticated;
grant select on public.allowed_users to authenticated;

-- -----------------------------------------------------------------------------
-- memories — фотоальбом
-- -----------------------------------------------------------------------------
create table public.memories (
  id          uuid primary key default gen_random_uuid(),
  title       text not null
                check (char_length(btrim(title)) between 1 and 120),
  caption     text
                check (caption is null or char_length(caption) <= 2000),
  memory_date date not null,
  image_path  text not null unique
                check (char_length(image_path) between 5 and 300),
  thumb_path  text unique
                check (thumb_path is null or char_length(thumb_path) between 5 and 300),
  width       integer check (width is null or width between 1 and 30000),
  height      integer check (height is null or height between 1 and 30000),
  category    text not null default 'Разное'
                check (char_length(btrim(category)) between 1 and 40),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index memories_date_idx
  on public.memories (memory_date desc, id desc);
create index memories_category_date_idx
  on public.memories (category, memory_date desc, id desc);
create index memories_created_by_idx
  on public.memories (created_by);

create trigger memories_set_updated_at
  before update on public.memories
  for each row execute function public.set_updated_at();

-- Защита неизменяемых полей
create or replace function public.memories_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
     or new.image_path is distinct from old.image_path
     or new.thumb_path is distinct from old.thumb_path then
    raise exception 'immutable column' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger memories_guard
  before update on public.memories
  for each row execute function public.memories_guard();

alter table public.memories enable row level security;

create policy "members read memories"
  on public.memories for select to authenticated
  using (public.is_allowed());

-- Автор подставляется строго из сессии; файл обязан лежать в папке автора.
create policy "members create memories"
  on public.memories for insert to authenticated
  with check (
    public.is_allowed()
    and created_by = (select auth.uid())
    and split_part(image_path, '/', 1) = (select auth.uid())::text
    and (thumb_path is null
         or split_part(thumb_path, '/', 1) = (select auth.uid())::text)
  );

-- Архив общий: оба участника могут править и удалять любые записи.
create policy "members update memories"
  on public.memories for update to authenticated
  using (public.is_allowed())
  with check (public.is_allowed());

create policy "members delete memories"
  on public.memories for delete to authenticated
  using (public.is_allowed());

revoke all on public.memories from anon, authenticated;
grant select, insert, update, delete on public.memories to authenticated;

-- -----------------------------------------------------------------------------
-- timeline_events — история отношений
-- -----------------------------------------------------------------------------
create table public.timeline_events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null
                check (char_length(btrim(title)) between 1 and 120),
  description text
                check (description is null or char_length(description) <= 4000),
  event_date  date not null,
  image_path  text unique
                check (image_path is null or char_length(image_path) between 5 and 300),
  thumb_path  text unique
                check (thumb_path is null or char_length(thumb_path) between 5 and 300),
  location    text
                check (location is null or char_length(location) <= 120),
  -- NULL допустим: стартовая запись создаётся миграцией, без автора
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index timeline_events_date_idx
  on public.timeline_events (event_date asc, id asc);
create index timeline_events_created_by_idx
  on public.timeline_events (created_by);

create trigger timeline_events_set_updated_at
  before update on public.timeline_events
  for each row execute function public.set_updated_at();

create or replace function public.timeline_events_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'immutable column' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger timeline_events_guard
  before update on public.timeline_events
  for each row execute function public.timeline_events_guard();

alter table public.timeline_events enable row level security;

create policy "members read timeline"
  on public.timeline_events for select to authenticated
  using (public.is_allowed());

create policy "members create timeline"
  on public.timeline_events for insert to authenticated
  with check (
    public.is_allowed()
    and created_by = (select auth.uid())
    and (image_path is null
         or split_part(image_path, '/', 1) = (select auth.uid())::text)
    and (thumb_path is null
         or split_part(thumb_path, '/', 1) = (select auth.uid())::text)
  );

-- При смене обложки новый файл тоже должен лежать в папке участника.
create policy "members update timeline"
  on public.timeline_events for update to authenticated
  using (public.is_allowed())
  with check (
    public.is_allowed()
    and (image_path is null
         or split_part(image_path, '/', 1) in (select au.user_id::text from public.allowed_users au))
    and (thumb_path is null
         or split_part(thumb_path, '/', 1) in (select au.user_id::text from public.allowed_users au))
  );

create policy "members delete timeline"
  on public.timeline_events for delete to authenticated
  using (public.is_allowed());

revoke all on public.timeline_events from anon, authenticated;
grant select, insert, update, delete on public.timeline_events to authenticated;

-- -----------------------------------------------------------------------------
-- letters — личные письма
--
-- Ключевое требование: письмо с будущей датой открытия НЕ раскрывает
-- содержимое получателю через клиентский API. Это обеспечивается на уровне
-- БД (RLS), а не скрытием в интерфейсе:
--   * получатель вообще не видит строку, пока status <> 'sent' или
--     open_at > now();
--   * «запечатанные» письма (для конверта в интерфейсе) отдаёт отдельная
--     функция list_sealed_letters(), которая НЕ возвращает ни заголовок,
--     ни текст;
--   * пометка «открыто» ставится только функцией open_letter().
-- -----------------------------------------------------------------------------
create table public.letters (
  id           uuid primary key default gen_random_uuid(),
  title        text not null
                 check (char_length(btrim(title)) between 1 and 120),
  body         text not null default ''
                 check (char_length(body) <= 20000),
  -- Обе стороны — аккаунты auth.users; принадлежность к allowlist проверяет
  -- триггер letters_guard (FK на allowed_users каскадом удалил бы письма
  -- при исключении человека из списка).
  sender_id    uuid not null
                 references auth.users (id) on delete cascade,
  recipient_id uuid not null
                 references auth.users (id) on delete cascade,
  status       text not null default 'draft'
                 check (status in ('draft', 'sent')),
  open_at      timestamptz,
  sent_at      timestamptz,
  opened_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint letters_distinct_parties check (sender_id <> recipient_id),
  constraint letters_sent_not_empty
    check (status = 'draft' or char_length(btrim(body)) > 0),
  constraint letters_sent_at_matches_status
    check ((status = 'sent') = (sent_at is not null)),
  constraint letters_opened_requires_sent
    check (opened_at is null or status = 'sent')
);

create index letters_recipient_idx
  on public.letters (recipient_id, status, open_at);
create index letters_sender_idx
  on public.letters (sender_id, created_at desc);

create trigger letters_set_updated_at
  before update on public.letters
  for each row execute function public.set_updated_at();

-- Серверная логика жизненного цикла письма.
-- SECURITY DEFINER: проверка allowlist не должна зависеть от того, что именно
-- видит вызывающий под своими RLS-политиками. Выполнение через API закрыто
-- (revoke ниже), триггер срабатывает независимо от прав вызывающего.
create or replace function public.letters_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- sent_at выставляет только сервер
    if new.status = 'sent' then
      new.sent_at := now();
    else
      new.sent_at := null;
    end if;

    -- получатель обязан быть участником allowlist
    if not exists (
      select 1 from public.allowed_users au where au.user_id = new.recipient_id
    ) then
      raise exception 'recipient is not an allowed user' using errcode = '23514';
    end if;
  else
    if new.sender_id is distinct from old.sender_id
       or new.created_at is distinct from old.created_at then
      raise exception 'immutable column' using errcode = '42501';
    end if;

    if old.status = 'sent' and new.status = 'draft' then
      raise exception 'a sent letter cannot return to draft'
        using errcode = '23514';
    end if;

    if new.status = 'sent' then
      if old.status = 'draft' then
        new.sent_at := now();
      else
        new.sent_at := old.sent_at;
      end if;
    else
      new.sent_at := null;
    end if;

    if new.recipient_id is distinct from old.recipient_id
       and not exists (
         select 1 from public.allowed_users au where au.user_id = new.recipient_id
       ) then
      raise exception 'recipient is not an allowed user' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger letters_guard
  before insert or update on public.letters
  for each row execute function public.letters_guard();

alter table public.letters enable row level security;

-- Автор видит свои письма всегда; получатель — только отправленные и
-- только после наступления open_at (проверка по времени сервера БД).
create policy "read own or unlocked letters"
  on public.letters for select to authenticated
  using (
    public.is_allowed()
    and (
      sender_id = (select auth.uid())
      or (
        recipient_id = (select auth.uid())
        and status = 'sent'
        and (open_at is null or open_at <= now())
      )
    )
  );

-- Отправитель = текущий пользователь (подмена автора невозможна).
-- Получатель = другой участник allowlist (check letters_distinct_parties
-- + триггер letters_guard).
create policy "send letters as myself"
  on public.letters for insert to authenticated
  with check (
    public.is_allowed()
    and sender_id = (select auth.uid())
    and opened_at is null
  );

-- Автор может править черновики и ещё не открытые письма.
create policy "edit own unopened letters"
  on public.letters for update to authenticated
  using (
    public.is_allowed()
    and sender_id = (select auth.uid())
    and opened_at is null
  )
  with check (
    sender_id = (select auth.uid())
    and opened_at is null
  );

create policy "delete own unopened letters"
  on public.letters for delete to authenticated
  using (
    public.is_allowed()
    and sender_id = (select auth.uid())
    and opened_at is null
  );

revoke all on public.letters from anon, authenticated;
grant select, insert, update, delete on public.letters to authenticated;

-- «Запечатанные» письма для получателя: только метаданные, без title/body.
create or replace function public.list_sealed_letters()
returns table (
  id        uuid,
  sender_id uuid,
  open_at   timestamptz,
  sent_at   timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.sender_id, l.open_at, l.sent_at
  from public.letters l
  where public.is_allowed()
    and l.recipient_id = (select auth.uid())
    and l.status = 'sent'
    and l.open_at is not null
    and l.open_at > now()
  order by l.open_at asc;
$$;

revoke all on function public.list_sealed_letters() from public, anon;
grant execute on function public.list_sealed_letters() to authenticated;

-- Открытие письма получателем: проверка даты — на стороне БД.
-- Любая неудача даёт одинаковую ошибку (не раскрываем, существует ли письмо).
create or replace function public.open_letter(p_id uuid)
returns public.letters
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.letters;
begin
  if not public.is_allowed() then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  update public.letters l
     set opened_at = coalesce(l.opened_at, now())
   where l.id = p_id
     and l.recipient_id = (select auth.uid())
     and l.status = 'sent'
     and (l.open_at is null or l.open_at <= now())
  returning l.* into v;

  if v.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  return v;
end;
$$;

revoke all on function public.open_letter(uuid) from public, anon;
grant execute on function public.open_letter(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Триггерные функции не должны вызываться через API
-- -----------------------------------------------------------------------------
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.enforce_allowlist_cap() from public, anon, authenticated;
revoke all on function public.memories_guard() from public, anon, authenticated;
revoke all on function public.timeline_events_guard() from public, anon, authenticated;
revoke all on function public.letters_guard() from public, anon, authenticated;
