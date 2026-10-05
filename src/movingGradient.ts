// WebGL2 port of the Figma "Moving gradient" shader (displaced, morphing sphere viewed up close).
// Material 0 / gradient method "Height" only; the rest of the Figma effect is not needed here.

export interface GradientStop {
  position: number
  color: [number, number, number]
}

// Defaults match the Figma effect's slider values.
const PARAMS = {
  detail: 1.78,
  intensity: 4.29,
  twist: 0.04,
  warp: 0.26,
  zoomPercent: 72,
  rotationSpeedPercent: 12,
  morphSpeed: 3.74,
}

function hex(value: string): [number, number, number] {
  const n = parseInt(value, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

const PALETTE = ['FFA63A', 'FFF04D', 'B07BFF', '4DE88A', '3AD0FF', 'FF5FA2']

export type GradientView = "trippy" | "calm"

const TRIPPY_STOPS: GradientStop[] = PALETTE.map((color, index) => ({
  position: index / (PALETTE.length - 1),
  color: hex(color),
}))

// Same swirl, in subtle dark greys: a narrow lightness range keeps the pattern visible but quiet.
const CALM_LIGHTNESS = [0.085, 0.115, 0.095, 0.13, 0.09, 0.11]
const CALM_STOPS: GradientStop[] = CALM_LIGHTNESS.map((value, index) => ({
  position: index / (CALM_LIGHTNESS.length - 1),
  color: [value, value, value],
}))

const STOPS_BY_VIEW: Record<GradientView, GradientStop[]> = { trippy: TRIPPY_STOPS, calm: CALM_STOPS }

const START_OFFSET_SECONDS = 20
const RENDER_SCALE = 0.5
const MESH_RESOLUTION = 80

const HEADER = `#version 300 es
precision highp float;
precision highp int;
uniform float u_time;
uniform float u_aspect;
uniform float u_zoom;
uniform float u_morph;
uniform float u_rotSpeed;
uniform float u_warp;
uniform float u_intensity;
uniform float u_twist;
uniform float u_detail;
`

const NOISE = `
vec3 hash33(vec3 p) {
  vec3 q = vec3(
    dot(p, vec3(127.1, 311.7, 74.7)),
    dot(p, vec3(269.5, 183.3, 246.1)),
    dot(p, vec3(113.5, 271.9, 124.6))
  );
  return fract(sin(q) * 43758.5453) * 2.0 - 1.0;
}

vec3 smootherCurve(vec3 t) {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

float gradDot(vec3 cell, vec3 offset, vec3 local) {
  return dot(hash33(cell + offset), local - offset);
}

float perlin3(vec3 p) {
  vec3 cell = floor(p);
  vec3 local = fract(p);
  vec3 w = smootherCurve(local);

  float n000 = gradDot(cell, vec3(0.0, 0.0, 0.0), local);
  float n100 = gradDot(cell, vec3(1.0, 0.0, 0.0), local);
  float n010 = gradDot(cell, vec3(0.0, 1.0, 0.0), local);
  float n110 = gradDot(cell, vec3(1.0, 1.0, 0.0), local);
  float n001 = gradDot(cell, vec3(0.0, 0.0, 1.0), local);
  float n101 = gradDot(cell, vec3(1.0, 0.0, 1.0), local);
  float n011 = gradDot(cell, vec3(0.0, 1.0, 1.0), local);
  float n111 = gradDot(cell, vec3(1.0, 1.0, 1.0), local);

  float nx00 = mix(n000, n100, w.x);
  float nx10 = mix(n010, n110, w.x);
  float nx01 = mix(n001, n101, w.x);
  float nx11 = mix(n011, n111, w.x);
  float nxy0 = mix(nx00, nx10, w.y);
  float nxy1 = mix(nx01, nx11, w.y);

  return mix(nxy0, nxy1, w.z) * 1.1547;
}

vec3 rotateOctave(vec3 p) {
  return vec3(
     0.00 * p.x + 0.80 * p.y + 0.60 * p.z,
    -0.80 * p.x + 0.36 * p.y - 0.48 * p.z,
    -0.60 * p.x - 0.48 * p.y + 0.64 * p.z
  );
}

float fbm(vec3 p) {
  vec3 q = p;
  float total = 0.0;
  float amplitude = 1.0;
  float weight = 0.0;
  for (int i = 0; i < 3; i++) {
    total += perlin3(q) * amplitude;
    weight += amplitude;
    q = rotateOctave(q) * 2.02 + vec3(3.7, 1.9, 6.3);
    amplitude *= 0.48;
  }
  return total / max(weight, 0.0001);
}

vec3 warpVector(vec3 p) {
  return vec3(
    perlin3(p),
    perlin3(p + vec3(5.2, 1.3, 2.8)),
    perlin3(p + vec3(1.7, 9.2, 4.4))
  );
}

float wrapPhase(float phase) {
  float tau = 6.28318530718;
  return phase - floor(phase / tau) * tau;
}

vec3 curvedDomainMotion(float morphTime, vec3 rates, vec3 phases) {
  return vec3(
    sin(wrapPhase(morphTime * rates.x + phases.x)),
    sin(wrapPhase(morphTime * rates.y + phases.y)),
    cos(wrapPhase(morphTime * rates.z + phases.z))
  );
}

vec3 primaryDomainMotion(float morphTime) {
  vec3 primaryDirection = normalize(vec3(0.73, -0.41, 0.55));
  vec3 secondaryDirection = normalize(vec3(-0.28, 0.91, 0.31));
  vec3 curve = curvedDomainMotion(morphTime, vec3(0.071, 0.043, 0.029), vec3(0.0, 1.73, 4.11)) * 0.16;
  return primaryDirection * morphTime * 0.105 + secondaryDirection * morphTime * 0.023 + curve;
}

vec3 warpDomainMotion(float morphTime) {
  vec3 primaryDirection = normalize(vec3(-0.46, 0.38, 0.80));
  vec3 secondaryDirection = normalize(vec3(0.84, 0.51, -0.18));
  vec3 curve = curvedDomainMotion(morphTime, vec3(0.089, 0.053, 0.034), vec3(2.21, 5.07, 0.83)) * 0.12;
  return primaryDirection * morphTime * 0.137 + secondaryDirection * morphTime * 0.031 + curve;
}

float heightField(vec3 direction, float detail) {
  float detailLevel = clamp(detail / 5.0, 0.0, 1.0);
  float frequency = mix(1.05, 3.4, detailLevel);
  float morphTime = u_time * max(u_morph, 0.0);
  vec3 p = direction * frequency + vec3(1.7, 3.1, 5.3) + primaryDomainMotion(morphTime);
  vec3 warp = warpVector(p * 0.55 + warpDomainMotion(morphTime) * 0.42 + vec3(0.7, -1.1, 0.4)) * u_warp;
  return fbm(p + warp);
}
`

const VERTEX_SRC = `${HEADER}
${NOISE}
in vec3 a_position;
out vec3 v_dir;

float displacementAmount(float detail) {
  float amount = clamp(detail, 0.0, 1.0);
  float eased = amount * amount * (3.0 - 2.0 * amount);
  return eased * 0.30 * clamp(u_intensity, 0.0, 5.0);
}

vec3 surfacePoint(vec3 direction, float detail) {
  float height = heightField(direction, detail);
  float radius = max(1.0 + height * displacementAmount(detail), 0.72);
  return direction * radius;
}

vec3 rotateAroundAxis(vec3 p, vec3 axis, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return p * c + cross(axis, p) * s + axis * dot(axis, p) * (1.0 - c);
}

vec3 twistedSurfacePoint(vec3 direction, float detail) {
  vec3 axis = normalize(vec3(-0.68, 0.54, 0.49));
  vec3 point = surfacePoint(direction, detail);
  float axial = clamp(dot(direction, axis), -1.0, 1.0);
  float smoothAxial = axial * (1.5 - 0.5 * axial * axial);
  float angle = smoothAxial * clamp(u_twist, 0.0, 7.0);
  return rotateAroundAxis(point, axis, angle);
}

vec3 rotateX(vec3 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
}

vec3 animatedOrientation(vec3 p, float rotationTime) {
  vec3 axisA = normalize(vec3(0.36, 0.81, 0.46));
  vec3 axisB = normalize(vec3(-0.71, 0.29, 0.64));
  vec3 axisC = normalize(vec3(0.58, -0.69, 0.43));
  vec3 oriented = rotateAroundAxis(p, axisA, wrapPhase(rotationTime * 0.287));
  oriented = rotateAroundAxis(oriented, axisB, wrapPhase(rotationTime * 0.2236068));
  oriented = rotateAroundAxis(oriented, axisC, wrapPhase(rotationTime * 0.1732051));
  return rotateX(oriented, -0.24);
}

float coverSphereScale(float aspect) {
  float safeRadius = 0.72;
  float cameraDistance = 3.0;
  float targetFocalLength = 1.73 * 4.0;
  float diagonal = sqrt(1.0 + aspect * aspect);
  float requiredRadius = cameraDistance * diagonal /
    sqrt(targetFocalLength * targetFocalLength + diagonal * diagonal);
  return max(0.82, requiredRadius / safeRadius);
}

void main() {
  float detail = clamp(u_detail, 0.0, 5.0);
  float rotationTime = u_time * max(u_rotSpeed, 0.0);
  float aspect = max(u_aspect, 0.001);

  vec3 base = normalize(a_position);
  vec3 rotated = animatedOrientation(twistedSurfacePoint(base, detail), rotationTime);
  vec3 world = rotated * coverSphereScale(aspect);
  vec3 view = world + vec3(0.0, 0.0, -3.0);

  float focal = 1.73 * u_zoom;
  float nearPlane = 0.1;
  float farPlane = 10.0;
  float depthA = farPlane / (nearPlane - farPlane);
  float depthB = nearPlane * farPlane / (nearPlane - farPlane);
  float w = -view.z;
  // The Figma shader targets WebGPU's [0, w] clip depth; WebGL needs [-w, w].
  float z = 2.0 * (depthA * view.z + depthB) - w;

  gl_Position = vec4(view.x * focal / aspect, view.y * focal, z, w);
  v_dir = base;
}
`

const FRAGMENT_SRC = `${HEADER}
${NOISE}
uniform vec3 u_colors[8];
uniform float u_stops[8];
uniform int u_count;
in vec3 v_dir;
out vec4 outColor;

vec3 srgbToLinear(vec3 c) {
  vec3 v = max(c, vec3(0.0));
  return mix(v / 12.92, pow((v + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), v));
}

vec3 linearToSrgb(vec3 c) {
  vec3 v = max(c, vec3(0.0));
  return mix(v * 12.92, 1.055 * pow(v, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), v));
}

vec3 linearToOklab(vec3 c) {
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
  float lc = pow(max(l, 0.0), 1.0 / 3.0);
  float mc = pow(max(m, 0.0), 1.0 / 3.0);
  float sc = pow(max(s, 0.0), 1.0 / 3.0);
  return vec3(
    0.2104542553 * lc + 0.7936177850 * mc - 0.0040720468 * sc,
    1.9779984951 * lc - 2.4285922050 * mc + 0.4505937099 * sc,
    0.0259040371 * lc + 0.7827717662 * mc - 0.8086757660 * sc
  );
}

vec3 oklabToLinear(vec3 c) {
  float lc = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float mc = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float sc = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  float l = lc * lc * lc;
  float m = mc * mc * mc;
  float s = sc * sc * sc;
  return vec3(
     4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

vec3 gradientAt(float t) {
  int count = clamp(u_count, 1, 8);
  if (count == 1) {
    return u_colors[0];
  }
  int low = 0;
  for (int i = 0; i < 7; i++) {
    if (i >= count - 1) {
      break;
    }
    if (t >= u_stops[i]) {
      low = i;
    }
  }
  int high = low + 1;
  float start = u_stops[low];
  float stop = u_stops[high];
  float amount = clamp((t - start) / max(stop - start, 0.0001), 0.0, 1.0);
  amount = amount * amount * (3.0 - 2.0 * amount);
  vec3 labA = linearToOklab(srgbToLinear(u_colors[low]));
  vec3 labB = linearToOklab(srgbToLinear(u_colors[high]));
  return linearToSrgb(oklabToLinear(mix(labA, labB, amount)));
}

void main() {
  float field = heightField(normalize(v_dir), clamp(u_detail, 0.0, 5.0));
  float t = clamp((field * 0.5 + 0.5 - 0.5) * 3.0 + 0.5, 0.0, 1.0);
  outColor = vec4(gradientAt(t), 1.0);
}
`

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Could not create shader')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Shader compile failed: ${log}`)
  }
  return shader
}

function buildSphere(resolution: number) {
  const faces = [
    { right: [0, 0, -1], up: [0, 1, 0] },
    { right: [0, 0, 1], up: [0, 1, 0] },
    { right: [1, 0, 0], up: [0, 0, -1] },
    { right: [1, 0, 0], up: [0, 0, 1] },
    { right: [1, 0, 0], up: [0, 1, 0] },
    { right: [-1, 0, 0], up: [0, 1, 0] },
  ]
  const verticesPerFace = (resolution + 1) * (resolution + 1)
  const vertices = new Float32Array(faces.length * verticesPerFace * 3)
  const indices = new Uint32Array(faces.length * resolution * resolution * 6)
  let vertexOffset = 0
  let indexOffset = 0

  for (const { right, up } of faces) {
    const forward = [
      right[1] * up[2] - right[2] * up[1],
      right[2] * up[0] - right[0] * up[2],
      right[0] * up[1] - right[1] * up[0],
    ]
    const baseIndex = vertexOffset / 3

    for (let row = 0; row <= resolution; row += 1) {
      const v = (row / resolution) * 2 - 1
      for (let column = 0; column <= resolution; column += 1) {
        const u = (column / resolution) * 2 - 1
        const x = forward[0] + right[0] * u + up[0] * v
        const y = forward[1] + right[1] * u + up[1] * v
        const z = forward[2] + right[2] * u + up[2] * v
        const x2 = x * x
        const y2 = y * y
        const z2 = z * z
        vertices[vertexOffset] = x * Math.sqrt(1 - y2 / 2 - z2 / 2 + (y2 * z2) / 3)
        vertices[vertexOffset + 1] = y * Math.sqrt(1 - z2 / 2 - x2 / 2 + (z2 * x2) / 3)
        vertices[vertexOffset + 2] = z * Math.sqrt(1 - x2 / 2 - y2 / 2 + (x2 * y2) / 3)
        vertexOffset += 3
      }
    }

    const rowSize = resolution + 1
    for (let row = 0; row < resolution; row += 1) {
      for (let column = 0; column < resolution; column += 1) {
        const a = baseIndex + row * rowSize + column
        const b = a + 1
        const c = a + rowSize + 1
        const d = a + rowSize
        indices.set([a, b, c, a, c, d], indexOffset)
        indexOffset += 6
      }
    }
  }

  return { vertices, indices }
}

// Smallest zoom at which the sphere still covers the viewport, mirrored from the Figma effect.
function zoomFor(aspect: number): number {
  const maximumZoom = 10
  const diagonal = Math.sqrt(1 + aspect * aspect)
  const safeRadius = 0.72
  const cameraDistance = 3
  const baseFocalLength = 1.73
  const targetFocalLength = baseFocalLength * 4
  const requiredRadius =
    (cameraDistance * diagonal) /
    Math.sqrt(targetFocalLength * targetFocalLength + diagonal * diagonal)
  const sphereScale = Math.max(0.82, requiredRadius / safeRadius)
  const conservativeRadius = Math.min(cameraDistance - 0.001, sphereScale * safeRadius)
  const perspectiveDepth = Math.sqrt(
    Math.max(0.0001, cameraDistance * cameraDistance - conservativeRadius * conservativeRadius),
  )
  const coverZoom = Math.min(
    maximumZoom,
    Math.max(0.5, ((diagonal * perspectiveDepth) / (baseFocalLength * conservativeRadius)) * 1.12),
  )
  const minimumZoom = Math.min(maximumZoom, Math.max(0.5, coverZoom * 0.65))
  const progress = Math.min(100, Math.max(0, PARAMS.zoomPercent)) / 100
  return Math.min(maximumZoom, Math.max(minimumZoom, minimumZoom * Math.pow(maximumZoom / minimumZoom, progress)))
}

export interface GradientController {
  setPaused(paused: boolean): void
  setView(view: GradientView): void
  destroy(): void
}

const INERT_CONTROLLER: GradientController = { setPaused() {}, setView() {}, destroy() {} }

// The animation advances only while running, so pausing and resuming never makes it jump.
const MAX_FRAME_SECONDS = 0.1

export function startMovingGradient(
  canvas: HTMLCanvasElement,
  options: { paused: boolean; view: GradientView },
): GradientController {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: true,
    powerPreference: "low-power",
  })
  if (!gl) return INERT_CONTROLLER

  let program: WebGLProgram
  try {
    program = gl.createProgram()
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SRC))
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program link failed: ${gl.getProgramInfoLog(program)}`)
    }
  } catch (error) {
    console.error("Moving gradient disabled:", error)
    return INERT_CONTROLLER
  }
  gl.useProgram(program)

  const { vertices, indices } = buildSphere(MESH_RESOLUTION)
  const vao = gl.createVertexArray()
  gl.bindVertexArray(vao)
  const vertexBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)
  const positionLocation = gl.getAttribLocation(program, "a_position")
  gl.enableVertexAttribArray(positionLocation)
  gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0)
  const indexBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW)

  const uniform = (name: string) => gl.getUniformLocation(program, name)
  const time = uniform("u_time")
  const aspectLocation = uniform("u_aspect")
  const zoomLocation = uniform("u_zoom")

  const rotationSpeed = Math.min(0.25, Math.max(0, (PARAMS.rotationSpeedPercent / 100) * 0.25))
  gl.uniform1f(uniform("u_morph"), PARAMS.morphSpeed)
  gl.uniform1f(uniform("u_rotSpeed"), rotationSpeed)
  gl.uniform1f(uniform("u_warp"), PARAMS.warp)
  gl.uniform1f(uniform("u_intensity"), PARAMS.intensity)
  gl.uniform1f(uniform("u_twist"), PARAMS.twist)
  gl.uniform1f(uniform("u_detail"), PARAMS.detail)

  const colorsLocation = uniform("u_colors[0]")
  const stopsLocation = uniform("u_stops[0]")
  const countLocation = uniform("u_count")
  const colors = new Float32Array(24)
  const positions = new Float32Array(8)

  const applyStops = (stops: GradientStop[]) => {
    colors.fill(0)
    positions.fill(0)
    const count = Math.min(8, stops.length)
    for (let i = 0; i < count; i += 1) {
      colors.set(stops[i].color, i * 3)
      positions[i] = stops[i].position
    }
    gl.uniform3fv(colorsLocation, colors)
    gl.uniform1fv(stopsLocation, positions)
    gl.uniform1i(countLocation, count)
    gl.clearColor(stops[0].color[0], stops[0].color[1], stops[0].color[2], 1)
  }
  applyStops(STOPS_BY_VIEW[options.view])

  gl.enable(gl.DEPTH_TEST)
  gl.depthFunc(gl.LESS)

  let paused = options.paused
  let elapsed = 0
  let lastTick: number | null = null
  let frame = 0
  let destroyed = false

  const draw = () => {
    gl.uniform1f(time, elapsed + START_OFFSET_SECONDS)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_INT, 0)
  }

  const loop = (now: number) => {
    if (destroyed || paused) return
    if (lastTick !== null) elapsed += Math.min((now - lastTick) / 1000, MAX_FRAME_SECONDS)
    lastTick = now
    draw()
    frame = requestAnimationFrame(loop)
  }

  const resize = () => {
    const width = Math.max(1, Math.floor(canvas.clientWidth * RENDER_SCALE))
    const height = Math.max(1, Math.floor(canvas.clientHeight * RENDER_SCALE))
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
    gl.viewport(0, 0, width, height)
    const aspect = width / height
    gl.uniform1f(aspectLocation, aspect)
    gl.uniform1f(zoomLocation, zoomFor(aspect))
    // Resizing clears the canvas; while paused nothing else would redraw it.
    if (paused) draw()
  }

  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  resize()
  if (paused) draw()
  else frame = requestAnimationFrame(loop)

  return {
    setView(view) {
      if (destroyed) return
      applyStops(STOPS_BY_VIEW[view])
      // While running the next frame picks it up; while paused nothing else would redraw.
      if (paused) draw()
    },
    setPaused(next) {
      if (destroyed || next === paused) return
      paused = next
      cancelAnimationFrame(frame)
      lastTick = null
      if (!paused) frame = requestAnimationFrame(loop)
    },
    destroy() {
      destroyed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      gl.deleteBuffer(vertexBuffer)
      gl.deleteBuffer(indexBuffer)
      gl.deleteVertexArray(vao)
      gl.deleteProgram(program)
    },
  }
}
