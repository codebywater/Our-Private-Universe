import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Проверка миграций и RLS на настоящем Postgres (PGlite, WASM).
 * Окружение Supabase (роли anon/authenticated, auth.uid(), storage.*)
 * эмулируется файлом supabase-stub.sql. Запуск: npm run test:db
 */
const HERE = dirname(fileURLToPath(import.meta.url));

const MIG = join(HERE, "..", "migrations");
const db = new PGlite();

let passed = 0;
let failed = 0;
const failures = [];

function ok(name) { passed++; console.log("  ok   -", name); }
function bad(name, detail) { failed++; failures.push(name); console.log("  FAIL -", name, "\n        ", detail); }

async function asUser(uid, role = "authenticated") {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false); set role ${role};`);
}
async function asOwner() {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
}
async function expectOk(name, sql, check) {
  try {
    const r = await db.query(sql);
    if (check && !check(r.rows)) return bad(name, "unexpected rows: " + JSON.stringify(r.rows));
    ok(name);
    return r.rows;
  } catch (e) { bad(name, "unexpected error: " + e.message); }
}
async function expectErr(name, sql, re) {
  try {
    await db.query(sql);
    bad(name, "expected an error, but the statement succeeded");
  } catch (e) {
    if (re && !re.test(e.message)) return bad(name, "wrong error: " + e.message);
    ok(name);
  }
}
async function expectRows(name, sql, n) {
  try {
    const r = await db.query(sql);
    if (r.rows.length !== n) return bad(name, `expected ${n} rows, got ${r.rows.length}`);
    ok(name);
    return r.rows;
  } catch (e) { bad(name, "unexpected error: " + e.message); }
}

// ---------- setup ----------
await db.exec(readFileSync(join(HERE, "supabase-stub.sql"), "utf8"));
for (const f of readdirSync(MIG).sort()) {
  try { await db.exec(readFileSync(`${MIG}/${f}`, "utf8")); console.log("applied", f); }
  catch (e) { console.log("MIGRATION FAILED", f, e.message); process.exit(2); }
}

const G = "11111111-1111-1111-1111-111111111111"; // Гриша
const K = "22222222-2222-2222-2222-222222222222"; // Катя
const X = "33333333-3333-3333-3333-333333333333"; // посторонний, зарегистрированный
const Z = "44444444-4444-4444-4444-444444444444"; // третий кандидат для allowlist
await db.exec(`insert into auth.users (id,email) values
  ('${G}','g@x'),('${K}','k@x'),('${X}','x@x'),('${Z}','z@x');`);
await db.exec(`insert into public.allowed_users (user_id, display_name) values ('${G}','Гриша'),('${K}','Катя');`);

console.log("\n[allowlist]");
await asOwner();
await expectErr("третий участник в allowlist запрещён (лимит 2)",
  `insert into public.allowed_users (user_id, display_name) values ('${Z}','Третий')`, /limited to two/);

await asUser(X);
await expectRows("посторонний не видит allowlist", `select * from public.allowed_users`, 0);
await expectErr("посторонний не может добавить себя в allowlist",
  `insert into public.allowed_users (user_id, display_name) values ('${X}','Я')`, /permission denied|row-level security/);
await asUser(G);
await expectRows("участник видит allowlist (2 строки)", `select * from public.allowed_users`, 2);
await expectErr("участник не может добавлять в allowlist",
  `insert into public.allowed_users (user_id, display_name) values ('${Z}','Z')`, /permission denied|row-level security/);
await expectErr("участник не может удалить из allowlist", `delete from public.allowed_users where user_id='${K}'`, /permission denied/);
await expectErr("участник не может править allowlist", `update public.allowed_users set display_name='Hack' where user_id='${K}'`, /permission denied/);
await asUser(null, "anon");
await expectErr("anon не имеет доступа к allowlist", `select * from public.allowed_users`, /permission denied/);

console.log("\n[timeline]");
await asUser(G);
await expectRows("стартовая запись существует", `select * from public.timeline_events where event_date='2020-01-01' and title='Начало нашей истории'`, 1);
await expectOk("участник добавляет событие от своего имени",
  `insert into public.timeline_events (title, event_date, created_by) values ('Событие','2020-01-01','${G}') returning id`);
await expectErr("нельзя создать событие от чужого имени",
  `insert into public.timeline_events (title, event_date, created_by) values ('Подмена','2020-01-01','${K}')`, /row-level security/);
await expectErr("нельзя сослаться на чужую папку Storage",
  `insert into public.timeline_events (title, event_date, created_by, image_path) values ('P','2020-01-01','${G}','${K}/a.jpg')`, /row-level security/);
await asUser(X);
await expectRows("посторонний не видит timeline", `select * from public.timeline_events`, 0);
await expectErr("посторонний не может добавлять в timeline",
  `insert into public.timeline_events (title, event_date, created_by) values ('Hack','2020-01-01','${X}')`, /row-level security/);

console.log("\n[memories]");
await asUser(G);
const m = await expectOk("участник создаёт воспоминание",
  `insert into public.memories (title, memory_date, image_path, thumb_path, created_by)
   values ('Фото','2021-05-05','${G}/a.jpg','${G}/a_thumb.webp','${G}') returning id`);
const memId = m?.[0]?.id;
await expectErr("нельзя положить путь в чужую папку",
  `insert into public.memories (title, memory_date, image_path, created_by) values ('x','2021-05-05','${K}/b.jpg','${G}')`, /row-level security/);
await expectErr("нельзя подменить автора",
  `insert into public.memories (title, memory_date, image_path, created_by) values ('x','2021-05-05','${G}/c.jpg','${K}')`, /row-level security/);
await asUser(K);
await expectRows("партнёр видит воспоминание", `select * from public.memories`, 1);
await expectOk("партнёр редактирует метаданные",
  `update public.memories set title='Новое' where id='${memId}' returning id`);
await expectErr("image_path неизменяем",
  `update public.memories set image_path='${K}/zzz.jpg' where id='${memId}'`, /immutable/);
await expectErr("created_by неизменяем",
  `update public.memories set created_by='${K}' where id='${memId}'`, /immutable/);
await asUser(X);
await expectRows("посторонний не видит воспоминаний", `select * from public.memories`, 0);
await expectOk("посторонний ничего не обновляет (0 строк)", `update public.memories set title='hack' where id='${memId}' returning id`, (r) => r.length === 0);
await expectOk("посторонний ничего не удаляет (0 строк)", `delete from public.memories where id='${memId}' returning id`, (r) => r.length === 0);
await asUser(null, "anon");
await expectErr("anon не имеет доступа к memories", `select * from public.memories`, /permission denied/);

console.log("\n[storage policies]");
await asUser(G);
await expectOk("участник загружает в свою папку",
  `insert into storage.objects (bucket_id, name) values ('memories','${G}/a.jpg') returning id`);
await expectErr("участник не может загрузить в папку партнёра",
  `insert into storage.objects (bucket_id, name) values ('memories','${K}/evil.jpg')`, /row-level security/);
await asUser(X);
await expectErr("посторонний не может загрузить файл",
  `insert into storage.objects (bucket_id, name) values ('memories','${X}/x.jpg')`, /row-level security/);
await expectRows("посторонний не видит файлов", `select * from storage.objects`, 0);
await asUser(K);
await expectRows("партнёр видит файл (для signed URL)", `select * from storage.objects`, 1);
await asOwner();
const b = await db.query(`select public, allowed_mime_types from storage.buckets where id='memories'`);
b.rows[0].public === false ? ok("bucket memories приватный") : bad("bucket приватный", JSON.stringify(b.rows));

console.log("\n[letters — главное требование]");
await asUser(G);
// будущее письмо от Гриши Кате
const future = await expectOk("Гриша отправляет письмо с отложенным открытием",
  `insert into public.letters (title, body, sender_id, recipient_id, status, open_at)
   values ('Секрет','СЕКРЕТНЫЙ ТЕКСТ','${G}','${K}','sent', now() + interval '30 days') returning id, sent_at`,
  (r) => r[0].sent_at !== null);
const fId = future?.[0]?.id;
const draft = await expectOk("Гриша сохраняет черновик",
  `insert into public.letters (title, body, sender_id, recipient_id) values ('Черновик','черновой текст','${G}','${K}') returning id, status, sent_at`,
  (r) => r[0].status === "draft" && r[0].sent_at === null);
const dId = draft?.[0]?.id;
const now_ = await expectOk("письмо без open_at доступно сразу",
  `insert into public.letters (title, body, sender_id, recipient_id, status) values ('Сразу','Привет','${G}','${K}','sent') returning id`);
const nowId = now_?.[0]?.id;
const past = await expectOk("письмо с open_at в прошлом доступно сразу",
  `insert into public.letters (title, body, sender_id, recipient_id, status, open_at) values ('Прошлое','Уже можно','${G}','${K}','sent', now() - interval '1 day') returning id`);
const pastId = past?.[0]?.id;

await expectRows("автор видит все свои письма (4)", `select * from public.letters`, 4);

await asUser(K);
const kLetters = await db.query(`select id, title, body from public.letters order by title`);
const kTitles = kLetters.rows.map((r) => r.title).sort().join(",");
kTitles === "Прошлое,Сразу" ? ok("получатель видит только открытые письма: " + kTitles) : bad("получатель видит только открытые", kTitles);
await expectRows("получатель НЕ видит будущее письмо напрямую по id", `select * from public.letters where id='${fId}'`, 0);
await expectRows("получатель НЕ видит чужой черновик", `select * from public.letters where id='${dId}'`, 0);
await expectRows("получатель НЕ найдёт будущее письмо поиском по тексту",
  `select * from public.letters where body ilike '%СЕКРЕТНЫЙ%' or title ilike '%Секрет%'`, 0);
const sealed = await expectRows("list_sealed_letters возвращает 1 запечатанное письмо", `select * from public.list_sealed_letters()`, 1);
if (sealed) {
  const cols = Object.keys(sealed[0]).sort().join(",");
  cols === "id,open_at,sender_id,sent_at" ? ok("запечатанное письмо не содержит title/body: " + cols) : bad("утечка колонок", cols);
}
await expectErr("open_letter на будущее письмо отказывает", `select * from public.open_letter('${fId}')`, /not_found/);
await expectErr("open_letter на чужой черновик отказывает", `select * from public.open_letter('${dId}')`, /not_found/);
await expectErr("open_letter на несуществующий id даёт ту же ошибку",
  `select * from public.open_letter('99999999-9999-9999-9999-999999999999')`, /not_found/);
const opened = await expectOk("open_letter на доступное письмо возвращает его и ставит opened_at",
  `select * from public.open_letter('${pastId}')`, (r) => r[0].body === "Уже можно" && r[0].opened_at !== null);
await expectOk("получатель не изменит письмо (0 строк)", `update public.letters set body='подделка' where id='${nowId}' returning id`, (r) => r.length === 0);
await expectOk("получатель не удалит письмо (0 строк)", `delete from public.letters where id='${nowId}' returning id`, (r) => r.length === 0);
await expectErr("получатель не может отправить письмо от имени Гриши",
  `insert into public.letters (title, body, sender_id, recipient_id, status) values ('Подмена','x','${G}','${K}','sent')`, /row-level security/);
await expectErr("получатель не может отправить письмо самому себе",
  `insert into public.letters (title, body, sender_id, recipient_id, status) values ('Себе','x','${K}','${K}','sent')`, /letters_distinct_parties|check/);
await expectErr("нельзя назначить получателем постороннего",
  `insert into public.letters (title, body, sender_id, recipient_id, status) values ('Чужому','x','${K}','${X}','sent')`, /not an allowed user/);
await expectErr("нельзя самому поставить opened_at при создании",
  `insert into public.letters (title, body, sender_id, recipient_id, status, opened_at) values ('o','x','${K}','${G}','sent', now())`, /row-level security/);

console.log("\n[letters — редактирование автором]");
await asUser(G);
await expectOk("автор правит черновик", `update public.letters set body='правка' where id='${dId}' returning id`, (r) => r.length === 1);
await expectOk("автор отправляет черновик (sent_at ставит БД)",
  `update public.letters set status='sent', open_at = now() + interval '1 day' where id='${dId}' returning sent_at`, (r) => r[0].sent_at !== null);
await expectErr("нельзя вернуть отправленное в черновик",
  `update public.letters set status='draft' where id='${dId}'`, /cannot return to draft/);
await expectErr("sender_id неизменяем", `update public.letters set sender_id='${K}' where id='${dId}'`, /immutable|row-level security/);
await expectOk("автор может удалить неоткрытое письмо", `delete from public.letters where id='${dId}' returning id`, (r) => r.length === 1);
await expectOk("автор не правит уже ОТКРЫТОЕ письмо (0 строк)",
  `update public.letters set body='задним числом' where id='${pastId}' returning id`, (r) => r.length === 0);
await expectOk("автор не удаляет уже ОТКРЫТОЕ письмо (0 строк)",
  `delete from public.letters where id='${pastId}' returning id`, (r) => r.length === 0);
await expectErr("sent без текста запрещён",
  `insert into public.letters (title, body, sender_id, recipient_id, status) values ('пусто','   ','${G}','${K}','sent')`, /letters_sent_not_empty|check/);
await expectErr("автор не может поставить sent_at/opened_at задним числом",
  `update public.letters set opened_at = now() where id='${fId}'`, /row-level security|new row/);

console.log("\n[посторонний и anon]");
await asUser(X);
await expectRows("посторонний не видит писем", `select * from public.letters`, 0);
await expectRows("посторонний не видит запечатанных", `select * from public.list_sealed_letters()`, 0);
await expectErr("посторонний не может open_letter", `select * from public.open_letter('${pastId}')`, /not_found/);
await expectErr("посторонний не может писать письма",
  `insert into public.letters (title, body, sender_id, recipient_id, status) values ('x','y','${X}','${G}','sent')`, /row-level security/);
await asUser(null, "anon");
await expectErr("anon не читает письма", `select * from public.letters`, /permission denied/);
await expectErr("anon не вызывает open_letter", `select * from public.open_letter('${pastId}')`, /permission denied/);
await expectErr("anon не вызывает list_sealed_letters", `select * from public.list_sealed_letters()`, /permission denied/);
await expectErr("anon не вызывает is_allowed", `select public.is_allowed()`, /permission denied/);
await asUser(G);
await expectErr("клиент не вызывает триггерные функции", `select public.letters_guard()`, /permission denied/);

await asOwner();
console.log(`\n=== итог: ${passed} пройдено, ${failed} провалено ===`);
if (failed) { console.log("Провалы:", failures); process.exit(1); }
