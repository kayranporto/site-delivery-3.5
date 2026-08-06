"use strict";

const form = document.getElementById("empresaCadastroForm");
const submitButton = form?.querySelector("button[type='submit']");

if (!form || !submitButton) {
    console.error("Formulário de cadastro da empresa não encontrado.");
} else {
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const nome = document.getElementById("nome").value.trim();
        const email = document.getElementById("email").value.trim().toLowerCase();
        const telefone = document.getElementById("telefone").value.trim();
        const cnpj = App.somenteNumeros(document.getElementById("cnpj").value);
        const senha = document.getElementById("senha").value;
        const confirmarSenha = document.getElementById("confirmarSenha").value;

        if (!nome || !email || !telefone || !cnpj || !senha || !confirmarSenha) return alert("Preencha todos os campos.");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return alert("Informe um e-mail válido.");
        if (!App.validarTelefone(telefone)) return alert("Informe um telefone com DDD e 10 ou 11 números.");
        if (!App.validarCNPJ(cnpj)) return alert("Informe um CNPJ válido.");
        const politica = window.AuthPolicy?.validar(senha);
        if (!politica?.valida) return alert(politica?.mensagem || "Informe uma senha segura.");
        if (senha !== confirmarSenha) return alert("As senhas não coincidem.");
        if (!window.DeliveryCaptcha?.validar()) return;

        App.definirCarregando(submitButton, true, "Criando restaurante...");
        try {
            const captchaToken = window.DeliveryCaptcha?.getToken() || undefined;
            const options = { data: { tipo_conta: "restaurante", nome, telefone, cnpj } };
            if (captchaToken) options.captchaToken = captchaToken;
            const { data, error } = await window.db.auth.signUp({ email, password: senha, options });
            if (error) throw error;

            const user = data?.user;
            if (!user) throw new Error("O Supabase não retornou o usuário criado.");
            if (Array.isArray(user.identities) && user.identities.length === 0) {
                throw new Error("Este e-mail já possui uma conta. Entre na área do restaurante ou use outro e-mail.");
            }
            if (!data.session) {
                throw new Error("A confirmação de e-mail ainda está habilitada no Supabase. Desative Confirm email em Auth > Providers > Email para permitir acesso imediato.");
            }

            let { data: empresa, error: erroEmpresa } = await window.db.from("empresas")
                .select("*").eq("usuario_id", user.id).maybeSingle();
            if (erroEmpresa) throw erroEmpresa;
            if (!empresa) {
                const resposta = await window.db.from("empresas").insert({
                    usuario_id: user.id, nome, email, telefone, cnpj, status: false, taxa_entrega: 0, pedido_minimo: 0
                }).select("*").single();
                if (resposta.error) throw resposta.error;
                empresa = resposta.data;
            }

            App.vincularUsuarioLocal(user.id);
            App.salvarJSON("empresaLogada", empresa);
            window.AppToast?.("Restaurante cadastrado", "Complete a loja no painel. A publicação depende da aprovação administrativa.", "success");
            window.location.replace("empresa-dashboard.html#configuracoes");
        } catch (erro) {
            console.error("Erro no cadastro da empresa:", erro);
            const mensagem = App.mensagemErro(erro, "Não foi possível concluir o cadastro. Tente novamente.");
            const normalizada = mensagem.toLowerCase();
            if (/cnpj|empresas_cnpj_unique|duplicate key.*cnpj|já existe.*cnpj/.test(normalizada)) {
                alert("Não foi possível cadastrar o restaurante. Este CNPJ já está cadastrado.");
            } else if (/already registered|user already registered|email.*exist|já possui uma conta/.test(normalizada)) {
                alert("Este e-mail já possui uma conta. Entre na Área do Restaurante ou use outro e-mail.");
            } else {
                alert(`Não foi possível cadastrar o restaurante.\n\n${mensagem}`);
            }
        } finally {
            window.DeliveryCaptcha?.reset();
            App.definirCarregando(submitButton, false);
        }
    });
}
