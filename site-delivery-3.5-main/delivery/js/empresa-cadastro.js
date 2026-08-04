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

        if (!nome || !email || !telefone || !cnpj || !senha || !confirmarSenha) {
            alert("Preencha todos os campos.");
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            alert("Informe um e-mail válido.");
            return;
        }
        if (!App.validarTelefone(telefone)) {
            alert("Informe um telefone com DDD e 10 ou 11 números.");
            return;
        }
        if (!App.validarCNPJ(cnpj)) {
            alert("Informe um CNPJ válido.");
            return;
        }
        if (senha.length < 6) {
            alert("A senha deve possuir pelo menos 6 caracteres.");
            return;
        }
        if (senha !== confirmarSenha) {
            alert("As senhas não coincidem.");
            return;
        }

        App.definirCarregando(submitButton, true, "Criando restaurante...");

        try {
            const { data, error } = await window.db.auth.signUp({
                email,
                password: senha,
                options: {
                    data: {
                        tipo_conta: "restaurante",
                        nome,
                        telefone,
                        cnpj
                    }
                }
            });

            if (error) throw error;

            const user = data?.user;
            const session = data?.session;

            if (!user) {
                throw new Error("O Supabase não retornou o usuário criado.");
            }

            // O Supabase pode ocultar a existência de um e-mail já cadastrado.
            // Quando isso acontece, o array identities costuma vir vazio.
            if (Array.isArray(user.identities) && user.identities.length === 0) {
                throw new Error("Este e-mail já possui uma conta. Entre na área do restaurante ou use outro e-mail.");
            }

            // A empresa só é criada quando existe uma sessão válida. Assim, projetos
            // com confirmação de e-mail não reservam CNPJ antes da confirmação.
            if (session) {
                let { data: empresa, error: erroEmpresa } = await window.db
                    .from("empresas")
                    .select("*")
                    .eq("usuario_id", user.id)
                    .maybeSingle();

                if (erroEmpresa) throw erroEmpresa;

                if (!empresa) {
                    const respostaFallback = await window.db
                        .from("empresas")
                        .insert({
                            usuario_id: user.id,
                            nome,
                            email,
                            telefone,
                            cnpj,
                            status: false,
                            taxa_entrega: 0,
                            pedido_minimo: 0
                        })
                        .select("*")
                        .single();

                    if (respostaFallback.error) throw respostaFallback.error;
                    empresa = respostaFallback.data;
                }

                App.vincularUsuarioLocal(user.id);
                App.salvarJSON("empresaLogada", empresa);
                alert("Restaurante cadastrado com sucesso! Complete os dados no painel. A loja ficará visível após aprovação.");
                window.location.href = "empresa-dashboard.html";
                return;
            }

            alert(
                "Cadastro criado com sucesso!\n\n" +
                "Verifique seu e-mail para confirmar a conta. Depois, entre na Área do Restaurante e complete os dados para solicitar aprovação."
            );
            window.location.href = "empresa-login.html?cadastro=sucesso";
        } catch (erro) {
            console.error("Erro no cadastro da empresa:", erro);

            const mensagem = App.mensagemErro(
                erro,
                "Não foi possível concluir o cadastro. Tente novamente."
            );
            const mensagemNormalizada = mensagem.toLowerCase();

            if (/cnpj|empresas_cnpj_unique|duplicate key.*cnpj|já existe.*cnpj/.test(mensagemNormalizada)) {
                alert("Não foi possível cadastrar o restaurante. Este CNPJ já está cadastrado.");
            } else if (/already registered|user already registered|email.*exist|já possui uma conta/.test(mensagemNormalizada)) {
                alert("Este e-mail já possui uma conta. Entre na Área do Restaurante ou use outro e-mail.");
            } else if (/row-level security|permission denied|not authorized/.test(mensagemNormalizada)) {
                alert(
                    "O cadastro chegou ao Supabase, mas o banco bloqueou o acesso.\n\n" +
                    "Verifique se o arquivo SETUP-COMPLETO.sql foi executado no projeto correto e se as políticas RLS estão ativas.\n\n" +
                    `Detalhe: ${mensagem}`
                );
            } else if (/email.*confirm|confirm.*email/.test(mensagemNormalizada)) {
                alert(`O Supabase exige confirmação do e-mail antes de continuar.\n\nDetalhe: ${mensagem}`);
            } else {
                alert(`Não foi possível cadastrar o restaurante.\n\n${mensagem}`);
            }
        } finally {
            App.definirCarregando(submitButton, false);
        }
    });
}
