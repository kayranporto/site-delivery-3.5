"use strict";

// Configurações públicas opcionais. Nunca coloque Access Token, service_role
// ou qualquer segredo neste arquivo.
window.DELIVERY_CONFIG = Object.freeze({
    appVersion: "4.2.0",
    vapidPublicKey: "",
    // Preencha com a Site Key pública do Cloudflare Turnstile.
    // Quando vazia, o componente anti-robô permanece desativado.
    turnstileSiteKey: ""
});
