/**
 * Stable-fluids velocity field on the GPU (advection, vorticity, pressure
 * projection). Only velocity is simulated: consumers sample `texture` to
 * displace their own imagery instead of drawing dye, so the effect bends the
 * artwork rather than painting smoke over it.
 */
import {
  HalfFloatType,
  LinearFilter,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  RawShaderMaterial,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from 'three';

const vertexShader = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  attribute vec2 uv;
  uniform vec2 uTexel;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  void main() {
    vUv = uv;
    vL = uv - vec2(uTexel.x, 0.0);
    vR = uv + vec2(uTexel.x, 0.0);
    vT = uv + vec2(0.0, uTexel.y);
    vB = uv - vec2(0.0, uTexel.y);
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const header = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
`;

const shaders = {
  splat: /* glsl */ `${header}
    uniform sampler2D uTarget;
    uniform vec3 uColor;
    uniform vec2 uPoint;
    uniform float uAspect;
    uniform float uRadius;
    void main() {
      vec2 p = vUv - uPoint;
      p.x *= uAspect;
      vec3 splat = exp(-dot(p, p) / uRadius) * uColor;
      gl_FragColor = vec4(texture2D(uTarget, vUv).xyz + splat, 1.0);
    }
  `,
  advection: /* glsl */ `${header}
    uniform sampler2D uVelocity;
    uniform vec2 uTexel;
    uniform float uDt;
    uniform float uDissipation;
    void main() {
      vec2 coord = vUv - uDt * texture2D(uVelocity, vUv).xy * uTexel;
      gl_FragColor = texture2D(uVelocity, coord) / (1.0 + uDissipation * uDt);
    }
  `,
  curl: /* glsl */ `${header}
    uniform sampler2D uVelocity;
    void main() {
      float l = texture2D(uVelocity, vL).y;
      float r = texture2D(uVelocity, vR).y;
      float t = texture2D(uVelocity, vT).x;
      float b = texture2D(uVelocity, vB).x;
      gl_FragColor = vec4(0.5 * (r - l - t + b), 0.0, 0.0, 1.0);
    }
  `,
  vorticity: /* glsl */ `${header}
    uniform sampler2D uVelocity;
    uniform sampler2D uCurl;
    uniform float uCurlStrength;
    uniform float uDt;
    void main() {
      float l = texture2D(uCurl, vL).x;
      float r = texture2D(uCurl, vR).x;
      float t = texture2D(uCurl, vT).x;
      float b = texture2D(uCurl, vB).x;
      float c = texture2D(uCurl, vUv).x;
      vec2 force = 0.5 * vec2(abs(t) - abs(b), abs(r) - abs(l));
      force /= length(force) + 0.0001;
      force *= uCurlStrength * c;
      force.y *= -1.0;
      vec2 velocity = texture2D(uVelocity, vUv).xy + force * uDt;
      gl_FragColor = vec4(clamp(velocity, -1000.0, 1000.0), 0.0, 1.0);
    }
  `,
  divergence: /* glsl */ `${header}
    uniform sampler2D uVelocity;
    void main() {
      float l = texture2D(uVelocity, vL).x;
      float r = texture2D(uVelocity, vR).x;
      float t = texture2D(uVelocity, vT).y;
      float b = texture2D(uVelocity, vB).y;
      vec2 c = texture2D(uVelocity, vUv).xy;
      if (vL.x < 0.0) l = -c.x;
      if (vR.x > 1.0) r = -c.x;
      if (vT.y > 1.0) t = -c.y;
      if (vB.y < 0.0) b = -c.y;
      gl_FragColor = vec4(0.5 * (r - l + t - b), 0.0, 0.0, 1.0);
    }
  `,
  clear: /* glsl */ `${header}
    uniform sampler2D uPressure;
    uniform float uValue;
    void main() {
      gl_FragColor = uValue * texture2D(uPressure, vUv);
    }
  `,
  pressure: /* glsl */ `${header}
    uniform sampler2D uPressure;
    uniform sampler2D uDivergence;
    void main() {
      float l = texture2D(uPressure, vL).x;
      float r = texture2D(uPressure, vR).x;
      float t = texture2D(uPressure, vT).x;
      float b = texture2D(uPressure, vB).x;
      float divergence = texture2D(uDivergence, vUv).x;
      gl_FragColor = vec4((l + r + b + t - divergence) * 0.25, 0.0, 0.0, 1.0);
    }
  `,
  gradient: /* glsl */ `${header}
    uniform sampler2D uPressure;
    uniform sampler2D uVelocity;
    void main() {
      float l = texture2D(uPressure, vL).x;
      float r = texture2D(uPressure, vR).x;
      float t = texture2D(uPressure, vT).x;
      float b = texture2D(uPressure, vB).x;
      vec2 velocity = texture2D(uVelocity, vUv).xy - vec2(r - l, t - b);
      gl_FragColor = vec4(velocity, 0.0, 1.0);
    }
  `,
};

const createTarget = (width, height, filter) =>
  new WebGLRenderTarget(width, height, {
    type: HalfFloatType,
    format: RGBAFormat,
    minFilter: filter,
    magFilter: filter,
    depthBuffer: false,
  });

class DoubleTarget {
  constructor(width, height, filter) {
    this.read = createTarget(width, height, filter);
    this.write = createTarget(width, height, filter);
  }

  swap() {
    [this.read, this.write] = [this.write, this.read];
  }

  setSize(width, height) {
    this.read.setSize(width, height);
    this.write.setSize(width, height);
  }

  dispose() {
    this.read.dispose();
    this.write.dispose();
  }
}

export class FluidSimulation {
  constructor(
    renderer,
    {
      resolution = 128,
      dissipation = 1.4,
      curl = 18,
      pressureIterations = 16,
      radius = 0.0016,
    } = {},
  ) {
    this.renderer = renderer;
    this.resolution = resolution;
    this.dissipation = dissipation;
    this.curlStrength = curl;
    this.pressureIterations = pressureIterations;
    this.radius = radius;
    this.aspect = 1;
    this.texel = new Vector2();

    this.scene = new Scene();
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new Mesh(new PlaneGeometry(2, 2));
    this.scene.add(this.quad);

    this.materials = Object.fromEntries(
      Object.entries(shaders).map(([name, fragmentShader]) => [
        name,
        new RawShaderMaterial({
          vertexShader,
          fragmentShader,
          uniforms: {
            uTexel: { value: this.texel },
            uTarget: { value: null },
            uVelocity: { value: null },
            uCurl: { value: null },
            uPressure: { value: null },
            uDivergence: { value: null },
            uColor: { value: new Vector3() },
            uPoint: { value: new Vector2() },
            uAspect: { value: 1 },
            uRadius: { value: radius },
            uDt: { value: 0 },
            uDissipation: { value: dissipation },
            uCurlStrength: { value: curl },
            uValue: { value: 0.8 },
          },
          depthTest: false,
          depthWrite: false,
        }),
      ]),
    );

    this.velocity = new DoubleTarget(1, 1, LinearFilter);
    this.pressure = new DoubleTarget(1, 1, NearestFilter);
    this.divergence = createTarget(1, 1, NearestFilter);
    this.curl = createTarget(1, 1, NearestFilter);
    this.splats = [];
  }

  /** Velocity field in simulation texels per second, linearly filtered. */
  get texture() {
    return this.velocity.read.texture;
  }

  setSize(width, height) {
    this.aspect = width / height;
    const short = this.resolution;
    const simWidth = Math.round(this.aspect >= 1 ? short * this.aspect : short);
    const simHeight = Math.round(this.aspect >= 1 ? short : short / this.aspect);
    this.texel.set(1 / simWidth, 1 / simHeight);
    this.velocity.setSize(simWidth, simHeight);
    this.pressure.setSize(simWidth, simHeight);
    this.divergence.setSize(simWidth, simHeight);
    this.curl.setSize(simWidth, simHeight);
  }

  /** Queue a force at uv `x, y` (0–1, origin bottom-left) with uv-per-frame delta. */
  splat(x, y, dx, dy, force = 5200) {
    this.splats.push([x, y, dx * force, dy * force]);
  }

  pass(name, target, uniforms = {}) {
    const material = this.materials[name];
    Object.entries(uniforms).forEach(([key, value]) => {
      material.uniforms[key].value = value;
    });
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.camera);
  }

  step(delta) {
    const dt = Math.min(delta, 1 / 30);
    const previous = this.renderer.getRenderTarget();
    const autoClear = this.renderer.autoClear;
    this.renderer.autoClear = false;

    this.splats.splice(0).forEach(([x, y, dx, dy]) => {
      this.materials.splat.uniforms.uPoint.value.set(x, y);
      this.materials.splat.uniforms.uColor.value.set(dx, dy, 0);
      this.pass('splat', this.velocity.write, {
        uTarget: this.velocity.read.texture,
        uAspect: this.aspect,
        uRadius: this.radius,
      });
      this.velocity.swap();
    });

    this.pass('curl', this.curl, { uVelocity: this.velocity.read.texture });
    this.pass('vorticity', this.velocity.write, {
      uVelocity: this.velocity.read.texture,
      uCurl: this.curl.texture,
      uCurlStrength: this.curlStrength,
      uDt: dt,
    });
    this.velocity.swap();

    this.pass('divergence', this.divergence, { uVelocity: this.velocity.read.texture });
    this.pass('clear', this.pressure.write, { uPressure: this.pressure.read.texture });
    this.pressure.swap();
    for (let i = 0; i < this.pressureIterations; i += 1) {
      this.pass('pressure', this.pressure.write, {
        uPressure: this.pressure.read.texture,
        uDivergence: this.divergence.texture,
      });
      this.pressure.swap();
    }
    this.pass('gradient', this.velocity.write, {
      uPressure: this.pressure.read.texture,
      uVelocity: this.velocity.read.texture,
    });
    this.velocity.swap();

    this.pass('advection', this.velocity.write, {
      uVelocity: this.velocity.read.texture,
      uDt: dt,
      uDissipation: this.dissipation,
    });
    this.velocity.swap();

    this.renderer.setRenderTarget(previous);
    this.renderer.autoClear = autoClear;
  }

  dispose() {
    Object.values(this.materials).forEach((material) => material.dispose());
    this.quad.geometry.dispose();
    this.velocity.dispose();
    this.pressure.dispose();
    this.divergence.dispose();
    this.curl.dispose();
  }
}
