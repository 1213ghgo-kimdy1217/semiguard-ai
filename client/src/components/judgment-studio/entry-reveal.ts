import * as THREE from "three";

/** Keep the open enclosure on screen while the enlarged cutaway comes into view.
 * The outgoing image stays in GPU memory, so each frame draws one 3D model.
 */
export function createEntryReveal(renderer: THREE.WebGLRenderer) {
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      enclosure: { value: null as THREE.FramebufferTexture | null },
      progress: { value: 0 },
    },
    vertexShader: `
      varying vec2 screenUv;
      void main() {
        screenUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D enclosure;
      uniform float progress;
      varying vec2 screenUv;
      void main() {
        vec2 offset = screenUv - 0.5;
        // Fade the complete enclosure together so the handoff cannot
        // appear to cut holes into a still-visible lid or equipment base.
        vec2 zoomedUv = 0.5 + offset / (1.0 + progress * 0.065);
        gl_FragColor = vec4(texture2D(enclosure, zoomedUv).rgb, 1.0 - progress);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const quad = new THREE.Mesh(geometry, material);
  quad.frustumCulled = false;
  scene.add(quad);
  const size = new THREE.Vector2();
  let frame: THREE.FramebufferTexture | undefined;
  let captured = false;

  function resize() {
    renderer.getDrawingBufferSize(size);
    if (frame?.image.width === size.x && frame.image.height === size.y) return;
    frame?.dispose();
    frame = new THREE.FramebufferTexture(size.x, size.y);
    frame.minFilter = THREE.LinearFilter;
    frame.magFilter = THREE.LinearFilter;
    material.uniforms.enclosure.value = frame;
    captured = false;
  }

  return {
    resize,
    get captured() { return captured; },
    warm() {
      resize();
      renderer.initTexture(frame!);
      renderer.compile(scene, camera);
    },
    capture() {
      renderer.copyFramebufferToTexture(frame!);
      captured = true;
    },
    draw(progress: number) {
      material.uniforms.progress.value = progress;
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      try {
        renderer.render(scene, camera);
      } finally {
        renderer.autoClear = autoClear;
      }
    },
    dispose() {
      frame?.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}
