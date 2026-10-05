import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import meshVert from './shaders/mesh.vert?raw'
import meshFrag from './shaders/mesh.frag?raw'

/** Past this many vertices a model is decimated: the frame budget is the limit, not the file. */
export const MESH_MAX_VERTS = 200_000

export interface MeshModel {
  /** indexed, unit bounding sphere centred on the origin; position + normal */
  geometry: THREE.BufferGeometry
  /** a PLY scan with no faces: only the points look has anything to draw */
  pointsOnly: boolean
}

/**
 * Vertex clustering: snap every vertex to a `res`^3 grid, average the ones that
 * share a cell and drop the triangles that collapse. Also welds a triangle soup
 * (high res), which is what gives the metal look smooth normals.
 */
function cluster(pos: Float32Array, res: number): { positions: Float32Array; index: Uint32Array } {
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  for (let i = 0; i < pos.length; i += 3) {
    minX = Math.min(minX, pos[i]); maxX = Math.max(maxX, pos[i])
    minY = Math.min(minY, pos[i + 1]); maxY = Math.max(maxY, pos[i + 1])
    minZ = Math.min(minZ, pos[i + 2]); maxZ = Math.max(maxZ, pos[i + 2])
  }
  const ext = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1e-9)
  const k = (res - 1) / ext
  const cells = new Map<number, number>()
  const sums: number[] = []
  const map = new Uint32Array(pos.length / 3)
  for (let v = 0; v < map.length; v++) {
    const x = Math.round((pos[v * 3] - minX) * k), y = Math.round((pos[v * 3 + 1] - minY) * k), z = Math.round((pos[v * 3 + 2] - minZ) * k)
    const key = (x * res + y) * res + z   // res <= 2048 -> < 2^33, exact in a double
    let id = cells.get(key)
    if (id === undefined) { id = cells.size; cells.set(key, id); sums.push(0, 0, 0, 0) }
    sums[id * 4] += pos[v * 3]; sums[id * 4 + 1] += pos[v * 3 + 1]; sums[id * 4 + 2] += pos[v * 3 + 2]; sums[id * 4 + 3]++
    map[v] = id
  }
  const positions = new Float32Array(cells.size * 3)
  for (let c = 0; c < cells.size; c++) for (let j = 0; j < 3; j++) positions[c * 3 + j] = sums[c * 4 + j] / sums[c * 4 + 3]
  const tris: number[] = []
  for (let t = 0; t + 2 < map.length; t += 3) {
    const a = map[t], b = map[t + 1], c = map[t + 2]
    if (a !== b && b !== c && a !== c) tris.push(a, b, c)
  }
  return { positions, index: new Uint32Array(tris) }
}

/** Triangle soup (3 positions per triangle, world space) → centred, unit-radius, indexed, ≤ MESH_MAX_VERTS */
function finalize(soup: Float32Array, pointsOnly: boolean): MeshModel {
  let positions: Float32Array, index: Uint32Array | null = null
  if (pointsOnly) {
    positions = soup
    if (positions.length / 3 > MESH_MAX_VERTS) {
      // ponytail: a cloud is thinned by stride, a spatial thinning would keep the silhouette better
      const stride = Math.ceil(positions.length / 3 / MESH_MAX_VERTS)
      const out = new Float32Array(Math.floor(positions.length / 3 / stride) * 3)
      for (let i = 0; i < out.length / 3; i++) out.set(positions.subarray(i * stride * 3, i * stride * 3 + 3), i * 3)
      positions = out
    }
  } else {
    let res = 2048
    let r = cluster(soup, res)
    // each step of 0.8 in res is ~0.64x the vertices of a surface
    while (r.positions.length / 3 > MESH_MAX_VERTS && res > 16) { res = Math.floor(res * 0.8); r = cluster(soup, res) }
    positions = r.positions
    index = r.index
  }
  if (positions.length < 9) throw new Error('modello vuoto')
  // centre on the bounding box, scale so the bounding sphere has radius 1
  const box = new THREE.Box3()
  const v = new THREE.Vector3()
  for (let i = 0; i < positions.length; i += 3) box.expandByPoint(v.set(positions[i], positions[i + 1], positions[i + 2]))
  const c = box.getCenter(new THREE.Vector3())
  let r2 = 0
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] -= c.x; positions[i + 1] -= c.y; positions[i + 2] -= c.z
    r2 = Math.max(r2, positions[i] ** 2 + positions[i + 1] ** 2 + positions[i + 2] ** 2)
  }
  const s = 1 / (Math.sqrt(r2) || 1)
  for (let i = 0; i < positions.length; i++) positions[i] *= s
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  if (index) {
    geometry.setIndex(new THREE.BufferAttribute(index, 1))
    geometry.computeVertexNormals()
  }
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.5)
  return { geometry, pointsOnly }
}

/** Append the world-space triangles of every mesh under `root` to `out` */
function collectSoup(root: THREE.Object3D): Float32Array {
  root.updateMatrixWorld(true)
  const parts: Float32Array[] = []
  const v = new THREE.Vector3()
  root.traverse(o => {
    const m = o as THREE.Mesh
    const g = m.geometry as THREE.BufferGeometry | undefined
    if (!g?.getAttribute('position') || !(m as any).isMesh) return
    const p = g.getAttribute('position')
    const idx = g.getIndex()
    const n = idx ? idx.count : p.count
    const out = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(p, idx ? idx.getX(i) : i).applyMatrix4(m.matrixWorld)
      out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z
    }
    parts.push(out.subarray(0, Math.floor(n / 3) * 9))
  })
  const all = new Float32Array(parts.reduce((a, p) => a + p.length, 0))
  let o = 0
  for (const p of parts) { all.set(p, o); o += p.length }
  return all
}

/** Parse a model file (GLB/GLTF with embedded buffers, OBJ, STL, PLY, FBX) */
export async function parseModel(buf: ArrayBuffer, name: string): Promise<MeshModel> {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'glb' || ext === 'gltf') {
    const gltf = await new Promise<{ scene: THREE.Object3D }>((res, rej) =>
      new GLTFLoader().parse(ext === 'gltf' ? new TextDecoder().decode(buf) : buf, '', res, rej))
    return finalize(collectSoup(gltf.scene), false)
  }
  if (ext === 'obj') return finalize(collectSoup(new OBJLoader().parse(new TextDecoder().decode(buf))), false)
  if (ext === 'fbx') return finalize(collectSoup(new FBXLoader().parse(buf, '')), false)
  if (ext === 'stl' || ext === 'ply') {
    const g = ext === 'stl' ? new STLLoader().parse(buf) : new PLYLoader().parse(buf)
    const mesh = new THREE.Mesh(g)
    const faceless = ext === 'ply' && !g.getIndex()
    return finalize(faceless ? Float32Array.from(g.getAttribute('position').array) : collectSoup(mesh), faceless)
  }
  throw new Error(`formato non supportato: ${ext}`)
}

/** What the effect shows until a model is loaded — never an empty frame */
function defaultModel(): MeshModel {
  const g = new THREE.TorusKnotGeometry(0.62, 0.22, 220, 28, 2, 3)
  return finalize(collectSoup(new THREE.Mesh(g)), false)
}

let current: MeshModel | null = null
const groups = new Set<THREE.Group>()

function fill(group: THREE.Group, model: MeshModel) {
  const [wire, points, solid] = group.children as [THREE.LineSegments, THREE.Points, THREE.Mesh]
  const old = [wire.geometry, points.geometry, solid.geometry]
  points.geometry = model.geometry
  solid.geometry = model.geometry
  // triangle edges, not the quads of a flat-shaded export: WireframeGeometry reads an index or a soup alike
  wire.geometry = model.geometry.getIndex() ? new THREE.WireframeGeometry(model.geometry) : new THREE.BufferGeometry()
  for (const g of old) if (g !== model.geometry) g.dispose()
  group.userData.uniforms.uPointsOnly.value = model.pointsOnly ? 1 : 0
}

/** Swap the model in every live mesh effect; null restores the default */
export function setMeshModel(model: MeshModel | null) {
  current = model ?? defaultModel()
  for (const g of groups) fill(g, current)
}

/** The 'mesh' effect: one material per look, sharing the effect uniforms */
export function buildMesh(uniforms: Record<string, THREE.IUniform>) {
  current ??= defaultModel()
  uniforms.uPointsOnly = { value: current.pointsOnly ? 1 : 0 }
  const mk = (look: number) => new THREE.ShaderMaterial({
    vertexShader: meshVert, fragmentShader: meshFrag, uniforms, defines: { LOOK: look },
    // neon and dust glow additively; the metal is opaque and needs the depth buffer
    blending: look === 2 ? THREE.NoBlending : THREE.AdditiveBlending,
    depthTest: look === 2, depthWrite: look === 2, transparent: look !== 2,
  })
  const empty = new THREE.BufferGeometry()
  const wire = new THREE.LineSegments(empty, mk(0))
  const points = new THREE.Points(empty, mk(1))
  const solid = new THREE.Mesh(empty, mk(2))
  const group = new THREE.Group()
  for (const o of [wire, points, solid]) { o.frustumCulled = false; group.add(o) }
  group.userData.uniforms = uniforms
  group.userData.depth = true   // the solid look needs a depth buffer in the target (see Engine.renderEffect)
  fill(group, current)
  groups.add(group)
  const material = solid.material as THREE.ShaderMaterial
  return { material, object: group }
}

/** Called by the Engine when a mesh effect instance is disposed */
export function releaseMesh(object: THREE.Object3D) {
  groups.delete(object as THREE.Group)
  for (const o of object.children) ((o as THREE.Mesh).material as THREE.Material).dispose()
}
