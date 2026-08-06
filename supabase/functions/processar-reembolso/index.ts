import { createClient } from "supabase";
import { corsHeaders, json } from "../_shared/cors.ts";

async function fetchPayment(accessToken: string, paymentId: string) {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  return await response.json();
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Método não permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN") ?? "";
  const authorization = request.headers.get("Authorization") ?? "";

  if (!supabaseUrl || !publishableKey || !serviceKey || !accessToken) {
    return json(request, { error: "Reembolso automático não configurado." }, 503);
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json(request, { error: "Sessão administrativa inválida." }, 401);

    const body: any = await request.json().catch(() => ({}));
    const pedidoId = String(body?.pedido_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(pedidoId)) return json(request, { error: "Pedido inválido." }, 400);

    const { data: preparo, error: preparoError } = await userClient.rpc("admin_preparar_reembolso", {
      p_pedido_id: pedidoId,
    });
    if (preparoError || !preparo?.payment_id) {
      return json(request, { error: preparoError?.message || "Pedido não elegível para reembolso." }, 409);
    }

    const paymentId = String(preparo.payment_id);
    const refundResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}/refunds`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": `refund-${pedidoId}`,
        },
        body: "{}",
      },
    );

    const refund = await refundResponse.json().catch(() => ({}));
    let providerStatus = refundResponse.ok ? "refunded" : "";

    if (!refundResponse.ok) {
      const payment = await fetchPayment(accessToken, paymentId);
      if (payment && ["refunded", "charged_back"].includes(String(payment.status))) {
        providerStatus = String(payment.status);
      } else {
        const reason = String(refund?.message || refund?.error || `HTTP ${refundResponse.status}`).slice(0, 500);
        await adminClient.rpc("servico_marcar_falha_reembolso", {
          p_pedido_id: pedidoId,
          p_erro: reason,
        });
        return json(request, { error: "O Mercado Pago não concluiu o reembolso.", detalhe: reason }, 502);
      }
    }

    const { data: reconciliacao, error: reconciliacaoError } = await adminClient.rpc(
      "reconciliar_pagamento_mercado_pago",
      {
        p_pedido_id: pedidoId,
        p_payment_id: paymentId,
        p_provider_status: providerStatus,
        p_amount: Number(preparo.valor),
        p_currency: String(preparo.moeda || "BRL"),
        p_dedupe_key: `refund:${pedidoId}:${refund?.id || paymentId}`,
        p_preference_id: preparo.preference_id || null,
        p_request_id: null,
        p_payload: {
          refund_id: refund?.id || null,
          payment_id: paymentId,
          status: refund?.status || providerStatus,
          amount: refund?.amount || preparo.valor,
        },
      },
    );

    if (reconciliacaoError) throw reconciliacaoError;
    return json(request, { ok: true, reembolso: refund, reconciliacao });
  } catch (error) {
    console.error(error);
    return json(request, { error: "Erro interno ao processar o reembolso." }, 500);
  }
});
