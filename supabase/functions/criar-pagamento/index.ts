import { createClient } from "supabase";
import { corsHeaders, json } from "../_shared/cors.ts";

function checkoutUrlValida(value: unknown) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:"
      && (url.hostname.endsWith("mercadopago.com") || url.hostname.endsWith("mercadopago.com.br"));
  } catch {
    return false;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request) });
  }
  if (request.method !== "POST") return json(request, { error: "Método não permitido." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN") ?? "";
    const siteUrl = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
    const authorization = request.headers.get("Authorization") ?? "";

    if (!supabaseUrl || !publishableKey || !serviceKey || !accessToken || !siteUrl) {
      return json(request, { error: "Pagamento online ainda não foi configurado pelo administrador." }, 503);
    }

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json(request, { error: "Sessão inválida." }, 401);

    const body: any = await request.json().catch(() => ({}));
    const pedidoId = String(body?.pedido_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(pedidoId)) {
      return json(request, { error: "Pedido não informado." }, 400);
    }

    const { data: pedido, error: pedidoError } = await userClient
      .from("pedidos")
      .select("id,numero,empresa_nome,total,status,pagamento_status,pagamento_url,pagamento_preferencia_id")
      .eq("id", pedidoId)
      .eq("usuario_id", user.id)
      .single();

    if (pedidoError || !pedido) return json(request, { error: "Pedido não encontrado." }, 404);
    if (pedido.status === "cancelado") return json(request, { error: "Pedido cancelado não pode ser pago." }, 409);
    if (pedido.pagamento_status === "pago") return json(request, { error: "Este pedido já está pago." }, 409);

    if (pedido.pagamento_preferencia_id && checkoutUrlValida(pedido.pagamento_url)) {
      return json(request, {
        checkout_url: pedido.pagamento_url,
        preference_id: pedido.pagamento_preferencia_id,
        reutilizada: true,
      });
    }

    const notificationUrl = `${supabaseUrl}/functions/v1/mercado-pago-webhook`;
    const backUrl = `${siteUrl}/acompanhamento.html?id=${encodeURIComponent(pedido.id)}`;
    const preferenceResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `pref-${pedido.id}`,
      },
      body: JSON.stringify({
        external_reference: pedido.id,
        metadata: { pedido_id: pedido.id, usuario_id: user.id, integracao: "multi_delivery_4" },
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

    const preference = await preferenceResponse.json().catch(() => ({}));
    if (!preferenceResponse.ok || !preference?.id) {
      console.error("Falha Mercado Pago", {
        status: preferenceResponse.status,
        code: preference?.error || preference?.message,
      });
      return json(request, { error: "Não foi possível iniciar o pagamento." }, 502);
    }

    const checkoutUrl = preference.init_point || preference.sandbox_init_point;
    if (!checkoutUrlValida(checkoutUrl)) {
      console.error("URL de checkout inesperada", checkoutUrl);
      return json(request, { error: "O provedor retornou uma URL de pagamento inválida." }, 502);
    }

    const { data: registro, error: registroError } = await adminClient.rpc("registrar_preferencia_pagamento", {
      p_pedido_id: pedido.id,
      p_usuario_id: user.id,
      p_preference_id: String(preference.id),
      p_checkout_url: String(checkoutUrl),
    });
    if (registroError) throw registroError;

    return json(request, {
      checkout_url: checkoutUrl,
      preference_id: preference.id,
      registro,
      reutilizada: false,
    });
  } catch (error) {
    console.error(error);
    return json(request, { error: "Erro interno ao iniciar o pagamento." }, 500);
  }
});
