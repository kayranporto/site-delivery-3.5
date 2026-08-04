# Configuração do Supabase — Multi Delivery

## Projeto configurado

- URL: `https://wzxsjxdbxonrmlmzufpv.supabase.co`
- Projeto: `wzxsjxdbxonrmlmzufpv`
- Chave usada no frontend: `anon` pública

## Instalação do banco

No painel do Supabase:

1. Abra o projeto correto.
2. Entre em **SQL Editor**.
3. Abra `delivery/supabase/SETUP-COMPLETO.sql`.
4. Cole o conteúdo inteiro no editor e execute.
5. Execute, em ordem, todos os arquivos de `delivery/supabase/migrations/001_delivery_core.sql` até `013_operacao_real.sql`. Em uma instalação criada pelo `SETUP-COMPLETO.sql`, comece pela `005_production_fixes.sql`.
6. Edite `delivery/supabase/CONFIGURAR-ADMIN.sql`, substitua o e-mail e execute.
7. Em **Database → Tables**, confirme as tabelas criadas.
8. Encerre a sessão do site e entre novamente para atualizar o acesso administrativo.
9. Faça cadastro de cliente e de restaurante pelo site.
10. Teste produto, estoque, região de entrega, pedido, cancelamento, fidelidade, suporte e aprovação administrativa.

O script cria e configura:

- `usuarios`
- `empresas`
- `categorias`
- `produtos`
- `grupos_adicionais`
- `adicionais`
- `produto_grupos`
- `pedidos`
- `pedido_itens`
- view `empresas_catalogo`
- trigger de criação automática de perfil/restaurante
- função `criar_pedido`
- índices e validações
- políticas RLS

## Atualização de uma instalação existente

Se o banco já estava configurado na versão anterior, execute:

1. `delivery/supabase/migrations/005_production_fixes.sql` (se ainda estiver pendente)
2. `delivery/supabase/migrations/006_pos_pedido.sql`
3. `delivery/supabase/migrations/007_painel_admin.sql`
4. `delivery/supabase/migrations/008_entregas_tempo_real.sql`
5. `delivery/supabase/migrations/009_hotfix_painel_admin.sql`
6. `delivery/supabase/migrations/010_admin_avancado.sql`
7. `delivery/supabase/migrations/011_foto_perfil.sql`
8. `delivery/supabase/migrations/012_experiencia_completa.sql`
9. `delivery/supabase/migrations/013_operacao_real.sql`

Essas migrações são obrigatórias antes de publicar o novo frontend. Elas adicionam:

- aprovação administrativa de novos restaurantes;
- cidade, UF, bairros e previsão de entrega;
- dados operacionais no pedido para o painel do restaurante;
- status de pagamento na entrega;
- validação transacional de cupons e primeiro pedido;
- transições seguras de status;
- proteção contra cadastro de restaurante antes da confirmação da conta.
- entregadores aprovados, atribuição de rotas e localização em tempo real;
- chat protegido por pedido e central de notificações;
- pedidos agendados e promoções com limites avançados;
- pagamentos online preparados para confirmação segura por webhook;
- logs de frontend e relatórios operacionais administrativos.
- horário de funcionamento, pausas e taxa de entrega por região;
- controle transacional de estoque e devolução automática em cancelamentos;
- cancelamento com análise, fila de reembolso e auditoria administrativa;
- fidelidade por restaurante, financeiro estimado e central de suporte;
- painel de saúde operacional com alertas de estoque e pendências.

A migração `006_pos_pedido.sql` cria a nota média pública por restaurante e
limita a edição da avaliação aos campos de nota e comentário. Ela também
converte com segurança o `empresa_id` antigo de UUID para texto.

Na primeira execução, restaurantes que já existiam permanecem publicados. Novos
restaurantes ficam com `publicado = false`; a aprovação deve ser feita por um
administrador no painel do Supabase, alterando esse campo para `true` depois da
conferência do cadastro.

## Fluxo de segurança

### Cliente

- pode consultar o catálogo público;
- pode visualizar e alterar somente seu próprio perfil;
- pode criar pedidos somente via `criar_pedido`;
- pode visualizar somente os próprios pedidos.

### Restaurante

- pode visualizar somente a própria empresa;
- pode atualizar somente a própria empresa;
- pode criar/editar/remover categorias e produtos da própria empresa;
- pode gerenciar grupos e adicionais da própria empresa;
- pode visualizar pedidos da própria empresa;
- pode atualizar somente o `status` dos pedidos da própria empresa.

### Público

O frontend não consulta diretamente a tabela `empresas` como catálogo. A página pública usa `empresas_catalogo`, que expõe apenas campos de catálogo.

## Importante

A chave `anon` é apropriada para uso no navegador. Nunca coloque uma chave `service_role` ou uma chave secreta no JavaScript publicado.

Depois da instalação, revise o **Security Advisor** e o **Performance Advisor** do Supabase.

O pagamento desta versão acontece diretamente ao restaurante na entrega. Não há
captura de cartão no site. Para pagamento online, integre um provedor com webhook
antes de alterar a interface para indicar pagamento antecipado.
