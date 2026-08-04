# Configuração da versão 3.4

## 1. Atualizar o banco

No SQL Editor do Supabase, execute nesta ordem:

1. `delivery/supabase/migrations/007_painel_admin.sql`, caso ainda esteja pendente.
2. `delivery/supabase/migrations/008_entregas_tempo_real.sql`.
3. `delivery/supabase/migrations/009_hotfix_painel_admin.sql`.
4. `delivery/supabase/migrations/010_admin_avancado.sql`.
5. `delivery/supabase/migrations/011_foto_perfil.sql`.
6. `delivery/supabase/migrations/012_experiencia_completa.sql`.
7. `delivery/supabase/CONFIGURAR-ADMIN.sql`, caso a conta administradora ainda não tenha sido definida.

Depois, encerre a sessão do site e entre novamente.

### Erro `pedidos.pagamento_modalidade does not exist`

Esse erro significa que a atualização 008 não foi aplicada por completo no
mesmo projeto Supabase usado pelo site. Execute novamente a 008 e, logo depois,
a 009. A migração 009 é segura para repetição e força a atualização do cache de
schema da API. Em seguida, recarregue o painel com `Ctrl + F5`.

O painel também possui modo de compatibilidade: se uma tabela opcional
ainda estiver pendente, as demais áreas continuam carregando e uma faixa de
aviso informa quais migrações precisam ser executadas.

## Recursos administrativos da versão 3.2

Depois de executar a migração 010, a administração passa a oferecer:

- criação, edição, ativação, pausa e exclusão de cupons;
- edição segura dos dados e da publicação dos restaurantes;
- listagem de pedidos com busca, período, restaurante, status e pagamento;
- detalhes do pedido com itens, valores, endereço e linha do tempo;
- exportação CSV respeitando os filtros ativos;
- histórico das ações administrativas;
- modais de confirmação, paginação e atalhos de teclado;
- seletor persistente de letras normais, grandes ou extragrandes.

As operações de escrita usam funções protegidas do banco e ficam registradas
em `admin_auditoria`. O atalho `Ctrl + K` leva diretamente à busca de pedidos.

### Correção do carrinho na versão 3.2.1

Os módulos do restaurante, personalização de produto e carrinho foram isolados
para evitar colisões entre variáveis JavaScript. Esta correção não exige uma
nova migração: publique os arquivos atualizados e use `Ctrl + F5`.

### Foto de perfil na versão 3.3

Execute `011_foto_perfil.sql` para criar a coluna `avatar_url`, o bucket público
`avatars` e as políticas de escrita. Cada cliente só pode alterar o arquivo
`avatar` dentro da própria pasta. A interface aceita JPG, PNG e WEBP, recorta a
foto em formato quadrado e gera uma versão otimizada de 512 × 512 pixels.

### Experiência completa na versão 3.4

Execute `012_experiencia_completa.sql` para ativar:

- upload protegido de fotos de produtos, logotipo e banner;
- favoritos sincronizados com a conta do cliente;
- foto e nome do cliente em avaliações e mensagens;
- registro pseudonimizado de tentativas de acesso;
- relatórios de produtos mais vendidos e clientes recorrentes;
- políticas RLS para os novos dados e arquivos.

Depois da migração, o painel do restaurante passa a aceitar arquivos JPG, PNG
e WEBP diretamente. As imagens são recortadas e comprimidas no navegador antes
do envio. O checkout também passa a recuperar o carrinho, exibir previsão e
endereço no mapa e solicitar confirmação antes de enviar o pedido.

## 2. Publicar o frontend

Publique toda a pasta `delivery`, incluindo os novos arquivos:

- `entregador.html`;
- `nova-senha.html`;
- `robots.txt` e `sitemap.xml`;
- novos arquivos em `css`, `js`, `supabase/functions` e `supabase/migrations`.

Após a publicação, use `Ctrl + F5` uma vez para substituir o cache anterior.

## 3. Pagamento online opcional

O pedido e o pagamento na entrega funcionam sem esta etapa. Para ativar PIX e
cartão online, siga `delivery/supabase/functions/README.md` e publique as
funções:

```bash
supabase functions deploy criar-pagamento
supabase functions deploy mercado-pago-webhook --no-verify-jwt
```

Configure primeiro as credenciais de teste do Mercado Pago. Nunca coloque o
Access Token no JavaScript ou no GitHub.

## 4. Notificações push opcionais

A central interna e as notificações com o site aberto funcionam imediatamente.
Para alertas com o site fechado:

1. gere um par de chaves VAPID;
2. configure os segredos descritos no README das funções;
3. coloque somente a chave pública em `delivery/js/config.js`;
4. publique `enviar-push` e configure o Database Webhook.

## 5. Fluxo de teste recomendado

1. Cadastre uma conta de entregador em `entregador.html`.
2. Aprove a conta em **Administração → Entregadores**.
3. Faça um pedido de cliente e avance o restaurante para **Preparando**.
4. Deixe o entregador online e aceite a rota.
5. Teste chat, localização, saída para entrega e confirmação final.
6. Faça uma avaliação e responda pelo painel do restaurante.
7. Confira os indicadores em **Administração → Relatórios**.

Para executar os testes locais:

```bash
npm test
```
