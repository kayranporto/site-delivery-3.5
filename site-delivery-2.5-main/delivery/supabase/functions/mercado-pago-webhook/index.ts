import { createClient } from "npm:@supabase/supabase-js@2";

function resposta(status = 200) {
  return new Response("ok", { status, headers: { "Content-Type": "text/plain" } });
}

function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constante(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i += 1) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

async function assinaturaValida(request: Request, dataId: string, secret: string) {
  const signature = request.headers.get("x-signature") ?? "";
  const requestId = request.headers.get("x-request-id") ?? "";
  const partes = Object.fromEntries(signature.split(",").map((parte) => parte.trim().split("=", 2)));
  if (!partes.ts || !partes.v1 || !requestId || !dataId) return false;
  const manifesto = `id:${dataId};request-id:${requestId};ts:${partes.ts};`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const esperado = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifesto)));
  return constante(esperado, partes.v1.toLowerCase());
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return resposta(405);
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const dataId = String(url.searchParams.get("data.id") || body?.data?.id || "").toLowerCase();
    const topic = String(url.searchParams.get("type") || body?.type || body?.topic || "");
    const secret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET") ?? "";
    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN") ?? "";
    if (!secret || !accessToken || topic !== "payment" || !await assinaturaValida(request, dataId, secret)) {
      return resposta(401);
    }

    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!paymentResponse.ok) return resposta(502);
    const payment = await paymentResponse.json();
    const pedidoId = String(payment.external_reference || "");
    if (!/^[0-9a-f-]{36}$/i.test(pedidoId)) return resposta(200);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const status = payment.status === "approved"
      ? "pago"
      : ["refunded", "charged_back"].includes(payment.status) ? "estornado" : "pendente";

    const { error } = await admin.from("pedidos").update({
      pagamento_status: status,
      pagamento_modalidade: "online",
      pagamento_provider: "mercado_pago",
      pagamento_referencia: String(payment.id),
      pagamento_atualizado_em: new Date().toISOString(),
    }).eq("id", pedidoId);
    if (error) throw error;
    return resposta(200);
  } catch (error) {
    console.error(error);
    return resposta(500);
  }
});

