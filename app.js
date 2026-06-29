/* GIMS Compliance Relay — single-page UI (vanilla, no build step). */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const state = {
    token: localStorage.getItem("gims_token") || null,
    user: null,
    trail: localStorage.getItem("gims_trail") || "default",
    limit: 50,
    offset: 0,
    total: 0,
    search: "",
    kind: "",
  };

  // ── API helper ────────────────────────────────────────────────
  async function api(path, { method = "GET", body, auth = true, raw = false } = {}) {
    const headers = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth && state.token) headers["Authorization"] = "Bearer " + state.token;
    // DEMO SEAM: the one and only LOGIC change to the cloned UI — route the single backend
    // call through the in-browser mock instead of the network. No fetch, no server. (Icon
    // sprite hrefs were also rebased from /static/icons.svg# to icons.svg# for the flat repo
    // layout — string paths, not logic.)
    const res = await window.MockAPI.fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    if (raw) return res;
    let data = null;
    try { data = await res.json(); } catch { /* no body */ }
    if (!res.ok) {
      const detail = (data && (data.detail || data.error)) || `HTTP ${res.status}`;
      const err = new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // ── Toasts ────────────────────────────────────────────────────
  function toast(msg, type = "ok") {
    const el = document.createElement("div");
    el.className = "toast " + type;
    const icon = type === "err" ? "i-alert" : "i-check";
    el.innerHTML = `<svg class="icon"><use href="icons.svg#${icon}"/></svg><span></span>`;
    el.querySelector("span").textContent = msg;
    $("toasts").appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateX(20px)"; setTimeout(() => el.remove(), 250); }, 3200);
  }

  function esc(s) { return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  // ── Auth / view switching ─────────────────────────────────────
  function showLogin() { $("loginScreen").classList.remove("hidden"); $("dashboard").classList.add("hidden"); $("operatorBox").classList.add("hidden"); $("chainPill").classList.add("hidden"); }
  function showDashboard() {
    $("loginScreen").classList.add("hidden"); $("dashboard").classList.remove("hidden");
    $("operatorBox").classList.remove("hidden"); $("chainPill").classList.remove("hidden");
    $("opName").textContent = state.user?.display_name || state.user?.actor_id || "reviewer";
    refreshAll();
  }

  async function restore() {
    if (!state.token) return showLogin();
    try { state.user = await api("/auth/me"); showDashboard(); }
    catch { state.token = null; localStorage.removeItem("gims_token"); showLogin(); }
  }

  async function doLogin() {
    const email = $("loginEmail").value.trim(), password = $("loginPassword").value;
    $("loginErr").textContent = "";
    if (!email || !password) { $("loginErr").textContent = "Email and password are required."; return; }
    try {
      const r = await api("/auth/login", { method: "POST", auth: false, body: { email, password } });
      state.token = r.access_token; localStorage.setItem("gims_token", state.token);
      state.user = { display_name: r.user.display_name, actor_id: "user:" + r.user.user_uuid };
      toast("Signed in as " + r.user.display_name);
      showDashboard();
    } catch (e) { $("loginErr").textContent = e.message || "Sign in failed."; }
  }

  async function doRegister() {
    const email = $("loginEmail").value.trim(), password = $("loginPassword").value;
    $("loginErr").textContent = "";
    if (!email || !password) { $("loginErr").textContent = "Enter an email and password to create the first account."; return; }
    try {
      await api("/auth/register", { method: "POST", auth: false, body: { email, password, display_name: email.split("@")[0] } });
      toast("Account created — signing in…");
      await doLogin();
    } catch (e) { $("loginErr").textContent = e.message || "Registration failed."; }
  }

  function doLogout() { state.token = null; state.user = null; localStorage.removeItem("gims_token"); showLogin(); toast("Signed out"); }

  // ── Trail viewer ──────────────────────────────────────────────
  function whatCell(r) {
    if (r.kind === "file_capture") {
      let f = "";
      try { f = JSON.parse(r.payload || "{}").filename || ""; } catch {}
      return `<span class="mono">${esc(f || r.path || "")}</span>`;
    }
    if (r.kind === "signature") return `<b>${esc(r.signature_meaning || "signed")}</b> — ${esc(r.reason || "")}`;
    if (r.kind === "export") return `Exported ${esc(r.method || "")}`;
    return `${esc(r.method || "")} ${esc(r.path || "")}`;
  }
  function actorCell(r) {
    const id = r.actor_id || "";
    const label = id.startsWith("os:") ? id.split(":").slice(2).join(":") || id : (id.startsWith("user:") ? "reviewer" : id);
    return `<span class="actor ${esc(r.actor_kind)}"><svg class="icon" style="width:13px;height:13px"><use href="icons.svg#${r.actor_kind === "authenticated" ? "i-lock" : "i-user"}"/></svg>${esc(label)}</span>`;
  }

  async function loadTrail() {
    const params = new URLSearchParams({ trail: state.trail, limit: state.limit, offset: state.offset, order_dir: "desc" });
    if (state.search) params.set("search", state.search);
    if (state.kind) params.set("kind", state.kind);
    let data;
    try { data = await api("/events?" + params.toString()); }
    catch (e) { if (e.status === 401) return doLogout(); toast(e.message, "err"); return; }
    state.total = data.total;
    const body = $("trailBody"); body.innerHTML = "";
    $("statTotal").textContent = data.total.toLocaleString();
    $("trailEmpty").classList.toggle("hidden", data.rows.length > 0);

    for (const r of data.rows) {
      const tr = document.createElement("tr");
      const t = (r.timestamp_utc || "").replace("T", " ").replace("Z", "");
      const ck = (r.checksum || "").slice(0, 10);
      tr.innerHTML =
        `<td class="chk mono">${r.chain_seq}</td>` +
        `<td class="mono" style="white-space:nowrap">${esc(t)}</td>` +
        `<td><span class="chip ${esc(r.kind)}">${esc((r.kind || "").replace("_", " "))}</span></td>` +
        `<td>${actorCell(r)}</td>` +
        `<td>${whatCell(r)}</td>` +
        `<td class="chk mono" title="${esc(r.checksum)}"><svg class="icon" style="width:12px;height:12px;color:var(--green-text)"><use href="icons.svg#i-link"/></svg> <b>${esc(ck)}</b>…</td>` +
        `<td><button class="btn sm ghost row-sign" data-ck="${esc(r.checksum)}" title="Sign this record"><svg class="icon" style="width:13px;height:13px"><use href="icons.svg#i-pen"/></svg></button></td>`;
      body.appendChild(tr);
    }
    body.querySelectorAll(".row-sign").forEach((b) => b.addEventListener("click", () => openSign(b.dataset.ck)));
    const from = data.total === 0 ? 0 : state.offset + 1;
    const to = Math.min(state.offset + state.limit, data.total);
    $("pagerInfo").textContent = `${from}–${to} of ${data.total.toLocaleString()}`;
    $("prevBtn").disabled = state.offset === 0;
    $("nextBtn").disabled = state.offset + state.limit >= data.total;
  }

  async function verifyChain() {
    const pill = $("chainPill"), txt = $("chainPillText");
    pill.className = "chain-pill"; txt.textContent = "Verifying…";
    try {
      const r = await api("/events/verify?trail=" + encodeURIComponent(state.trail));
      if (r.ok) { pill.className = "chain-pill ok"; txt.textContent = `Chain verified · ${r.records_checked}`; $("statVerified").textContent = "#" + (r.head_seq ?? "—"); }
      else { pill.className = "chain-pill broken"; txt.textContent = `Chain BROKEN · ${r.breaks.length}`; }
    } catch (e) { if (e.status === 401) return doLogout(); pill.className = "chain-pill"; txt.textContent = "Verify failed"; }
  }

  // ── File watcher ──────────────────────────────────────────────
  async function loadWatcher() {
    let s;
    try { s = await api("/filewatch/status?trail=" + encodeURIComponent(state.trail)); }
    catch { return; }
    $("watcherSys").textContent = s.watchfiles_available ? "system ready" : "watcher unavailable";
    $("watcherSys").className = "chip " + (s.watchfiles_available ? "export" : "system");
    const list = $("watcherList"); list.innerHTML = "";
    if (!s.folders || !s.folders.length) {
      list.innerHTML = `<p style="font-size:12px;color:var(--text-soft)">No folders watched. Add one above to auto-capture instrument files.</p>`;
      return;
    }
    for (const f of s.folders) {
      const led = f.running ? "on" : (f.last_error ? "warn" : "");
      const card = document.createElement("div");
      card.className = "watcher";
      card.innerHTML =
        `<div class="watcher-top"><span class="led ${led}"></span><span class="watcher-path">${esc(f.folder)}</span></div>` +
        `<div class="watcher-meta"><span>detected <b>${f.files_detected}</b></span><span>logged <b>${f.files_logged}</b></span>${f.last_error ? `<span style="color:var(--amber)">${esc(f.last_error.slice(0, 40))}</span>` : ""}</div>` +
        `<div style="display:flex;gap:7px">` +
        (f.running
          ? `<button class="btn sm" data-stop="${esc(f.folder)}"><svg class="icon" style="width:12px;height:12px"><use href="icons.svg#i-stop"/></svg> Stop</button>`
          : `<button class="btn sm green" data-start="${esc(f.folder)}"><svg class="icon" style="width:12px;height:12px"><use href="icons.svg#i-play"/></svg> Start</button>`) +
        `<button class="btn sm ghost" data-remove="${esc(f.folder)}"><svg class="icon" style="width:12px;height:12px"><use href="icons.svg#i-x"/></svg></button></div>`;
      list.appendChild(card);
    }
    list.querySelectorAll("[data-start]").forEach((b) => b.addEventListener("click", () => watchAction("start", b.dataset.start)));
    list.querySelectorAll("[data-stop]").forEach((b) => b.addEventListener("click", () => watchAction("stop", b.dataset.stop)));
    list.querySelectorAll("[data-remove]").forEach((b) => b.addEventListener("click", () => removeFolder(b.dataset.remove)));
  }

  async function addFolder() {
    const folder = $("folderInput").value.trim();
    if (!folder) return;
    try {
      await api("/filewatch/configure", { method: "POST", body: { trail: state.trail, folders: [folder] } });
      await api("/filewatch/start", { method: "POST", body: { trail: state.trail, folders: [folder] } });
      $("folderInput").value = ""; toast("Watching " + folder); loadWatcher();
    } catch (e) { toast(e.message, "err"); }
  }
  async function watchAction(action, folder) {
    try { await api("/filewatch/" + action, { method: "POST", body: { trail: state.trail, folders: [folder] } }); loadWatcher(); }
    catch (e) { toast(e.message, "err"); }
  }
  async function removeFolder(folder) {
    try { await api("/filewatch/folder", { method: "DELETE", body: { trail: state.trail, folder } }); loadWatcher(); }
    catch (e) { toast(e.message, "err"); }
  }

  // ── Export (fetch with auth → download blob) ──────────────────
  async function exportTrail(fmt) {
    const params = new URLSearchParams({ trail: state.trail });
    if (state.search) params.set("search", state.search);
    if (state.kind) params.set("kind", state.kind);
    try {
      const res = await api(`/events/export.${fmt}?` + params.toString(), { raw: true });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.detail || `HTTP ${res.status}`); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${state.trail}-trail.${fmt}`; a.click();
      URL.revokeObjectURL(url);
      toast(`Sealed ${fmt.toUpperCase()} export downloaded`);
    } catch (e) { toast(e.message, "err"); }
  }

  // ── E-signature ───────────────────────────────────────────────
  function openSign(checksum) {
    $("signTarget").value = checksum;
    $("signEmail").value = $("loginEmail").value || "";
    $("signPassword").value = ""; $("signReason").value = ""; $("signErr").textContent = "";
    $("signOverlay").classList.remove("hidden");
    $("signPassword").focus();
  }
  function closeSign() { $("signOverlay").classList.add("hidden"); }
  async function confirmSign() {
    const body = {
      email: $("signEmail").value.trim(), password: $("signPassword").value,
      target_checksums: [$("signTarget").value], meaning: $("signMeaning").value,
      reason: $("signReason").value.trim(), trail: state.trail,
    };
    $("signErr").textContent = "";
    if (!body.password) { $("signErr").textContent = "Password is required to sign."; return; }
    if (!body.reason) { $("signErr").textContent = "A reason is required."; return; }
    try {
      await api("/events/sign", { method: "POST", body });
      closeSign(); toast("Signature recorded"); refreshAll();
    } catch (e) { $("signErr").textContent = e.message || "Signature failed."; }
  }

  // ── Refresh orchestration ─────────────────────────────────────
  function rememberTrail() {
    const t = (localStorage.getItem("gims_trails") || "default").split(",");
    if (!t.includes(state.trail)) t.push(state.trail);
    localStorage.setItem("gims_trails", t.join(","));
    $("trailList").innerHTML = t.map((x) => `<option value="${esc(x)}">`).join("");
  }
  function refreshAll() { rememberTrail(); loadTrail(); verifyChain(); loadWatcher(); }

  // ── Wire events ───────────────────────────────────────────────
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  $("loginBtn").addEventListener("click", doLogin);
  $("loginPassword").addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
  $("registerLink").addEventListener("click", doRegister);
  $("logoutBtn").addEventListener("click", doLogout);

  $("trailInput").addEventListener("change", (e) => { state.trail = e.target.value.trim() || "default"; state.offset = 0; localStorage.setItem("gims_trail", state.trail); refreshAll(); });
  $("verifyBtn").addEventListener("click", verifyChain);
  $("chainPill").addEventListener("click", verifyChain);
  $("refreshBtn").addEventListener("click", refreshAll);
  $("searchInput").addEventListener("input", debounce((e) => { state.search = e.target.value.trim(); state.offset = 0; loadTrail(); }, 300));
  $("kindFilter").addEventListener("change", (e) => { state.kind = e.target.value; state.offset = 0; loadTrail(); });
  $("prevBtn").addEventListener("click", () => { state.offset = Math.max(0, state.offset - state.limit); loadTrail(); });
  $("nextBtn").addEventListener("click", () => { state.offset += state.limit; loadTrail(); });

  $("addFolderBtn").addEventListener("click", addFolder);
  $("folderInput").addEventListener("keydown", (e) => { if (e.key === "Enter") addFolder(); });
  $("exportCsvBtn").addEventListener("click", () => exportTrail("csv"));
  $("exportJsonBtn").addEventListener("click", () => exportTrail("json"));

  $("signCancel").addEventListener("click", closeSign);
  $("signConfirm").addEventListener("click", confirmSign);
  $("signOverlay").addEventListener("click", (e) => { if (e.target.id === "signOverlay") closeSign(); });

  $("trailInput").value = state.trail;
  // auto-refresh the trail + watcher periodically while viewing
  setInterval(() => { if (!$("dashboard").classList.contains("hidden")) { loadWatcher(); } }, 8000);

  restore();
})();
