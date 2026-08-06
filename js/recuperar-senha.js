"use strict";

const form = document.getElementById("recuperarForm");
form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("email").value.trim().toLowerCase();
    const botao = form.querySelector("button[type='submit']");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return alert("Informe um e-mail válido.");
    if (!window.DeliveryCaptcha?.validar()) return;
    App.definirCarregando(botao, true, "Enviando...");
    try {
        const redirectTo = new URL("nova-senha.html", window.location.href).href;
        const captchaToken = window.DeliveryCaptcha?.getToken() || undefined;
        const options = { redirectTo };
        if (captchaToken) options.captchaToken = captchaToken;
        const { error } = await window.db.auth.resetPasswordForEmail(email, options);
        if (error) throw error;
        alert("Se o e-mail estiver cadastrado, você receberá um link de recuperação.");
        window.location.replace("login.html");
    } catch (erro) {
        alert(`Não foi possível enviar o link: ${App.mensagemErro(erro, "erro desconhecido")}`);
    } finally {
        window.DeliveryCaptcha?.reset(); App.definirCarregando(botao, false);
    }
});
