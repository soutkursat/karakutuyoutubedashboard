-- =====================================================================
--  KARA KUTU — Supabase veritabanı şeması
--  Supabase panelinde: SQL Editor → New query → bu dosyanın tamamını yapıştır → Run
--  (Tekrar çalıştırılabilir; mevcut veriyi silmez.)
-- =====================================================================

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------
-- TABLOLAR
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        text not null default 'student' check (role in ('student', 'admin')),
  name        text not null check (char_length(name) between 2 and 80),
  email       text not null,
  username    text unique,
  phone       text not null default '' check (phone = '' or phone ~ '^[0-9]{10,15}$'),
  status      text not null default 'active' check (status in ('active', 'disabled')),
  admin_note  text not null default '',
  created_at  timestamptz not null default now()
);
-- Öğrenci takip alanları (v0.4)
alter table public.profiles add column if not exists skool_member boolean not null default false;
-- Eski öğrenci: yeni üye dönemini (ilk 4 randevu haftada 1) atlar, doğrudan 2 haftada 1
alter table public.profiles add column if not exists veteran boolean not null default false;
-- Yönetici düzeltmeleri (v0.5): sistem dışında kullanılmış yeni üye hakları ve bekleme sıfırlama
alter table public.profiles add column if not exists intro_used_extra int not null default 0;
alter table public.profiles add column if not exists quota_reset_at timestamptz;

-- Aynı telefonla iki öğrenci hesabı açılamaz
create unique index if not exists profiles_student_phone_uq on public.profiles (phone) where role = 'student' and phone <> '';

-- Öğrencilerin YouTube kanalları (sadece öğrencinin kendisi ve yönetici görür)
create table if not exists public.student_channels (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  url         text not null check (char_length(url) between 10 and 300 and url ~* '^https?://'),
  monetized   boolean not null default false,
  -- Kanalın açıldığı ya da aktif içerik üretmeye başlanan tarih
  started_on  date check (started_on is null or started_on between date '2005-01-01' and current_date + 1),
  created_at  timestamptz not null default now()
);
create index if not exists student_channels_student_idx on public.student_channels (student_id);
-- Kanal detayları (v0.6, hepsi isteğe bağlı)
alter table public.student_channels add column if not exists upload_days smallint[] not null default '{}';
alter table public.student_channels add column if not exists video_count int;
alter table public.student_channels add column if not exists niche text;
alter table public.student_channels add column if not exists content_format text;
alter table public.student_channels add column if not exists challenge text;
do $$ begin
  alter table public.student_channels add constraint student_channels_details_check check (
    upload_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
    and (video_count is null or video_count between 0 and 100000)
    and (niche is null or char_length(niche) <= 120)
    and (content_format is null or content_format in ('long', 'shorts', 'both'))
    and (challenge is null or char_length(challenge) <= 600)
  );
exception when duplicate_object then null;
end $$;

-- Tek satırlık ayar tablosu (öğrenciler okuyabilir)
create table if not exists public.app_settings (
  id    int primary key default 1 check (id = 1),
  data  jsonb not null
);
insert into public.app_settings (id, data) values (1, '{
  "weekly": {
    "0": [],
    "1": [{"start":"10:00","end":"13:00"},{"start":"14:00","end":"18:00"}],
    "2": [{"start":"10:00","end":"13:00"},{"start":"14:00","end":"18:00"}],
    "3": [{"start":"10:00","end":"13:00"},{"start":"14:00","end":"18:00"}],
    "4": [{"start":"10:00","end":"13:00"},{"start":"14:00","end":"18:00"}],
    "5": [{"start":"10:00","end":"13:00"},{"start":"14:00","end":"17:00"}],
    "6": []
  },
  "blockedDates": [],
  "slotMinutes": 45,
  "bufferMinutes": 15,
  "minNoticeHours": 12,
  "maxDaysAhead": 21,
  "maxActivePerStudent": 2,
  "introBookings": 4,
  "introGapDays": 7,
  "regularGapDays": 14,
  "cancelLimitHours": 6,
  "whatsappNumber": "905377935090",
  "defaultMeetLink": "",
  "autoConfirm": false,
  "registrationOpen": true,
  "topics": ["Kanal analizi","Niş / konu seçimi","Thumbnail & başlık","Senaryo / içerik","Monetizasyon","Diğer"]
}'::jsonb) on conflict (id) do nothing;

-- Gizli ayarlar (sadece yönetici)
create table if not exists public.app_secrets (
  id           int primary key default 1 check (id = 1),
  invite_code  text not null default '',
  -- Yöneticinin panelden öğrenci eklerken kayıt kurallarını atlaması için sunucu anahtarı
  admin_bypass text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);
insert into public.app_secrets (id) values (1) on conflict (id) do nothing;

create table if not exists public.appointments (
  id                    uuid primary key default gen_random_uuid(),
  code                  text not null unique,
  student_id            uuid not null references public.profiles (id) on delete cascade,
  start_at              timestamptz not null,
  end_at                timestamptz not null,
  topic                 text not null check (char_length(topic) between 1 and 80),
  note                  text not null default '' check (char_length(note) <= 600),
  status                text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  meet_link             text check (meet_link is null or meet_link ~ '^https://'),
  whatsapp_notified_at  timestamptz,
  cancel_reason         text,
  cancelled_by          text check (cancelled_by in ('student', 'admin')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (end_at > start_at),
  -- ÇİFT RANDEVU KORUMASI: aktif randevular zaman olarak asla çakışamaz (veritabanı seviyesinde)
  constraint appointments_no_overlap exclude using gist (tstzrange(start_at, end_at) with &&)
    where (status in ('pending', 'confirmed'))
);
create index if not exists appointments_student_idx on public.appointments (student_id);
-- Google Takvim eşleşmesi (v0.3)
alter table public.appointments add column if not exists google_event_id text;
alter table public.appointments add column if not exists google_synced_status text;

-- ---------------------------------------------------------------------
-- GOOGLE TAKVİM (sadece sunucu fonksiyonları erişir; politikası yok = tarayıcıdan okunamaz)
-- ---------------------------------------------------------------------
create table if not exists public.google_integration (
  id               int primary key default 1 check (id = 1),
  email            text,
  refresh_token    text,
  connected_at     timestamptz,
  last_synced_at   timestamptz,
  last_error       text,
  sync_lock_until  timestamptz
);
insert into public.google_integration (id) values (1) on conflict (id) do nothing;

-- OAuth bağlantısı sırasında sahte istekleri engellemek için tek kullanımlık anahtarlar
create table if not exists public.oauth_states (
  state       text primary key,
  user_id     uuid not null,
  created_at  timestamptz not null default now()
);

-- Google Takvimindeki dolu saatler (randevu sistemi dışındaki etkinlikler)
create table if not exists public.external_busy (
  id        bigserial primary key,
  start_at  timestamptz not null,
  end_at    timestamptz not null,
  check (end_at > start_at)
);
create index if not exists external_busy_range_idx on public.external_busy using gist (tstzrange(start_at, end_at));
create index if not exists appointments_start_idx on public.appointments (start_at);

-- ---------------------------------------------------------------------
-- YARDIMCILAR
-- ---------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and status = 'active');
$$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists appointments_touch on public.appointments;
create trigger appointments_touch before update on public.appointments
  for each row execute function public.touch_updated_at();

create or replace function public.limit_student_channels() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from student_channels where student_id = new.student_id) >= 10 then
    raise exception 'En fazla 10 kanal ekleyebilirsin.';
  end if;
  return new;
end $$;
drop trigger if exists student_channels_limit on public.student_channels;
create trigger student_channels_limit before insert on public.student_channels
  for each row execute function public.limit_student_channels();

create or replace function public._hhmm_to_min(t text) returns int
language sql immutable as $$ select split_part(t, ':', 1)::int * 60 + split_part(t, ':', 2)::int $$;

-- ---------------------------------------------------------------------
-- KAYIT: auth.users'a yeni kullanıcı eklenince profil oluştur
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  s jsonb;
  sec app_secrets;
  bypass boolean;
begin
  select data into s from app_settings where id = 1;
  select * into sec from app_secrets where id = 1;
  bypass := coalesce(meta ->> 'bypass', '') <> '' and meta ->> 'bypass' = sec.admin_bypass;
  -- Panelden (Supabase dashboard) elle eklenen kullanıcılarda meta boştur; onları da kabul et
  if not bypass and meta ? 'name' then
    if not coalesce((s ->> 'registrationOpen')::boolean, true) then
      raise exception 'Şu an yeni kayıt alınmıyor.';
    end if;
    if sec.invite_code <> '' and coalesce(meta ->> 'invite_code', '') <> sec.invite_code then
      raise exception 'Davet kodu hatalı.';
    end if;
  end if;
  insert into profiles (id, name, email, phone)
  values (
    new.id,
    coalesce(nullif(trim(meta ->> 'name'), ''), split_part(new.email, '@', 1)),
    lower(new.email),
    coalesce(meta ->> 'phone', '')
  );
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- E-posta değişirse profile de yansıt
create or replace function public.handle_user_email_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update profiles set email = lower(new.email) where id = new.id;
  return new;
end $$;
drop trigger if exists on_auth_user_email on auth.users;
create trigger on_auth_user_email after update of email on auth.users
  for each row when (old.email is distinct from new.email) execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------
-- GİRİŞ ÖNCESİ (anonim) FONKSİYONLAR
-- ---------------------------------------------------------------------
-- Giriş ekranı: kayıt açık mı, davet kodu isteniyor mu?
create or replace function public.public_config() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'registrationOpen', coalesce((s.data ->> 'registrationOpen')::boolean, true),
    'inviteRequired', sec.invite_code <> ''
  ) from app_settings s, app_secrets sec where s.id = 1 and sec.id = 1;
$$;

-- Kullanıcı adıyla giriş (ör. kursatyoutube) → e-postaya çevir
create or replace function public.resolve_login(p_identifier text) returns text
language sql stable security definer set search_path = public as $$
  select email from profiles where username is not null and lower(username) = lower(trim(p_identifier)) limit 1;
$$;

-- Kayıt öncesi kontrol: Supabase kayıt hatalarını gizlediği için anlaşılır mesaj buradan döner
create or replace function public.check_signup(p_email text, p_phone text, p_invite text) returns text
language plpgsql stable security definer set search_path = public as $$
declare s jsonb; sec app_secrets;
begin
  select data into s from app_settings where id = 1;
  select * into sec from app_secrets where id = 1;
  if not coalesce((s ->> 'registrationOpen')::boolean, true) then return 'Şu an yeni kayıt alınmıyor. Hesabını yöneticiden iste.'; end if;
  if sec.invite_code <> '' and coalesce(trim(p_invite), '') <> sec.invite_code then return 'Davet kodu hatalı.'; end if;
  if exists (select 1 from profiles where email = lower(trim(p_email))) then return 'Bu e-posta ile kayıtlı bir hesap zaten var.'; end if;
  if exists (select 1 from profiles where role = 'student' and phone = p_phone) then return 'Bu telefon numarası başka bir hesapta kayıtlı.'; end if;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- ÖĞRENCİ FONKSİYONLARI
-- ---------------------------------------------------------------------
-- Dolu saatler (kimin aldığı gizli)
create or replace function public.busy_slots(p_from timestamptz, p_to timestamptz)
returns table (start_at timestamptz, end_at timestamptz, mine boolean)
language sql stable security definer set search_path = public as $$
  select a.start_at, a.end_at, a.student_id = auth.uid()
  from appointments a
  where auth.uid() is not null
    and a.status in ('pending', 'confirmed')
    and a.end_at > p_from and a.start_at < p_to
  union all
  -- Mentörün Google Takvimindeki diğer etkinlikler
  select e.start_at, e.end_at, false
  from external_busy e
  where auth.uid() is not null and e.end_at > p_from and e.start_at < p_to;
$$;

-- Aynı anda iki senkronizasyon çalışmasın (çift Google etkinliği oluşmasın)
create or replace function public.google_try_lock(p_seconds int) returns boolean
language plpgsql security definer set search_path = public as $$
declare got int;
begin
  update google_integration set sync_lock_until = now() + make_interval(secs => p_seconds)
   where id = 1 and (sync_lock_until is null or sync_lock_until < now());
  get diagnostics got = row_count;
  return got > 0;
end $$;

-- Sunucu (api/google.ts) Google'dan okuduğu dolu saatleri tek seferde değiştirir
create or replace function public.replace_external_busy(p_rows jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from external_busy where true;
  insert into external_busy (start_at, end_at)
  select (r ->> 'start')::timestamptz, (r ->> 'end')::timestamptz
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  where (r ->> 'end')::timestamptz > (r ->> 'start')::timestamptz;
end $$;

create or replace function public.book_appointment(p_start timestamptz, p_topic text, p_note text)
returns public.appointments
language plpgsql security definer set search_path = public as $$
declare
  me profiles;
  s jsonb;
  slot int; step int; mins int; rs int; re int;
  loc timestamp;
  dkey date;
  r jsonb;
  ok boolean := false;
  cnt int;
  used int;
  last_at timestamptz;
  gap int;
  next_at timestamptz;
  v_code text;
  confirmed boolean;
  result appointments;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null or me.status <> 'active' then raise exception 'Oturumun geçersiz. Tekrar giriş yap.'; end if;
  if me.role <> 'student' then raise exception 'Sadece öğrenci hesapları randevu alabilir.'; end if;

  p_topic := left(regexp_replace(trim(coalesce(p_topic, '')), '\s+', ' ', 'g'), 80);
  p_note := left(trim(coalesce(p_note, '')), 600);
  if p_topic = '' then raise exception 'Görüşme konusunu seç.'; end if;

  -- Aynı öğrencinin eşzamanlı isteklerini sıraya sok
  perform pg_advisory_xact_lock(hashtext(me.id::text));

  select data into s from app_settings where id = 1;
  slot := (s ->> 'slotMinutes')::int;
  step := slot + (s ->> 'bufferMinutes')::int;

  if p_start < now() + make_interval(hours => (s ->> 'minNoticeHours')::int) then
    raise exception 'Bu saat artık uygun değil (en az % saat önceden randevu alınabilir).', s ->> 'minNoticeHours';
  end if;

  loc := p_start at time zone 'Europe/Istanbul';
  dkey := loc::date;
  if dkey > (now() at time zone 'Europe/Istanbul')::date + (s ->> 'maxDaysAhead')::int then
    raise exception 'Bu tarih için henüz randevu alınamıyor.';
  end if;
  if (s -> 'blockedDates') ? to_char(dkey, 'YYYY-MM-DD') then
    raise exception 'Bu gün kapalı.';
  end if;
  if extract(second from loc) <> 0 then raise exception 'Geçersiz saat.'; end if;

  mins := extract(hour from loc)::int * 60 + extract(minute from loc)::int;
  for r in select * from jsonb_array_elements(coalesce(s -> 'weekly' -> (extract(dow from loc)::int)::text, '[]'::jsonb)) loop
    rs := _hhmm_to_min(r ->> 'start');
    re := _hhmm_to_min(r ->> 'end');
    if mins >= rs and mins + slot <= re and (mins - rs) % step = 0 then ok := true; end if;
  end loop;
  if not ok then raise exception 'Bu saat müsaitlik takviminde yok. Sayfayı yenileyip tekrar dene.'; end if;

  -- Mentörün Google Takviminde bu saatte başka bir etkinlik var mı?
  if exists (
    select 1 from external_busy e
     where tstzrange(e.start_at, e.end_at) && tstzrange(p_start, p_start + make_interval(mins => slot))
  ) then
    raise exception 'Bu saat artık uygun değil. Lütfen başka bir saat seç.';
  end if;

  -- RANDEVU SIKLIĞI: yeni üye ilk N randevuyu haftada 1, sonra 2 haftada 1 oluşturabilir.
  -- İptal edilen randevular sayılmaz (hak geri gelir). Süre son randevunun OLUŞTURULDUĞU andan başlar.
  -- Yönetici düzeltmeleri: intro_used_extra (dışarıda kullanılmış haklar),
  -- quota_reset_at (bu andan önce oluşturulan randevular bekleme süresini etkilemez)
  select count(*) + coalesce(me.intro_used_extra, 0),
         max(created_at) filter (where me.quota_reset_at is null or created_at > me.quota_reset_at)
    into used, last_at
    from appointments
   where student_id = me.id and status <> 'cancelled';
  gap := case
    when me.veteran or used >= coalesce((s ->> 'introBookings')::int, 4) then coalesce((s ->> 'regularGapDays')::int, 14)
    else coalesce((s ->> 'introGapDays')::int, 7)
  end;
  next_at := last_at + make_interval(days => gap);
  if last_at is not null and now() < next_at then
    raise exception 'Yeni randevu hakkın % tarihinde açılacak.',
      to_char(next_at at time zone 'Europe/Istanbul', 'DD.MM.YYYY HH24:MI');
  end if;

  select count(*) into cnt from appointments
   where student_id = me.id and status in ('pending', 'confirmed') and end_at > now();
  if cnt >= (s ->> 'maxActivePerStudent')::int then
    raise exception 'Aynı anda en fazla % aktif randevun olabilir. Önce mevcut randevunu tamamla ya da iptal et.', s ->> 'maxActivePerStudent';
  end if;

  loop
    v_code := 'KK-' || (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 5));
    exit when not exists (select 1 from appointments where code = v_code);
  end loop;

  confirmed := coalesce((s ->> 'autoConfirm')::boolean, false);
  begin
    insert into appointments (code, student_id, start_at, end_at, topic, note, status, meet_link)
    values (
      v_code, me.id, p_start, p_start + make_interval(mins => slot), p_topic, p_note,
      case when confirmed then 'confirmed' else 'pending' end,
      case when confirmed then nullif(s ->> 'defaultMeetLink', '') end
    ) returning * into result;
  exception when exclusion_violation then
    raise exception 'Bu saat az önce doldu. Lütfen başka bir saat seç.';
  end;
  return result;
end $$;

create or replace function public.cancel_my_appointment(p_id uuid, p_reason text)
returns public.appointments
language plpgsql security definer set search_path = public as $$
declare a appointments; s jsonb; result appointments;
begin
  select * into a from appointments where id = p_id and student_id = auth.uid() for update;
  if a.id is null then raise exception 'Randevu bulunamadı.'; end if;
  if a.status not in ('pending', 'confirmed') then raise exception 'Bu randevu zaten aktif değil.'; end if;
  select data into s from app_settings where id = 1;
  if a.start_at - now() < make_interval(hours => (s ->> 'cancelLimitHours')::int) then
    raise exception 'Randevuya % saatten az kaldığı için iptal edilemez. WhatsApp''tan bize yaz.', s ->> 'cancelLimitHours';
  end if;
  update appointments set status = 'cancelled', cancelled_by = 'student', cancel_reason = left(trim(coalesce(p_reason, '')), 300)
   where id = p_id returning * into result;
  return result;
end $$;

create or replace function public.mark_whatsapp_notified(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update appointments set whatsapp_notified_at = now()
   where id = p_id and (student_id = auth.uid() or public.is_admin());
$$;

drop function if exists public.update_my_profile(text, text);
create or replace function public.update_my_profile(p_name text, p_phone text, p_skool boolean default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Oturum yok.'; end if;
  update profiles set name = left(trim(p_name), 80), phone = p_phone, skool_member = coalesce(p_skool, skool_member)
   where id = auth.uid();
exception when unique_violation then
  raise exception 'Bu telefon numarası başka bir hesapta kayıtlı.';
end $$;

-- ---------------------------------------------------------------------
-- YÖNETİCİ FONKSİYONLARI
-- ---------------------------------------------------------------------
create or replace function public.admin_set_appointment_status(p_id uuid, p_status text, p_reason text default '')
returns public.appointments
language plpgsql security definer set search_path = public as $$
declare a appointments; s jsonb; result appointments;
begin
  if not is_admin() then raise exception 'Yetkin yok.'; end if;
  select * into a from appointments where id = p_id for update;
  if a.id is null then raise exception 'Randevu bulunamadı.'; end if;
  select data into s from app_settings where id = 1;
  begin
    update appointments set
      status = p_status,
      cancelled_by = case when p_status = 'cancelled' then 'admin' else cancelled_by end,
      cancel_reason = case when p_status = 'cancelled' then left(trim(coalesce(p_reason, '')), 300) else cancel_reason end,
      meet_link = case when p_status = 'confirmed' and meet_link is null then nullif(s ->> 'defaultMeetLink', '') else meet_link end
    where id = p_id returning * into result;
  exception when exclusion_violation then
    raise exception 'Bu saate başka bir randevu alınmış, geri açılamaz.';
  end;
  return result;
end $$;

create or replace function public.admin_set_user_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Yetkin yok.'; end if;
  if exists (select 1 from profiles where id = p_id and role = 'admin') then raise exception 'Bu hesap değiştirilemez.'; end if;
  update profiles set status = p_status where id = p_id;
  if p_status = 'disabled' then
    update appointments set status = 'cancelled', cancelled_by = 'admin', cancel_reason = 'Hesap askıya alındı'
     where student_id = p_id and status in ('pending', 'confirmed') and start_at > now();
  end if;
end $$;

-- ---------------------------------------------------------------------
-- GÜVENLİK (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.appointments enable row level security;
alter table public.app_settings enable row level security;
alter table public.app_secrets  enable row level security;
alter table public.student_channels enable row level security;
alter table public.google_integration enable row level security;
alter table public.oauth_states       enable row level security;
alter table public.external_busy      enable row level security;
-- Bu üç tabloya tarayıcıdan hiçbir erişim yok (sadece service role)
revoke all on public.google_integration, public.oauth_states, public.external_busy from anon, authenticated;

drop policy if exists "profil: kendin veya yönetici okur" on public.profiles;
create policy "profil: kendin veya yönetici okur" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "profil: yönetici günceller" on public.profiles;
create policy "profil: yönetici günceller" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "randevu: kendin veya yönetici okur" on public.appointments;
create policy "randevu: kendin veya yönetici okur" on public.appointments
  for select to authenticated using (student_id = auth.uid() or public.is_admin());
drop policy if exists "randevu: yönetici günceller" on public.appointments;
create policy "randevu: yönetici günceller" on public.appointments
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "kanal: kendin veya yönetici okur" on public.student_channels;
create policy "kanal: kendin veya yönetici okur" on public.student_channels
  for select to authenticated using (student_id = auth.uid() or public.is_admin());
drop policy if exists "kanal: kendin ekler" on public.student_channels;
create policy "kanal: kendin ekler" on public.student_channels
  for insert to authenticated with check (student_id = auth.uid() or public.is_admin());
drop policy if exists "kanal: kendin veya yönetici düzenler" on public.student_channels;
create policy "kanal: kendin veya yönetici düzenler" on public.student_channels
  for update to authenticated using (student_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or public.is_admin());
drop policy if exists "kanal: kendin veya yönetici siler" on public.student_channels;
create policy "kanal: kendin veya yönetici siler" on public.student_channels
  for delete to authenticated using (student_id = auth.uid() or public.is_admin());

drop policy if exists "ayar: giriş yapan okur" on public.app_settings;
create policy "ayar: giriş yapan okur" on public.app_settings
  for select to authenticated using (true);
drop policy if exists "ayar: yönetici günceller" on public.app_settings;
create policy "ayar: yönetici günceller" on public.app_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "gizli: yönetici" on public.app_secrets;
create policy "gizli: yönetici" on public.app_secrets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Öğrenciler tabloya doğrudan yazamaz; tüm yazma işlemleri yukarıdaki fonksiyonlardan geçer.
revoke insert, delete on public.appointments from anon, authenticated;
revoke insert, delete on public.profiles from anon, authenticated;

-- Fonksiyon yetkileri
revoke execute on function public.book_appointment(timestamptz, text, text) from public, anon;
revoke execute on function public.cancel_my_appointment(uuid, text) from public, anon;
revoke execute on function public.mark_whatsapp_notified(uuid) from public, anon;
revoke execute on function public.update_my_profile(text, text, boolean) from public, anon;
revoke execute on function public.admin_set_appointment_status(uuid, text, text) from public, anon;
revoke execute on function public.admin_set_user_status(uuid, text) from public, anon;
revoke execute on function public.busy_slots(timestamptz, timestamptz) from public, anon;
grant execute on function public.book_appointment(timestamptz, text, text) to authenticated;
grant execute on function public.cancel_my_appointment(uuid, text) to authenticated;
grant execute on function public.mark_whatsapp_notified(uuid) to authenticated;
grant execute on function public.update_my_profile(text, text, boolean) to authenticated;
grant execute on function public.admin_set_appointment_status(uuid, text, text) to authenticated;
grant execute on function public.admin_set_user_status(uuid, text) to authenticated;
grant execute on function public.busy_slots(timestamptz, timestamptz) to authenticated;
revoke execute on function public.replace_external_busy(jsonb) from public, anon, authenticated;
revoke execute on function public.google_try_lock(int) from public, anon, authenticated;
do $$ begin
  grant execute on function public.replace_external_busy(jsonb) to service_role;
  grant execute on function public.google_try_lock(int) to service_role;
exception when undefined_object then null;
end $$;
grant execute on function public.public_config() to anon, authenticated;
grant execute on function public.resolve_login(text) to anon, authenticated;
grant execute on function public.check_signup(text, text, text) to anon, authenticated;

-- Canlı güncelleme (yönetici paneli yeni randevuları anında görsün)
do $$ begin
  alter publication supabase_realtime add table public.appointments;
exception when duplicate_object or undefined_object then null;
end $$;
