-- Единственная стартовая запись timeline. Остальные события добавляют
-- пользователи — выдуманных событий здесь нет.
insert into public.timeline_events (title, description, event_date, created_by)
select
  'Начало нашей истории',
  'Дата, с которой начинается этот архив.',
  date '2020-01-01',
  null
where not exists (
  select 1
  from public.timeline_events
  where event_date = date '2020-01-01'
    and title = 'Начало нашей истории'
);

-- Дата стартовой записи должна совпадать с siteConfig.meetingDate (lib/site-config.ts).
