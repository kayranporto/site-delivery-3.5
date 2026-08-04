"use strict";

(() => {
    const $ = (id) => document.getElementById(id);
    const criar = (tag, classe, texto) => { const item = document.createElement(tag); if (classe) item.className = classe; if (texto !== undefined) item.textContent = texto; return item; };
    let chamadoDados = [];
    let reembolsoDados = [];
    let cancelamentoDados = [];

    function solicitarResposta(chamado) {
        return new Promise((resolve) => {
            const overlay = criar("div", "ops-dialog"); const painel = criar("section", "ops-dialog-panel");
            painel.setAttribute("role", "dialog"); painel.setAttribute("aria-modal", "true");
            const campo = document.createElement("textarea"); campo.maxLength = 2000; campo.placeholder = "Escreva uma resposta clara para o cliente";
            const fecharLabel = criar("label", "ops-dialog-check"); const fechar = document.createElement("input"); fechar.type = "checkbox"; fechar.checked = true; fecharLabel.append(fechar, document.createTextNode(" Fechar chamado após responder"));
            const acoes = criar("div", "ops-dialog-actions"); const cancelar = criar("button", "secondary", "Cancelar"); const enviar = criar("button", "primary", "Enviar resposta"); cancelar.type = enviar.type = "button";
            const concluir = (valor) => { overlay.remove(); resolve(valor); }; cancelar.addEventListener("click", () => concluir(null)); overlay.addEventListener("click", (event) => { if (event.target === overlay) concluir(null); });
            enviar.addEventListener("click", () => { if (campo.value.trim().length < 3) { campo.setCustomValidity("Informe uma resposta."); campo.reportValidity(); return; } concluir({ resposta: campo.value.trim(), fechar: fechar.checked }); });
            acoes.append(cancelar,enviar); painel.append(criar("span", "admin-kicker", "ATENDIMENTO"),criar("h2", "", chamado.assunto),criar("p", "", chamado.mensagem),campo,fecharLabel,acoes); overlay.append(painel); document.body.append(overlay); campo.focus();
        });
    }

    function renderizarChamados() {
        const container = $("adminChamados"); container.replaceChildren();
        if (!chamadoDados.length) return container.append(criar("p", "admin-loading-inline", "Nenhum chamado pendente."));
        chamadoDados.forEach((chamado) => {
            const linha = criar("article", "ops-row"); const texto = criar("div");
            texto.append(criar("strong", "", chamado.assunto), criar("small", "", `${chamado.prioridade.toUpperCase()} • ${chamado.mensagem.slice(0, 150)}`));
            const acoes = criar("div", "ops-row-actions"); const responder = criar("button", "", "Responder"); responder.type = "button";
            responder.addEventListener("click", async () => {
                const formulario = await solicitarResposta(chamado); if (!formulario) return;
                responder.disabled = true;
                const { error } = await window.db.rpc("admin_responder_chamado", { p_chamado_id: chamado.id, p_resposta: formulario.resposta, p_fechar: formulario.fechar });
                responder.disabled = false;
                if (error) return window.AppToast?.("Falha no atendimento", App.mensagemErro(error), "error");
                chamadoDados = chamadoDados.filter((item) => item.id !== chamado.id); renderizarChamados(); carregar();
                window.AppToast?.("Resposta enviada", "O cliente recebeu uma notificação.", "success");
            });
            acoes.append(responder); linha.append(texto, acoes); container.append(linha);
        });
    }

    function renderizarReembolsos() {
        const container = $("adminReembolsos"); container.replaceChildren();
        if (!reembolsoDados.length && !cancelamentoDados.length) return container.append(criar("p", "admin-loading-inline", "Nenhuma pendência financeira ou de cancelamento."));
        cancelamentoDados.forEach((pedido) => {
            const linha = criar("article", "ops-row"); const texto = criar("div");
            texto.append(criar("strong", "", `Cancelamento #${pedido.numero || String(pedido.id).slice(0, 8)} • ${pedido.empresa_nome}`), criar("small", "", pedido.cancelamento_motivo || "Motivo não informado"));
            const acoes = criar("div", "ops-row-actions"); const aprovar = criar("button", "", "Aprovar"); const recusar = criar("button", "", "Recusar");
            aprovar.type = recusar.type = "button";
            const decidir = async (valor, botao) => { botao.disabled = true; const { error } = await window.db.rpc("empresa_decidir_cancelamento", { p_pedido_id: pedido.id, p_aprovar: valor, p_observacao: "Analisado pela administração" }); botao.disabled = false; if (error) return window.AppToast?.("Falha ao decidir", App.mensagemErro(error), "error"); cancelamentoDados = cancelamentoDados.filter((item) => item.id !== pedido.id); renderizarReembolsos(); await carregarSaude(); };
            aprovar.addEventListener("click", () => decidir(true, aprovar)); recusar.addEventListener("click", () => decidir(false, recusar)); acoes.append(aprovar, recusar); linha.append(texto, acoes); container.append(linha);
        });
        reembolsoDados.forEach((pedido) => {
            const linha = criar("article", "ops-row"); const texto = criar("div");
            texto.append(criar("strong", "", `Pedido #${pedido.numero || String(pedido.id).slice(0, 8)} • ${pedido.empresa_nome}`), criar("small", "", `${pedido.cliente_nome || "Cliente"} • ${App.dinheiro(pedido.total)} • ${pedido.reembolso_status}`));
            const acoes = criar("div", "ops-row-actions"); const select = document.createElement("select");
            [["pendente","Pendente"],["processando","Processando"],["concluido","Concluído"],["falhou","Falhou"]].forEach(([valor,nome]) => { const option = document.createElement("option"); option.value = valor; option.textContent = nome; option.selected = pedido.reembolso_status === valor; select.append(option); });
            const salvar = criar("button", "", "Salvar"); salvar.type = "button";
            salvar.addEventListener("click", async () => {
                salvar.disabled = true; const { error } = await window.db.rpc("admin_atualizar_reembolso", { p_pedido_id: pedido.id, p_status: select.value }); salvar.disabled = false;
                if (error) return window.AppToast?.("Falha no reembolso", App.mensagemErro(error), "error");
                if (["concluido","falhou"].includes(select.value)) reembolsoDados = reembolsoDados.filter((item) => item.id !== pedido.id); else pedido.reembolso_status = select.value;
                renderizarReembolsos(); carregarSaude(); window.AppToast?.("Reembolso atualizado", "O cliente foi notificado.", "success");
            });
            acoes.append(select,salvar); linha.append(texto,acoes); container.append(linha);
        });
    }

    async function carregarSaude() {
        const { data, error } = await window.db.rpc("admin_saude_operacao");
        if (error) throw error;
        $("opsChamados").textContent = String(data.chamados_abertos || 0); $("opsCancelamentos").textContent = String(data.cancelamentos_pendentes || 0); $("opsReembolsos").textContent = String(data.reembolsos_pendentes || 0); $("opsEstoque").textContent = String(data.produtos_estoque_baixo || 0); $("opsPausas").textContent = String(data.restaurantes_pausados || 0); $("suporteMenu").textContent = String(data.chamados_abertos || 0);
        const totalCritico = Number(data.chamados_abertos || 0) + Number(data.cancelamentos_pendentes || 0) + Number(data.reembolsos_pendentes || 0);
        $("saudeOperacaoTexto").textContent = totalCritico ? `${totalCritico} pendência${totalCritico === 1 ? "" : "s"} para analisar` : "Operação normal";
        $("saudeOperacao").classList.toggle("warning", totalCritico > 0 && totalCritico < 5); $("saudeOperacao").classList.toggle("danger", totalCritico >= 5);
    }

    async function carregar() {
        const { data: admin } = await window.db.rpc("usuario_eh_admin"); if (admin !== true) return;
        const [chamados, reembolsos, cancelamentos] = await Promise.all([
            window.db.from("chamados_suporte").select("id,assunto,mensagem,status,prioridade,created_at").in("status", ["aberto","em_analise"]).order("prioridade", { ascending: false }).order("created_at").limit(50),
            window.db.from("pedidos").select("id,numero,empresa_nome,cliente_nome,total,reembolso_status").in("reembolso_status", ["pendente","processando"]).order("updated_at").limit(50),
            window.db.from("pedidos").select("id,numero,empresa_nome,cliente_nome,cancelamento_motivo").eq("cancelamento_status", "solicitado").order("cancelamento_solicitado_em").limit(50)
        ]);
        if (chamados.error) throw chamados.error; if (reembolsos.error) throw reembolsos.error; if (cancelamentos.error) throw cancelamentos.error;
        chamadoDados = chamados.data || []; reembolsoDados = reembolsos.data || []; cancelamentoDados = cancelamentos.data || [];
        renderizarChamados(); renderizarReembolsos(); await carregarSaude();
    }

    $("atualizarOperacaoAdmin")?.addEventListener("click", () => carregar().catch((error) => window.AppToast?.("Falha ao atualizar", App.mensagemErro(error), "error")));
    carregar().catch((error) => { console.warn("Operação 3.5 aguardando migração:", error); $("saudeOperacaoTexto").textContent = "Execute a migração 013"; $("saudeOperacao").classList.add("warning"); });
})();
