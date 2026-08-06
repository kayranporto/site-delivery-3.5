#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_ACCESS_TOKEN:?Defina SUPABASE_ACCESS_TOKEN com um token pessoal do Supabase}"
PROJECT_REF="${PROJECT_REF:-wzxsjxdbxonrmlmzufpv}"

curl --fail-with-body --silent --show-error \
  -X PATCH "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "mailer_autoconfirm": true,
    "password_min_length": 8,
    "password_hibp_enabled": true,
    "mailer_secure_email_change_enabled": true
  }'

printf '\nAuth atualizado: cadastro sem confirmação, senha mínima 8 e proteção HIBP ativada.\n'
