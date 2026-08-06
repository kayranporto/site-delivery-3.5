# Autenticação — Multi Delivery 4.2.0

## Cadastro sem confirmação de e-mail

O fluxo de cliente e restaurante exige que o Supabase devolva uma sessão no próprio `signUp`. A aplicação não mostra mais a etapa “confirme seu e-mail”.

### Projeto hospedado

No Supabase Dashboard, abra **Authentication → Providers → Email** e desative **Confirm email**.

Alternativamente, execute com um token pessoal que tenha permissão de configuração do projeto:

```bash
export SUPABASE_ACCESS_TOKEN="seu-token-pessoal"
npm run configure:auth:no-confirm
```

O script não armazena o token. Ele também define senha mínima de 8 caracteres, ativa verificação de senhas vazadas e mantém a confirmação segura para troca de e-mail.

## Controles compensatórios obrigatórios

Desativar confirmação de e-mail aumenta a facilidade de criar contas com endereços inexistentes ou pertencentes a terceiros. Antes da produção:

1. configure Cloudflare Turnstile ou hCaptcha no Supabase Auth;
2. preencha `turnstileSiteKey` em `js/config.js`;
3. ajuste rate limits de cadastro, login e recuperação;
4. mantenha a proteção contra senhas vazadas ativa;
5. monitore cadastros, tentativas e abuso por IP no provedor de borda.

O e-mail continua necessário para recuperação de senha e comunicações operacionais. Alterar o e-mail da conta continua sendo uma operação confirmada.
