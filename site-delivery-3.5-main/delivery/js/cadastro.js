"use strict";

const form = document.getElementById("cadastroForm");
const submitButton = form.querySelector("button[type='submit']");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nome = document.getElementById("nome").value.trim();
    const sobrenome = document.getElementById("sobrenome").value.trim();
    const telefone = document.getElementById("telefone").value.trim();
    const email = document.getElementById("email").value.trim().toLowerCase();
    const cpf = App.somenteNumeros(document.getElementById("cpf").value);
    const senha = document.getElementById("senha").value;
    const confirmarSenha = document.getElementById("confirmarSenha").value;

    if (!nome || !sobrenome || !telefone || !email || !senha || !confirmarSenha) {
        alert("Preencha todos os campos obrigatórios.");
        return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return alert("Informe um e-mail válido.");
    if (senha.length < 6) return alert("A senha deve ter pelo menos 6 caracteres.");
    if (senha !== confirmarSenha) return alert("As senhas não coincidem.");
    if (!App.validarTelefone(telefone)) return alert("Informe um telefone com DDD e 10 ou 11 números.");
    if (cpf && !App.validarCPF(cpf)) return alert("Informe um CPF válido ou deixe o campo vazio.");

    App.definirCarregando(submitButton, true, "Criando conta...");
    try {
        const { data, error } = await window.db.auth.signUp({
            email,
            password: senha,
            options: { data: { nome, sobrenome, telefone, cpf: cpf || null, tipo_conta: "cliente" } }
        });
        if (error) throw error;
        if (!data?.user) throw new Error("Não foi possível criar o usuário.");

        if (data.session) {
            const { error: erroUsuario } = await window.db.from("usuarios").upsert({
                id: data.user.id,
                nome,
                sobrenome,
                telefone,
                cpf: cpf || null
            }, { onConflict: "id" });
            if (erroUsuario) throw erroUsuario;
        }

        alert(data.session
            ? "Conta criada com sucesso!"
            : "Conta criada. Confirme o e-mail antes de entrar, caso a confirmação esteja habilitada.");
        window.location.href = "login.html";
    } catch (erro) {
        console.error("Erro ao criar conta:", erro);
        alert(`Não foi possível criar a conta: ${erro.message || "erro desconhecido"}`);
    } finally {
        App.definirCarregando(submitButton, false);
    }
});
