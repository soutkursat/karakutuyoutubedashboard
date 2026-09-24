-- =====================================================================
--  YÖNETİCİ HESABINI TANIMLA (bir kez çalıştır)
--  1) Supabase → Authentication → Users → "Add user" → "Create new user"
--     E-posta: kendi e-postan · Şifre: güçlü bir şifre · "Auto Confirm User" işaretli
--  2) Aşağıdaki e-postayı kendi e-postanla değiştirip SQL Editor'de çalıştır.
--  Sonra giriş ekranında kullanıcı adı "kursatyoutube" VEYA e-postanla girebilirsin.
-- =====================================================================
update public.profiles
   set role = 'admin', username = 'kursatyoutube', name = 'Kürşat', phone = '905377935090'
 where email = lower('BURAYA-EPOSTANI-YAZ@gmail.com');

-- Kontrol: 1 satır "admin" görmelisin
select id, email, username, role from public.profiles where role = 'admin';
