"use strict";

const SUPABASE_URL = "https://wzxsjxdbxonrmlmzufpv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6eHNqeGRieG9ucm1sbXp1ZnB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjA2NzIsImV4cCI6MjEwMDkzNjY3Mn0.FWE89Blk5Y16r_WmeZRVq8ZSbySI7PaIMytck6NL8oY";
const SUPABASE_PROJECT_REF = "wzxsjxdbxonrmlmzufpv";

(() => {
    if (window.db) return;

    const mensagem = "Não foi possível conectar ao serviço de dados. Verifique a internet e tente novamente.";

    function clienteIndisponivel() {
        const resultado = () => ({ data: null, error: new Error(mensagem), count: 0 });
        let consulta;
        consulta = new Proxy({}, {
            get(_alvo, propriedade) {
                if (propriedade === "then") {
                    return (resolver) => Promise.resolve(resultado()).then(resolver);
                }
                return () => consulta;
            }
        });

        const respostaAuth = async () => resultado();
        return {
            indisponivel: true,
            from: () => consulta,
            rpc: respostaAuth,
            functions: { invoke: respostaAuth },
            auth: {
                getUser: async () => ({ data: { user: null }, error: new Error(mensagem) }),
                getSession: async () => ({ data: { session: null }, error: new Error(mensagem) }),
                signUp: respostaAuth,
                signInWithPassword: respostaAuth,
                signOut: respostaAuth,
                resetPasswordForEmail: respostaAuth,
                updateUser: respostaAuth
            }
        };
    }

    try {
        if (!window.supabase?.createClient) throw new Error("Biblioteca do Supabase não carregada.");
        if (!SUPABASE_URL.includes(`://${SUPABASE_PROJECT_REF}.supabase.co`)) {
            throw new Error("A URL do Supabase não corresponde ao projeto configurado.");
        }
        window.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
    } catch (erro) {
        console.error(erro);
        window.db = clienteIndisponivel();
        window.App?.mostrarErroPagina(mensagem);
    }
})();
