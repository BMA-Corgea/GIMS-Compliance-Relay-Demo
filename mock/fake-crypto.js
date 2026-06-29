/* ════════════════════════════════════════════════════════════════════════
   fake-crypto.js — COSMETIC, non-cryptographic stand-ins for the demo.

   The real product computes a keyed integrity value over a canonical field set
   and chains each record to the previous one. NONE OF THAT IS HERE. There is no
   key, nothing to chain against, and nothing to write to. This file returns
   random hex of a DELIBERATELY DIFFERENT SHAPE, tagged with a "demo" prefix so
   the on-screen value can never be mistaken for a real integrity checksum.

   This is the point of "subtractive" neutering: there is no real algorithm sitting
   behind a flag to uncomment — the brain simply isn't in this repository.
   ════════════════════════════════════════════════════════════════════════ */
(function (global) {
  "use strict";

  function hex(n) {
    var chars = "0123456789abcdef", s = "";
    for (var i = 0; i < n; i++) s += chars[(Math.random() * 16) | 0];
    return s;
  }

  global.FakeCrypto = {
    // "demo…" prefix: the UI previews the first 10 chars of the checksum, so every
    // row visibly reads "demoXXXXXX…" — a loud tag that this is a simulated value.
    checksum: function () { return "demo" + hex(60); },
    uuid: function () { return hex(32); },
    // a constant-ish opaque session string; carries no claims and is never verified.
    token: function () { return "demo.session." + hex(16); },
    hex: hex,
  };
})(window);
