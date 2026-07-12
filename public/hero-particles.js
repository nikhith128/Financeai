/* FinanceAI — Hero particle diamond (Three.js)
   Confined to the .hero section only. Thousands of tiny glowing gold
   particles hold a faceted diamond (octahedron) silhouette, drift with
   gentle organic motion, then smoothly morph into a flat square and
   back, on a slow continuous loop. Replaces whatever sits behind the
   hero text with an opaque near-black backdrop matching the site theme. */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {

  if (typeof THREE === "undefined") {
    console.warn("Three.js not loaded — skipping hero particle diamond.");
    return;
  }

  var heroEl = document.querySelector(".hero");
  if (!heroEl) return;

  heroEl.style.position = "relative";
  heroEl.style.overflow = "hidden";

  var canvas = document.createElement("canvas");
  canvas.id = "hero-particles";
  canvas.style.position = "absolute";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.zIndex = "0";
  canvas.style.pointerEvents = "none";
  heroEl.insertBefore(canvas, heroEl.firstChild);

  Array.prototype.forEach.call(heroEl.children, function (child) {
    if (child !== canvas) {
      child.style.position = "relative";
      child.style.zIndex = "1";
    }
  });

  function getSize() {
    return { w: heroEl.clientWidth, h: heroEl.clientHeight || Math.round(window.innerHeight * 0.9) };
  }
  var size = getSize();

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(45, size.w / size.h, 0.1, 1000);
  camera.position.z = 20;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  } catch (e) {
    console.warn("WebGL unavailable — skipping hero particle diamond.", e);
    canvas.remove();
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(size.w, size.h);
  renderer.setClearColor(0x0a0a0c, 1);

  function makeGlowTexture() {
    var c = document.createElement("canvas");
    c.width = 64; c.height = 64;
    var ctx = c.getContext("2d");
    var g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(244,224,190,0.9)");
    g.addColorStop(0.6, "rgba(212,175,122,0.35)");
    g.addColorStop(1, "rgba(212,175,122,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  var glowTexture = makeGlowTexture();

  var isSmall = size.w < 700;
  var COUNT = isSmall ? 1400 : 3200;

  function diamondPoint() {
    var R = 7.2;
    var top = new THREE.Vector3(0, R, 0);
    var bottom = new THREE.Vector3(0, -R, 0);
    var ring = [
      new THREE.Vector3(R, 0, 0),
      new THREE.Vector3(0, 0, R),
      new THREE.Vector3(-R, 0, 0),
      new THREE.Vector3(0, 0, -R)
    ];
    var apex = Math.random() < 0.5 ? top : bottom;
    var idx = Math.floor(Math.random() * 4);
    var a = ring[idx];
    var b = ring[(idx + 1) % 4];
    var u = Math.random();
    var v = Math.random() * (1 - u);
    var w = 1 - u - v;
    return new THREE.Vector3(
      apex.x * u + a.x * v + b.x * w,
      apex.y * u + a.y * v + b.y * w,
      apex.z * u + a.z * v + b.z * w
    );
  }

  function squarePoint() {
    var S = 8.6;
    var onEdge = Math.random() < 0.75;
    if (onEdge) {
      var edge = Math.floor(Math.random() * 4);
      var t = (Math.random() - 0.5) * 2 * S;
      switch (edge) {
        case 0: return new THREE.Vector3(t, S, (Math.random() - 0.5) * 0.6);
        case 1: return new THREE.Vector3(t, -S, (Math.random() - 0.5) * 0.6);
        case 2: return new THREE.Vector3(S, t, (Math.random() - 0.5) * 0.6);
        default: return new THREE.Vector3(-S, t, (Math.random() - 0.5) * 0.6);
      }
    }
    return new THREE.Vector3(
      (Math.random() - 0.5) * 2 * S,
      (Math.random() - 0.5) * 2 * S,
      (Math.random() - 0.5) * 0.6
    );
  }

  var diamondPositions = new Float32Array(COUNT * 3);
  var squarePositions = new Float32Array(COUNT * 3);
  var currentPositions = new Float32Array(COUNT * 3);
  var jitterSeed = new Float32Array(COUNT * 3);

  for (var i = 0; i < COUNT; i++) {
    var dp = diamondPoint();
    var sp = squarePoint();
    var ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;
    diamondPositions[ix] = dp.x; diamondPositions[iy] = dp.y; diamondPositions[iz] = dp.z;
    squarePositions[ix] = sp.x; squarePositions[iy] = sp.y; squarePositions[iz] = sp.z;
    currentPositions[ix] = dp.x; currentPositions[iy] = dp.y; currentPositions[iz] = dp.z;
    jitterSeed[ix] = Math.random() * Math.PI * 2;
    jitterSeed[iy] = Math.random() * Math.PI * 2;
    jitterSeed[iz] = Math.random() * Math.PI * 2;
  }

  var geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(currentPositions, 3));

  var material = new THREE.PointsMaterial({
    size: isSmall ? 0.16 : 0.13,
    map: glowTexture,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    color: 0xe9d3a8,
    sizeAttenuation: true,
    opacity: 0.85
  });

  var points = new THREE.Points(geometry, material);
  points.position.set(0, -1.5, -4);
  scene.add(points);

  var HOLD_DIAMOND = 4200;
  var MORPH_TIME = 2600;
  var HOLD_SQUARE = 3000;
  var state = 0;
  var stateStart = performance.now();

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function updateMorph(now) {
    var elapsed = now - stateStart;
    var morphT;
    if (state === 0) {
      morphT = 0;
      if (elapsed > HOLD_DIAMOND) { state = 1; stateStart = now; }
    } else if (state === 1) {
      morphT = easeInOutCubic(Math.min(1, elapsed / MORPH_TIME));
      if (elapsed > MORPH_TIME) { state = 2; stateStart = now; }
    } else if (state === 2) {
      morphT = 1;
      if (elapsed > HOLD_SQUARE) { state = 3; stateStart = now; }
    } else {
      morphT = 1 - easeInOutCubic(Math.min(1, elapsed / MORPH_TIME));
      if (elapsed > MORPH_TIME) { state = 0; stateStart = now; }
    }
    return morphT;
  }

  var pos = geometry.attributes.position.array;

  function animate(time) {
    requestAnimationFrame(animate);
    var morphT = updateMorph(time);

    for (var i = 0; i < COUNT; i++) {
      var ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;
      var baseX = diamondPositions[ix] + (squarePositions[ix] - diamondPositions[ix]) * morphT;
      var baseY = diamondPositions[iy] + (squarePositions[iy] - diamondPositions[iy]) * morphT;
      var baseZ = diamondPositions[iz] + (squarePositions[iz] - diamondPositions[iz]) * morphT;

      pos[ix] = baseX + Math.sin(time * 0.0006 + jitterSeed[ix]) * 0.12;
      pos[iy] = baseY + Math.cos(time * 0.0005 + jitterSeed[iy]) * 0.12;
      pos[iz] = baseZ + Math.sin(time * 0.0007 + jitterSeed[iz]) * 0.12;
    }
    geometry.attributes.position.needsUpdate = true;

    points.rotation.y += 0.0011;
    points.rotation.x = Math.sin(time * 0.00012) * 0.08;

    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);

  window.addEventListener("resize", function () {
    var s = getSize();
    camera.aspect = s.w / s.h;
    camera.updateProjectionMatrix();
    renderer.setSize(s.w, s.h);
  });

  }); // end DOMContentLoaded
})();
