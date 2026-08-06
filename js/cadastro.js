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
    const politica = window.AuthPolicy?.validar(senha);
    if (!politica?.valida) return alert(politica?.mensagem || "Informe uma senha segura.");
    if (senha !== confirmarSenha) return alert("As senhas não coincidem.");
    if (!App.validarTelefone(telefone)) return alert("Informe um telefone com DDD e 10 ou 11 números.");
    if (cpf && !App.validarCPF(cpf)) return alert("Informe um CPF válido ou deixe o campo vazio.");
    if (!window.DeliveryCaptcha?.validar()) return;

    App.definirCarregando(submitButton, true, "Criando conta...");
    try {
        const captchaToken = window.DeliveryCaptcha?.getToken() || undefined;
        const options = { data: { nome, sobrenome, telefone, cpf: cpf || null, tipo_conta: "cliente" } };
        if (captchaToken) options.captchaToken = captchaToken;
        const { data, error } = await window.db.auth.signUp({ email, password: senha, options });
        if (error) throw error;
        if (!data?.user) throw new Error("Não foi possível criar o usuário.");
        if (!data.session) {
            throw new Error("A confirmação de e-mail ainda está habilitada no Supabase. Desative Confirm email em Auth > Providers > Email para permitir acesso imediato.");
        }

        const { error: erroUsuario } = await window.db.from("usuarios").upsert({
            id: data.user.id, nome, sobrenome, telefone, cpf: cpf || null
        }, { onConflict: "id" });
        if (erroUsuario) throw erroUsuario;

        App.vincularUsuarioLocal(data.user.id);
        const solicitado = localStorage.getItem("redirect");
        localStorage.removeItem("redirect");
        window.AppToast?.("Conta criada", "Seu acesso já está liberado.", "success");
        window.location.replace(App.destinoInterno(solicitado, "perfil.html?cadastro=sucesso"));
    } catch (erro) {
        console.error("Erro ao criar conta:", erro);
        alert(`Não foi possível criar a conta: ${App.mensagemErro(erro, "erro desconhecido")}`);
    } finally {
        window.DeliveryCaptcha?.reset();
        App.definirCarregando(submitButton, false);
    }
});
