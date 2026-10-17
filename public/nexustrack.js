/**
 * NexusTrack - Universal Pixel & Tracking Engine v2
 * Compatibilidade total com Meta Ads (Facebook), Google Ads, TikTok e UTMify.
 * Rastreamento de PageView, ViewContent, InitiateCheckout e deduplicação oficial com CAPI.
 */
(function (window, document) {
  'use strict';

  var STORAGE_KEY = 'nx_attribution_data';
  var API_URL = 'https://qjfnosljbyqzyrfhiybi.supabase.co/functions/v1/track';
  var CTA_URL = 'https://qjfnosljbyqzyrfhiybi.supabase.co/functions/v1/track-cta';

  // 1. Extrair atributos do script tag
  var currentScript = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && scripts[i].src.indexOf('nexustrack.js') > -1) {
        return scripts[i];
      }
    }
    return null;
  })();

  var pixelId = currentScript ? (currentScript.getAttribute('data-pixel-id') || '') : '';
  var metaPixelsRaw = currentScript ? (currentScript.getAttribute('data-meta-pixels') || '') : '';
  var checkoutTextsRaw = currentScript ? (currentScript.getAttribute('data-checkout-texts') || '') : '';
  var autoKeywords = currentScript ? currentScript.getAttribute('data-auto-keywords') !== 'false' : true;

  var metaPixelIds = metaPixelsRaw ? metaPixelsRaw.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
  var checkoutTexts = [];
  try {
    if (checkoutTextsRaw) {
      checkoutTexts = decodeURIComponent(checkoutTextsRaw).split('|').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
    }
  } catch (e) {
    checkoutTexts = [];
  }

  // Palavras-chave padrão para detecção automática de botões de compra
  var defaultCheckoutKeywords = [
    'comprar', 'checkout', 'adquirir', 'garantir', 'pagar', 'quero', 'assinar',
    'matricular', 'inscrição', 'acesso', 'levar agora', 'plano', 'order now', 'buy now'
  ];

  // 2. Utilitários de cookies e parâmetros
  function getParam(name) {
    try {
      var url = new URL(window.location.href);
      return url.searchParams.get(name) || '';
    } catch (e) {
      return '';
    }
  }

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : '';
  }

  function setCookie(name, val, days) {
    var d = new Date();
    d.setTime(d.getTime() + (days || 30) * 24 * 60 * 60 * 1000);
    document.cookie = name + '=' + encodeURIComponent(val) + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
  }

  function generateEventId(prefix) {
    return (prefix || 'evt') + '_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  }

  // 3. Captura e persistência de identificadores Meta (fbclid, _fbp, _fbc)
  var fbclid = getParam('fbclid');
  var fbp = getCookie('_fbp') || ('fb.1.' + Date.now() + '.' + Math.floor(Math.random() * 1000000000));
  var fbc = getCookie('_fbc') || (fbclid ? ('fb.1.' + Date.now() + '.' + fbclid) : '');

  setCookie('_fbp', fbp, 90);
  if (fbc) setCookie('_fbc', fbc, 90);

  // 4. Captura de Parâmetros UTM
  var utms = {
    utm_source: getParam('utm_source'),
    utm_medium: getParam('utm_medium'),
    utm_campaign: getParam('utm_campaign'),
    utm_content: getParam('utm_content'),
    utm_term: getParam('utm_term'),
    nx_dash: getParam('nx_dash'),
  };

  var saved = {};
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) saved = JSON.parse(raw);
  } catch (e) {}

  var attribution = {
    utm_source: utms.utm_source || saved.utm_source || '',
    utm_medium: utms.utm_medium || saved.utm_medium || '',
    utm_campaign: utms.utm_campaign || saved.utm_campaign || '',
    utm_content: utms.utm_content || saved.utm_content || '',
    utm_term: utms.utm_term || saved.utm_term || '',
    nx_dash: utms.nx_dash || saved.nx_dash || '',
    fbp: fbp || saved.fbp || '',
    fbc: fbc || saved.fbc || '',
    referrer: document.referrer || saved.referrer || '',
    first_seen: saved.first_seen || new Date().toISOString(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
  } catch (e) {}

  // 5. Inicialização Inteligente do Facebook Pixel (fbq)
  if (!window.fbq) {
    (function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
      t = b.createElement(e);
      t.async = true;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  }

  // Inicializar todos os Pixels da Meta configurados
  for (var m = 0; m < metaPixelIds.length; m++) {
    try {
      window.fbq('init', metaPixelIds[m]);
    } catch (err) {}
  }

  // 6. Envio de Eventos para a API do NexusTrack
  function sendEvent(eventType, eventData, eventId) {
    var payload = Object.assign({}, attribution, {
      event_type: eventType,
      event_id: eventId || generateEventId('nx'),
      pixel_id: pixelId,
      page_url: window.location.href,
      referrer: document.referrer,
      user_agent: navigator.userAgent,
    }, eventData || {});

    var bodyStr = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(API_URL, bodyStr);
    } else {
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr,
        keepalive: true,
      }).catch(function () {});
    }
  }

  // 7. Auto-track PageView no Facebook Pixel e NexusTrack com Deduplicação
  var pageViewEventId = generateEventId('pv');
  try {
    window.fbq('track', 'PageView', {}, { eventID: pageViewEventId });
  } catch (err) {}
  sendEvent('PageView', { title: document.title }, pageViewEventId);

  // 8. Detecção Automática de Cliques em Botões de Compra (Initiate Checkout)
  var trackedClicks = {};

  document.addEventListener('click', function (e) {
    var el = e.target;
    if (!el) return;

    // Buscar elemento clicável pai se clicou em ícone ou texto interno
    var clickable = el.closest('button, a, input[type="submit"], input[type="button"], [role="button"]');
    if (!clickable) return;

    var text = (clickable.innerText || clickable.value || '').trim().toLowerCase();
    var href = (clickable.getAttribute('href') || '').toLowerCase();

    var isCheckoutTrigger = false;

    // Verificar se o texto contém algum dos termos configurados
    if (checkoutTexts.length > 0) {
      for (var t = 0; t < checkoutTexts.length; t++) {
        if (text.indexOf(checkoutTexts[t]) > -1) {
          isCheckoutTrigger = true;
          break;
        }
      }
    }

    // Se detecção automática estiver ativa, checar palavras-chave comuns
    if (!isCheckoutTrigger && autoKeywords) {
      for (var k = 0; k < defaultCheckoutKeywords.length; k++) {
        if (text.indexOf(defaultCheckoutKeywords[k]) > -1) {
          isCheckoutTrigger = true;
          break;
        }
      }
    }

    // Checar se o link aponta para gateways conhecidos
    var checkoutDomains = ['kiwify', 'hotmart', 'perfectpay', 'eduzz', 'monetizze', 'braip', 'cartpanda', 'stripe', 'checkout'];
    if (!isCheckoutTrigger && href) {
      for (var d = 0; d < checkoutDomains.length; d++) {
        if (href.indexOf(checkoutDomains[d]) > -1) {
          isCheckoutTrigger = true;
          break;
        }
      }
    }

    if (isCheckoutTrigger) {
      var clickKey = text + '_' + href;
      var now = Date.now();
      // Evitar duplo disparo consecutivo no mesmo clique
      if (trackedClicks[clickKey] && (now - trackedClicks[clickKey] < 2000)) {
        return;
      }
      trackedClicks[clickKey] = now;

      var checkoutEventId = generateEventId('ic');

      // 1. Disparar no Facebook Pixel oficial com eventID
      try {
        window.fbq('track', 'InitiateCheckout', {
          content_name: document.title,
          currency: 'USD',
        }, { eventID: checkoutEventId });
      } catch (err) {}

      // 2. Disparar para o backend NexusTrack (para registro e eventual CAPI)
      sendEvent('InitiateCheckout', {
        button_text: text.slice(0, 200),
        button_href: href.slice(0, 500),
      }, checkoutEventId);
    }
  }, true);

  // 9. Expor API Global para o cliente disparar manualmente se desejar
  window.nxTrack = function (eventName, data) {
    var customEventId = generateEventId('custom');
    try {
      window.fbq('trackCustom', eventName, data || {}, { eventID: customEventId });
    } catch (err) {}
    sendEvent(eventName, data, customEventId);
  };

})(window, document);