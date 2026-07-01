/* ════════════════════════════════════════════════════════════════════════
   steps.js — the GIMS demo's gnome-led tour (CONTENT only).

   The engine lives in tutorial.js (Tour.*). This file just describes the steps,
   the narrator, and wires the "Replay tour" control. The gnome walks a first-time
   visitor through the real workflow: sign in → watch a folder → see a capture →
   verify → sign → export. Each interactive step performs the real action via the
   mock, so the trail visibly grows just like the live product.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var STORAGE_KEY = "gims_demo_tour_done";
  var DEMO_EMAIL = "reviewer@lab.com";
  var DEMO_PASS = "demo-password";
  var SAMPLE_FOLDER = "/instrument/hplc/exports";

  function firstTrailRow() { return document.querySelector("#trailBody tr"); }

  var STEPS = [
    {
      target: null, placement: "center", title: "Welcome to the Relay 🧙",
      html: "I'm the GIMS gnome. This is a <b>non-functional demo</b> — every value is " +
            "simulated and resets on reload. Let me walk you through the workflow. " +
            "You can <b>Skip</b> anytime.",
    },
    {
      target: "#loginBtn", placement: "top", title: "Sign in",
      html: "Viewing the regulated trail needs an authenticated reviewer. In this demo " +
            "<b>any</b> email & password work — I've filled them in. Click <b>Sign in</b>." +
            "<br><br><i>Already signed in?</i> Click the <b>logout</b> button (top-right), " +
            "then press <b>Back</b> and <b>Next</b> to pick up here.",
      advanceOn: "target-click", advanceDelay: 500,
      beforeShow: function (api) { api.set("#loginEmail", DEMO_EMAIL); api.set("#loginPassword", DEMO_PASS); },
    },
    {
      target: "#trailInput", placement: "right", title: "Pick a trail",
      html: "A <b>trail</b> is a study or batch — its own append-only record stream. " +
            "We'll stay on <b>default</b>, which already has some seeded records.",
    },
    {
      target: "#addFolderBtn", placement: "right", title: "Watch a folder",
      html: "Point the relay at an instrument's output folder and it auto-captures every " +
            "new file. I've typed a path — click <b>+</b> to start watching.",
      advanceOn: "target-click", advanceDelay: 650,
      beforeShow: function (api) { api.set("#folderInput", SAMPLE_FOLDER); },
    },
    {
      target: firstTrailRow, placement: "left", title: "A capture appears",
      html: "The moment a folder is watched, a simulated instrument file is captured and " +
            "logged to the top of the trail — under the operator's OS identity.",
      beforeShow: function (api) { api.click("#refreshBtn"); return api.wait(450); },
    },
    {
      target: "#verifyBtn", placement: "right", title: "Verify the chain",
      html: "In the real product this re-walks a keyed, tamper-evident chain. Here it's " +
            "cosmetic — click <b>Verify</b> and the header pill turns green ✓.",
      advanceOn: "target-click", advanceDelay: 600,
    },
    {
      target: ".row-sign", placement: "left", title: "Sign a record",
      html: "Reviewers bind an <b>electronic signature</b> to a record. Hover reveals a pen " +
            "on each row — click it to open the signing dialog.",
      advanceOn: "target-click", advanceDelay: 500,
    },
    {
      target: "#signConfirm", placement: "left", spotlight: false,
      raise: "#signOverlay",            // lift the modal above the tour dim
      shield: "#signOverlay",           // …but its backdrop must not catch stray clicks
      interactive: "#signOverlay .modal", // …while the dialog itself stays clickable
      title: "Confirm the signature",
      html: "Part 11 requires re-entering your password to sign. I've filled the password " +
            "and a reason — click <b>Sign &amp; confirm</b>.",
      advanceOn: "target-click", advanceDelay: 650,
      beforeShow: function (api) {
        return api.wait(250).then(function () {
          api.set("#signPassword", DEMO_PASS);
          api.set("#signReason", "Reviewed in demo walkthrough.");
        });
      },
    },
    {
      target: "#exportCsvBtn", placement: "top", title: "Export the evidence",
      html: "Export the trail as CSV or JSON. Click <b>CSV</b> — the file downloads, " +
            "watermarked as <b>simulated</b> so it can't be mistaken for a real record.",
      advanceOn: "target-click", advanceDelay: 700,
    },
    {
      target: null, placement: "center", title: "That's the tour! ✨",
      html: "You signed in, captured a file, verified, signed, and exported — the whole " +
            "Compliance Relay workflow. Remember: this is a <b>demo</b>; everything resets " +
            "on reload. Use <b>↻ Replay tour</b> in the banner to see it again.",
    },
  ];

  function startTour(opts) {
    Tour.start({
      storageKey: opts && opts.force ? null : STORAGE_KEY,
      finishLabel: "Finish",
      narrator: { image: "assets/gnome.png", name: "GIMS gnome" },
      dim: "rgba(6,10,20,0.74)", ring: "#4f6ef7",
      steps: STEPS,
      onFinish: function () { try { localStorage.setItem(STORAGE_KEY, "done"); } catch (e) {} },
      onSkip: function () { try { localStorage.setItem(STORAGE_KEY, "done"); } catch (e) {} },
    });
  }

  function launchReplay() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    Tour.replay({ storageKey: STORAGE_KEY, finishLabel: "Finish", narrator: { image: "assets/gnome.png", name: "GIMS gnome" }, steps: STEPS });
  }

  window.GimsTour = {
    replay: function () {
      // The tour begins on the login screen, so a replay must first return the
      // app to a logged-out state — otherwise the login-step spotlight has no
      // target and the tour glitches. Sign out, then start once the login
      // screen has painted.
      var demo = window.GimsDemo;
      if (demo && demo.isLoggedIn && demo.isLoggedIn()) {
        try { demo.logout(); } catch (e) {}
        setTimeout(launchReplay, 150);
      } else {
        launchReplay();
      }
    },
  };

  function boot() {
    var replay = document.getElementById("replayTour");
    if (replay) replay.addEventListener("click", function () { window.GimsTour.replay(); });
    var seen = false;
    try { seen = localStorage.getItem(STORAGE_KEY) === "done"; } catch (e) {}
    if (!seen) setTimeout(function () { startTour(); }, 600);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
