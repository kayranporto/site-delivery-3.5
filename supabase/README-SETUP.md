# Configuração do Supabase — Multi Delivery 4.0

## Princípios

- Use projetos separados para desenvolvimento, homologação e produção.
- Nunca publique `service_role`, secret key ou credenciais do Mercado Pago.
- A chave pública do cliente depende de RLS corretamente configurado.
- Toda alteração de schema deve ser versionada por migration e validada antes da produção.

## Instalação nova

1. Crie o projeto Supabase.
2. Configure as opções do Auth e as URLs permitidas.
3. Aplique o schema base e as migrations em ordem, de `001_delivery_core.sql` até `014_producao_financeira.sql`.
4. Execute `CONFIGURAR-ADMIN.sql` depois de substituir o e-mail de exemplo.
5. Revise Security Advisor e Performance Advisor.
6. Verifique as 31 tabelas públicas e confirme RLS habilitado em todas.
7. Configure Storage, webhooks e Edge Functions.
8. Execute os testes funcionais de `PRODUCAO.md`.

Não aplique `SETUP-COMPLETO.sql` e todas as migrations cegamente no mesmo banco sem verificar a versão de origem. Em bancos existentes, use somente as migrations ainda não aplicadas.

## Atualização da versão 3.5

Aplique:

```text
supabase/migrations/014_producao_financeira.sql
```

A migration:

- cria `pagamento_eventos` com RLS e chave de idempotência;
- adiciona identificadores e estados de conciliação aos pedidos;
- substitui a criação de pedido por snapshot único de preços;
- corrige devolução de cupom no cancelamento;
- trata pagamento tardio após cancelamento;
- disponibiliza RPCs exclusivas do serviço de pagamento;
- adiciona relatório administrativo de conciliação.

## Verificações após migration

No SQL Editor, confirme:

```sql
select relname, relrowsecurity
from pg_class
join pg_namespace on pg_namespace.oid = pg_class.relnamespace
where pg_namespace.nspname = 'public'
  and relkind = 'r'
order by relname;
```

Confirme também:

```sql
select proname, prosecdef
from pg_proc
join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
where pg_namespace.nspname in ('public', 'private')
order by proname;
```

Revise manualmente qualquer função `SECURITY DEFINER`, seus grants e seu `search_path`.

## Data API

A exposição de tabelas pela Data API e RLS são controles distintos. Caso o projeto use configuração restritiva de schemas/tabelas, ajuste também os grants de `anon` e `authenticated`; nunca conceda acesso público sem RLS compatível.

## Administração

A autorização administrativa deve permanecer em `app_metadata`, não em `user_metadata`. Depois de alterar o papel administrativo, encerre as sessões existentes e entre novamente para obter claims atualizadas.
