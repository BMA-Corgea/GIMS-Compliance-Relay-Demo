/* ════════════════════════════════════════════════════════════════════════
   fixtures.js — seeded, in-memory demo data + event factory.

   Pure data and shape helpers only (no routing, no state mutation). The router
   (mock-api.js) owns the live, mutable event list and seeds it from here.

   Every event carries the FULL StoredEvent field set the real product returns,
   so the trail viewer renders identically and CSV/JSON exports carry every
   column — but the checksums are cosmetic (see fake-crypto.js) and nothing is
   keyed, chained, or persisted.
   ════════════════════════════════════════════════════════════════════════ */
(function (global) {
  "use strict";
  var FC = global.FakeCrypto;

  // A constant fake reviewer. Login accepts ANY credentials and resolves to this.
  var DEMO_USER = { user_uuid: "demo-reviewer-0001", email: "reviewer@lab.com", display_name: "Dana Reviewer" };

  var OS_ACTOR = "os:LABPC-03:dlab";       // file capture runs under the OS identity
  var USER_ACTOR = "user:" + DEMO_USER.user_uuid;
  var RELAY_ACTOR = "relay:LABPC-03";
  var UA = "Mozilla/5.0 (Demo) GIMS-Compliance-Relay-Demo";

  // Plausible instrument output filenames the simulated capture draws from.
  var CAPTURE_FILES = [
    "NMR_run_042.fid", "HPLC_2026-06-24_0931.csv", "LCMS_batch17.raw",
    "GCMS_sampleA12.cdf", "UVvis_scan_337.dx", "IR_spectrum_88.spa",
    "plate_read_A03.xlsx", "balance_log_0930.txt", "dissolution_v4.csv",
    "karl_fischer_22.txt", "particle_size_d50.csv", "pH_meter_log_14.txt",
  ];

  var BASE_MS = Date.parse("2026-06-23T14:02:00Z");
  function iso(minOffset) {
    return new Date(BASE_MS + minOffset * 60000).toISOString().replace(".000", "");
  }
  function payloadStr(p) {
    if (p == null) return null;
    if (typeof p === "string") return p;
    try { return JSON.stringify(p); } catch (e) { return String(p); }
  }

  /* Build a full-shaped event row. `seq` and `prev` set the (cosmetic) chain
     position; `o` overrides any field. `o.payload` may be an object — it is
     normalized to a JSON string to match the real wire shape. */
  function makeEvent(seq, prev, o) {
    o = o || {};
    var ev = {
      id: seq,
      event_uuid: FC.uuid(),
      trail: "default",
      kind: "system",
      timestamp_utc: o.timestamp_utc || iso(seq),
      recorded_at_utc: o.recorded_at_utc || o.timestamp_utc || iso(seq),
      actor_id: RELAY_ACTOR,
      actor_kind: "os_bound",
      method: null, path: null, ids: null,
      status: 200, success: true,
      payload: null, project: null,
      source_ip: "127.0.0.1", session_id: FC.hex(8), user_agent: UA,
      signer: null, signature_meaning: null, reason: null,
      prev_checksum: prev, chain_seq: seq, checksum: FC.checksum(),
    };
    for (var k in o) if (o.hasOwnProperty(k)) ev[k] = o[k];
    ev.payload = payloadStr(ev.payload);
    ev.chain_seq = seq; ev.prev_checksum = prev; ev.id = seq;
    return ev;
  }

  // ── Seed descriptors (kind-specific helpers keep the list readable) ──────
  function sys(t, method, path, msg) { return { t: t, kind: "system", method: method, path: path, actor_id: RELAY_ACTOR, actor_kind: "os_bound", payload: { event: msg } }; }
  function wctl(t, method, folder) { return { t: t, kind: "watcher_control", method: method, path: folder, actor_id: RELAY_ACTOR, actor_kind: "os_bound", payload: { folder: folder } }; }
  function cap(t, file, folder) { return { t: t, kind: "file_capture", method: "CAPTURE", path: folder + "/" + file, actor_id: OS_ACTOR, actor_kind: "os_bound", payload: { filename: file, bytes: 1024 * ((file.length * 137) % 900 + 60), sha256: FC.checksum() } }; }
  function acc(t, method, path) { return { t: t, kind: "access", method: method, path: path, actor_id: USER_ACTOR, actor_kind: "authenticated", payload: { email: DEMO_USER.email } }; }
  function sig(t, meaning, reason) { return { t: t, kind: "signature", method: "SIGN", path: "/events/sign", actor_id: USER_ACTOR, actor_kind: "authenticated", signer: DEMO_USER.email, signature_meaning: meaning, reason: reason, payload: { target_checksums: [FC.checksum()] } }; }
  function exp(t, fmt) { return { t: t, kind: "export", method: "EXPORT", path: "/events/export." + fmt, actor_id: USER_ACTOR, actor_kind: "authenticated", payload: { format: fmt, row_count: 18 } }; }

  var SPECS = [
    sys(0, "STARTUP", "/system/startup", "relay started (edge mode)"),
    wctl(2, "CONFIGURE", "/instrument/nmr"),
    wctl(3, "START", "/instrument/nmr"),
    cap(7, "NMR_run_039.fid", "/instrument/nmr"),
    wctl(11, "CONFIGURE", "/instrument/hplc"),
    wctl(12, "START", "/instrument/hplc"),
    cap(18, "HPLC_2026-06-23_1431.csv", "/instrument/hplc"),
    cap(26, "LCMS_batch16.raw", "/instrument/lcms"),
    acc(34, "LOGIN", "/auth/login"),
    acc(35, "READ", "/events"),
    sig(41, "approved", "NMR identity confirmed against the reference standard."),
    cap(53, "GCMS_sampleA11.cdf", "/instrument/gcms"),
    cap(67, "UVvis_scan_336.dx", "/instrument/uvvis"),
    sig(72, "reviewed", "HPLC assay within spec; reviewed for batch release."),
    cap(80, "plate_read_A02.xlsx", "/instrument/platereader"),
    exp(88, "csv"),
    sys(95, "INTEGRITY_CHECK", "/system/verify", "periodic chain verification ok"),
    cap(101, "balance_log_0915.txt", "/instrument/balance"),
    acc(140, "LOGIN", "/auth/login"),
    cap(151, "dissolution_v3.csv", "/instrument/dissolution"),
    sig(158, "approved", "Dissolution profile meets acceptance criteria."),
    cap(171, "karl_fischer_21.txt", "/instrument/kf"),
  ];

  // Build a fresh, cosmetically-chained array each call (so a reload reseeds clean).
  function seedEvents() {
    var rows = [], prev = "GENESIS";
    for (var i = 0; i < SPECS.length; i++) {
      var s = SPECS[i], seq = i + 1;
      var o = {};
      for (var k in s) if (s.hasOwnProperty(k) && k !== "t") o[k] = s[k];
      o.timestamp_utc = iso(s.t);
      var ev = makeEvent(seq, prev, o);
      prev = ev.checksum;
      rows.push(ev);
    }
    return rows;
  }

  global.MockFixtures = {
    DEMO_USER: DEMO_USER,
    OS_ACTOR: OS_ACTOR,
    captureFilenames: CAPTURE_FILES,
    seedEvents: seedEvents,
    makeEvent: makeEvent,
    nowIso: function () { return new Date().toISOString().replace(/\.\d{3}Z$/, "Z"); },
  };
})(window);
