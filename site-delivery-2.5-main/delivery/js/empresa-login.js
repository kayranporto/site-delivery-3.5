"use strict";

const form = document.getElementById("empresaLoginForm");
const email = document.getElementById("email");
const senha = document.getElementById("senha");
const submitButton = form?.querySelector("button[type='submit']");
const statusSeguranca = document.getElementById("loginSecurityStatus");
const CHAVE_TENTATIVAS = "login_tentativas_3_4";

function mensagemLogin(texto, erro = false) {
    if (statusSeguranca) { statusSeguranca.hidden = !texto; statusSeguranca.textContent = texto || ""; statusSeguranca.classList.toggle("error", erro); }
    if (texto) window.AppToast?.(erro ? "Acesso não realizado" : "Acesso", texto, erro ? "error" : "info");
}

function estadoLogin(emailAtual) {
    const salvo = App.lerJSON(CHAVE_TENTATIVAS, {}) || {};
    return salvo.email === emailAtual ? salvo : { email: emailAtual, falhas: 0, bloqueadoAte: 0 };
}

async function registrarTentativa(emailAtual, sucesso) {
    const { data, error } = await window.db.rpc("registrar_tentativa_login", { p_email: emailAtual, p_sucesso: sucesso });
    if (error) console.warn("Registro de segurança indisponível:", error);
    return data || {};
}

function mostrarMensagemCadastro() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("cadastro") !== "sucesso") return;

    const aviso = document.createElement("div");
    aviso.className = "mensagem-sucesso";
    aviso.setAttribute("role", "status");
    aviso.textContent = "Cadastro criado com sucesso. Confirme seu e-mail e depois faça login.";
    form?.parentElement?.insertBefore(aviso, form);
}

mostrarMensagemCadastro();

async function obterOuCriarEmpresa(user) {
    let { data: empresa, error } = await window.db
        .from("empresas")
        .select("*")
        .eq("usuario_id", user.id)
        .maybeSingle();

    if (error) throw error;
    if (empresa) return empresa;

    const metadata = user.user_metadata || {};
    if (metadata.tipo_conta !== "restaurante") return null;

    const cnpj = App.somenteNumeros(metadata.cnpj);
    if (!metadata.nome || !App.validarCNPJ(cnpj)) {
        throw new Error("Os dados do restaurante estão incompletos. Faça um novo cadastro ou procure o suporte.");
    }

    const resposta = await window.db.from("empresas").insert({
        usuario_id: user.id,
        nome: String(metadata.nome).trim(),
        email: user.email,
        telefone: String(metadata.telefone || "").trim(),
        cnpj,
        status: false,
        taxa_entrega: 0,
        pedido_minimo: 0
    }).select("*").single();

    if (resposta.error) throw resposta.error;
    return resposta.data;
}

if (!form || !email || !senha || !submitButton) {
    console.error("Formulário de login da empresa não encontrado.");
} else {
    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const emailDigitado = email.value.trim().toLowerCase();
        const senhaDigitada = senha.value;
        const estado = estadoLogin(emailDigitado);
        const espera = Math.max(0, Math.ceil((Number(estado.bloqueadoAte || 0) - Date.now()) / 1000));
        if (espera) { mensagemLogin(`Muitas tentativas. Aguarde ${espera} segundos.`, true); return; }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDigitado)) {
            mensagemLogin("Informe um e-mail válido.", true);
            return;
        }
        if (senhaDigitada.length < 6) {
            mensagemLogin("Informe uma senha válida.", true);
            return;
        }

        App.definirCarregando(submitButton, true, "Entrando...");

        try {
            const { data, error } = await window.db.auth.signInWithPassword({
                email: emailDigitado,
                password: senhaDigitada
            });

            if (error) throw error;
            if (!data?.user) throw new Error("Usuário não encontrado.");

            await registrarTentativa(emailDigitado, true);
            App.salvarJSON(CHAVE_TENTATIVAS, { email: emailDigitado, falhas: 0, bloqueadoAte: 0 });

            const empresa = await obterOuCriarEmpresa(data.user);

            if (!empresa) {
                await window.db.auth.signOut();
                throw new Error("Esta conta ainda não possui um restaurante cadastrado.");
            }

            App.vincularUsuarioLocal(data.user.id);
            App.salvarJSON("empresaLogada", empresa);
            window.location.href = "empresa-dashboard.html";
        } catch (erro) {
            console.error("Erro no login da empresa:", erro);
            const resposta = await registrarTentativa(emailDigitado, false);
            estado.falhas = Number(resposta.falhas || estado.falhas + 1);
            if (resposta.bloqueado || estado.falhas >= 5) estado.bloqueadoAte = Date.now() + 60000;
            App.salvarJSON(CHAVE_TENTATIVAS, estado);
            const texto = estado.bloqueadoAte > Date.now()
                ? "Muitas tentativas incorretas. Aguarde 60 segundos."
                : `Confira o e-mail e a senha. ${Math.max(0, 5 - estado.falhas)} tentativa(s) antes da pausa.`;
            mensagemLogin(texto, true);
        } finally {
            App.definirCarregando(submitButton, false);
        }
    });
    [email, senha].forEach((campo) => campo.addEventListener("input", () => mensagemLogin("")));
}
