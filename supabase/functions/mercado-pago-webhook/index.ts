import { createClient } from "supabase";

function response(status = 200, body = "ok") {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

async function validSignature(request: Request, dataId: string, secret: string) {
  const signature = request.headers.get("x-signature") ?? "";
  const requestId = request.headers.get("x-request-id") ?? "";
  const parts = Object.fromEntries(
    signature.split(",").map((part) => part.trim().split("=", 2)).filter((part) => part.length === 2),
  );
  if (!parts.ts || !parts.v1 || !requestId || !dataId) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${parts.ts};`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest)));
  return constantTimeEqual(expected, String(parts.v1).toLowerCase());
}

function safePaymentPayload(payment: Record<string, unknown>) {
  const order = payment.order && typeof payment.order === "object" ? payment.order as Record<string, unknown> : {};
  return {
    id: payment.id,
    status: payment.status,
    status_detail: payment.status_detail,
    external_reference: payment.external_reference,
    transaction_amount: payment.transaction_amount,
    currency_id: payment.currency_id,
    date_created: payment.date_created,
    date_approved: payment.date_approved,
    date_last_updated: payment.date_last_updated,
    live_mode: payment.live_mode,
    collector_id: payment.collector_id,
    order_id: order.id,
  };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return response(405, "method not allowed");

  try {
    const url = new URL(request.url);
    const body: any = await request.json().catch(() => ({}));
    const dataId = String(url.searchParams.get("data.id") || body?.data?.id || "").toLowerCase();
    const topic = String(url.searchParams.get("type") || body?.type || body?.topic || "").toLowerCase();
    const webhookEventId = String(body?.id || "");
    const requestId = request.headers.get("x-request-id") ?? "";
    const secret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET") ?? "";
    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN") ?? "";
    const expectedCollectorId = Deno.env.get("MERCADO_PAGO_COLLECTOR_ID") ?? "";

    if (!secret || !accessToken || topic !== "payment" || !await validSignature(request, dataId, secret)) {
      return response(401, "unauthorized");
    }

    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!paymentResponse.ok) return response(502, "provider unavailable");

    const payment = await paymentResponse.json();
    const pedidoId = String(payment.external_reference || "");
    if (!/^[0-9a-f-]{36}$/i.test(pedidoId)) return response(200);

    if (expectedCollectorId && String(payment.collector_id || "") !== expectedCollectorId) {
      console.error("Pagamento recebido por collector diferente", {
        payment_id: payment.id,
        collector_id: payment.collector_id,
      });
      return response(200);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) return response(503, "service not configured");

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const dedupeKey = webhookEventId
      ? `webhook:${webhookEventId}`
      : `payment:${payment.id}:${payment.status}:${payment.date_last_updated || "unknown"}`;

    const { data, error } = await admin.rpc("reconciliar_pagamento_mercado_pago", {
      p_pedido_id: pedidoId,
      p_payment_id: String(payment.id),
      p_provider_status: String(payment.status || "unknown"),
      p_amount: Number(payment.transaction_amount),
      p_currency: String(payment.currency_id || ""),
      p_dedupe_key: dedupeKey,
      p_preference_id: null,
      p_request_id: requestId || null,
      p_payload: safePaymentPayload(payment),
    });

    if (error) throw error;
    if (data?.ok === false) {
      console.error("Divergência de conciliação", data);
      return response(200, "accepted for review");
    }

    return response(200);
  } catch (error) {
    console.error(error);
    return response(500, "internal error");
  }
});
