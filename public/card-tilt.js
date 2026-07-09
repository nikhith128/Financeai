/* FinanceAI — subtle 3D tilt-on-hover for cards.
   Uses event delegation on document so it automatically works on cards that
   get rebuilt dynamically (goal cards, budget rows) without needing to
   re-attach listeners after every re-render, and without ever stacking up
   duplicate listeners.
   Only activates on devices with a precise pointer (mouse/trackpad) — skips
   touch devices, where hover-follow doesn't make sense. */
(function () {
  "use strict";

  if (!window.matchMedia || !window.matchMedia("(pointer: fine)").matches) {
    return;
  }

  var TILT_SELECTOR = ".kpi-card, .chart-card, .summary-card, .goal-card, .panel";
  var MAX_TILT_DEG = 5;

  var currentEl = null;

  function applyTilt(el, clientX, clientY) {
    var rect = el.getBoundingClientRect();
    var x = clientX - rect.left;
    var y = clientY - rect.top;
    var rotateY = ((x - rect.width / 2) / (rect.width / 2)) * MAX_TILT_DEG;
    var rotateX = -((y - rect.height / 2) / (rect.height / 2)) * MAX_TILT_DEG;
    el.style.transform =
      "perspective(900px) rotateX(" + rotateX.toFixed(2) + "deg) rotateY(" + rotateY.toFixed(2) + "deg) translateY(-3px)";
  }

  function resetTilt(el) {
    if (el) el.style.transform = "";
  }

  document.addEventListener("mousemove", function (e) {
    var card = e.target.closest ? e.target.closest(TILT_SELECTOR) : null;

    if (card !== currentEl) {
      resetTilt(currentEl);
      currentEl = card;
    }
    if (card) {
      applyTilt(card, e.clientX, e.clientY);
    }
  });

  // Safety net: if the cursor leaves the browser window entirely, mousemove
  // stops firing, which would otherwise leave the last card stuck tilted.
  document.addEventListener("mouseleave", function () {
    resetTilt(currentEl);
    currentEl = null;
  });
})();
