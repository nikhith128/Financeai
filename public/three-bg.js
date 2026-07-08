/* FinanceAI — subtle floating wireframe background (Three.js)
   Loaded on every page after the Three.js CDN script. Renders a handful of
   slowly rotating, slowly drifting wireframe polyhedra in soft ivory, at very
   low opacity, on a fixed full-viewport canvas behind the glass panels. */
(function () {
  "use strict";

  if (typeof THREE === "undefined") {
    console.warn("Three.js failed to load — skipping 3D background.");
    return;
  }

  var canvas = document.createElement("canvas");
  canvas.id = "bg3d";
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.zIndex = "-1";
  canvas.style.display = "block";
  canvas.style.pointerEvents = "none";
  document.body.insertBefore(canvas, document.body.firstChild);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 32;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  } catch (e) {
    console.warn("WebGL unavailable — skipping 3D background.", e);
    canvas.remove();
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);

  var isSmallScreen = window.innerWidth < 700;
  var shapeCount = isSmallScreen ? 5 : 10;

  var geometries = [
    new THREE.IcosahedronGeometry(4, 0),
    new THREE.DodecahedronGeometry(3.2, 0),
    new THREE.OctahedronGeometry(3.6, 0)
  ];

  var shapes = [];
  for (var i = 0; i < shapeCount; i++) {
    var geo = geometries[i % geometries.length];
    var material = new THREE.MeshBasicMaterial({
      color: 0xf3f1ea,
      wireframe: true,
      transparent: true,
      opacity: 0.05 + Math.random() * 0.05
    });
    var mesh = new THREE.Mesh(geo, material);

    mesh.position.set(
      (Math.random() - 0.5) * 60,
      (Math.random() - 0.5) * 40,
      (Math.random() - 0.5) * 25 - 8
    );
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);

    mesh.userData.rotSpeedX = (Math.random() - 0.5) * 0.0016;
    mesh.userData.rotSpeedY = (Math.random() - 0.5) * 0.0022;
    mesh.userData.floatOffset = Math.random() * Math.PI * 2;
    mesh.userData.baseY = mesh.position.y;

    scene.add(mesh);
    shapes.push(mesh);
  }
// Centerpiece sphere my edit
var sphereGeometry = new THREE.IcosahedronGeometry(8, 1);

var sphereMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  wireframe: true,
  transparent: true,
  opacity: 0.08
});

var sphere = new THREE.Mesh(
  sphereGeometry,
  sphereMaterial
);

sphere.position.set(0, 0, -10);

scene.add(sphere);


  function animate(time) {
    requestAnimationFrame(animate);
    for (var i = 0; i < shapes.length; i++) {
      var mesh = shapes[i];
      mesh.rotation.x += mesh.userData.rotSpeedX;
      mesh.rotation.y += mesh.userData.rotSpeedY;
      mesh.position.y = mesh.userData.baseY + Math.sin(time * 0.00018 + mesh.userData.floatOffset) * 1.6;
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);

  window.addEventListener("resize", function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();
