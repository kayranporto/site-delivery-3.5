"use strict";

let usuario = null;
let entregador = null;
let disponiveis = [];
let minhas = [];
let canal = null;
let localizacaoWatch = null;

const loading = document.getElementById("entregadorLoading");
const cadastro = document.getElementById("cadastroEntregador");
const pendente = document.getElementById("entregadorPendente");
const app = document.getElementById("entregadorApp");
const online = document.getElementById("entregadorOnline");

function elemento(tag, classe, texto) {
    const item = document.createElement(tag);
    if (classe) item.className = classe;
    if (texto !== undefined) item.textContent = texto;
    return item;
}

function dataHora(valor) {
    const data = new Date(valor);
    return Number.isFinite(data.getTime()) ? data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "Agora";
}

function textoStatus(status) {
    return ({ preparando: "Aguardando retirada", saiu_para_entrega: "Em rota", entregue: "Entregue" })[status] || status;
}

function atualizarMetricas() {
    document.getElementById("totalDisponiveis").textContent = String(disponiveis.length);
    document.getElementById("totalEmRota").textContent = String(minhas.filter((pedido) => ["preparando", "saiu_para_entrega"].includes(pedido.status)).length);
    const hoje = new Date().toDateString();
    document.getElementById("totalConcluidas").textContent = String(minhas.filter((pedido) => pedido.status === "entregue" && new Date(pedido.updated_at).toDateString() === hoje).length);
}

async function aceitar(pedidoId, botao) {
    App.definirCarregando(botao, true, "Aceitando...");
    const { data, error } = await db.rpc("entregador_aceitar_pedido", { p_pedido_id: pedidoId });
    App.definirCarregando(botao, false);
    if (error || data !== true) return alert(`Não foi possível aceitar: ${App.mensagemErro(error, "A entrega já foi aceita.")}`);
    await carregarEntregas();
    window.AppToast?.("Entrega aceita", "O endereço completo e as ações de rota já estão disponíveis.", "success");
}

async function mudarStatus(pedido, status, pagamentoRecebido, botao) {
    App.definirCarregando(botao, true, "Atualizando...");
    const { data, error } = await db.rpc("entregador_atualizar_status", {
        p_pedido_id: pedido.id,
        p_status: status,
        p_pagamento_recebido: pagamentoRecebido
    });
    App.definirCarregando(botao, false);
    if (error || data !== true) return alert(`Não foi possível atualizar: ${App.mensagemErro(error)}`);
    await carregarEntregas();
}

async function abrirChat(pedido) {
    const { data, error } = await db.from("pedido_mensagens").select("autor_tipo,mensagem,created_at").eq("pedido_id", pedido.id).order("created_at").limit(30);
    if (error) return alert(`Não foi possível abrir o chat: ${App.mensagemErro(error)}`);
    const historico = (data || []).map((item) => `[${new Date(item.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}] ${item.autor_tipo}: ${item.mensagem}`).join("\n") || "Ainda não há mensagens.";
    const resposta = prompt(`Conversa do pedido #${pedido.numero}\n\n${historico}\n\nDigite uma resposta:`);
    if (!resposta?.trim()) return;
    const { error: envioErro } = await db.from("pedido_mensagens").insert({ pedido_id: pedido.id, autor_id: usuario.id, autor_tipo: "entregador", mensagem: resposta.trim().slice(0, 1000) });
    if (envioErro) alert(`Não foi possível enviar: ${App.mensagemErro(envioErro)}`);
}

function cardDisponivel(pedido) {
    const card = elemento("article", "delivery-card");
    const info = elemento("div");
    info.append(elemento("h3", "", `#${pedido.numero} • ${pedido.restaurante}`));
    const meta = elemento("div", "delivery-meta");
    meta.append(elemento("span", "status-chip", pedido.agendado_para ? "Agendado" : "Disponível"), elemento("span", "", pedido.bairro || "Região protegida"), elemento("span", "", App.dinheiro(pedido.total)), elemento("span", "", dataHora(pedido.agendado_para || pedido.created_at)));
    info.append(meta, elemento("p", "delivery-address", "O endereço completo ficará visível após aceitar a entrega."));
    const acoes = elemento("div", "delivery-actions");
    const aceitarBtn = elemento("button", "accept", "Aceitar entrega"); aceitarBtn.type = "button"; aceitarBtn.addEventListener("click", () => aceitar(pedido.pedido_id, aceitarBtn));
    acoes.append(aceitarBtn); card.append(info, acoes); return card;
}

function cardMinha(pedido) {
    const card = elemento("article", "delivery-card");
    const info = elemento("div");
    info.append(elemento("h3", "", `#${pedido.numero} • ${pedido.empresa_nome}`));
    const meta = elemento("div", "delivery-meta");
    meta.append(elemento("span", `status-chip ${pedido.status === "saiu_para_entrega" ? "route" : ""}`, textoStatus(pedido.status)), elemento("span", "", pedido.cliente_nome || "Cliente"), elemento("span", "", pedido.cliente_telefone || "Telefone não informado"), elemento("span", "", App.dinheiro(pedido.total)));
    info.append(meta, elemento("p", "delivery-address", pedido.endereco));
    const itens = (pedido.pedido_itens || []).map((item) => `${item.quantidade}x ${item.nome_produto}`).join(" • ");
    if (itens) info.append(elemento("p", "delivery-address", itens));

    const acoes = elemento("div", "delivery-actions");
    const mapa = elemento("a", "", "Abrir rota"); mapa.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pedido.endereco)}`; mapa.target = "_blank"; mapa.rel = "noopener"; acoes.append(mapa);
    const chat = elemento("button", "", "Abrir chat"); chat.type = "button"; chat.addEventListener("click", () => abrirChat(pedido)); acoes.append(chat);
    if (pedido.status === "preparando") {
        const iniciar = elemento("button", "accept", "Iniciar entrega"); iniciar.type = "button"; iniciar.addEventListener("click", () => mudarStatus(pedido, "saiu_para_entrega", false, iniciar)); acoes.append(iniciar);
    } else if (pedido.status === "saiu_para_entrega") {
        const pagoLabel = elemento("label"); const pago = document.createElement("input"); pago.type = "checkbox"; pago.disabled = pedido.pagamento_modalidade === "online"; pagoLabel.append(pago, document.createTextNode(pedido.pagamento_modalidade === "online" ? "Pagamento online" : "Pagamento recebido"));
        const concluir = elemento("button", "done", "Confirmar entrega"); concluir.type = "button"; concluir.addEventListener("click", () => mudarStatus(pedido, "entregue", pago.checked, concluir)); acoes.append(pagoLabel, concluir);
    }
    card.append(info, acoes); return card;
}

function renderizar() {
    const minhasBox = document.getElementById("minhasEntregas");
    const disponiveisBox = document.getElementById("entregasDisponiveis");
    minhasBox.replaceChildren(); disponiveisBox.replaceChildren();
    const ativas = minhas.filter((pedido) => ["preparando", "saiu_para_entrega"].includes(pedido.status));
    if (ativas.length) ativas.forEach((pedido) => minhasBox.append(cardMinha(pedido)));
    else minhasBox.append(elemento("p", "empty", "Nenhuma entrega em andamento."));
    if (!entregador.online) disponiveisBox.append(elemento("p", "empty", "Fique online para consultar novas entregas."));
    else if (disponiveis.length) disponiveis.forEach((pedido) => disponiveisBox.append(cardDisponivel(pedido)));
    else disponiveisBox.append(elemento("p", "empty", "Nenhuma entrega disponível agora."));
    atualizarMetricas();
}

async function carregarEntregas() {
    const [resMinhas, resDisponiveis] = await Promise.all([
        db.from("pedidos").select("*,pedido_itens(*)").eq("entregador_id", usuario.id).order("created_at", { ascending: false }).limit(100),
        entregador.online ? db.rpc("listar_entregas_disponiveis") : Promise.resolve({ data: [], error: null })
    ]);
    if (resMinhas.error) throw resMinhas.error;
    if (resDisponiveis.error) throw resDisponiveis.error;
    minhas = resMinhas.data || []; disponiveis = resDisponiveis.data || [];
    renderizar(); gerenciarLocalizacao();
}

function gerenciarLocalizacao() {
    const ativa = minhas.find((pedido) => ["preparando", "saiu_para_entrega"].includes(pedido.status));
    if (!entregador?.online || !ativa || !navigator.geolocation) {
        if (localizacaoWatch !== null) navigator.geolocation.clearWatch(localizacaoWatch);
        localizacaoWatch = null;
        document.getElementById("statusLocalizacao").textContent = navigator.geolocation ? "Desativada" : "Indisponível";
        return;
    }
    if (localizacaoWatch !== null) return;
    document.getElementById("statusLocalizacao").textContent = "Conectando";
    localizacaoWatch = navigator.geolocation.watchPosition(async (posicao) => {
        document.getElementById("statusLocalizacao").textContent = "Compartilhando";
        const pedidoAtivo = minhas.find((pedido) => ["preparando", "saiu_para_entrega"].includes(pedido.status));
        if (!pedidoAtivo) return;
        const { error } = await db.rpc("entregador_atualizar_localizacao", {
            p_pedido_id: pedidoAtivo.id,
            p_latitude: posicao.coords.latitude,
            p_longitude: posicao.coords.longitude,
            p_precisao_metros: posicao.coords.accuracy
        });
        if (error) window.Monitoramento?.registrar("warning", "localizacao_entregador", App.mensagemErro(error));
    }, () => {
        document.getElementById("statusLocalizacao").textContent = "Permissão necessária";
    }, { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 });
}

online.addEventListener("change", async () => {
    online.disabled = true;
    const { data, error } = await db.rpc("entregador_definir_online", { p_online: online.checked });
    online.disabled = false;
    if (error || data !== true) { online.checked = !online.checked; return alert(`Não foi possível alterar seu status: ${App.mensagemErro(error)}`); }
    entregador.online = online.checked;
    document.getElementById("textoEntregadorOnline").textContent = online.checked ? "Online" : "Offline";
    await carregarEntregas();
});

document.getElementById("entregadorForm").addEventListener("submit", async (event) => {
    event.preventDefault(); const botao = event.currentTarget.querySelector("button"); App.definirCarregando(botao, true, "Enviando...");
    const { data, error } = await db.rpc("cadastrar_entregador", {
        p_nome: document.getElementById("entregadorNome").value.trim(),
        p_telefone: document.getElementById("entregadorTelefone").value.trim(),
        p_veiculo: document.getElementById("entregadorVeiculo").value,
        p_documento: document.getElementById("entregadorDocumento").value.trim() || null,
        p_placa: document.getElementById("entregadorPlaca").value.trim() || null
    });
    App.definirCarregando(botao, false);
    if (error) return alert(`Não foi possível enviar: ${App.mensagemErro(error)}`);
    entregador = data; cadastro.hidden = true; pendente.hidden = false;
});

async function iniciar() {
    const { data: { user } } = await db.auth.getUser();
    if (!user) { localStorage.setItem("redirect", "entregador.html"); location.replace("login.html"); return; }
    usuario = user;
    const { data, error } = await db.from("entregadores").select("*").eq("id", user.id).maybeSingle();
    loading.hidden = true;
    if (error) return App.mostrarErroPagina(`Não foi possível carregar o cadastro: ${App.mensagemErro(error)}`);
    if (!data) { cadastro.hidden = false; return; }
    entregador = data;
    if (!data.aprovado) { pendente.hidden = false; return; }
    app.hidden = false; document.getElementById("nomeEntregador").textContent = data.nome.split(/\s+/)[0]; online.checked = data.online; document.getElementById("textoEntregadorOnline").textContent = data.online ? "Online" : "Offline";
    await carregarEntregas();
    canal = db.channel(`entregador-${user.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => carregarEntregas())
        .subscribe();
}

document.getElementById("atualizarEntregas").addEventListener("click", carregarEntregas);
document.getElementById("sairEntregador").addEventListener("click", async () => { if (entregador?.online) await db.rpc("entregador_definir_online", { p_online: false }); await db.auth.signOut(); App.limparDadosPrivados(); location.replace("login.html"); });
addEventListener("beforeunload", () => { if (canal) db.removeChannel(canal); if (localizacaoWatch !== null) navigator.geolocation.clearWatch(localizacaoWatch); });
iniciar().catch((error) => { loading.hidden = true; App.mostrarErroPagina(`Falha ao iniciar: ${App.mensagemErro(error)}`); });
