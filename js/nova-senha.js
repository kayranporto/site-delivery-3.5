"use strict";

const formNovaSenha = document.getElementById("novaSenhaForm");
const statusRecuperacao = document.getElementById("statusRecuperacao");
const novoLink = document.getElementById("novoLinkRecuperacao");

function senhaValida(senha) {
    return senha.length >= 8 && /[A-Za-zÀ-ÿ]/.test(senha) && /\d/.test(senha);
}

async function verificarRecuperacao() {
    const { data: { session }, error } = await db.auth.getSession();
    if (error || !session) {
        statusRecuperacao.textContent = "Este link é inválido ou expirou. Solicite uma nova recuperação.";
        novoLink.hidden = false;
        return;
    }
    statusRecuperacao.textContent = "Digite e confirme sua nova senha.";
    formNovaSenha.hidden = false;
}

formNovaSenha.addEventListener("submit", async (event) => {
    event.preventDefault();
    const senha = document.getElementById("novaSenha").value;
    const confirmacao = document.getElementById("confirmarSenha").value;
    if (!senhaValida(senha)) return alert("A senha precisa ter pelo menos 8 caracteres, incluindo letra e número.");
    if (senha !== confirmacao) return alert("As senhas não são iguais.");
    const botao = event.currentTarget.querySelector("button"); App.definirCarregando(botao, true, "Atualizando...");
    const { error } = await db.auth.updateUser({ password: senha });
    App.definirCarregando(botao, false);
    if (error) return alert(`Não foi possível atualizar a senha: ${App.mensagemErro(error)}`);
    await db.auth.signOut(); App.limparDadosPrivados();
    alert("Senha atualizada. Entre novamente com sua nova senha.");
    location.replace("login.html");
});

verificarRecuperacao();

