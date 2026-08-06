"use strict";

const form = document.getElementById("empresaLoginForm");
const email = document.getElementById("email");
const senha = document.getElementById("senha");
const submitButton = form?.querySelector("button[type='submit']");
const statusSeguranca = document.getElementById("loginSecurityStatus");
const CHAVE_TENTATIVAS = "login_empresa_tentativas_4_1";

function mensagemLogin(texto, erro = false) {
    if (statusSeguranca) { statusSeguranca.hidden = !texto; statusSeguranca.textContent = texto || ""; statusSeguranca.classList.toggle("error", erro); }
    if (texto) window.AppToast?.(erro ? "Acesso não realizado" : "Acesso", texto, erro ? "error" : "info");
}
function estadoLogin(emailAtual) {
    const salvo = App.lerJSON(CHAVE_TENTATIVAS, {}) || {};
    return salvo.email === emailAtual ? salvo : { email: emailAtual, falhas: 0, bloqueadoAte: 0 };
}
async function obterOuCriarEmpresa(user) {
    let { data: empresa, error } = await window.db.from("empresas").select("*").eq("usuario_id", user.id).maybeSingle();
    if (error) throw error;
    if (empresa) return empresa;
    const metadata = user.user_metadata || {};
    if (metadata.tipo_conta !== "restaurante") return null;
    const cnpj = App.somenteNumeros(metadata.cnpj);
    if (!metadata.nome || !App.validarCNPJ(cnpj)) throw new Error("Os dados do restaurante estão incompletos. Procure o suporte.");
    const resposta = await window.db.from("empresas").insert({
        usuario_id: user.id, nome: String(metadata.nome).trim(), email: user.email,
        telefone: String(metadata.telefone || "").trim(), cnpj, status: false, taxa_entrega: 0, pedido_minimo: 0
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
        if (espera) return mensagemLogin(`Aguarde ${espera} segundos antes de tentar novamente.`, true);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDigitado)) return mensagemLogin("Informe um e-mail válido.", true);
        if (!senhaDigitada) return mensagemLogin("Informe sua senha.", true);
        if (!window.DeliveryCaptcha?.validar()) return;

        App.definirCarregando(submitButton, true, "Entrando...");
        try {
            const captchaToken = window.DeliveryCaptcha?.getToken() || undefined;
            const credentials = { email: emailDigitado, password: senhaDigitada };
            if (captchaToken) credentials.options = { captchaToken };
            const { data, error } = await window.db.auth.signInWithPassword(credentials);
            if (error) throw error;
            if (!data?.user) throw new Error("Usuário não encontrado.");
            App.salvarJSON(CHAVE_TENTATIVAS, { email: emailDigitado, falhas: 0, bloqueadoAte: 0 });
            const empresa = await obterOuCriarEmpresa(data.user);
            if (!empresa) { await window.db.auth.signOut(); throw new Error("Esta conta ainda não possui um restaurante cadastrado."); }
            App.vincularUsuarioLocal(data.user.id); App.salvarJSON("empresaLogada", empresa);
            window.location.replace("empresa-dashboard.html");
        } catch (erro) {
            console.error("Erro no login da empresa:", erro);
            estado.falhas = Number(estado.falhas || 0) + 1;
            if (estado.falhas >= 5) estado.bloqueadoAte = Date.now() + 60000;
            App.salvarJSON(CHAVE_TENTATIVAS, estado);
            const texto = estado.bloqueadoAte > Date.now()
                ? "Muitas tentativas incorretas. Aguarde 60 segundos."
                : `Confira o e-mail e a senha. ${Math.max(0, 5 - estado.falhas)} tentativa(s) antes da pausa local.`;
            mensagemLogin(texto, true);
        } finally {
            window.DeliveryCaptcha?.reset(); App.definirCarregando(submitButton, false);
        }
    });
    [email, senha].forEach((campo) => campo.addEventListener("input", () => mensagemLogin("")));
}
