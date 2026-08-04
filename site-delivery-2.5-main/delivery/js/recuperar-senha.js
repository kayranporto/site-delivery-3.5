"use strict";

const form = document.getElementById("recuperarForm");

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("email").value.trim().toLowerCase();
    const botao = form.querySelector("button[type='submit']");
    App.definirCarregando(botao, true, "Enviando...");

    try {
        const redirectTo = new URL("nova-senha.html", window.location.href).href;
        const { error } = await window.db.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw error;
        alert("Se o e-mail estiver cadastrado, você receberá um link de recuperação.");
        window.location.href = "login.html";
    } catch (erro) {
        alert(`Não foi possível enviar o link: ${erro.message || "erro desconhecido"}`);
    } finally {
        App.definirCarregando(botao, false);
    }
});
