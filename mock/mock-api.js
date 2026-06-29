/* ════════════════════════════════════════════════════════════════════════
   mock-api.js — the in-browser stand-in for the backend.

   Exposes window.MockAPI.fetch(path, opts) with the SAME contract as fetch():
   it returns a Promise<Response>, so the cloned app.js's api() wrapper works
   byte-for-byte (including res.ok / res.json() / res.blob() for raw exports).
   That single call is the only seam between the cloned UI and "the backend."

   It is deliberately dumb: no auth logic, no integrity, no persistence.
     • login accepts ANYTHING and resolves to one constant fake reviewer
     • verify is a hard-coded ok:true (it does not walk any chain)
     • all state is in-memory and GONE on reload
     • exports are watermarked as simulated
   ════════════════════════════════════════════════════════════════════════ */
(function (global) {
  "use strict";
  var FC = global.FakeCrypto;
  var FX = global.MockFixtures;
  var USER = FX.DEMO_USER;

  // ── In-memory state (resets on reload — there is nothing to attack) ──────
  var events = FX.seedEvents();
  var seqCounter = events.length;
  var headChecksum = events.length ? events[events.length - 1].checksum : "GENESIS";
  var folders = {};   // trail -> { folderPath -> folderState }

  function appendEvent(partial) {
    seqCounter += 1;
    partial = partial || {};
    if (!partial.timestamp_utc) partial.timestamp_utc = FX.nowIso();
    var ev = FX.makeEvent(seqCounter, headChecksum, partial);
    headChecksum = ev.checksum;
    events.push(ev);
    return ev;
  }

  // ── /events query (client-side filter + paginate, honoring the UI params) ─
  function matchesSearch(e, q) {
    return [e.payload, e.path, e.actor_id, e.signer, e.reason, e.method, e.kind]
      .some(function (v) { return v && String(v).toLowerCase().indexOf(q) >= 0; });
  }
  function filterRows(query) {
    var trail = query.trail || "default";
    var kind = query.kind || "";
    var search = (query.search || "").toLowerCase();
    var rows = events.filter(function (e) { return e.trail === trail; });
    if (kind) rows = rows.filter(function (e) { return e.kind === kind; });
    if (search) rows = rows.filter(function (e) { return matchesSearch(e, search); });
    return rows;
  }
  function queryEvents(query) {
    var order = query.order_dir || "desc";
    var limit = Math.max(1, parseInt(query.limit || "50", 10));
    var offset = Math.max(0, parseInt(query.offset || "0", 10));
    var rows = filterRows(query).slice().sort(function (a, b) {
      return order === "asc" ? a.chain_seq - b.chain_seq : b.chain_seq - a.chain_seq;
    });
    return { trail: query.trail || "default", total: rows.length, rows: rows.slice(offset, offset + limit), limit: limit, offset: offset };
  }

  // ── File watcher (in-memory) + simulated capture ─────────────────────────
  function trailFolders(trail) { trail = trail || "default"; if (!folders[trail]) folders[trail] = {}; return folders[trail]; }
  function ensureFolder(trail, p) {
    var f = trailFolders(trail);
    if (!f[p]) f[p] = { folder: p, active: true, running: false, files_detected: 0, files_logged: 0, last_error: null };
    return f[p];
  }
  function captureInto(trail, folderPath) {
    var st = trailFolders(trail)[folderPath];
    if (!st || !st.running) return;
    var name = FX.captureFilenames[(Math.random() * FX.captureFilenames.length) | 0];
    appendEvent({
      trail: trail, kind: "file_capture", method: "CAPTURE",
      path: folderPath.replace(/\/+$/, "") + "/" + name,
      actor_id: FX.OS_ACTOR, actor_kind: "os_bound",
      payload: { filename: name, bytes: 1024 * ((Math.random() * 900 | 0) + 50), sha256: FC.checksum() },
    });
    st.files_detected += 1; st.files_logged += 1;
  }
  function statusFor(trail) {
    var f = trailFolders(trail);
    var arr = Object.keys(f).sort().map(function (k) { return f[k]; });
    return {
      trail: trail || "default",
      folders: arr.map(function (x) { return { folder: x.folder, active: x.active, running: x.running, files_detected: x.files_detected, files_logged: x.files_logged, last_error: x.last_error }; }),
      files_detected: arr.reduce(function (s, x) { return s + x.files_detected; }, 0),
      files_logged: arr.reduce(function (s, x) { return s + x.files_logged; }, 0),
      last_error: (arr.filter(function (x) { return x.last_error; })[0] || {}).last_error || null,
      watchfiles_available: true,
      persistence: false,
    };
  }

  // periodically grow the trail for any running folder (the demo's "live" feel)
  setInterval(function () {
    Object.keys(folders).forEach(function (trail) {
      Object.keys(folders[trail]).forEach(function (p) {
        if (folders[trail][p].running && Math.random() < 0.6) captureInto(trail, p);
      });
    });
  }, 7000);

  // ── Exports (watermarked as simulated) ───────────────────────────────────
  var CSV_COLS = [
    "id", "event_uuid", "trail", "kind", "timestamp_utc", "recorded_at_utc",
    "actor_id", "actor_kind", "method", "path", "ids", "status", "success",
    "payload", "project", "source_ip", "session_id", "user_agent",
    "signer", "signature_meaning", "reason", "prev_checksum", "chain_seq", "checksum",
  ];
  function csvCell(v) {
    if (v == null) return "";
    var s = String(v);
    // Neutralize spreadsheet formula injection from user-typed fields (sign reason/email):
    // a leading = + - @ (or tab/CR) is prefixed with an apostrophe so apps don't execute it.
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function exportRows(query) {
    return filterRows(query).slice().sort(function (a, b) { return a.chain_seq - b.chain_seq; });
  }
  function exportCsv(query) {
    var rows = exportRows(query);
    var lines = [
      "# GIMS COMPLIANCE RELAY — DEMO EXPORT — simulated data, NOT a regulated record.",
      "# Generated in-browser; no sealed manifest, no signature; resets on reload.",
      CSV_COLS.join(","),
    ];
    rows.forEach(function (r) { lines.push(CSV_COLS.map(function (c) { return csvCell(r[c]); }).join(",")); });
    return blobResponse(lines.join("\n") + "\n", "text/csv", (query.trail || "default") + "-trail.csv");
  }
  function exportJson(query) {
    var rows = exportRows(query);
    var head = rows.length ? rows[rows.length - 1] : null;
    var doc = {
      _demo_watermark: "SIMULATED — generated in-browser by the GIMS Compliance Relay DEMO. " +
        "This is NOT a sealed, signed evidence package and NOT a regulated record. State resets on reload.",
      manifest: {
        trail: query.trail || "default", generated_at_utc: FX.nowIso(),
        row_count: rows.length, demo: true,
        head_checksum: head ? head.checksum : null, head_seq: head ? head.chain_seq : null,
        signature: "demo-not-signed",
      },
      rows: rows,
    };
    return blobResponse(JSON.stringify(doc, null, 2), "application/json", (query.trail || "default") + "-trail.json");
  }

  // ── Response builders ────────────────────────────────────────────────────
  function jsonResponse(status, obj) {
    return new Response(JSON.stringify(obj), { status: status, headers: { "Content-Type": "application/json" } });
  }
  function blobResponse(text, type, filename) {
    return new Response(new Blob([text], { type: type }), {
      status: 200,
      headers: { "Content-Type": type, "Content-Disposition": 'attachment; filename="' + filename + '"' },
    });
  }

  // ── Router ───────────────────────────────────────────────────────────────
  function handle(method, pathname, query, body) {
    // auth — accepts anything, resolves to one constant fake reviewer
    if (method === "POST" && pathname === "/auth/register") {
      if (!body.email || !body.password) return jsonResponse(400, { detail: "email and password are required" });
      return jsonResponse(200, { user_uuid: FC.uuid(), email: body.email, display_name: body.display_name || String(body.email).split("@")[0] });
    }
    if (method === "POST" && pathname === "/auth/login") {
      if (!body.email || !body.password) return jsonResponse(400, { detail: "email and password are required" });
      return jsonResponse(200, { access_token: FC.token(), token_type: "bearer", user: { user_uuid: USER.user_uuid, email: body.email, display_name: USER.display_name } });
    }
    if (method === "GET" && pathname === "/auth/me") {
      // presence-only: any token string is accepted; nothing is verified.
      return jsonResponse(200, { actor_id: "user:" + USER.user_uuid, actor_kind: "authenticated", display_name: USER.display_name });
    }

    // events
    if (method === "GET" && pathname === "/events") return jsonResponse(200, queryEvents(query));
    if (method === "GET" && pathname === "/events/verify") {
      var rows = filterRows({ trail: query.trail || "default" }).sort(function (a, b) { return a.chain_seq - b.chain_seq; });
      var head = rows.length ? rows[rows.length - 1] : null;
      return jsonResponse(200, { trail: query.trail || "default", ok: true, records_checked: rows.length, head_checksum: head ? head.checksum : null, head_seq: head ? head.chain_seq : null, breaks: [] });
    }
    if (method === "POST" && pathname === "/events/sign") {
      if (!body.password) return jsonResponse(401, { detail: "re-authentication failed" });
      var ev = appendEvent({
        trail: body.trail || "default", kind: "signature", method: "SIGN", path: "/events/sign",
        actor_id: "user:" + USER.user_uuid, actor_kind: "authenticated",
        signer: body.email || USER.email, signature_meaning: body.meaning || "approved",
        reason: body.reason || "", payload: { target_checksums: body.target_checksums || [] },
      });
      return jsonResponse(200, { ok: true, signature: ev });
    }
    if (method === "GET" && pathname === "/events/export.csv") return exportCsv(query);
    if (method === "GET" && pathname === "/events/export.json") return exportJson(query);

    // file watcher
    if (method === "POST" && pathname === "/filewatch/configure") {
      (body.folders || []).forEach(function (p) { ensureFolder(body.trail, p); });
      return jsonResponse(200, statusFor(body.trail || "default"));
    }
    if (method === "POST" && pathname === "/filewatch/start") {
      var f = trailFolders(body.trail);
      var targets = (body.folders && body.folders.length) ? body.folders : Object.keys(f);
      targets.forEach(function (p) { var st = ensureFolder(body.trail, p); st.running = true; st.active = true; st.last_error = null; captureInto(body.trail || "default", p); });
      return jsonResponse(200, statusFor(body.trail || "default"));
    }
    if (method === "POST" && pathname === "/filewatch/stop") {
      var ff = trailFolders(body.trail);
      var tg = (body.folders && body.folders.length) ? body.folders : Object.keys(ff);
      tg.forEach(function (p) { if (ff[p]) { ff[p].running = false; ff[p].active = false; } });
      return jsonResponse(200, statusFor(body.trail || "default"));
    }
    if (method === "DELETE" && pathname === "/filewatch/folder") {
      delete trailFolders(body.trail)[body.folder];
      return jsonResponse(200, statusFor(body.trail || "default"));
    }
    if (method === "GET" && pathname === "/filewatch/status") return jsonResponse(200, statusFor(query.trail || "default"));

    return jsonResponse(404, { detail: "not found (demo mock): " + method + " " + pathname });
  }

  function parseUrl(path) {
    var url = new URL(path, "http://demo.local");
    var q = {};
    url.searchParams.forEach(function (v, k) { q[k] = v; });
    return { pathname: url.pathname, query: q };
  }

  global.MockAPI = {
    fetch: function (path, opts) {
      opts = opts || {};
      var method = (opts.method || "GET").toUpperCase();
      var u = parseUrl(path);
      var body = {};
      if (opts.body) { try { body = JSON.parse(opts.body); } catch (e) { body = {}; } }
      // small simulated latency so the UI's spinners/transitions feel real
      return new Promise(function (resolve) {
        setTimeout(function () { resolve(handle(method, u.pathname, u.query, body)); }, 80 + (Math.random() * 110 | 0));
      });
    },
    // exposed for the tutorial / debugging
    _events: function () { return events; },
  };
})(window);
