# Funções de pagamento — Multi Delivery 3.1

O checkout online usa o Checkout Pro hospedado pelo Mercado Pago. Nenhum dado
de cartão passa pelo frontend.

## Segredos necessários

Configure no Supabase, sem colocar os valores em arquivos públicos:

```bash
supabase secrets set MERCADO_PAGO_ACCESS_TOKEN="SEU_ACCESS_TOKEN"
supabase secrets set MERCADO_PAGO_WEBHOOK_SECRET="SUA_ASSINATURA_WEBHOOK"
supabase secrets set SITE_URL="https://SEU-DOMINIO/delivery"
supabase secrets set VAPID_PUBLIC_KEY="SUA_CHAVE_PUBLICA"
supabase secrets set VAPID_PRIVATE_KEY="SUA_CHAVE_PRIVADA"
supabase secrets set VAPID_SUBJECT="mailto:seu-email@dominio.com"
supabase secrets set PUSH_WEBHOOK_SECRET="UM_SEGREDO_ALEATORIO_LONGO"
```

## Publicação

```bash
supabase functions deploy criar-pagamento
supabase functions deploy mercado-pago-webhook --no-verify-jwt
supabase functions deploy enviar-push --no-verify-jwt
```

No painel do Mercado Pago, cadastre o evento **Pagamentos** apontando para:

```text
https://SEU-PROJETO.supabase.co/functions/v1/mercado-pago-webhook
```

Use credenciais de teste antes das credenciais de produção. O webhook valida
`x-signature`, consulta o pagamento na API oficial e somente então atualiza o
pedido usando a credencial interna da função.

## Notificações push

1. Copie a mesma `VAPID_PUBLIC_KEY` para `delivery/js/config.js`.
2. Em **Database → Webhooks**, crie um webhook para `INSERT` em
   `public.notificacoes`.
3. Use a URL `https://SEU-PROJETO.supabase.co/functions/v1/enviar-push`.
4. Envie o header `x-delivery-webhook-secret` com o mesmo valor configurado em
   `PUSH_WEBHOOK_SECRET`.

Sem as chaves VAPID, a central de notificações e os alertas enquanto o site
está aberto continuam funcionando normalmente.
