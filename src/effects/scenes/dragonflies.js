import { DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry, TextureLoader, Vector2 } from 'three';

const SPRITES = [
  { x: 465, y: 225, width: 228, height: 108, axis: [0.98, -0.19], joint: [24, -35], travel: 55 },
  { x: 640, y: 394.5, width: 206, height: 253, axis: [0.94, 0.34], joint: [0, -11], travel: 82 },
  { x: 462, y: 743, width: 504, height: 400, axis: [0.73, 0.68], joint: [-22, -3], travel: 100 },
];

/** Painted membranes on subdivided 3D meshes, hinged along each insect's thorax.
 * The original ink is the texture; no replacement illustration is introduced.
 * Coordinates are artwork pixels (1536 × 1024) centred on the origin.
 */
export async function createDragonflies(scene, { renderOrder = 0 } = {}) {
  const loader = new TextureLoader();
  const flies = await Promise.all(
    SPRITES.map(async (spec, index) => {
      const texture = await loader.loadAsync(
        `/assets/images/hero/layers/dragonfly-${index + 1}.webp`,
      );
      const uniforms = {
        uTime: { value: 0 },
        uAxis: { value: new Vector2(...spec.axis) },
        uJoint: { value: new Vector2(...spec.joint) },
      };
      const material = new MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: DoubleSide,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = `uniform float uTime; uniform vec2 uAxis; uniform vec2 uJoint;\n${shader.vertexShader}`;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `
          #include <begin_vertex>
          vec2 normal = vec2(-uAxis.y, uAxis.x);
          vec2 relative = position.xy - uJoint;
          float across = dot(relative, normal);
          float along = dot(relative, uAxis);
          float wing = smoothstep(5.0, 22.0, abs(across));
          float beat = sin(uTime * 36.0 + smoothstep(-15.0, 20.0, along) * 0.85);
          float angle = beat * 0.43 * wing;
          transformed.xy += normal * across * (cos(angle) - 1.0);
          transformed.z += abs(across) * sin(angle);
        `,
        );
      };
      const mesh = new Mesh(new PlaneGeometry(spec.width, spec.height, 40, 36), material);
      mesh.position.set(spec.x - 768, 512 - spec.y, index * 3);
      mesh.renderOrder = renderOrder;
      scene.add(mesh);
      return { mesh, uniforms, texture, spec, index };
    }),
  );

  let elapsed = 0;
  return {
    update(delta) {
      elapsed += Math.min(delta, 0.05);
      flies.forEach(({ mesh, uniforms, spec, index }) => {
        const phase = index * 2.17;
        const takeoff = Math.min(elapsed / 5, 1);
        const travel = spec.travel * takeoff;
        mesh.position.x =
          spec.x -
          768 +
          Math.sin(elapsed * 0.21 + phase) * travel +
          Math.sin(elapsed * 1.1 + phase) * 4;
        mesh.position.y =
          512 -
          spec.y +
          Math.sin(elapsed * 0.31 + phase) * travel * 0.42 +
          Math.cos(elapsed * 1.7 + phase) * 3;
        mesh.rotation.z = Math.sin(elapsed * 0.4 + phase) * 0.09 * takeoff;
        mesh.rotation.y = Math.sin(elapsed * 0.33 + phase) * 0.14;
        uniforms.uTime.value = elapsed + phase;
      });
    },
    dispose() {
      flies.forEach(({ mesh, texture }) => {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        texture.dispose();
      });
    },
  };
}
