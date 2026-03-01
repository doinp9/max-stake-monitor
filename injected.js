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

  // Find match name from a string — looks for " @ " or " v " or " vs "
  function isMatchName(str) {
    return typeof str === 'string' && str.length > 5 && str.length < 120 &&
      (str.indexOf(' @ ') !== -1 || str.indexOf(' v ') !== -1 || str.indexOf(' vs ') !== -1);
  }

  // Search an object for any match name string
  function findMatchNameInObj(obj) {
    if (!obj || typeof obj !== 'object') return null;
    // Check fd first (known field)
    if (obj.fd && isMatchName(obj.fd)) return obj.fd;
    for (var k in obj) {
      if (obj.hasOwnProperty(k) && isMatchName(obj[k])) return obj[k];
    }
    return null;
  }

  // Deep search for match name
  function deepFindMatchName(obj, depth) {
    depth = depth || 0;
    if (depth > 6 || obj === null || obj === undefined || typeof obj !== 'object') return null;
    if (Array.isArray(obj)) {
      for (var i = 0; i < obj.length; i++) {
        var r = deepFindMatchName(obj[i], depth + 1);
        if (r) return r;
      }
    } else {
      if (obj.fd && isMatchName(obj.fd)) return obj.fd;
      for (var key in obj) {
        if (!obj.hasOwnProperty(key)) continue;
        var val = obj[key];
        if (isMatchName(val)) return val;
        if (typeof val === 'object' && val !== null) {
          var r2 = deepFindMatchName(val, depth + 1);
          if (r2) return r2;
        }
      }
    }
    return null;
  }

  // Build a lookup map: fixtureId → match name from la[] array
  function buildMatchLookup(la) {
    var lookup = {};
    if (!la || !Array.isArray(la)) return lookup;
    for (var i = 0; i < la.length; i++) {
      if (!la[i]) continue;
      var name = findMatchNameInObj(la[i]);
      if (name) {
        // Map by fi (fixture ID) if available
        if (la[i].fi) lookup[la[i].fi] = name;
        // Also map by index
        lookup['__idx_' + i] = name;
      }
    }
    return lookup;
  }

  // Get match name for a specific bt entry using la lookup
  function getMatchForBt(btEntry, matchLookup, allLaNames) {
    if (!btEntry) return null;

    // Try fixture ID match
    if (btEntry.fi && matchLookup[btEntry.fi]) return matchLookup[btEntry.fi];

    // Try scanning bt entry itself for match name
    var fromBt = findMatchNameInObj(btEntry);
    if (fromBt) return fromBt;

    // For parlays: if bt entry has pt[] (parts/legs), try to get all match names
    if (btEntry.pt && Array.isArray(btEntry.pt) && btEntry.pt.length > 1) {
      var names = [];
      for (var p = 0; p < btEntry.pt.length; p++) {
        var leg = btEntry.pt[p];
        if (!leg) continue;
        var legName = null;
        if (leg.fi && matchLookup[leg.fi]) legName = matchLookup[leg.fi];
        if (!legName) legName = findMatchNameInObj(leg);
        if (legName && names.indexOf(legName) === -1) names.push(legName);
      }
      if (names.length > 0) return names.join(' + ');
    }

    // For parlays: if multiple la entries exist and this bt has no single fi, combine all
    if (allLaNames.length > 1 && !btEntry.fi) {
      // Check if this might be a parlay (has ot/bt type indicating accumulator)
      return allLaNames.join(' + ');
    }

    return null;
  }

  function emitResult(json, source) {
    var bt = json.bt || json.Bt || json.BT;
    if (!bt || !Array.isArray(bt)) return;

    var la = json.la;
    var matchLookup = buildMatchLookup(la);

    // Collect all la match names for parlay fallback
    var allLaNames = [];
    if (la && Array.isArray(la)) {
      for (var li = 0; li < la.length; li++) {
        var n = la[li] ? findMatchNameInObj(la[li]) : null;
        if (n) allLaNames.push(n);
      }
    }

    var now = Date.now();
    var emitted = 0;

    for (var i = 0; i < bt.length; i++) {
      var entry = bt[i];
      if (!entry || entry.ms === undefined || entry.ms === null) continue;

      var ms = parseFloat(entry.ms);
      if (isNaN(ms) || ms <= 0) continue;

      var matchName = getMatchForBt(entry, matchLookup, allLaNames);

      // If still no name, deep search as last resort
      if (!matchName && i === 0) matchName = deepFindMatchName(json);

      var odds = entry.re || null;

      // Detect if this is a parlay/accumulator
      var isParlay = false;
      if (entry.pt && Array.isArray(entry.pt) && entry.pt.length > 1) isParlay = true;
      if (entry.ot === 3 || entry.bt === 2) isParlay = true; // common parlay type codes

      // For parlay: prefix with fold count
      if (isParlay && matchName && matchName.indexOf('+') === -1) {
        // matchName might be just one game, try to build full parlay name
        var parlayNames = [];
        if (entry.pt && Array.isArray(entry.pt)) {
          for (var pp = 0; pp < entry.pt.length; pp++) {
            var pn = null;
            if (entry.pt[pp] && entry.pt[pp].fi && matchLookup[entry.pt[pp].fi]) {
              pn = matchLookup[entry.pt[pp].fi];
            }
            if (pn && parlayNames.indexOf(pn) === -1) parlayNames.push(pn);
          }
        }
        if (parlayNames.length > 1) matchName = parlayNames.join(' + ');
        else if (allLaNames.length > 1) matchName = allLaNames.join(' + ');
      }

      // Label parlays
      var displayName = matchName || null;
      if (isParlay && displayName) {
        var legCount = (entry.pt && entry.pt.length) || allLaNames.length || '?';
        displayName = legCount + '-Fold: ' + displayName;
      } else if (isParlay && !displayName) {
        var legCount2 = (entry.pt && entry.pt.length) || allLaNames.length || '?';
        displayName = legCount2 + '-Fold Parlay';
      }

      console.log('%c[B365-MS] ✅ MAX STAKE: ' + ms + (displayName ? ' | ' + displayName : ''),
        'color: #FFDF00; background: #016443; padding: 4px 8px; font-weight: bold; font-size: 14px;');

      window.postMessage({
        type: 'B365_MAX_STAKE',
        data: {
          maxStake: ms,
          source: source,
          method: source,
          eventInfo: {
            eventName: displayName,
            odds: odds,
          },
          timestamp: now + i, // +i ms offset so entries have unique timestamps and correct order
        }
      }, '*');

      emitted++;
    }

    if (emitted > 1) {
      console.log('%c[B365-MS] 📋 ' + emitted + ' bets captured from one betslip',
        'color: #FFDF00; background: #016443; padding: 4px 8px; font-weight: bold;');
    }
  }

  function checkForMaxStake(obj, source) {
    try {
      if (typeof obj !== 'object' || obj === null) return;
      if (!(obj.bt || obj.Bt || obj.BT)) return;
      var bt = obj.bt || obj.Bt || obj.BT;
      // Must have at least one entry with ms
      var hasMs = false;
      if (Array.isArray(bt)) {
        for (var i = 0; i < bt.length; i++) {
          if (bt[i] && bt[i].ms !== undefined) { hasMs = true; break; }
        }
      }
      if (!hasMs) return;
      var text = JSON.stringify(obj);
      if (!isDuplicate(text)) emitResult(obj, source);
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
