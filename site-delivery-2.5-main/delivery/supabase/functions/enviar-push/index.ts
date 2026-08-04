import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("method", { status: 405 });
  const webhookSecret = Deno.env.get("PUSH_WEBHOOK_SECRET") ?? "";
  if (!webhookSecret || request.headers.get("x-delivery-webhook-secret") !== webhookSecret) {
    return new Response("unauthorized", { status: 401 });
  }

  try {
    const body = await request.json();
    const notification = body.record || body;
    if (!notification?.usuario_id) return new Response("ok", { status: 200 });

    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
    const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";
    if (!publicKey || !privateKey) return new Response("not configured", { status: 503 });
    webpush.setVapidDetails(subject, publicKey, privateKey);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const { data: subscriptions, error } = await supabase.from("push_subscriptions")
      .select("id,subscription").eq("usuario_id", notification.usuario_id);
    if (error) throw error;

    const payload = JSON.stringify({
      title: notification.titulo || "Multi Delivery",
      body: notification.mensagem || "Você tem uma nova atualização.",
      url: notification.pedido_id ? `./acompanhamento.html?id=${notification.pedido_id}` : "./perfil.html",
    });
    for (const item of subscriptions || []) {
      try {
        await webpush.sendNotification(item.subscription, payload, { TTL: 300 });
      } catch (pushError) {
        const status = Number(pushError?.statusCode || 0);
        if (status === 404 || status === 410) await supabase.from("push_subscriptions").delete().eq("id", item.id);
        else console.error(pushError);
      }
    }
    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("error", { status: 500 });
  }
});

