import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN") ?? "";
    const siteUrl = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
    const authorization = request.headers.get("Authorization") ?? "";

    if (!supabaseUrl || !anonKey || !serviceKey || !accessToken || !siteUrl) {
      return json({ error: "Pagamento online ainda não foi configurado pelo administrador." }, 503);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Sessão inválida." }, 401);

    const { pedido_id: pedidoId } = await request.json();
    if (!pedidoId) return json({ error: "Pedido não informado." }, 400);

    const { data: pedido, error: pedidoError } = await userClient
      .from("pedidos")
      .select("id,numero,empresa_nome,total,status,pagamento_status,pagamento_url")
      .eq("id", pedidoId)
      .eq("usuario_id", user.id)
      .single();
    if (pedidoError || !pedido) return json({ error: "Pedido não encontrado." }, 404);
    if (pedido.status === "cancelado") return json({ error: "Pedido cancelado não pode ser pago." }, 409);
    if (pedido.pagamento_status === "pago") return json({ error: "Este pedido já está pago." }, 409);

    const notificationUrl = `${supabaseUrl}/functions/v1/mercado-pago-webhook`;
    const backUrl = `${siteUrl}/acompanhamento.html?id=${encodeURIComponent(pedido.id)}`;
    const preferenceResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `pedido-${pedido.id}`,
      },
      body: JSON.stringify({
        external_reference: pedido.id,
        items: [{
          id: pedido.id,
          title: `Pedido #${pedido.numero} — ${pedido.empresa_nome}`.slice(0, 120),
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number(pedido.total),
        }],
        payer: { email: user.email },
        back_urls: {
          success: `${backUrl}&pagamento=sucesso`,
          pending: `${backUrl}&pagamento=pendente`,
          failure: `${backUrl}&pagamento=falha`,
        },
        auto_return: "approved",
        notification_url: notificationUrl,
        statement_descriptor: "MULTI DELIVERY",
      }),
    });

    const preference = await preferenceResponse.json();
    if (!preferenceResponse.ok || !preference?.id) {
      console.error("Falha Mercado Pago", preference);
      return json({ error: "Não foi possível iniciar o pagamento." }, 502);
    }

    const checkoutUrl = preference.init_point || preference.sandbox_init_point;
    const { error: updateError } = await adminClient.from("pedidos").update({
      pagamento_modalidade: "online",
      pagamento_provider: "mercado_pago",
      pagamento_referencia: String(preference.id),
      pagamento_url: checkoutUrl,
      pagamento_atualizado_em: new Date().toISOString(),
    }).eq("id", pedido.id).eq("usuario_id", user.id);
    if (updateError) throw updateError;

    return json({ checkout_url: checkoutUrl, preference_id: preference.id });
  } catch (error) {
    console.error(error);
    return json({ error: "Erro interno ao iniciar o pagamento." }, 500);
  }
});

