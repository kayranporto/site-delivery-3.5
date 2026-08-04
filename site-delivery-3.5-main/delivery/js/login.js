"use strict";

const form = document.getElementById("loginForm");
const email = document.getElementById("email");
const senha = document.getElementById("senha");
const botao = form.querySelector("button[type='submit']");
const statusSeguranca = document.getElementById("loginSecurityStatus");
const CHAVE_TENTATIVAS = "login_tentativas_3_4";

function estadoTentativas(emailAtual) {
    const estado = App.lerJSON(CHAVE_TENTATIVAS, {}) || {};
    return estado.email === emailAtual ? estado : { email: emailAtual, falhas: 0, bloqueadoAte: 0 };
}

function salvarTentativas(estado) { App.salvarJSON(CHAVE_TENTATIVAS, estado); }

function exibirStatus(mensagem, erro = false) {
    statusSeguranca.hidden = !mensagem;
    statusSeguranca.textContent = mensagem || "";
    statusSeguranca.classList.toggle("error", erro);
}

function segundosRestantes(estado) { return Math.max(0, Math.ceil((Number(estado.bloqueadoAte || 0) - Date.now()) / 1000)); }

async function registrarTentativa(emailAtual, sucesso) {
    const { data, error } = await window.db.rpc("registrar_tentativa_login", { p_email: emailAtual, p_sucesso: sucesso });
    if (error) console.warn("Registro de segurança indisponível:", error);
    return data || {};
}

function mostrarErro(campo, mensagem) {
    campo.setAttribute("aria-invalid", "true");
    campo.focus();
    exibirStatus(mensagem, true);
    window.AppToast?.("Verifique os dados", mensagem, "error");
}

function limparErros() {
    email.removeAttribute("aria-invalid");
    senha.removeAttribute("aria-invalid");
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    limparErros();

    const emailDigitado = email.value.trim().toLowerCase();
    const senhaDigitada = senha.value;
    const estado = estadoTentativas(emailDigitado);
    const espera = segundosRestantes(estado);
    if (espera > 0) {
        exibirStatus(`Muitas tentativas. Aguarde ${espera} segundos antes de tentar novamente.`, true);
        return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDigitado)) {
        mostrarErro(email, "Informe um e-mail válido.");
        return;
    }
    if (senhaDigitada.length < 6) {
        mostrarErro(senha, "A senha deve ter pelo menos 6 caracteres.");
        return;
    }

    App.definirCarregando(botao, true, "Entrando...");
    try {
        const { data, error } = await window.db.auth.signInWithPassword({
            email: emailDigitado,
            password: senhaDigitada
        });
        if (error) throw error;
        if (!data?.user) throw new Error("Usuário não encontrado.");

        await registrarTentativa(emailDigitado, true);
        salvarTentativas({ email: emailDigitado, falhas: 0, bloqueadoAte: 0 });

        App.vincularUsuarioLocal(data.user.id);

        const solicitado = localStorage.getItem("redirect");
        localStorage.removeItem("redirect");
        window.location.href = App.destinoInterno(solicitado, "perfil.html");
    } catch (erro) {
        console.error("Erro ao fazer login:", erro);
        const resposta = await registrarTentativa(emailDigitado, false);
        estado.falhas = Number(resposta.falhas || estado.falhas + 1);
        if (resposta.bloqueado || estado.falhas >= 5) estado.bloqueadoAte = Date.now() + Math.max(60, Number(resposta.aguarde_segundos || 0)) * 1000;
        salvarTentativas(estado);
        const mensagem = estado.bloqueadoAte > Date.now()
            ? "Muitas tentativas incorretas. O formulário foi pausado por 60 segundos."
            : `Não foi possível entrar. Confira e-mail e senha. ${Math.max(0, 5 - estado.falhas)} tentativa(s) antes da pausa.`;
        exibirStatus(mensagem, true);
        window.AppToast?.("Acesso não realizado", mensagem, "error");
    } finally {
        App.definirCarregando(botao, false);
    }
});

[email, senha].forEach((campo) => campo.addEventListener("input", () => exibirStatus("")));
