/**
 * NexusTrack - Pixel & Tracking Script (Universal UTMify Engine)
 * Leve, não-bloqueante e com persistência de parâmetros em cookies/localStorage.
 */
(function (window, document) {
  'use strict';

  var STORAGE_KEY = 'nx_attribution_data';
  var API_URL = 'https://qjfnosljbyqzyrfhiybi.supabase.co/functions/v1/track';

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

  // 1. Extração de Identificadores
  var currentUrl = new URL(window.location.href);
  var fbclid = getParam('fbclid');
  var fbp = getCookie('_fbp');
  var fbc = getCookie('_fbc') || (fbclid ? 'fb.1.' + Date.now() + '.' + fbclid : '');

  if (fbc) setCookie('_fbc', fbc, 90);

  // 2. Extração de UTMs
  var utms = {
    utm_source: getParam('utm_source'),
    utm_medium: getParam('utm_medium'),
    utm_campaign: getParam('utm_campaign'),
    utm_content: getParam('utm_content'),
    utm_term: getParam('utm_term'),
    nx_dash: getParam('nx_dash'),
  };

  // 3. Persistência de Atribuição (First Touch / Last Touch)
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

  // 4. Mecanismo de Disparo
  function sendEvent(eventType, eventData) {
    var payload = Object.assign({}, attribution, {
      event_type: eventType,
      page_url: window.location.href,
      referrer: document.referrer,
      user_agent: navigator.userAgent,
    }, eventData || {});

    // Usa fetch assíncrono ou sendBeacon
    if (navigator.sendBeacon) {
      navigator.sendBeacon(API_URL, JSON.stringify(payload));
    } else {
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(function () {});
    }
  }

  // 5. Expor API Global
  window.nxTrack = function (eventName, data) {
    sendEvent(eventName, data);
  };

  // 6. Auto-track PageView
  sendEvent('PageView', { title: document.title });

})(window, document);