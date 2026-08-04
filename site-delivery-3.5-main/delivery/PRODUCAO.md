# Publicação segura — Multi Delivery 3.5

## Antes de publicar

1. Faça um backup do banco no Supabase e confirme que a restauração está disponível.
2. Execute as migrações em ordem até `supabase/migrations/013_operacao_real.sql`.
3. Confirme que nenhuma chave `service_role` aparece nos arquivos publicados.
4. Rode `npm test` na raiz do projeto.
5. Teste em uma conta de cliente, restaurante, entregador e administrador.

## Teste rápido obrigatório

- Cadastre um produto com estoque controlado e finalize um pedido.
- Confirme que o estoque baixou e que um pedido acima do saldo foi recusado.
- Solicite um cancelamento e aprove pelo painel do restaurante; confirme a devolução do estoque.
- Cadastre uma região, selecione um endereço do bairro e confira taxa, mínimo e previsão no checkout.
- Salve horários e confirme que a loja fecha automaticamente fora da agenda.
- Entregue um pedido com fidelidade ativa e confira os pontos na área do cliente.
- Abra um chamado e responda na administração.
- Simule um reembolso e confirme a auditoria e a notificação do cliente.

## Rotina operacional

- Diário: conferir a seção **Suporte e pendências** da administração.
- Semanal: revisar produtos com estoque baixo, cancelamentos e pagamentos pendentes.
- Mensal: exportar relatórios, revisar contas administrativas e testar restauração de backup.
- Antes de cada versão: trocar a versão do cache em `sw.js` para evitar arquivos antigos no PWA.

## Monitoramento

O frontend registra erros na infraestrutura já configurada em `js/monitoring.js`. O painel administrativo reúne chamados, cancelamentos, reembolsos, estoque baixo e lojas em pausa. Integrações externas de pagamento devem confirmar pagamento e reembolso apenas por função de servidor/webhook; nunca pelo navegador.
