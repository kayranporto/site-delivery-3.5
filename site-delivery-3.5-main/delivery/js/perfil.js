"use strict";

const STATUS_FINAIS = new Set(["entregue", "cancelado"]);
const ETAPAS_STATUS = Object.freeze({
    recebido: 1,
    preparando: 2,
    saiu_para_entrega: 3,
    entregue: 4,
    cancelado: 0
});

function nomeStatus(status) {
    const nomes = {
        recebido: "Pedido recebido",
        preparando: "Em preparação",
        saiu_para_entrega: "Saiu para entrega",
        entregue: "Pedido entregue",
        cancelado: "Pedido cancelado"
    };
    return nomes[status] || "Pedido recebido";
}

function iniciais(nome) {
    const partes = String(nome || "Usuário").trim().split(/\s+/).filter(Boolean);
    return (partes.length > 1 ? `${partes[0][0]}${partes.at(-1)[0]}` : partes[0]?.slice(0, 2) || "U").toUpperCase();
}

function renderizarAvatar(url, nome) {
    const avatar = document.getElementById("avatarUsuario");
    const fallback = () => avatar.replaceChildren(criar("span", "", iniciais(nome)));
    if (!url) { fallback(); return; }
    const imagem = document.createElement("img");
    imagem.src = url;
    imagem.alt = `Foto de perfil de ${nome}`;
    imagem.referrerPolicy = "no-referrer";
    imagem.addEventListener("error", fallback, { once: true });
    avatar.replaceChildren(imagem);
}

function dataMembro(valor) {
    const data = valor ? new Date(valor) : null;
    if (!data || !Number.isFinite(data.getTime())) return "Cliente Delivery";
    return `Cliente desde ${data.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`;
}

function criar(tag, classe, texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
}

function renderizarPedidoDestaque(pedidos) {
    const container = document.getElementById("pedidoDestaque");
    container.replaceChildren();

    if (!pedidos.length) {
        const vazio = criar("div", "pedido-vazio");
        const texto = criar("div");
        texto.append(
            criar("h3", "", "Seu próximo pedido começa aqui"),
            criar("p", "", "Explore os restaurantes disponíveis e encontre algo gostoso.")
        );
        const link = criar("a", "", "Ver restaurantes");
        link.href = "index.html";
        vazio.append(texto, link);
        container.append(vazio);
        return;
    }

    const pedido = pedidos.find((item) => !STATUS_FINAIS.has(item.status)) || pedidos[0];
    const etapa = ETAPAS_STATUS[pedido.status] ?? 1;
    const atual = criar("div", "pedido-atual");
    const primeiraLinha = criar("div", "pedido-linha");
    const restaurante = criar("div", "pedido-restaurante");
    restaurante.append(
        criar("h3", "", pedido.empresa_nome || "Restaurante"),
        criar("p", "", `Pedido #${pedido.numero || String(pedido.id || "").slice(0, 8) || "—"}`)
    );
    const total = criar("div", "pedido-total");
    total.append(criar("span", "", "Total"), criar("strong", "", App.dinheiro(pedido.total)));
    primeiraLinha.append(restaurante, total);

    const etapas = criar("div", "etapas-pedido");
    etapas.setAttribute("aria-label", nomeStatus(pedido.status));
    for (let indice = 1; indice <= 4; indice += 1) {
        const marcador = criar("span", indice <= etapa ? "ativa" : "");
        etapas.append(marcador);
    }

    const rodape = criar("div", "pedido-status-linha");
    const status = criar("span", `pedido-status ${pedido.status || "recebido"}`, nomeStatus(pedido.status));
    const previsao = criar("span", "pedido-previsao");
    if (!STATUS_FINAIS.has(pedido.status)) {
        previsao.textContent = `Previsão: ${Number(pedido.previsao_min) || 25}–${Number(pedido.previsao_max) || 45} min`;
    } else if (pedido.created_at) {
        previsao.textContent = new Date(pedido.created_at).toLocaleDateString("pt-BR");
    }

    const acao = criar("a", "pedido-acao", STATUS_FINAIS.has(pedido.status) ? "Ver detalhes" : "Acompanhar pedido");
    acao.href = `acompanhamento.html?id=${encodeURIComponent(pedido.id)}`;
    rodape.append(status, previsao, acao);
    atual.append(primeiraLinha, etapas, rodape);
    container.append(atual);
}

async function atualizarResumo(pedidos) {
    const favoritos = window.FavoritesSync ? await window.FavoritesSync.ready() : App.lerJSON("favoritos", []);
    const listaFavoritos = Array.isArray(favoritos) ? [...new Set(favoritos.map(String).filter(Boolean))] : [];
    const andamento = pedidos.filter((pedido) => !STATUS_FINAIS.has(pedido.status)).length;
    const economia = pedidos.reduce((total, pedido) => total + Math.max(0, Number(pedido.desconto) || 0), 0);

    document.getElementById("totalPedidosPerfil").textContent = String(pedidos.length);
    document.getElementById("pedidosAndamentoPerfil").textContent = String(andamento);
    document.getElementById("totalFavoritosPerfil").textContent = String(listaFavoritos.length);
    document.getElementById("economiaPerfil").textContent = App.dinheiro(economia);
}

function atualizarProgresso(usuario, user, totalEnderecos) {
    const verificacoes = [
        Boolean(usuario?.nome),
        Boolean(usuario?.sobrenome),
        App.validarTelefone(usuario?.telefone),
        App.validarCPF(usuario?.cpf),
        Boolean(usuario?.avatar_url),
        Boolean(user?.email),
        totalEnderecos > 0
    ];
    const completos = verificacoes.filter(Boolean).length;
    const percentual = Math.round((completos / verificacoes.length) * 100);
    const progresso = document.getElementById("progressoPerfil");
    progresso.setAttribute("aria-valuenow", String(percentual));
    document.getElementById("progressoBarra").style.width = `${percentual}%`;
    document.getElementById("progressoValor").textContent = `${percentual}%`;
    document.getElementById("progressoMensagem").textContent = percentual === 100
        ? "Tudo certo! Seu cadastro está completo para receber pedidos sem atrasos."
        : `Faltam ${verificacoes.length - completos} informações para deixar seus pedidos mais rápidos.`;
}

async function carregarFidelidade() {
    const container = document.getElementById("fidelidadePerfil");
    const { data: saldos, error } = await window.db.rpc("meus_beneficios_fidelidade");
    if (error) {
        container.replaceChildren(criar("p", "loyalty-empty", "Os pontos serão exibidos após ativar a migração operacional."));
        return;
    }
    const ids = (saldos || []).map((item) => item.empresa_id);
    const { data: empresas } = ids.length ? await window.db.from("empresas_catalogo").select("id,nome").in("id", ids) : { data: [] };
    const nomes = new Map((empresas || []).map((item) => [String(item.id), item.nome]));
    const total = (saldos || []).reduce((soma, item) => soma + Number(item.pontos || 0), 0);
    document.getElementById("totalPontosPerfil").textContent = `${total} ${total === 1 ? "ponto" : "pontos"}`;
    container.replaceChildren();
    if (!saldos?.length) return container.append(criar("p", "loyalty-empty", "Quando um restaurante oferecer fidelidade, seus pedidos entregues acumularão pontos aqui."));
    saldos.forEach((saldo) => {
        const linha = criar("article", "loyalty-row");
        const texto = criar("div"); texto.append(criar("strong", "", nomes.get(String(saldo.empresa_id)) || "Restaurante"), criar("small", "", `${saldo.pontos_para_beneficio} pontos valem ${App.dinheiro(saldo.valor_beneficio)}`));
        const pontos = criar("div", "loyalty-points"); pontos.append(criar("b", "", String(saldo.pontos || 0)), criar("span", "", "pontos"));
        if (Number(saldo.pontos || 0) >= Number(saldo.pontos_para_beneficio || 0)) {
            const resgatar = criar("button", "loyalty-redeem", "Resgatar"); resgatar.type = "button";
            resgatar.addEventListener("click", async () => {
                if (!confirm(`Trocar ${saldo.pontos_para_beneficio} pontos por ${App.dinheiro(saldo.valor_beneficio)} em desconto?`)) return;
                App.definirCarregando(resgatar, true, "Resgatando...");
                const { data: codigo, error: erroResgate } = await window.db.rpc("resgatar_beneficio_fidelidade", { p_empresa_id: saldo.empresa_id });
                App.definirCarregando(resgatar, false);
                if (erroResgate) return window.AppToast?.("Não foi possível resgatar", App.mensagemErro(erroResgate), "error");
                try { await navigator.clipboard.writeText(codigo); } catch { /* O código também aparece na mensagem. */ }
                window.AppToast?.("Benefício resgatado", `Cupom ${codigo} copiado. Ele vale por 30 dias.`, "success", 9000);
                carregarFidelidade();
            });
            pontos.append(resgatar);
        }
        linha.append(texto, pontos); container.append(linha);
    });
}

async function carregarPerfil() {
    try {
        const { data: { user }, error } = await window.db.auth.getUser();
        if (error || !user) {
            localStorage.setItem("redirect", "perfil.html");
            window.location.replace("login.html");
            return;
        }
        App.vincularUsuarioLocal(user.id);

        const [resUsuario, resPedidos, resEnderecos, resAdmin] = await Promise.all([
            window.db.from("usuarios").select("nome,sobrenome,telefone,cpf,avatar_url").eq("id", user.id).maybeSingle(),
            window.db.from("pedidos")
                .select("id,numero,empresa_id,empresa_nome,status,total,desconto,created_at")
                .eq("usuario_id", user.id)
                .order("created_at", { ascending: false })
                .limit(100),
            window.db.from("enderecos").select("id").eq("usuario_id", user.id),
            window.db.rpc("usuario_eh_admin")
        ]);

        if (resUsuario.error) console.error("Erro ao carregar dados do perfil:", resUsuario.error);
        if (resPedidos.error) console.error("Erro ao carregar resumo dos pedidos:", resPedidos.error);
        if (resEnderecos.error) console.error("Erro ao carregar endereços:", resEnderecos.error);

        const usuario = resUsuario.data || null;
        const pedidos = resPedidos.error ? [] : (resPedidos.data || []);
        const nome = [usuario?.nome, usuario?.sobrenome].filter(Boolean).join(" ")
            || user.user_metadata?.nome
            || "Usuário";

        document.getElementById("nomeUsuario").textContent = nome;
        document.getElementById("primeiroNome").textContent = nome.split(/\s+/)[0];
        document.getElementById("emailUsuario").textContent = user.email || "E-mail não informado";
        renderizarAvatar(usuario?.avatar_url, nome);
        document.getElementById("membroDesde").textContent = dataMembro(user.created_at);

        await Promise.all([atualizarResumo(pedidos), carregarFidelidade()]);
        renderizarPedidoDestaque(pedidos);
        atualizarProgresso(usuario, user, resEnderecos.error ? 0 : (resEnderecos.data || []).length);
        document.getElementById("adminLink").hidden = resAdmin.error || resAdmin.data !== true;
    } catch (erro) {
        console.error("Erro ao carregar perfil:", erro);
        App.mostrarErroPagina("Não foi possível carregar sua área do cliente agora.");
        await atualizarResumo([]);
        renderizarPedidoDestaque([]);
    }
}

const logout = document.getElementById("logout");
logout.addEventListener("click", async () => {
    if (!confirm("Deseja sair da sua conta?")) return;
    App.definirCarregando(logout, true, "Saindo...");
    try {
        const { error } = await window.db.auth.signOut();
        if (error) throw error;
        App.limparDadosPrivados();
        window.location.replace("index.html");
    } catch (erro) {
        window.AppToast?.("Não foi possível sair", App.mensagemErro(erro), "error");
    } finally {
        App.definirCarregando(logout, false);
    }
});

carregarPerfil();
