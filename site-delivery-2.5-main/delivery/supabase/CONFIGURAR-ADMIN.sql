-- Execute somente depois de 007_painel_admin.sql.
-- Substitua SEU_EMAIL_AQUI pelo e-mail real da conta administradora.

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"role":"admin"}'::jsonb
where lower(email) = lower('kayranporto12@gmail.com');

-- Confirmação: deve retornar uma linha com role = admin.
select
  id,
  email,
  raw_app_meta_data ->> 'role' as role
from auth.users
where lower(email) = lower('kayranporto12@gmail.com');

-- Após executar, encerre a sessão no site e entre novamente para renovar o JWT.
