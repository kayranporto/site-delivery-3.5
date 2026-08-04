"use strict";

let empresa = null;
let categorias = [];
let produtos = [];
let produtoEditandoId = null;
let pedidos = [];
let gruposAdicionais = [];
let adicionaisEmpresa = [];
let vinculosProdutoGrupo = [];
let cuponsEmpresa = [];
let avaliacoesEmpresa = [];
let filtroPeriodo = "hoje";
let filtroStatusPedido = "todos";
let buscaPedido = "";
let audioContexto = null;
let alertasAtivos = localStorage.getItem("alertasRestaurante") === "true";

const listaPedidos = document.getElementById("pedidosEmpresa");
const listaProdutos = document.getElementById("produtosEmpresa");
const categoriasContainer = document.getElementById("categoriasEmpresa");
const categoriaSelect = document.getElementById("produtoCategoria");
const statusEmpresa = document.getElementById("statusEmpresa");
const gruposContainer = document.getElementById("gruposAdicionaisEmpresa");
const adicionalGrupoSelect = document.getElementById("adicionalGrupo");
const vinculoProdutoSelect = document.getElementById("vinculoProduto");
const vinculoGrupoSelect = document.getElementById("vinculoGrupo");

function linhaVazia(colunas, mensagem) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = colunas;
    td.textContent = mensagem;
    tr.append(td);
    return tr;
}

function textoStatus(status) {
    return ({
        recebido: "Recebido",
        preparando: "Preparando",
        saiu_para_entrega: "Em entrega",
        entregue: "Entregue",
        cancelado: "Cancelado"
    })[status] || "Recebido";
}

function inicioDoPeriodo() {
    const agora = new Date();
    if (filtroPeriodo === "todos") return new Date(0);
    if (filtroPeriodo === "hoje") return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const dias = filtroPeriodo === "30d" ? 30 : 7;
    return new Date(agora.getTime() - (dias - 1) * 86400000);
}

function pedidosNoPeriodo() {
    const inicio = inicioDoPeriodo().getTime();
    return pedidos.filter((pedido) => {
        const data = new Date(pedido.created_at).getTime();
        return Number.isFinite(data) && data >= inicio;
    });
}

function criarElemento(tag, classe, texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
}

function renderizarGrafico(lista) {
    const container = document.getElementById("vendasChart");
    const vendas = lista.filter((pedido) => pedido.status === "entregue" && pedido.pagamento_status === "pago");
    const agora = new Date();
    const hoje = filtroPeriodo === "hoje";
    const dias = filtroPeriodo === "30d" ? 30 : 7;
    const grupos = [];

    if (hoje) {
        for (let hora = 0; hora < 24; hora += 4) grupos.push({ chave: hora, label: `${String(hora).padStart(2, "0")}h`, valor: 0 });
        vendas.forEach((pedido) => {
            const data = new Date(pedido.created_at);
            const grupo = grupos[Math.floor(data.getHours() / 4)];
            if (grupo) grupo.valor += Number(pedido.total || 0);
        });
    } else if (filtroPeriodo === "todos") {
        const datasValidas = lista.map((pedido) => new Date(pedido.created_at)).filter((data) => Number.isFinite(data.getTime()));
        const primeira = datasValidas.length ? new Date(Math.min(...datasValidas.map((data) => data.getTime()))) : agora;
        const cursor = new Date(primeira.getFullYear(), primeira.getMonth(), 1);
        while (cursor <= agora) {
            grupos.push({
                chave: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
                label: cursor.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(" de ", "/"),
                valor: 0
            });
            cursor.setMonth(cursor.getMonth() + 1);
        }
        vendas.forEach((pedido) => {
            const data = new Date(pedido.created_at);
            const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
            const grupo = grupos.find((item) => item.chave === chave);
            if (grupo) grupo.valor += Number(pedido.total || 0);
        });
    } else {
        for (let indice = dias - 1; indice >= 0; indice -= 1) {
            const data = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - indice);
            grupos.push({ chave: data.toISOString().slice(0, 10), label: data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), valor: 0 });
        }
        vendas.forEach((pedido) => {
            const data = new Date(pedido.created_at);
            const chave = new Date(data.getFullYear(), data.getMonth(), data.getDate()).toISOString().slice(0, 10);
            const grupo = grupos.find((item) => item.chave === chave);
            if (grupo) grupo.valor += Number(pedido.total || 0);
        });
    }

    const total = grupos.reduce((soma, grupo) => soma + grupo.valor, 0);
    document.getElementById("vendasChartResumo").textContent = App.dinheiro(total);
    container.replaceChildren();

    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 720 230");
    svg.setAttribute("preserveAspectRatio", "none");
    const defs = document.createElementNS(ns, "defs");
    const gradient = document.createElementNS(ns, "linearGradient");
    gradient.id = "chartGradient";
    gradient.setAttribute("x1", "0"); gradient.setAttribute("y1", "0"); gradient.setAttribute("x2", "0"); gradient.setAttribute("y2", "1");
    [["0%", "#ef2435", ".25"], ["100%", "#ef2435", "0"]].forEach(([offset, cor, opacidade]) => {
        const stop = document.createElementNS(ns, "stop"); stop.setAttribute("offset", offset); stop.setAttribute("stop-color", cor); stop.setAttribute("stop-opacity", opacidade); gradient.append(stop);
    });
    defs.append(gradient); svg.append(defs);
    const maximo = Math.max(...grupos.map((item) => item.valor), 1);
    const esquerda = 42; const direita = 708; const topo = 14; const base = 194;
    for (let linha = 0; linha <= 4; linha += 1) {
        const y = topo + (base - topo) * linha / 4;
        const grade = document.createElementNS(ns, "line"); grade.setAttribute("x1", esquerda); grade.setAttribute("x2", direita); grade.setAttribute("y1", y); grade.setAttribute("y2", y); grade.setAttribute("class", "chart-grid"); svg.append(grade);
        const label = document.createElementNS(ns, "text"); label.setAttribute("x", "0"); label.setAttribute("y", y + 3); label.setAttribute("class", "chart-label"); label.textContent = App.dinheiro(maximo * (4 - linha) / 4).replace("R$ ", ""); svg.append(label);
    }
    const pontos = grupos.map((grupo, indice) => ({
        x: esquerda + (grupos.length === 1 ? 0 : (direita - esquerda) * indice / (grupos.length - 1)),
        y: base - (grupo.valor / maximo) * (base - topo),
        ...grupo
    }));
    const caminho = pontos.map((ponto, indice) => `${indice ? "L" : "M"}${ponto.x.toFixed(1)},${ponto.y.toFixed(1)}`).join(" ");
    const area = document.createElementNS(ns, "path"); area.setAttribute("d", `${caminho} L${pontos.at(-1).x},${base} L${pontos[0].x},${base} Z`); area.setAttribute("class", "chart-area"); svg.append(area);
    const linha = document.createElementNS(ns, "path"); linha.setAttribute("d", caminho); linha.setAttribute("class", "chart-line"); svg.append(linha);
    const passoLabel = Math.max(1, Math.ceil(grupos.length / 8));
    pontos.forEach((ponto, indice) => {
        const circulo = document.createElementNS(ns, "circle"); circulo.setAttribute("cx", ponto.x); circulo.setAttribute("cy", ponto.y); circulo.setAttribute("r", "3.5"); circulo.setAttribute("class", "chart-point"); svg.append(circulo);
        if (indice % passoLabel === 0 || indice === pontos.length - 1) {
            const label = document.createElementNS(ns, "text"); label.setAttribute("x", ponto.x); label.setAttribute("y", "218"); label.setAttribute("text-anchor", "middle"); label.setAttribute("class", "chart-label"); label.textContent = ponto.label; svg.append(label);
        }
    });
    container.setAttribute("aria-label", `Faturamento no período: ${App.dinheiro(total)}`);
    container.append(svg);
}

function renderizarMaisVendidos(lista) {
    const container = document.getElementById("produtosMaisVendidos");
    const contagem = new Map();
    lista.filter((pedido) => pedido.status === "entregue").forEach((pedido) => {
        (pedido.pedido_itens || []).forEach((item) => {
            const nome = item.nome_produto || "Produto";
            const atual = contagem.get(nome) || { quantidade: 0, valor: 0 };
            const quantidade = Number(item.quantidade || 1);
            const extras = (Array.isArray(item.adicionais) ? item.adicionais : []).reduce((soma, adicional) => soma + Number(adicional.preco || 0), 0);
            atual.quantidade += quantidade;
            atual.valor += (Number(item.preco_unitario || 0) + extras) * quantidade;
            contagem.set(nome, atual);
        });
    });
    const ranking = [...contagem].sort((a, b) => b[1].quantidade - a[1].quantidade).slice(0, 5);
    container.replaceChildren();
    if (!ranking.length) {
        container.append(criarElemento("div", "empty-state", "Os produtos mais vendidos aparecerão após as primeiras entregas."));
        return;
    }
    const maximo = ranking[0][1].quantidade;
    ranking.forEach(([nome, dados], indice) => {
        const item = criarElemento("div", "top-product");
        const posicao = criarElemento("span", "", String(indice + 1));
        const info = criarElemento("div");
        info.append(criarElemento("strong", "", nome), criarElemento("small", "", `${dados.quantidade} vendidos • ${App.dinheiro(dados.valor)}`));
        const barra = criarElemento("div", "product-bar");
        const preenchimento = criarElemento("i"); preenchimento.style.width = `${(dados.quantidade / maximo) * 100}%`; barra.append(preenchimento); info.append(barra);
        item.append(posicao, info, criarElemento("em", "", `${dados.quantidade}x`)); container.append(item);
    });
}

function atualizarIndicadores() {
    const lista = pedidosNoPeriodo();
    const concluidos = lista.filter((pedido) => pedido.status === "entregue" && pedido.pagamento_status === "pago");
    const faturamento = concluidos.reduce((soma, pedido) => soma + Number(pedido.total || 0), 0);
    const ativos = pedidos.filter((pedido) => !["entregue", "cancelado"].includes(pedido.status)).length;
    document.getElementById("totalPedidos").textContent = String(lista.length);
    document.getElementById("pedidosAtivos").textContent = String(ativos);
    document.getElementById("pedidosAtivosMenu").textContent = String(ativos);
    document.getElementById("totalProdutos").textContent = String(produtos.length);
    document.getElementById("produtosDisponiveis").textContent = `${produtos.filter((produto) => produto.disponivel !== false).length} disponíveis`;
    document.getElementById("resumoProdutos").textContent = `${produtos.length} ${produtos.length === 1 ? "produto" : "produtos"}`;
    document.getElementById("faturamento").textContent = App.dinheiro(faturamento);
    document.getElementById("ticketMedio").textContent = App.dinheiro(concluidos.length ? faturamento / concluidos.length : 0);
    renderizarGrafico(lista);
    renderizarMaisVendidos(lista);
}

function pedidosVisiveis() {
    const inicio = inicioDoPeriodo().getTime();
    const termo = buscaPedido.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return pedidos.filter((pedido) => {
        const data = new Date(pedido.created_at).getTime();
        const noPeriodo = filtroPeriodo === "todos" || (Number.isFinite(data) && data >= inicio);
        const statusOk = filtroStatusPedido === "todos" || pedido.status === filtroStatusPedido;
        const conteudo = [pedido.numero, pedido.cliente_nome, pedido.endereco, ...(pedido.pedido_itens || []).map((item) => item.nome_produto)].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        return noPeriodo && statusOk && (!termo || conteudo.includes(termo));
    });
}

async function atualizarPedido(pedido, alteracoes, botao) {
    if (botao) botao.disabled = true;
    const anterior = { status: pedido.status, pagamento_status: pedido.pagamento_status };
    const { error } = await window.db.from("pedidos").update(alteracoes).eq("id", pedido.id);
    if (botao) botao.disabled = false;
    if (error) {
        pedido.status = anterior.status; pedido.pagamento_status = anterior.pagamento_status;
        alert(`Não foi possível atualizar o pedido: ${error.message}`);
        return false;
    }
    Object.assign(pedido, alteracoes);
    renderizarPedidos(); atualizarIndicadores();
    window.AppToast?.("Pedido atualizado", `Pedido #${pedido.numero || String(pedido.id).slice(0, 8)}: ${textoStatus(pedido.status)}.`, "success");
    return true;
}

function criarCardPedido(pedido, indice) {
    const card = criarElemento("article", `order-card${pedido._novo ? " new-order" : ""}`);
    card.style.animationDelay = `${Math.min(indice * 35, 200)}ms`;
    const cabecalho = criarElemento("div", "order-card-head");
    cabecalho.append(criarElemento("strong", "", `#${pedido.numero || String(pedido.id).slice(0, 8)}`), criarElemento("time", "", pedido.created_at ? new Date(pedido.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"));
    const cliente = criarElemento("div", "order-customer");
    if (pedido.agendado_para) cliente.append(criarElemento("span", "schedule-badge", `Agendado: ${new Date(pedido.agendado_para).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`));
    cliente.append(criarElemento("strong", "", pedido.cliente_nome || "Cliente"), criarElemento("span", "", pedido.endereco || "Endereço não informado"));
    const telefoneNumero = App.somenteNumeros(pedido.cliente_telefone);
    if (telefoneNumero) { const telefone = criarElemento("a", "", pedido.cliente_telefone); telefone.href = `tel:${telefoneNumero}`; cliente.append(telefone); }
    if (pedido.entregador_id) cliente.append(criarElemento("span", "driver-badge", "✓ Entregador atribuído"));
    const itens = criarElemento("div", "order-items");
    (pedido.pedido_itens || []).forEach((item) => {
        const linha = criarElemento("div", "order-item");
        linha.append(criarElemento("strong", "", `${item.quantidade || 1}x ${item.nome_produto || "Produto"}`));
        const detalhes = [];
        if (Array.isArray(item.adicionais) && item.adicionais.length) detalhes.push(item.adicionais.map((adicional) => adicional.nome).filter(Boolean).join(", "));
        if (item.observacao) detalhes.push(`Obs.: ${item.observacao}`);
        if (detalhes.length) linha.append(criarElemento("small", "", detalhes.join(" • ")));
        itens.append(linha);
    });
    if (!itens.children.length) itens.append(criarElemento("small", "", "Itens indisponíveis"));
    card.append(cabecalho, cliente, itens);
    if (pedido.observacoes) card.append(criarElemento("div", "order-note", pedido.observacoes));
    const total = criarElemento("div", "order-total-row");
    const pagamento = criarElemento("span", `payment-chip ${pedido.pagamento_status === "pago" ? "pago" : ""}`, pedido.pagamento_status === "pago" ? "Pago" : pedido.pagamento_modalidade === "online" ? "Online pendente" : `${pedido.pagamento || "Pagamento"} pendente`);
    total.append(pagamento, criarElemento("strong", "", App.dinheiro(pedido.total))); card.append(total);
    const acoes = criarElemento("div", "order-card-actions");
    const proxima = { recebido: ["preparando", "Iniciar preparo"], preparando: ["saiu_para_entrega", "Enviar para entrega"], saiu_para_entrega: ["entregue", "Confirmar entrega"] }[pedido.status];
    if (proxima) { const foraDaJanela = pedido.status === "recebido" && pedido.agendado_para && new Date(pedido.agendado_para).getTime() > Date.now() + 30 * 60 * 1000; const avancar = criarElemento("button", "order-action primary", foraDaJanela ? "Aguardando horário" : proxima[1]); avancar.type = "button"; avancar.disabled = Boolean(foraDaJanela); if (foraDaJanela) avancar.title = "O preparo é liberado 30 minutos antes do horário agendado."; else avancar.addEventListener("click", () => atualizarPedido(pedido, { status: proxima[0] }, avancar)); acoes.append(avancar); }
    if (pedido.pagamento_status !== "pago" && pedido.status !== "cancelado" && pedido.pagamento_modalidade !== "online") { const pago = criarElemento("button", "order-action secondary", "Marcar pago"); pago.type = "button"; pago.addEventListener("click", () => atualizarPedido(pedido, { pagamento_status: "pago" }, pago)); acoes.append(pago); }
    const chat = criarElemento("button", "order-action secondary", "Chat"); chat.type = "button"; chat.addEventListener("click", () => abrirChatPedido(pedido)); acoes.append(chat);
    if (["recebido", "preparando"].includes(pedido.status) && pedido.pagamento_status !== "pago") { const cancelar = criarElemento("button", "order-action cancel", "×"); cancelar.type = "button"; cancelar.setAttribute("aria-label", "Cancelar pedido"); cancelar.addEventListener("click", () => { if (confirm(`Cancelar o pedido #${pedido.numero || ""}?`)) atualizarPedido(pedido, { status: "cancelado" }, cancelar); }); acoes.append(cancelar); }
    if (acoes.children.length) card.append(acoes);
    return card;
}

async function abrirChatPedido(pedido) {
    const { data, error } = await window.db.from("pedido_mensagens").select("autor_tipo,mensagem,created_at").eq("pedido_id", pedido.id).order("created_at").limit(30);
    if (error) return alert(`Não foi possível abrir o chat: ${App.mensagemErro(error)}`);
    const historico = (data || []).map((item) => `[${new Date(item.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}] ${item.autor_tipo}: ${item.mensagem}`).join("\n") || "Ainda não há mensagens.";
    const resposta = prompt(`Conversa do pedido #${pedido.numero}\n\n${historico}\n\nDigite uma resposta:`);
    if (!resposta?.trim()) return;
    const { error: erroEnvio } = await window.db.from("pedido_mensagens").insert({ pedido_id: pedido.id, autor_id: empresa.usuario_id, autor_tipo: "restaurante", mensagem: resposta.trim().slice(0, 1000) });
    if (erroEnvio) alert(`Não foi possível enviar: ${App.mensagemErro(erroEnvio)}`);
}

function textoBeneficioCupom(cupom) {
    if (cupom.tipo === "frete") return "Frete grátis";
    if (cupom.tipo === "percentual") return `${Number(cupom.valor)}%${cupom.max_desconto ? ` (até ${App.dinheiro(cupom.max_desconto)})` : ""}`;
    return App.dinheiro(cupom.valor);
}

function renderizarCuponsEmpresa() {
    const box = document.getElementById("cuponsEmpresa"); box.replaceChildren();
    if (!cuponsEmpresa.length) { box.append(criarElemento("p", "empty", "Nenhum cupom criado pela loja.")); return; }
    cuponsEmpresa.forEach((cupom) => {
        const card = criarElemento("article", "promo-card"); const header = criarElemento("header"); const titulo = criarElemento("div");
        titulo.append(criarElemento("strong", "", cupom.codigo), criarElemento("small", "", `${textoBeneficioCupom(cupom)} • mínimo ${App.dinheiro(cupom.pedido_minimo)}`));
        header.append(titulo, criarElemento("span", `promo-state ${cupom.ativo ? "" : "off"}`, cupom.ativo ? "Ativo" : "Pausado"));
        const validade = cupom.fim ? `Válido até ${new Date(cupom.fim).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}` : "Sem data final";
        const footer = criarElemento("footer"); const alternar = criarElemento("button", "", cupom.ativo ? "Pausar" : "Ativar"); const remover = criarElemento("button", "", "Excluir");
        alternar.type = remover.type = "button";
        alternar.addEventListener("click", async () => { const { error } = await db.from("cupons").update({ ativo: !cupom.ativo, updated_at: new Date().toISOString() }).eq("id", cupom.id); if (!error) { cupom.ativo = !cupom.ativo; renderizarCuponsEmpresa(); } });
        remover.addEventListener("click", async () => { if (!confirm(`Excluir o cupom ${cupom.codigo}?`)) return; const { error } = await db.from("cupons").delete().eq("id", cupom.id); if (!error) { cuponsEmpresa = cuponsEmpresa.filter((item) => item.id !== cupom.id); renderizarCuponsEmpresa(); } });
        footer.append(alternar, remover); card.append(header, criarElemento("p", "", `${validade} • ${cupom.usos || 0}${cupom.limite_usos ? `/${cupom.limite_usos}` : ""} usos • ${cupom.limite_por_usuario || 1} por cliente`), footer); box.append(card);
    });
}

function renderizarAvaliacoesEmpresa() {
    const box = document.getElementById("avaliacoesEmpresa"); box.replaceChildren();
    const media = avaliacoesEmpresa.length ? avaliacoesEmpresa.reduce((soma, item) => soma + Number(item.nota || 0), 0) / avaliacoesEmpresa.length : 0;
    document.getElementById("mediaAvaliacoes").textContent = avaliacoesEmpresa.length ? `★ ${media.toFixed(1)} • ${avaliacoesEmpresa.length}` : "Sem avaliações";
    if (!avaliacoesEmpresa.length) { box.append(criarElemento("p", "empty", "Nenhuma avaliação recebida ainda.")); return; }
    avaliacoesEmpresa.forEach((avaliacao) => {
        const card = criarElemento("article", "review-admin-card"); const header = criarElemento("header"); const identidade = criarElemento("div", "review-customer");
        if (avaliacao.autor_avatar_url) { const foto = document.createElement("img"); foto.src = avaliacao.autor_avatar_url; foto.alt = ""; identidade.append(foto); }
        else identidade.append(criarElemento("span", "review-initial", (avaliacao.autor_nome || "C").charAt(0).toUpperCase()));
        const titulo = criarElemento("div"); titulo.append(criarElemento("strong", "", avaliacao.autor_nome || "Cliente"), criarElemento("span", "review-stars", "★".repeat(avaliacao.nota) + "☆".repeat(5 - avaliacao.nota)), criarElemento("small", "", new Date(avaliacao.created_at).toLocaleDateString("pt-BR"))); identidade.append(titulo); header.append(identidade, criarElemento("small", "", `Pedido ${String(avaliacao.pedido_id).slice(0, 8)}`));
        const form = criarElemento("form", "review-response-form"); const input = document.createElement("input"); input.maxLength = 1000; input.placeholder = "Escreva uma resposta pública..."; input.value = avaliacao.resposta || ""; const enviar = criarElemento("button", "", avaliacao.resposta ? "Atualizar" : "Responder"); enviar.type = "submit"; form.append(input, enviar);
        form.addEventListener("submit", async (event) => { event.preventDefault(); App.definirCarregando(enviar, true, "Salvando..."); const { error } = await db.rpc("empresa_responder_avaliacao", { p_avaliacao_id: avaliacao.id, p_resposta: input.value.trim() || null }); App.definirCarregando(enviar, false); if (error) return alert(`Não foi possível responder: ${App.mensagemErro(error)}`); avaliacao.resposta = input.value.trim(); renderizarAvaliacoesEmpresa(); });
        card.append(header, criarElemento("p", "", avaliacao.comentario || "Cliente deixou apenas a nota."), form); box.append(card);
    });
}

function renderizarPedidos() {
    const colunas = [
        { id: "recebido", nome: "Recebidos", aceita: ["recebido"] },
        { id: "preparando", nome: "Preparando", aceita: ["preparando"] },
        { id: "saiu_para_entrega", nome: "Em entrega", aceita: ["saiu_para_entrega"] },
        { id: "finalizados", nome: "Finalizados", aceita: ["entregue", "cancelado"] }
    ];
    const visiveis = pedidosVisiveis();
    listaPedidos.replaceChildren();
    colunas.forEach((coluna) => {
        const pedidosColuna = visiveis.filter((pedido) => coluna.aceita.includes(pedido.status));
        const bloco = criarElemento("section", "kanban-column"); bloco.dataset.column = coluna.id;
        const cabecalho = criarElemento("header", "kanban-column-header"); const titulo = criarElemento("div"); titulo.append(criarElemento("i"), criarElemento("strong", "", coluna.nome)); cabecalho.append(titulo, criarElemento("span", "", String(pedidosColuna.length)));
        const lista = criarElemento("div", "kanban-list");
        if (pedidosColuna.length) pedidosColuna.forEach((pedido, indice) => lista.append(criarCardPedido(pedido, indice)));
        else lista.append(criarElemento("div", "column-empty", "Nenhum pedido aqui"));
        bloco.append(cabecalho, lista); listaPedidos.append(bloco);
    });
    document.getElementById("ultimaAtualizacao").textContent = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function atualizarSelectCategorias() {
    const valorAtual = categoriaSelect.value;
    categoriaSelect.replaceChildren();
    const semCategoria = document.createElement("option");
    semCategoria.value = "";
    semCategoria.textContent = "Sem categoria";
    categoriaSelect.append(semCategoria);
    categorias.forEach((categoria) => {
        const option = document.createElement("option");
        option.value = String(categoria.id);
        option.textContent = categoria.nome;
        categoriaSelect.append(option);
    });
    if ([...categoriaSelect.options].some((option) => option.value === valorAtual)) categoriaSelect.value = valorAtual;
}

function renderizarCategorias() {
    categoriasContainer.replaceChildren();
    if (!categorias.length) {
        const vazio = document.createElement("p");
        vazio.className = "muted";
        vazio.textContent = "Nenhuma categoria cadastrada.";
        categoriasContainer.append(vazio);
        atualizarSelectCategorias();
        return;
    }

    categorias.forEach((categoria) => {
        const chip = document.createElement("span");
        chip.className = "chip-admin";
        const texto = document.createElement("span");
        texto.textContent = categoria.nome;
        const remover = document.createElement("button");
        remover.type = "button";
        remover.textContent = "×";
        remover.setAttribute("aria-label", `Remover categoria ${categoria.nome}`);
        remover.addEventListener("click", async () => {
            if (!confirm(`Remover a categoria “${categoria.nome}”? Os produtos ficarão sem categoria.`)) return;
            remover.disabled = true;
            const { error: erroProdutos } = await window.db.from("produtos")
                .update({ categoria_id: null })
                .eq("empresa_id", empresa.id)
                .eq("categoria_id", categoria.id);
            if (erroProdutos) {
                remover.disabled = false;
                alert(`Não foi possível desvincular os produtos: ${erroProdutos.message}`);
                return;
            }
            const { error } = await window.db.from("categorias").delete().eq("id", categoria.id);
            if (error) {
                remover.disabled = false;
                alert(`Não foi possível remover a categoria: ${error.message}`);
                return;
            }
            categorias = categorias.filter((item) => String(item.id) !== String(categoria.id));
            produtos = produtos.map((produto) => String(produto.categoria_id) === String(categoria.id)
                ? { ...produto, categoria_id: null }
                : produto);
            renderizarCategorias();
            renderizarProdutos();
        });
        chip.append(texto, remover);
        categoriasContainer.append(chip);
    });
    atualizarSelectCategorias();
}

function nomeCategoria(id) {
    return categorias.find((categoria) => String(categoria.id) === String(id))?.nome || "Sem categoria";
}

function renderizarProdutos() {
    listaProdutos.replaceChildren();
    if (!produtos.length) {
        listaProdutos.append(linhaVazia(5, "Nenhum produto cadastrado."));
        atualizarIndicadores();
        return;
    }

    produtos.forEach((produto) => {
        const tr = document.createElement("tr");
        const nome = document.createElement("td");
        const nomeProduto = document.createElement("strong");
        nomeProduto.textContent = produto.nome || "Produto";
        nome.append(nomeProduto);
        if (produto.controle_estoque) {
            const estoque = document.createElement("small");
            estoque.className = Number(produto.estoque || 0) <= Number(produto.estoque_minimo || 0) ? "stock-low" : "stock-ok";
            estoque.textContent = `Estoque: ${Number(produto.estoque || 0)}${estoque.className === "stock-low" ? " • baixo" : ""}`;
            nome.append(estoque);
        }
        const categoria = document.createElement("td");
        categoria.textContent = nomeCategoria(produto.categoria_id);
        const preco = document.createElement("td");
        const promocao = Number(produto.promocao || 0);
        preco.textContent = App.dinheiro(promocao > 0 ? promocao : produto.preco);

        const disponibilidade = document.createElement("td");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = produto.disponivel !== false;
        checkbox.setAttribute("aria-label", `Disponibilidade de ${produto.nome}`);
        checkbox.addEventListener("change", async () => {
            const anterior = !checkbox.checked;
            checkbox.disabled = true;
            const { error } = await window.db.from("produtos").update({ disponivel: checkbox.checked }).eq("id", produto.id);
            checkbox.disabled = false;
            if (error) {
                checkbox.checked = anterior;
                alert(`Não foi possível atualizar o produto: ${error.message}`);
                return;
            }
            produto.disponivel = checkbox.checked;
        });
        disponibilidade.append(checkbox);

        const acoes = document.createElement("td");
        const grupo = document.createElement("div");
        grupo.className = "acoes-tabela";
        const editar = document.createElement("button");
        editar.type = "button";
        editar.className = "btn-mini secundario";
        editar.textContent = "Editar";
        editar.addEventListener("click", () => editarProduto(produto));
        const excluir = document.createElement("button");
        excluir.type = "button";
        excluir.className = "btn-mini perigo";
        excluir.textContent = "Excluir";
        excluir.addEventListener("click", async () => {
            if (!confirm(`Excluir o produto “${produto.nome}”?`)) return;
            excluir.disabled = true;
            const { error: erroVinculos } = await window.db.from("produto_grupos").delete().eq("produto_id", produto.id);
            if (erroVinculos) {
                excluir.disabled = false;
                alert(`Não foi possível remover os vínculos do produto: ${erroVinculos.message}`);
                return;
            }
            const { error } = await window.db.from("produtos").delete().eq("id", produto.id);
            if (error) {
                excluir.disabled = false;
                alert(`Não foi possível excluir o produto: ${error.message}`);
                return;
            }
            produtos = produtos.filter((item) => String(item.id) !== String(produto.id));
            vinculosProdutoGrupo = vinculosProdutoGrupo.filter((item) => String(item.produto_id) !== String(produto.id));
            renderizarProdutos();
            renderizarGruposAdicionais();
        });
        grupo.append(editar, excluir);
        acoes.append(grupo);

        tr.append(nome, categoria, preco, disponibilidade, acoes);
        listaProdutos.append(tr);
    });
    atualizarIndicadores();
    atualizarSelectsPersonalizacao();
}

function preencherSelect(select, itens, placeholder) {
    const valorAtual = select.value;
    select.replaceChildren();
    const vazio = document.createElement("option");
    vazio.value = "";
    vazio.textContent = placeholder;
    select.append(vazio);
    itens.forEach((item) => {
        const option = document.createElement("option");
        option.value = String(item.id);
        option.textContent = item.nome || "Sem nome";
        select.append(option);
    });
    if ([...select.options].some((option) => option.value === valorAtual)) select.value = valorAtual;
}

function atualizarSelectsPersonalizacao() {
    if (!adicionalGrupoSelect || !vinculoProdutoSelect || !vinculoGrupoSelect) return;
    preencherSelect(adicionalGrupoSelect, gruposAdicionais, gruposAdicionais.length ? "Selecione o grupo" : "Crie um grupo primeiro");
    preencherSelect(vinculoGrupoSelect, gruposAdicionais, gruposAdicionais.length ? "Selecione o grupo" : "Crie um grupo primeiro");
    preencherSelect(vinculoProdutoSelect, produtos, produtos.length ? "Selecione o produto" : "Cadastre um produto primeiro");
}

async function removerAdicional(adicional) {
    if (!confirm(`Remover o adicional “${adicional.nome}”?`)) return false;
    const { error } = await window.db.from("adicionais").delete().eq("id", adicional.id);
    if (error) return alert(`Não foi possível remover o adicional: ${error.message}`), false;
    adicionaisEmpresa = adicionaisEmpresa.filter((item) => String(item.id) !== String(adicional.id));
    renderizarGruposAdicionais();
    return true;
}

async function desvincularProdutoGrupo(vinculo) {
    const { error } = await window.db.from("produto_grupos").delete()
        .eq("produto_id", vinculo.produto_id)
        .eq("grupo_id", vinculo.grupo_id);
    if (error) return alert(`Não foi possível desvincular: ${error.message}`);
    vinculosProdutoGrupo = vinculosProdutoGrupo.filter((item) => !(
        String(item.produto_id) === String(vinculo.produto_id)
        && String(item.grupo_id) === String(vinculo.grupo_id)
    ));
    renderizarGruposAdicionais();
}

async function removerGrupoAdicional(grupo) {
    if (!confirm(`Remover o grupo “${grupo.nome}” e todas as opções dele?`)) return;
    const { error: erroVinculos } = await window.db.from("produto_grupos").delete().eq("grupo_id", grupo.id);
    if (erroVinculos) return alert(`Não foi possível remover os vínculos: ${erroVinculos.message}`);
    const { error: erroAdicionais } = await window.db.from("adicionais").delete().eq("grupo_id", grupo.id);
    if (erroAdicionais) return alert(`Não foi possível remover as opções: ${erroAdicionais.message}`);
    const { error } = await window.db.from("grupos_adicionais").delete().eq("id", grupo.id);
    if (error) return alert(`Não foi possível remover o grupo: ${error.message}`);
    gruposAdicionais = gruposAdicionais.filter((item) => String(item.id) !== String(grupo.id));
    adicionaisEmpresa = adicionaisEmpresa.filter((item) => String(item.grupo_id) !== String(grupo.id));
    vinculosProdutoGrupo = vinculosProdutoGrupo.filter((item) => String(item.grupo_id) !== String(grupo.id));
    renderizarGruposAdicionais();
}

function renderizarGruposAdicionais() {
    if (!gruposContainer) return;
    gruposContainer.replaceChildren();
    atualizarSelectsPersonalizacao();
    if (!gruposAdicionais.length) {
        const vazio = document.createElement("div");
        vazio.className = "empty";
        vazio.textContent = "Nenhum grupo de adicionais cadastrado.";
        gruposContainer.append(vazio);
        return;
    }

    gruposAdicionais.forEach((grupo) => {
        const card = document.createElement("article");
        card.className = "item-card grupo-admin-card";
        const conteudo = document.createElement("div");
        const titulo = document.createElement("h3");
        titulo.textContent = grupo.nome || "Grupo";
        const regra = document.createElement("p");
        regra.textContent = `Escolhas: mínimo ${grupo.minimo || 0}, máximo ${grupo.maximo || 1}`;
        conteudo.append(titulo, regra);

        const opcoes = document.createElement("div");
        opcoes.className = "chips-admin opcoes-admin";
        adicionaisEmpresa.filter((adicional) => String(adicional.grupo_id) === String(grupo.id)).forEach((adicional) => {
            const chip = document.createElement("span");
            chip.className = "chip-admin";
            const texto = document.createElement("span");
            texto.textContent = `${adicional.nome} • ${App.dinheiro(adicional.preco)}`;
            const remover = document.createElement("button");
            remover.type = "button";
            remover.textContent = "×";
            remover.setAttribute("aria-label", `Remover adicional ${adicional.nome}`);
            remover.addEventListener("click", () => removerAdicional(adicional));
            chip.append(texto, remover);
            opcoes.append(chip);
        });
        if (!opcoes.children.length) {
            const semOpcoes = document.createElement("p");
            semOpcoes.textContent = "Nenhuma opção neste grupo.";
            opcoes.append(semOpcoes);
        }
        conteudo.append(opcoes);

        const vinculados = document.createElement("div");
        vinculados.className = "vinculos-admin";
        const vinculosDoGrupo = vinculosProdutoGrupo.filter((vinculo) => String(vinculo.grupo_id) === String(grupo.id));
        vinculosDoGrupo.forEach((vinculo) => {
            const produto = produtos.find((item) => String(item.id) === String(vinculo.produto_id));
            const chip = document.createElement("span");
            chip.className = "chip-admin vinculo-chip";
            const texto = document.createElement("span");
            texto.textContent = `Produto: ${produto?.nome || "Produto removido"}`;
            const remover = document.createElement("button");
            remover.type = "button";
            remover.textContent = "×";
            remover.setAttribute("aria-label", `Desvincular ${produto?.nome || "produto"}`);
            remover.addEventListener("click", () => desvincularProdutoGrupo(vinculo));
            chip.append(texto, remover);
            vinculados.append(chip);
        });
        if (!vinculados.children.length) {
            const aviso = document.createElement("p");
            aviso.textContent = "Ainda não vinculado a um produto.";
            vinculados.append(aviso);
        }
        conteudo.append(vinculados);

        const acoes = document.createElement("div");
        acoes.className = "actions";
        const excluir = document.createElement("button");
        excluir.type = "button";
        excluir.className = "btn-mini perigo";
        excluir.textContent = "Excluir grupo";
        excluir.addEventListener("click", () => removerGrupoAdicional(grupo));
        acoes.append(excluir);
        card.append(conteudo, acoes);
        gruposContainer.append(card);
    });
}

function editarProduto(produto) {
    produtoEditandoId = produto.id;
    document.getElementById("produtoNome").value = produto.nome || "";
    document.getElementById("produtoCategoria").value = produto.categoria_id || "";
    document.getElementById("produtoPreco").value = Number(produto.preco || 0).toFixed(2);
    document.getElementById("produtoPromocao").value = Number(produto.promocao || 0) > 0 ? Number(produto.promocao).toFixed(2) : "";
    document.getElementById("produtoDescricao").value = produto.descricao || "";
    document.getElementById("produtoImagem").value = produto.imagem || "";
    document.getElementById("produtoDisponivel").checked = produto.disponivel !== false;
    document.getElementById("produtoControlaEstoque").checked = produto.controle_estoque === true;
    document.getElementById("produtoEstoque").value = Number(produto.estoque || 0);
    document.getElementById("produtoEstoqueMinimo").value = Number(produto.estoque_minimo ?? 5);
    document.getElementById("produtoFormTitulo").textContent = "Editar produto";
    document.getElementById("produtoSalvar").textContent = "Salvar alterações";
    window.MediaUploader?.refreshAll();
    document.getElementById("produtoForm").scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById("produtoNome").focus({ preventScroll: true });
}

function preencherLoja() {
    document.getElementById("nomeEmpresa").textContent = empresa.nome || "Painel do Restaurante";
    const linkLoja = document.getElementById("linkLoja");
    linkLoja.href = `restaurante.html?id=${encodeURIComponent(empresa.id)}`;
    linkLoja.hidden = empresa.publicado !== true;
    document.getElementById("publicacaoAviso").hidden = empresa.publicado === true;
    statusEmpresa.checked = empresa.status !== false;
    statusEmpresa.disabled = false;
    document.getElementById("textoStatusLoja").textContent = empresa.status !== false ? "Aberta e recebendo" : "Fechada temporariamente";
    document.getElementById("lojaNome").value = empresa.nome || "";
    document.getElementById("lojaTelefone").value = empresa.telefone || "";
    document.getElementById("lojaCategoria").value = empresa.categoria || empresa.tipo || "";
    document.getElementById("lojaTaxa").value = Number(empresa.taxa_entrega || 0).toFixed(2);
    document.getElementById("lojaMinimo").value = Number(empresa.pedido_minimo || 0).toFixed(2);
    document.getElementById("lojaCidade").value = empresa.cidade_atendimento || "";
    document.getElementById("lojaUf").value = empresa.uf_atendimento || "";
    document.getElementById("lojaBairros").value = Array.isArray(empresa.bairros_atendidos) ? empresa.bairros_atendidos.join("\n") : "";
    document.getElementById("lojaTempoMin").value = Number(empresa.tempo_estimado_min || 25);
    document.getElementById("lojaTempoMax").value = Number(empresa.tempo_estimado_max || 45);
    document.getElementById("lojaDescricao").value = empresa.descricao || "";
    document.getElementById("lojaLogo").value = empresa.logo || "";
    document.getElementById("lojaBanner").value = empresa.banner || "";
    window.MediaUploader?.refreshAll();
}

async function carregarPainel() {
    try {
        const { data: { user }, error: erroAuth } = await window.db.auth.getUser();
        if (erroAuth || !user) {
            window.location.replace("empresa-login.html");
            return;
        }

        const { data, error } = await window.db.from("empresas").select("*").eq("usuario_id", user.id).maybeSingle();
        if (error || !data) {
            await window.db.auth.signOut();
            window.location.replace("empresa-login.html");
            return;
        }

        empresa = data;
        preencherLoja();

        const [resPedidos, resProdutos, resCategorias, resGrupos, resCupons, resAvaliacoes] = await Promise.all([
            window.db.from("pedidos").select("*, pedido_itens(*)").eq("empresa_id", String(empresa.id)).order("created_at", { ascending: false }),
            window.db.from("produtos").select("*").eq("empresa_id", empresa.id).order("nome"),
            window.db.from("categorias").select("*").eq("empresa_id", empresa.id).order("ordem").order("nome"),
            window.db.from("grupos_adicionais").select("*").eq("empresa_id", empresa.id).order("nome"),
            window.db.from("cupons").select("*").eq("empresa_id", String(empresa.id)).order("created_at", { ascending: false }),
            window.db.from("avaliacoes").select("id,pedido_id,nota,comentario,resposta,autor_nome,autor_avatar_url,created_at,updated_at").eq("empresa_id", String(empresa.id)).order("created_at", { ascending: false }).limit(200)
        ]);

        if (resPedidos.error) console.error("Erro ao carregar pedidos:", resPedidos.error);
        if (resProdutos.error) console.error("Erro ao carregar produtos:", resProdutos.error);
        if (resCategorias.error) console.error("Erro ao carregar categorias:", resCategorias.error);
        if (resGrupos.error) console.error("Erro ao carregar grupos de adicionais:", resGrupos.error);
        if (resCupons.error) console.error("Erro ao carregar cupons:", resCupons.error);
        if (resAvaliacoes.error) console.error("Erro ao carregar avaliações:", resAvaliacoes.error);

        pedidos = resPedidos.error ? [] : (resPedidos.data || []);
        produtos = resProdutos.error ? [] : (resProdutos.data || []);
        categorias = resCategorias.error ? [] : (resCategorias.data || []);
        gruposAdicionais = resGrupos.error ? [] : (resGrupos.data || []);
        cuponsEmpresa = resCupons.error ? [] : (resCupons.data || []);
        avaliacoesEmpresa = resAvaliacoes.error ? [] : (resAvaliacoes.data || []);

        const grupoIds = gruposAdicionais.map((grupo) => String(grupo.id));
        const produtoIds = produtos.map((produto) => String(produto.id));
        const [resAdicionais, resVinculos] = await Promise.all([
            grupoIds.length
                ? window.db.from("adicionais").select("*").in("grupo_id", grupoIds).order("nome")
                : Promise.resolve({ data: [], error: null }),
            produtoIds.length
                ? window.db.from("produto_grupos").select("*").in("produto_id", produtoIds)
                : Promise.resolve({ data: [], error: null })
        ]);
        adicionaisEmpresa = resAdicionais.error ? [] : (resAdicionais.data || []);
        vinculosProdutoGrupo = resVinculos.error ? [] : (resVinculos.data || []);
        renderizarPedidos();
        renderizarCategorias();
        renderizarProdutos();
        renderizarGruposAdicionais();
        renderizarCuponsEmpresa();
        renderizarAvaliacoesEmpresa();
        atualizarIndicadores();
    } catch (erro) {
        console.error("Erro ao carregar painel:", erro);
        App.mostrarErroPagina("Não foi possível carregar o painel do restaurante.");
        listaPedidos.replaceChildren(criarElemento("div", "empty-state", "Falha ao carregar pedidos."));
        listaProdutos.replaceChildren(linhaVazia(5, "Falha ao carregar produtos."));
    }
}

statusEmpresa.addEventListener("change", async () => {
    if (!empresa) return;
    const anterior = !statusEmpresa.checked;
    statusEmpresa.disabled = true;
    const { error } = await window.db.from("empresas").update({ status: statusEmpresa.checked }).eq("id", empresa.id);
    statusEmpresa.disabled = false;
    if (error) {
        statusEmpresa.checked = anterior;
        alert(`Não foi possível alterar o status: ${error.message}`);
        return;
    }
    empresa.status = statusEmpresa.checked;
    document.getElementById("textoStatusLoja").textContent = empresa.status ? "Aberta e recebendo" : "Fechada temporariamente";
    window.AppToast?.("Status da loja atualizado", empresa.status ? "A loja está recebendo novos pedidos." : "Novos pedidos foram pausados.", "success");
});

document.getElementById("cupomTipo").addEventListener("change", ({ target }) => {
    const valor = document.getElementById("cupomValor");
    valor.disabled = target.value === "frete";
    if (valor.disabled) valor.value = "0";
});

document.getElementById("cupomForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!empresa) return;
    const form = event.currentTarget; const botao = form.querySelector("button[type='submit']");
    const codigo = document.getElementById("cupomCodigo").value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (codigo.length < 3) return alert("Use um código com pelo menos três caracteres.");
    const fimTexto = document.getElementById("cupomFim").value;
    const payload = {
        empresa_id: String(empresa.id), codigo,
        tipo: document.getElementById("cupomTipo").value,
        valor: Number(document.getElementById("cupomValor").value || 0),
        pedido_minimo: Number(document.getElementById("cupomMinimo").value || 0),
        max_desconto: document.getElementById("cupomMaximo").value ? Number(document.getElementById("cupomMaximo").value) : null,
        limite_usos: document.getElementById("cupomLimite").value ? Number(document.getElementById("cupomLimite").value) : null,
        limite_por_usuario: Number(document.getElementById("cupomPorUsuario").value || 1),
        primeiro_pedido: document.getElementById("cupomPrimeiro").checked,
        fim: fimTexto ? new Date(fimTexto).toISOString() : null,
        ativo: true
    };
    App.definirCarregando(botao, true, "Criando...");
    const { data, error } = await db.from("cupons").insert(payload).select("*").single();
    App.definirCarregando(botao, false);
    if (error) return alert(`Não foi possível criar o cupom: ${App.mensagemErro(error)}`);
    cuponsEmpresa.unshift(data); renderizarCuponsEmpresa(); form.reset(); document.getElementById("cupomValor").value = "10"; document.getElementById("cupomMinimo").value = "0"; document.getElementById("cupomPorUsuario").value = "1";
    window.AppToast?.("Promoção criada", `O cupom ${codigo} já pode ser utilizado.`, "success");
});

document.getElementById("lojaForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!empresa) return;
    const form = event.currentTarget;
    const botao = form.querySelector("button[type='submit']");
    const bairros = document.getElementById("lojaBairros").value
        .split(/[\n,;]+/)
        .map((bairro) => bairro.trim())
        .filter((bairro, indice, todos) => bairro && todos.findIndex((item) => item.toLowerCase() === bairro.toLowerCase()) === indice)
        .slice(0, 100);
    const payload = {
        nome: document.getElementById("lojaNome").value.trim(),
        telefone: document.getElementById("lojaTelefone").value.trim(),
        categoria: document.getElementById("lojaCategoria").value.trim() || null,
        descricao: document.getElementById("lojaDescricao").value.trim() || null,
        taxa_entrega: Number(document.getElementById("lojaTaxa").value),
        pedido_minimo: Number(document.getElementById("lojaMinimo").value),
        cidade_atendimento: document.getElementById("lojaCidade").value.trim() || null,
        uf_atendimento: document.getElementById("lojaUf").value.trim().toUpperCase() || null,
        bairros_atendidos: bairros,
        tempo_estimado_min: Number(document.getElementById("lojaTempoMin").value),
        tempo_estimado_max: Number(document.getElementById("lojaTempoMax").value),
        logo: document.getElementById("lojaLogo").value.trim() || null,
        banner: document.getElementById("lojaBanner").value.trim() || null
    };
    if (!payload.nome) return alert("Informe o nome da loja.");
    if (![payload.taxa_entrega, payload.pedido_minimo].every((valor) => Number.isFinite(valor) && valor >= 0)) {
        return alert("Informe valores válidos para taxa e pedido mínimo.");
    }
    if (payload.uf_atendimento && !/^[A-Z]{2}$/.test(payload.uf_atendimento)) return alert("Informe uma UF válida com duas letras.");
    if (!Number.isInteger(payload.tempo_estimado_min) || !Number.isInteger(payload.tempo_estimado_max)
        || payload.tempo_estimado_min < 5 || payload.tempo_estimado_max < payload.tempo_estimado_min) {
        return alert("Informe uma previsão de entrega válida.");
    }

    App.definirCarregando(botao, true, "Salvando...");
    const { data, error } = await window.db.from("empresas").update(payload).eq("id", empresa.id).select("*").single();
    App.definirCarregando(botao, false);
    if (error) return alert(`Não foi possível salvar: ${error.message}`);
    empresa = data;
    preencherLoja();
    alert("Configurações atualizadas.");
});

document.getElementById("categoriaForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!empresa) return;
    const form = event.currentTarget;
    const campo = document.getElementById("novaCategoria");
    const nome = campo.value.trim();
    if (!nome) return;
    if (categorias.some((categoria) => categoria.nome.toLowerCase() === nome.toLowerCase())) return alert("Essa categoria já existe.");

    const botao = form.querySelector("button[type='submit']");
    App.definirCarregando(botao, true, "Adicionando...");
    const { data, error } = await window.db.from("categorias").insert({
        empresa_id: empresa.id,
        nome,
        ordem: categorias.length,
        ativo: true
    }).select("*").single();
    App.definirCarregando(botao, false);
    if (error) return alert(`Não foi possível criar a categoria: ${error.message}`);
    categorias.push(data);
    campo.value = "";
    renderizarCategorias();
});

document.getElementById("produtoForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!empresa) return;
    const form = event.currentTarget;
    const preco = Number(document.getElementById("produtoPreco").value);
    const promocaoTexto = document.getElementById("produtoPromocao").value;
    const promocao = promocaoTexto === "" ? null : Number(promocaoTexto);
    const estoque = Number(document.getElementById("produtoEstoque").value);
    const estoqueMinimo = Number(document.getElementById("produtoEstoqueMinimo").value);
    if (!Number.isFinite(preco) || preco < 0) return alert("Informe um preço válido.");
    if (promocao !== null && (!Number.isFinite(promocao) || promocao <= 0)) return alert("O preço promocional deve ser maior que zero.");
    if (promocao !== null && promocao >= preco) return alert("O preço promocional deve ser menor que o preço normal.");
    if (![estoque, estoqueMinimo].every(Number.isInteger) || estoque < 0 || estoqueMinimo < 0) return alert("Informe quantidades de estoque válidas.");

    const payload = {
        empresa_id: empresa.id,
        categoria_id: categoriaSelect.value || null,
        nome: document.getElementById("produtoNome").value.trim(),
        descricao: document.getElementById("produtoDescricao").value.trim() || null,
        imagem: document.getElementById("produtoImagem").value.trim() || null,
        preco,
        promocao,
        disponivel: document.getElementById("produtoDisponivel").checked,
        controle_estoque: document.getElementById("produtoControlaEstoque").checked,
        estoque,
        estoque_minimo: estoqueMinimo
    };
    if (!payload.nome) return alert("Informe o nome do produto.");

    const botao = form.querySelector("button[type='submit']");
    App.definirCarregando(botao, true, produtoEditandoId ? "Salvando..." : "Cadastrando...");
    const consulta = produtoEditandoId
        ? window.db.from("produtos").update(payload).eq("id", produtoEditandoId)
        : window.db.from("produtos").insert(payload);
    const { data, error } = await consulta.select("*").single();
    App.definirCarregando(botao, false);
    if (error) return alert(`Não foi possível cadastrar o produto: ${error.message}`);
    if (produtoEditandoId) produtos = produtos.map((item) => String(item.id) === String(produtoEditandoId) ? data : item);
    else produtos.push(data);
    produtos.sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
    form.reset();
    produtoEditandoId = null;
    document.getElementById("produtoFormTitulo").textContent = "Novo produto";
    document.getElementById("produtoSalvar").textContent = "Cadastrar produto";
    document.getElementById("produtoDisponivel").checked = true;
    document.getElementById("produtoControlaEstoque").checked = false;
    document.getElementById("produtoEstoque").value = "0";
    document.getElementById("produtoEstoqueMinimo").value = "5";
    window.MediaUploader?.refreshAll();
    renderizarProdutos();
    renderizarGruposAdicionais();
});

document.getElementById("grupoAdicionalForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!empresa) return;
    const form = event.currentTarget;
    const nome = document.getElementById("grupoNome").value.trim();
    const minimo = Number(document.getElementById("grupoMinimo").value);
    const maximo = Number(document.getElementById("grupoMaximo").value);
    if (!nome) return alert("Informe o nome do grupo.");
    if (!Number.isInteger(minimo) || !Number.isInteger(maximo) || minimo < 0 || maximo < Math.max(minimo, 1) || maximo > 20) {
        return alert("Use limites válidos: mínimo a partir de zero e máximo entre 1 e 20.");
    }
    const botao = form.querySelector("button[type='submit']");
    App.definirCarregando(botao, true, "Criando...");
    const { data, error } = await window.db.from("grupos_adicionais").insert({
        empresa_id: String(empresa.id), nome, minimo, maximo, ativo: true
    }).select("*").single();
    App.definirCarregando(botao, false);
    if (error) return alert(`Não foi possível criar o grupo: ${error.message}`);
    gruposAdicionais.push(data);
    gruposAdicionais.sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
    form.reset();
    document.getElementById("grupoMinimo").value = "0";
    document.getElementById("grupoMaximo").value = "1";
    renderizarGruposAdicionais();
});

document.getElementById("adicionalForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const grupoId = adicionalGrupoSelect.value;
    const nome = document.getElementById("adicionalNome").value.trim();
    const preco = Number(document.getElementById("adicionalPreco").value);
    if (!grupoId) return alert("Selecione um grupo.");
    if (!nome) return alert("Informe o nome do adicional.");
    if (!Number.isFinite(preco) || preco < 0) return alert("Informe um preço válido.");
    const botao = form.querySelector("button[type='submit']");
    App.definirCarregando(botao, true, "Adicionando...");
    const { data, error } = await window.db.from("adicionais").insert({
        grupo_id: grupoId, nome, preco, ativo: true
    }).select("*").single();
    App.definirCarregando(botao, false);
    if (error) return alert(`Não foi possível adicionar a opção: ${error.message}`);
    adicionaisEmpresa.push(data);
    const manterGrupo = grupoId;
    form.reset();
    adicionalGrupoSelect.value = manterGrupo;
    document.getElementById("adicionalPreco").value = "0";
    renderizarGruposAdicionais();
});

document.getElementById("vinculoGrupoForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const produtoId = vinculoProdutoSelect.value;
    const grupoId = vinculoGrupoSelect.value;
    if (!produtoId || !grupoId) return alert("Selecione o produto e o grupo.");
    if (vinculosProdutoGrupo.some((item) => String(item.produto_id) === produtoId && String(item.grupo_id) === grupoId)) {
        return alert("Este grupo já está vinculado ao produto.");
    }
    const botao = event.currentTarget.querySelector("button[type='submit']");
    App.definirCarregando(botao, true, "Vinculando...");
    const { data, error } = await window.db.from("produto_grupos").insert({
        produto_id: produtoId, grupo_id: grupoId
    }).select("*").single();
    App.definirCarregando(botao, false);
    if (error) return alert(`Não foi possível vincular: ${error.message}`);
    vinculosProdutoGrupo.push(data);
    renderizarGruposAdicionais();
});

document.getElementById("logoutEmpresa").addEventListener("click", async () => {
    const botao = document.getElementById("logoutEmpresa");
    App.definirCarregando(botao, true, "Saindo...");
    const { error } = await window.db.auth.signOut();
    if (error) {
        App.definirCarregando(botao, false);
        alert(`Não foi possível sair: ${error.message}`);
        return;
    }
    App.limparDadosPrivados();
    window.location.replace("empresa-login.html");
});

function atualizarBotaoAlertas() {
    const botao = document.getElementById("ativarAlertas");
    botao.classList.toggle("active", alertasAtivos);
    botao.setAttribute("aria-pressed", String(alertasAtivos));
    botao.querySelector(".alert-label").textContent = alertasAtivos ? "Alertas ativos" : "Ativar alertas";
}

function tocarAlertaPedido() {
    if (!alertasAtivos) return;
    try {
        audioContexto ||= new (window.AudioContext || window.webkitAudioContext)();
        const inicio = audioContexto.currentTime;
        [0, .18].forEach((atraso, indice) => {
            const oscilador = audioContexto.createOscillator();
            const ganho = audioContexto.createGain();
            oscilador.type = "sine";
            oscilador.frequency.value = indice ? 880 : 660;
            ganho.gain.setValueAtTime(.0001, inicio + atraso);
            ganho.gain.exponentialRampToValueAtTime(.18, inicio + atraso + .02);
            ganho.gain.exponentialRampToValueAtTime(.0001, inicio + atraso + .16);
            oscilador.connect(ganho); ganho.connect(audioContexto.destination);
            oscilador.start(inicio + atraso); oscilador.stop(inicio + atraso + .18);
        });
    } catch (erro) {
        console.warn("Alerta sonoro indisponível:", erro);
    }
}

async function recarregarPedidos(marcarNovo = "") {
    if (!empresa) return false;
    const { data, error } = await window.db.from("pedidos")
        .select("*, pedido_itens(*)")
        .eq("empresa_id", String(empresa.id))
        .order("created_at", { ascending: false });
    if (error) {
        window.AppToast?.("Falha ao atualizar", App.mensagemErro(error), "error");
        return false;
    }
    pedidos = (data || []).map((pedido) => ({ ...pedido, _novo: String(pedido.id) === String(marcarNovo) }));
    renderizarPedidos(); atualizarIndicadores();
    return true;
}

document.getElementById("filtroPeriodo").addEventListener("change", (event) => {
    filtroPeriodo = event.target.value;
    renderizarPedidos(); atualizarIndicadores();
});
document.getElementById("filtroStatusPedido").addEventListener("change", (event) => {
    filtroStatusPedido = event.target.value;
    renderizarPedidos();
});
document.getElementById("buscaPedido").addEventListener("input", (event) => {
    buscaPedido = event.target.value.trim();
    renderizarPedidos();
});
document.getElementById("atualizarPedidos").addEventListener("click", async (event) => {
    const botao = event.currentTarget;
    App.definirCarregando(botao, true, "Atualizando...");
    await recarregarPedidos();
    App.definirCarregando(botao, false);
});
document.getElementById("ativarAlertas").addEventListener("click", async () => {
    alertasAtivos = !alertasAtivos;
    if (alertasAtivos) {
        try {
            audioContexto ||= new (window.AudioContext || window.webkitAudioContext)();
            await audioContexto.resume();
            tocarAlertaPedido();
        } catch (erro) {
            console.warn(erro);
        }
        if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
    }
    localStorage.setItem("alertasRestaurante", String(alertasAtivos));
    atualizarBotaoAlertas();
    window.AppToast?.(alertasAtivos ? "Alertas ativados" : "Alertas pausados", alertasAtivos ? "Você ouvirá um aviso quando chegar um novo pedido." : "Os avisos sonoros foram desativados.", "success");
});
addEventListener("pointerdown", async () => {
    if (!alertasAtivos) return;
    try {
        audioContexto ||= new (window.AudioContext || window.webkitAudioContext)();
        await audioContexto.resume();
    } catch (erro) {
        console.warn("Não foi possível preparar o alerta sonoro:", erro);
    }
}, { once: true });

const sidebar = document.getElementById("dashboardSidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const menuDashboard = document.getElementById("menuDashboard");
function fecharSidebar() {
    sidebar.classList.remove("open"); sidebarOverlay.classList.remove("show"); menuDashboard.setAttribute("aria-expanded", "false");
}
menuDashboard.addEventListener("click", () => {
    const abrir = !sidebar.classList.contains("open");
    sidebar.classList.toggle("open", abrir); sidebarOverlay.classList.toggle("show", abrir); menuDashboard.setAttribute("aria-expanded", String(abrir));
});
sidebarOverlay.addEventListener("click", fecharSidebar);
sidebar.querySelectorAll("nav a").forEach((link) => link.addEventListener("click", () => {
    sidebar.querySelectorAll("nav a").forEach((item) => item.classList.toggle("active", item === link));
    fecharSidebar();
}));

atualizarBotaoAlertas();
carregarPainel();

// Atualização em tempo real dos pedidos do restaurante.
let canalPedidosEmpresa = null;
async function ativarPedidosEmTempoReal() {
    if (!empresa || canalPedidosEmpresa) return;
    canalPedidosEmpresa = window.db.channel(`empresa-pedidos-${empresa.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "pedidos", filter: `empresa_id=eq.${empresa.id}` }, async (payload) => {
            await recarregarPedidos(payload.eventType === "INSERT" ? payload.new.id : "");
            if (payload.eventType === "INSERT") {
                tocarAlertaPedido();
                const numero = payload.new.numero || String(payload.new.id).slice(0, 8);
                window.AppToast?.("Novo pedido recebido", `Pedido #${numero} chegou e precisa ser confirmado.`, "success", 9000);
                if ("Notification" in window && Notification.permission === "granted") {
                    new Notification("Novo pedido no Multi Delivery", { body: `Pedido #${numero} recebido.`, icon: "assets/favicon.svg" });
                }
            }
        }).subscribe();
}
const observarEmpresa = setInterval(() => {
    if (empresa) { clearInterval(observarEmpresa); ativarPedidosEmTempoReal(); }
}, 350);
addEventListener("beforeunload", () => {
    if (canalPedidosEmpresa) window.db.removeChannel(canalPedidosEmpresa);
});
