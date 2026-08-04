# Multi Delivery 3.1 — entregas em tempo real

## Antes de publicar

1. No SQL Editor do Supabase, execute a versão incluída neste pacote de `delivery/supabase/migrations/005_production_fixes.sql`.
2. Em seguida, execute a versão incluída neste pacote de `delivery/supabase/migrations/006_pos_pedido.sql`.
3. Execute `delivery/supabase/migrations/007_painel_admin.sql`.
4. Edite e execute `delivery/supabase/CONFIGURAR-ADMIN.sql` com o e-mail da conta administradora.
5. Execute `delivery/supabase/migrations/008_entregas_tempo_real.sql`.
6. Encerre a sessão e entre novamente para renovar as permissões.
7. Publique os arquivos da pasta `delivery`.
8. Recarregue o site. O service worker foi atualizado para substituir CSS e JavaScript antigos.

## Principais correções

- CSS completo para painel, formulários, métricas, tabelas e páginas internas.
- Cache do service worker atualizado para não conservar CSS antigo após deploy.
- Todos os arquivos CSS e JavaScript receberam versionamento de URL para impedir que o GitHub Pages reutilize recursos antigos.
- Painel do restaurante mostra cliente, telefone, endereço, adicionais, observações e pagamento.
- Faturamento considera somente pedidos entregues e pagos.
- Gerenciamento de grupos de adicionais, opções e vínculos com produtos.
- Endereços estruturados e salvos por usuário no Supabase.
- Dados privados locais são removidos no logout e isolados na troca de conta.
- Checkout confirma preços atuais antes de criar o pedido.
- Pagamento foi esclarecido como pagamento na entrega, com campo de troco.
- Cupons são validados no banco, inclusive o limite de primeiro pedido.
- Novos restaurantes ficam pendentes até aprovação administrativa.
- Cidade, UF, bairros atendidos e previsão de entrega configuráveis.
- Transições de status e status de pagamento validados no banco.
- Filtros, teclado, foco de modal/carrinho e experiência móvel corrigidos.
- Migrações compatíveis com bancos antigos que usavam `titulo/rua/estado`, cupons simplificados e `avaliacoes.empresa_id` como UUID.

## Nova área do cliente

- Perfil reorganizado como painel, com identidade visual consistente e melhor uso do espaço.
- Resumo de pedidos realizados, pedidos em andamento, favoritos e economia com cupons.
- Destaque automático para o pedido ativo ou mais recente, com status e acesso ao acompanhamento.
- Indicador de conclusão do cadastro baseado em dados pessoais e endereço salvo.
- Atalhos mais claros para pedidos, favoritos, endereços, dados e segurança.
- Layout responsivo em duas colunas no desktop e compacto no celular.

## Home moderna

- Destaque inicial redesenhado com degradês mais vivos, contraste e profundidade.
- Entrada escalonada do conteúdo, brilho suave, elementos flutuantes e botão com reflexo animado.
- Leve efeito 3D no destaque ao movimentar o mouse ou trackpad.
- Estatísticas em cartões modernos, chamadas mais claras e nova hierarquia de cores.
- Animações reduzidas automaticamente em dispositivos móveis e para usuários que preferem menos movimento.

## Pós-pedido e reputação

- Histórico redesenhado com filtros e contadores para pedidos em andamento, entregues e cancelados.
- Recibo detalhado com subtotal, entrega, desconto, cupom, observações e opção de imprimir ou salvar em PDF.
- Ação “Pedir novamente” que consulta disponibilidade e preços atuais antes de reconstruir o carrinho.
- Avaliação de 1 a 5 estrelas após a entrega, com comentário opcional e possibilidade de edição.
- Nota média e quantidade de avaliações exibidas nos cartões e na página do restaurante.
- Navegação por teclado, mensagens de estado e respeito à preferência por movimento reduzido.

## Painel do restaurante 3.0

- Pedidos organizados em Kanban: recebidos, preparando, em entrega e finalizados.
- Alertas sonoros, notificações do navegador e destaque visual para novos pedidos.
- Filtros por período e status, busca por cliente, número ou produto e atualização manual.
- Faturamento diário, semanal, mensal ou de todo o período.
- Gráfico de vendas, ticket médio, pedidos ativos e produtos mais vendidos.
- Cardápio, adicionais e configurações reorganizados em uma navegação lateral responsiva.

## Painel administrativo

- Acesso protegido por função administrativa e políticas RLS.
- Botão “Painel admin” no cabeçalho da página inicial para contas administradoras.
- Atalho administrativo destacado também dentro da página “Minha conta”.
- Indicadores globais de restaurantes, usuários, pedidos e volume processado.
- Aprovação e suspensão de restaurantes sem expor permissão de publicação ao proprietário.
- Bloqueio reversível de novos pedidos por usuário, preservando conta e histórico.
- Ativação e pausa de cupons globais ou dos restaurantes.
- Monitoramento dos pedidos recentes e gráfico dos últimos sete dias.

## Entregas em tempo real 3.1

- Cadastro e aprovação administrativa de entregadores.
- Painel responsivo para ficar online, aceitar rotas e atualizar a entrega.
- Localização aproximada do entregador exibida ao cliente em mapa.
- Chat protegido por pedido entre cliente, restaurante e entregador.
- Notificações persistentes, alertas do navegador e base para Web Push.
- Pedidos agendados entre 30 minutos e sete dias.
- Cupons por restaurante com validade, teto de desconto e limite por cliente.
- Respostas públicas dos restaurantes às avaliações.
- Relatórios administrativos por período e exportação CSV.
- Monitoramento de erros do frontend sem armazenar senhas ou dados de cartão.
- Recuperação de senha completa com página segura para definir a nova senha.
- SEO técnico com dados estruturados, sitemap e robots.txt.
- Testes automatizados de regras de pedido e integridade dos arquivos.

## Pagamento online

- Integração preparada com Checkout Pro do Mercado Pago em Edge Functions.
- PIX e cartão são processados no ambiente hospedado do provedor.
- O status de pagamento é atualizado somente após webhook validado.
- Requer credenciais e publicação das funções conforme `CONFIGURAR-3.1.md`.

## Limites desta versão

- Não há gateway de pagamento online. PIX, cartão e dinheiro são pagos diretamente ao restaurante.
- A aprovação de CNPJ é manual no Supabase; não existe integração com um verificador externo.
- Não há painel separado para entregadores. O restaurante continua responsável pela entrega e pelo status do pedido.
