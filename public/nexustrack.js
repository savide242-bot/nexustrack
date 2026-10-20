/**
 * NexusTrack - Universal Tracking & Conversions Engine v3 (Ultra-Fast UTMify Compatible)
 * 1. Inicializa o Facebook Pixel oficial (fbq) com qualquer ID fornecido.
 * 2. Dispara PageView e ViewContent imediatamente com deduplicação oficial (eventID).
 * 3. Injeta automaticamente todas as UTMs, fbclid, _fbp, _fbc e sck em TODOS os links e botões de checkout.
 * 4. Detecta cliques em botões de compra (CTAs) e dispara InitiateCheckout instantaneamente.
 * 5. Captura dados de formulários e dispara evento de Lead.
 */
(function (window, document) {
  'use strict';

  var STORAGE_KEY = 'nx_attribution_data';
  var API_TRACK_URL = 'https://qjfnosljbyqzyrfhiybi.supabase.co/functions/v1/track';
  var API_CTA_URL = 'https://qjfnosljbyqzyrfhiybi.supabase.co/functions/v1/track-cta';

  // ==========================================
  // 1. EXTRAÇÃO DE CONFIGURAÇÃO DO SCRIPT
  // ==========================================
  var currentScript = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].src || '';
      if (src.indexOf('nexustrack.js') > -1) {
        return scripts[i];
      }
    }
    return null;
  })();

  function getQueryParamFromUrl(urlStr, param) {
    try {
      var u = new URL(urlStr, window.location.href);
      return u.searchParams.get(param) || '';
    } catch (e) {
      return '';
    }
  }

  var scriptSrc = currentScript ? (currentScript.src || '') : '';
  var scriptUrlPixel = getQueryParamFromUrl(scriptSrc, 'pixel') || getQueryParamFromUrl(scriptSrc, 'id');

  var pixelIdAttr = currentScript ? (currentScript.getAttribute('data-pixel-id') || '') : '';
  var metaPixelsAttr = currentScript ? (currentScript.getAttribute('data-meta-pixels') || '') : '';
  var checkoutTextsAttr = currentScript ? (currentScript.getAttribute('data-checkout-texts') || '') : '';
  var autoKeywordsAttr = currentScript ? currentScript.getAttribute('data-auto-keywords') !== 'false' : true;

  // Lista de Meta Pixels combinada de todas as fontes possíveis
  var metaPixelIds = [];
  if (metaPixelsAttr) {
    metaPixelIds = metaPixelsAttr.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  }
  if (scriptUrlPixel && metaPixelIds.indexOf(scriptUrlPixel) === -1) {
    metaPixelIds.push(scriptUrlPixel);
  }
  if (window.pixelId && metaPixelIds.indexOf(String(window.pixelId)) === -1) {
    metaPixelIds.push(String(window.pixelId));
  }
  if (window.metaPixelId && metaPixelIds.indexOf(String(window.metaPixelId)) === -1) {
    metaPixelIds.push(String(window.metaPixelId));
  }

  // Se o pixelIdAttr for apenas numérico (um Facebook Pixel ID passado como data-pixel-id)
  if (/^\d{10,20}$/.test(pixelIdAttr) && metaPixelIds.indexOf(pixelIdAttr) === -1) {
    metaPixelIds.push(pixelIdAttr);
  }

  // Textos de botões customizados
  var customCheckoutTexts = [];
  try {
    if (checkoutTextsAttr) {
      customCheckoutTexts = decodeURIComponent(checkoutTextsAttr)
        .split('|')
        .map(function (s) { return s.trim().toLowerCase(); })
        .filter(Boolean);
    }
  } catch (e) {
    customCheckoutTexts = [];
  }

  // ==========================================
  // 2. CTAS E PALAVRAS-CHAVE DE CHECKOUT SUPORTADAS
  // ==========================================
  var defaultCheckoutKeywords = [
    'comprar', 'checkout', 'adquirir', 'garantir', 'pagar', 'quero', 'assinar',
    'matricular', 'inscrição', 'inscricao', 'acesso', 'levar agora', 'plano',
    'order now', 'buy now', 'get access', 'quero meu acesso', 'garantir vaga',
    'garanta sua vaga', 'sim, quero', 'comprar agora', 'compre agora',
    'plano ouro', 'plano prata', 'plano diamante', 'plano vip',
    'desconto', 'garantir desconto', 'finalizar compra', 'adicionar ao carrinho'
  ];

  // Domínios de checkouts reconhecidos para injeção automática de UTMs
  var checkoutDomains = [
    'kiwify.com.br', 'pay.kiwify.com.br',
    'hotmart.com', 'pay.hotmart.com',
    'perfectpay.com.br', 'checkout.perfectpay.com.br',
    'eduzz.com', 'sun.eduzz.com',
    'monetizze.com.br', 'app.monetizze.com.br',
    'braip.com', 'ev.braip.com',
    'cartpanda.com', 'checkout.cartpanda.com',
    'stripe.com', 'buy.stripe.com', 'checkout.stripe.com',
    'appmax.com.br',
    'greenn.com.br',
    'ticto.app', 'checkout.ticto.app',
    'yampi.io', 'seguro.yampi.com.br',
    'kirvano.com',
    'doppus.com',
    'hubla.app',
    'turbopay',
    'checkout'
  ];

  // ==========================================
  // 3. UTILITÁRIOS E PERSISTÊNCIA DE ATRIBUIÇÃO
  // ==========================================
  function getUrlParam(name) {
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
    d.setTime(d.getTime() + (days || 90) * 24 * 60 * 60 * 1000);
    document.cookie = name + '=' + encodeURIComponent(val) + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
  }

  function generateEventId(prefix) {
    return (prefix || 'nx') + '_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  }

  // Captura de fbclid e geração de cookies oficiais da Meta (_fbp, _fbc)
  var fbclid = getUrlParam('fbclid');
  var existingFbp = getCookie('_fbp');
  var fbp = existingFbp || ('fb.1.' + Date.now() + '.' + Math.floor(Math.random() * 1000000000));
  var existingFbc = getCookie('_fbc');
  var fbc = existingFbc || (fbclid ? ('fb.1.' + Date.now() + '.' + fbclid) : '');

  setCookie('_fbp', fbp, 90);
  if (fbc) setCookie('_fbc', fbc, 90);

  // Captura inteligente de Parâmetro Ultra Curto ?c=1 ou ?c=1_b ou ?c=2_s
  var shortCode = getUrlParam('c') || getUrlParam('conta') || '';
  var parsedAccount = '';
  var parsedPlacement = '';
  if (shortCode) {
    var parts = shortCode.split('_');
    var accKey = parts[0];
    parsedAccount = accKey === '1' ? 'conta1' : accKey === '2' ? 'conta2' : accKey;
    if (parts[1]) {
      var pl = parts[1].toLowerCase();
      parsedPlacement = (pl === 'b' || pl === 'bio') ? 'bio' :
                        (pl === 's' || pl === 'stories' || pl === 'story') ? 'stories' :
                        (pl === 'd' || pl === 'dir' || pl === 'direct') ? 'direct' :
                        (pl === 'r' || pl === 'reels') ? 'reels' : pl;
    } else {
      parsedPlacement = 'stories'; // Default para quando usa só ?c=1
    }
  }

  // Captura de Parâmetros UTM atuais (com expansão automática de ?c=1)
  var currentUtms = {
    utm_source: getUrlParam('utm_source') || parsedAccount,
    utm_medium: getUrlParam('utm_medium') || parsedPlacement,
    utm_campaign: getUrlParam('utm_campaign') || (parsedAccount ? 'organico' : ''),
    utm_content: getUrlParam('utm_content') || '',
    utm_term: getUrlParam('utm_term') || '',
    src: getUrlParam('src') || (parsedAccount ? (parsedAccount + (parsedPlacement ? '_' + parsedPlacement : '')) : ''),
    sck: getUrlParam('sck'),
    nx_dash: getUrlParam('nx_dash'),
  };

  // Carregar dados salvos no localStorage (First Touch)
  var savedAttribution = {};
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) savedAttribution = JSON.parse(raw);
  } catch (e) {}

  var activeAttribution = {
    utm_source: currentUtms.utm_source || savedAttribution.utm_source || 'direct',
    utm_medium: currentUtms.utm_medium || savedAttribution.utm_medium || '',
    utm_campaign: currentUtms.utm_campaign || savedAttribution.utm_campaign || '',
    utm_content: currentUtms.utm_content || savedAttribution.utm_content || '',
    utm_term: currentUtms.utm_term || savedAttribution.utm_term || '',
    src: currentUtms.src || savedAttribution.src || currentUtms.utm_source || '',
    sck: currentUtms.sck || savedAttribution.sck || currentUtms.utm_campaign || '',
    nx_dash: currentUtms.nx_dash || savedAttribution.nx_dash || '',
    fbclid: fbclid || savedAttribution.fbclid || '',
    fbp: fbp || savedAttribution.fbp || '',
    fbc: fbc || savedAttribution.fbc || '',
    referrer: document.referrer || savedAttribution.referrer || '',
    first_seen: savedAttribution.first_seen || new Date().toISOString(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activeAttribution));
  } catch (e) {}

  // ==========================================
  // 4. INICIALIZAÇÃO INFALÍVEL DO FACEBOOK PIXEL (fbq)
  // ==========================================
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

  // Descobrir pixels adicionais já inicializados no site (se houver)
  try {
    if (window._fbq && window._fbq.instance && window._fbq.instance.pixelsByID) {
      for (var existingId in window._fbq.instance.pixelsByID) {
        if (existingId && metaPixelIds.indexOf(existingId) === -1) {
          metaPixelIds.push(existingId);
        }
      }
    }
  } catch (e) {}

  // Inicializar todos os IDs encontrados
  for (var m = 0; m < metaPixelIds.length; m++) {
    try {
      window.fbq('init', metaPixelIds[m]);
    } catch (err) {
      console.warn('[NexusTrack] Erro ao iniciar pixel ' + metaPixelIds[m], err);
    }
  }

  // ==========================================
  // 5. DISPARAR EVENTOS OFICIAIS (PAGEVIEW & VIEWCONTENT)
  // ==========================================
  var pageViewEventId = generateEventId('pv');
  var viewContentEventId = generateEventId('vc');

  try {
    window.fbq('track', 'PageView', {}, { eventID: pageViewEventId });
    window.fbq('track', 'ViewContent', {
      content_name: document.title,
      content_category: 'Landing Page',
    }, { eventID: viewContentEventId });
  } catch (err) {}

  // Enviar para o coletor NexusTrack
  function sendNexusEvent(eventType, eventData, eventId) {
    var payload = Object.assign({}, activeAttribution, {
      event_type: eventType,
      event_id: eventId || generateEventId('nx'),
      pixel_id: pixelIdAttr || (metaPixelIds[0] || ''),
      page_url: window.location.href,
      page_title: document.title,
      referrer: document.referrer,
      user_agent: navigator.userAgent,
    }, eventData || {});

    var bodyStr = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(API_TRACK_URL, bodyStr);
    } else {
      fetch(API_TRACK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr,
        keepalive: true,
      }).catch(function () {});
    }
  }

  sendNexusEvent('PageView', { title: document.title }, pageViewEventId);

  // ==========================================
  // 6. O MOTOR DA UTMIFY: INJEÇÃO AUTOMÁTICA DE UTMS EM LINKS DE CHECKOUT
  // ==========================================
  function isCheckoutUrl(url) {
    if (!url) return false;
    var lower = url.toLowerCase();
    for (var i = 0; i < checkoutDomains.length; i++) {
      if (lower.indexOf(checkoutDomains[i]) > -1) {
        return true;
      }
    }
    return false;
  }

  function appendUtmsToUrl(rawUrl) {
    if (!rawUrl || rawUrl.indexOf('javascript:') === 0 || rawUrl.indexOf('#') === 0 || rawUrl.indexOf('mailto:') === 0 || rawUrl.indexOf('tel:') === 0) {
      return rawUrl;
    }

    try {
      var parsed = new URL(rawUrl, window.location.href);
      var paramsToSet = [
        ['utm_source', activeAttribution.utm_source],
        ['utm_medium', activeAttribution.utm_medium],
        ['utm_campaign', activeAttribution.utm_campaign],
        ['utm_content', activeAttribution.utm_content],
        ['utm_term', activeAttribution.utm_term],
        ['src', activeAttribution.src || activeAttribution.utm_source],
        ['sck', activeAttribution.sck || activeAttribution.utm_campaign],
        ['fbclid', activeAttribution.fbclid],
        ['fbc', activeAttribution.fbc],
        ['fbp', activeAttribution.fbp],
      ];

      for (var p = 0; p < paramsToSet.length; p++) {
        var key = paramsToSet[p][0];
        var val = paramsToSet[p][1];
        if (val && !parsed.searchParams.get(key)) {
          parsed.searchParams.set(key, val);
        }
      }

      return parsed.toString();
    } catch (e) {
      return rawUrl;
    }
  }

  function injectUtmsIntoAllElements() {
    // 1. Links <a href="...">
    var links = document.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var href = a.getAttribute('href');
      if (href && isCheckoutUrl(href)) {
        var newHref = appendUtmsToUrl(href);
        if (newHref !== href) {
          a.setAttribute('href', newHref);
        }
      }
    }

    // 2. Iframes (ex: checkouts incorporados)
    var iframes = document.querySelectorAll('iframe[src]');
    for (var j = 0; j < iframes.length; j++) {
      var ifr = iframes[j];
      var src = ifr.getAttribute('src');
      if (src && isCheckoutUrl(src)) {
        var newSrc = appendUtmsToUrl(src);
        if (newSrc !== src) {
          ifr.setAttribute('src', newSrc);
        }
      }
    }

    // 3. Formulários <form action="...">
    var forms = document.querySelectorAll('form[action]');
    for (var k = 0; k < forms.length; k++) {
      var form = forms[k];
      var action = form.getAttribute('action');
      if (action && isCheckoutUrl(action)) {
        form.setAttribute('action', appendUtmsToUrl(action));
      }
    }
  }

  // Executar injeção imediatamente
  injectUtmsIntoAllElements();

  // Executar novamente após DOM estar completamente pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectUtmsIntoAllElements);
  } else {
    setTimeout(injectUtmsIntoAllElements, 300);
  }

  // Monitorar adições dinâmicas de botões no DOM (ex: Elementor, React, popups)
  if (window.MutationObserver) {
    var observer = new MutationObserver(function () {
      injectUtmsIntoAllElements();
    });
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  // Injeção de última hora no momento em que o usuário clica ou passa o mouse
  document.addEventListener('mouseover', function (e) {
    var link = e.target && e.target.closest('a[href]');
    if (link) {
      var href = link.getAttribute('href');
      if (href && isCheckoutUrl(href)) {
        link.setAttribute('href', appendUtmsToUrl(href));
      }
    }
  }, true);

  // ==========================================
  // 7. INTERCEPTADOR DE CLIQUES DE COMPRA (INITIATE CHECKOUT)
  // ==========================================
  var trackedClickTimestamps = {};

  document.addEventListener('click', function (e) {
    var el = e.target;
    if (!el) return;

    var clickable = el.closest('button, a, input[type="submit"], input[type="button"], [role="button"]');
    if (!clickable) return;

    var text = (clickable.innerText || clickable.value || '').trim().toLowerCase();
    var href = (clickable.getAttribute('href') || '').toLowerCase();

    var isTrigger = false;

    // Checar se o link aponta para um dos checkouts suportados
    if (href && isCheckoutUrl(href)) {
      isTrigger = true;
      clickable.setAttribute('href', appendUtmsToUrl(clickable.getAttribute('href')));
    }

    // Checar se o texto bate com os textos personalizados configurados no NexusTrack
    if (!isTrigger && customCheckoutTexts.length > 0) {
      for (var c = 0; c < customCheckoutTexts.length; c++) {
        if (text.indexOf(customCheckoutTexts[c]) > -1) {
          isTrigger = true;
          break;
        }
      }
    }

    // Checar se o texto contém palavras-chave automáticas
    if (!isTrigger && autoKeywordsAttr) {
      for (var k = 0; k < defaultCheckoutKeywords.length; k++) {
        if (text.indexOf(defaultCheckoutKeywords[k]) > -1) {
          isTrigger = true;
          break;
        }
      }
    }

    if (isTrigger) {
      var dedupeKey = text.slice(0, 50) + '_' + href.slice(0, 100);
      var now = Date.now();
      if (trackedClickTimestamps[dedupeKey] && (now - trackedClickTimestamps[dedupeKey] < 2000)) {
        return;
      }
      trackedClickTimestamps[dedupeKey] = now;

      var checkoutEventId = generateEventId('ic');

      // Disparar no Meta Pixel oficial (fbq)
      try {
        window.fbq('track', 'InitiateCheckout', {
          content_name: document.title,
          currency: 'USD',
        }, { eventID: checkoutEventId });
      } catch (err) {}

      // Disparar para a API do NexusTrack
      sendNexusEvent('InitiateCheckout', {
        button_text: text.slice(0, 200),
        button_href: href.slice(0, 500),
      }, checkoutEventId);
    }
  }, true);

  // ==========================================
  // 8. CAPTURA AUTOMÁTICA DE LEADS EM FORMULÁRIOS
  // ==========================================
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form) return;

    var emailInput = form.querySelector('input[type="email"], input[name*="email"], input[id*="email"]');
    var phoneInput = form.querySelector('input[type="tel"], input[name*="phone"], input[name*="telefone"], input[name*="whatsapp"], input[id*="phone"]');
    var nameInput = form.querySelector('input[name*="name"], input[name*="nome"], input[id*="name"]');

    var email = emailInput ? (emailInput.value || '').trim() : '';
    var phone = phoneInput ? (phoneInput.value || '').trim() : '';
    var name = nameInput ? (nameInput.value || '').trim() : '';

    if (email || phone) {
      var leadEventId = generateEventId('lead');
      try {
        window.fbq('track', 'Lead', {
          content_name: document.title,
        }, { eventID: leadEventId });
      } catch (err) {}

      sendNexusEvent('Lead', {
        email: email,
        phone: phone,
        name: name,
      }, leadEventId);
    }
  }, true);

  // ==========================================
  // 9. API GLOBAL NEXUSTRACK
  // ==========================================
  window.nxTrack = function (eventName, data) {
    var customId = generateEventId('custom');
    try {
      window.fbq('trackCustom', eventName, data || {}, { eventID: customId });
    } catch (err) {}
    sendNexusEvent(eventName, data, customId);
  };

  console.log('[NexusTrack Engine v3] Ativo. Pixels Meta:', metaPixelIds.length > 0 ? metaPixelIds : 'Nenhum');
})(window, document);