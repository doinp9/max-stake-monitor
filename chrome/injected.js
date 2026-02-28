// injected.js — MAIN world interceptor
(function () {
  'use strict';

  console.log('%c[B365-MS] Interceptor LOADED', 'color: #FFDF00; background: #016443; padding: 4px 8px; font-weight: bold; font-size: 14px;');

  var lastSig = '';
  function isDuplicate(text) {
    var sig = text.substring(0, 300);
    if (sig === lastSig) return true;
    lastSig = sig;
    return false;
  }

  function findMaxStakes(obj, path, results) {
    path = path || '';
    results = results || [];
    if (obj === null || obj === undefined || typeof obj !== 'object') return results;
    if (Array.isArray(obj)) {
      for (var i = 0; i < obj.length; i++) findMaxStakes(obj[i], path + '[' + i + ']', results);
    } else {
      for (var key in obj) {
        if (!obj.hasOwnProperty(key)) continue;
        var val = obj[key];
        if (key === 'ms' && (typeof val === 'number' || typeof val === 'string')) {
          var numVal = parseFloat(val);
          if (!isNaN(numVal) && numVal > 0) results.push({ path: path ? path + '.' + key : key, value: numVal });
        }
        if (typeof val === 'object' && val !== null) findMaxStakes(val, path ? path + '.' + key : key, results);
      }
    }
    return results;
  }

  // Find ALL strings in the JSON that look like match names
  function findAllStrings(obj, depth, results) {
    depth = depth || 0;
    results = results || [];
    if (depth > 8 || obj === null || obj === undefined || typeof obj !== 'object') return results;
    if (Array.isArray(obj)) {
      for (var i = 0; i < obj.length; i++) findAllStrings(obj[i], depth + 1, results);
    } else {
      for (var key in obj) {
        if (!obj.hasOwnProperty(key)) continue;
        var val = obj[key];
        if (typeof val === 'string' && val.length > 5 && val.length < 120) {
          // Match patterns: "Team A @ Team B", "Team A v Team B", "Team A vs Team B"
          if (val.indexOf(' @ ') !== -1 || val.indexOf(' v ') !== -1 || val.indexOf(' vs ') !== -1) {
            results.push({ key: key, value: val });
          }
        }
        if (typeof val === 'object' && val !== null) findAllStrings(val, depth + 1, results);
      }
    }
    return results;
  }

  function emitResult(msResults, json, source) {
    var primary = null;
    for (var i = 0; i < msResults.length; i++) {
      if (msResults[i].path.indexOf('bt') !== -1) { primary = msResults[i]; break; }
    }
    if (!primary) primary = msResults[0];

    var eventInfo = null;
    try {
      var bt = json.bt || json.Bt || json.BT;
      var la = json.la;

      // Strategy 1: la[].fd
      var matchName = null;
      if (la && Array.isArray(la)) {
        for (var li = 0; li < la.length; li++) {
          if (la[li]) {
            // Check fd first, then every string field in la[i]
            if (la[li].fd && la[li].fd.length > 3) { matchName = la[li].fd; break; }
            // Scan all fields in la[i] for match pattern
            for (var lk in la[li]) {
              var lv = la[li][lk];
              if (typeof lv === 'string' && lv.length > 5 &&
                  (lv.indexOf(' @ ') !== -1 || lv.indexOf(' v ') !== -1 || lv.indexOf(' vs ') !== -1)) {
                matchName = lv;
                break;
              }
            }
            if (matchName) break;
          }
        }
      }

      // Strategy 2: scan bt[] for match name strings
      if (!matchName && bt && Array.isArray(bt)) {
        for (var bi = 0; bi < bt.length; bi++) {
          if (!bt[bi]) continue;
          for (var bk in bt[bi]) {
            var bv = bt[bi][bk];
            if (typeof bv === 'string' && bv.length > 5 &&
                (bv.indexOf(' @ ') !== -1 || bv.indexOf(' v ') !== -1 || bv.indexOf(' vs ') !== -1)) {
              matchName = bv;
              break;
            }
          }
          if (matchName) break;
        }
      }

      // Strategy 3: deep scan entire JSON
      if (!matchName) {
        var allStrings = findAllStrings(json);
        if (allStrings.length > 0) {
          // Prefer fd key
          var fdMatch = null;
          for (var si = 0; si < allStrings.length; si++) {
            if (allStrings[si].key === 'fd') { fdMatch = allStrings[si].value; break; }
          }
          matchName = fdMatch || allStrings[0].value;
        }
      }

      // Get odds
      var odds = null;
      if (bt && bt[0]) odds = bt[0].re || null;

      eventInfo = {
        eventName: matchName,
        selectionName: null,
        marketName: null,
        odds: odds,
      };
    } catch (e) { }

    console.log('%c[B365-MS] ✅ MAX STAKE: ' + primary.value + (eventInfo && eventInfo.eventName ? ' | ' + eventInfo.eventName : ''),
      'color: #FFDF00; background: #016443; padding: 4px 8px; font-weight: bold; font-size: 14px;');

    window.postMessage({
      type: 'B365_MAX_STAKE',
      data: {
        maxStake: primary.value,
        allMaxStakes: msResults,
        source: source,
        method: source,
        eventInfo: eventInfo,
        timestamp: Date.now(),
      }
    }, '*');
  }

  function checkForMaxStake(obj, source) {
    try {
      if (typeof obj !== 'object' || obj === null) return;
      if (!(obj.bt || obj.Bt || obj.BT)) return;
      var msResults = findMaxStakes(obj);
      if (msResults.length > 0) {
        var text = JSON.stringify(obj);
        if (!isDuplicate(text)) emitResult(msResults, obj, source);
      }
    } catch (e) { }
  }

  // METHOD 1: JSON.parse
  var origJSONParse = JSON.parse;
  JSON.parse = function () {
    var result = origJSONParse.apply(this, arguments);
    try {
      if (result && typeof result === 'object' && (result.bt || result.Bt || result.BT)) {
        checkForMaxStake(result, 'JSON.parse');
      }
    } catch (e) { }
    return result;
  };

  // METHOD 2: XHR
  var xhrUrlMap = new WeakMap();
  var origOpen = XMLHttpRequest.prototype.open;
  var origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function () {
    xhrUrlMap.set(this, String(arguments[1] || ''));
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    var xhr = this;
    xhr.addEventListener('load', function () {
      try {
        var text = xhr.responseText;
        if (text && text.indexOf('"ms"') !== -1 && text.indexOf('"bt"') !== -1) {
          checkForMaxStake(origJSONParse(text), 'XHR');
        }
      } catch (e) { }
    });
    return origSend.apply(this, arguments);
  };

  // METHOD 3: fetch
  var origFetch = window.fetch;
  window.fetch = function () {
    return origFetch.apply(this, arguments).then(function (response) {
      try {
        var clone = response.clone();
        clone.text().then(function (text) {
          if (text && text.indexOf('"ms"') !== -1 && text.indexOf('"bt"') !== -1) {
            checkForMaxStake(origJSONParse(text), 'Fetch');
          }
        }).catch(function () { });
      } catch (e) { }
      return response;
    });
  };

  // METHOD 4: Response.json/text
  try {
    var origRJ = Response.prototype.json;
    Response.prototype.json = function () {
      return origRJ.call(this).then(function (d) { checkForMaxStake(d, 'Response.json'); return d; });
    };
  } catch (e) { }
  try {
    var origRT = Response.prototype.text;
    Response.prototype.text = function () {
      return origRT.call(this).then(function (t) {
        if (t && t.indexOf('"ms"') !== -1 && t.indexOf('"bt"') !== -1) {
          try { checkForMaxStake(origJSONParse(t), 'Response.text'); } catch (e) { }
        }
        return t;
      });
    };
  } catch (e) { }

  console.log('%c[B365-MS] All interceptors active ✓', 'color: #FFDF00; background: #016443; padding: 4px 8px; font-weight: bold;');
})();
