"""Sovereign World Kit — shared builder, material slots, CPU preview and export (Blender 3.2+, headless).
Everything is procedural and seeded; meshes are ours outright (CC0).
Slots are named so an engine can map them to its own concrete/metal/rust and emissive materials.
Previews render on the **CPU** (Cycles) so they never compete with a running Unreal editor for the GPU."""
import math, os
import bpy, bmesh
from mathutils import Vector

SLOTS = ['Concrete', 'ConcreteDark', 'Metal', 'MetalLight', 'Rust', 'Plastic', 'Glass',
         'WinWarm', 'WinCool', 'WinDark', 'NeonPink', 'NeonGreen', 'NeonCyan', 'NeonAmber', 'SolPurple',
         'ClothA', 'ClothB', 'ClothC', 'Rubber', 'Brick', 'Tiles', 'PlasterA', 'PlasterB', 'Panel', 'ShopGlow',
         'SignBand', 'SignBlade']
SIGN_SLOTS = ('SignBand', 'SignBlade')  # 0..1 UVs per face (one whole sign); the engine picks an atlas cell per instance
COLOR = {'Concrete': (0.075, 0.072, 0.07), 'ConcreteDark': (0.035, 0.034, 0.036), 'Metal': (0.045, 0.047, 0.05),
         'MetalLight': (0.25, 0.26, 0.27), 'Rust': (0.11, 0.05, 0.025), 'Plastic': (0.5, 0.5, 0.48), 'Glass': (0.02, 0.03, 0.04),
         'WinWarm': (1.0, 0.62, 0.3), 'WinCool': (0.6, 0.78, 1.0), 'WinDark': (0.01, 0.012, 0.016), 'NeonPink': (1.0, 0.05, 0.55),
         'NeonGreen': (0.08, 1.0, 0.55), 'NeonCyan': (0.0, 0.65, 1.0), 'NeonAmber': (1.0, 0.45, 0.05), 'SolPurple': (0.6, 0.27, 1.0),
         'ClothA': (0.5, 0.12, 0.1), 'ClothB': (0.15, 0.25, 0.5), 'ClothC': (0.6, 0.55, 0.4), 'Rubber': (0.015, 0.015, 0.015),
         'Brick': (0.3, 0.12, 0.08), 'Tiles': (0.6, 0.6, 0.6), 'PlasterA': (0.5, 0.4, 0.3), 'PlasterB': (0.3, 0.4, 0.45), 'Panel': (0.3, 0.32, 0.35),
         'ShopGlow': (1.0, 0.85, 0.65), 'SignBand': (1.0, 0.3, 0.7), 'SignBlade': (0.2, 0.9, 1.0)}
GLOW = {'WinWarm': 0.9, 'WinCool': 0.7, 'NeonPink': 7, 'NeonGreen': 7, 'NeonCyan': 7, 'NeonAmber': 7, 'SolPurple': 6, 'ShopGlow': 0.35, 'SignBand': 4, 'SignBlade': 4}


class Builder:
    def __init__(self):
        self.bm = bmesh.new()

    def face(self, vs, slot):
        f = self.bm.faces.new([self.bm.verts.new(Vector(v)) for v in vs])
        f.material_index = SLOTS.index(slot)
        return f

    def box(self, c, size, slot, top=True, bottom=True, yaw=0.0):
        """Box with base centre c (x, y, z_bottom), size (sx, sy, sz), rotated yaw degrees about Z."""
        x, y, z = c
        sx, sy, sz = size[0] / 2, size[1] / 2, size[2]
        ca, sa = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
        pts = []
        for h in (0, sz):
            for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                lx, ly = a * sx, b * sy
                pts.append((x + lx * ca - ly * sa, y + lx * sa + ly * ca, z + h))
        for i in range(4):
            j = (i + 1) % 4
            self.face([pts[i], pts[j], pts[4 + j], pts[4 + i]], slot)
        if top:
            self.face(pts[4:], slot)
        if bottom:
            self.face(list(reversed(pts[:4])), slot)

    def beam(self, a, b, w, slot, h=None):
        a, b = Vector(a), Vector(b)
        d = b - a
        if d.length < 1e-5:
            return
        x = d.normalized()
        up = Vector((0, 0, 1)) if abs(x.z) < 0.95 else Vector((1, 0, 0))
        y = up.cross(x).normalized() * w / 2
        z = x.cross(y).normalized() * (h if h is not None else w) / 2
        c = [a + y + z, a - y + z, a - y - z, a + y - z]
        e = [p + d for p in c]
        for i in range(4):
            j = (i + 1) % 4
            self.face([c[i], c[j], e[j], e[i]], slot)
        self.face(list(reversed(c)), slot)
        self.face(e, slot)

    def cyl(self, c, r, h, slot, n=12, axis='z', cap=True):
        c = Vector(c)
        ring = []
        for i in range(n):
            a = 2 * math.pi * i / n
            if axis == 'z':
                ring.append(c + Vector((r * math.cos(a), r * math.sin(a), 0)))
            elif axis == 'x':
                ring.append(c + Vector((0, r * math.cos(a), r * math.sin(a))))
            else:
                ring.append(c + Vector((r * math.cos(a), 0, r * math.sin(a))))
        off = Vector((0, 0, h)) if axis == 'z' else (Vector((h, 0, 0)) if axis == 'x' else Vector((0, h, 0)))
        top = [p + off for p in ring]
        for i in range(n):
            j = (i + 1) % n
            self.face([ring[i], ring[j], top[j], top[i]], slot)
        if cap:
            self.face(top, slot)
            self.face(list(reversed(ring)), slot)

    def swag(self, a, b, sag, w, slot, segs=6):
        """Sagging cable from a to b."""
        a, b = Vector(a), Vector(b)
        pts = [a.lerp(b, i / segs) - Vector((0, 0, sag * 4 * (i / segs) * (1 - i / segs))) for i in range(segs + 1)]
        for p, q in zip(pts, pts[1:]):
            self.beam(p, q, w, slot)

    def to_object(self, name):
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=0.001)
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        world_uvs(self.bm)
        sign_uvs(self.bm)
        me = bpy.data.meshes.new(name)
        self.bm.to_mesh(me)
        self.bm.free()
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        for s in SLOTS:
            me.materials.append(material(s))
        return ob


def world_uvs(bm, scale=0.5):
    """Box-projected UVs in metres (1 UV unit = 2 m): textures tile seamlessly across modules placed on the grid."""
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            p = l.vert.co
            u, v = ((p.y, p.z), (p.x, p.z), (p.x, p.y))[ax]
            l[uv].uv = (u * scale, v * scale)


def sign_uvs(bm):
    """Sign faces get 0..1 across the face as seen from the front (u to the viewer's right, v up)."""
    uv = bm.loops.layers.uv.verify()
    idx = {SLOTS.index(s) for s in SIGN_SLOTS}
    for f in bm.faces:
        if f.material_index not in idx:
            continue
        n = f.normal
        right = (-n).cross(Vector((0, 0, 1)))
        if right.length < 1e-4:
            right = Vector((1, 0, 0))
        right.normalize()
        up = right.cross(-n).normalized()  # Z for vertical faces
        us = [l.vert.co.dot(right) for l in f.loops]
        vs = [l.vert.co.dot(up) for l in f.loops]
        u0, u1, v0, v1 = min(us), max(us), min(vs), max(vs)
        for l, u, v in zip(f.loops, us, vs):
            l[uv].uv = ((u - u0) / max(u1 - u0, 1e-5), (v - v0) / max(v1 - v0, 1e-5))


CC0 = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'Imports', 'cc0', 'ambientcg')  # repo-relative
PBR = {  # slot -> (ambientCG set, tint, roughness bias)
    'Concrete': ('Concrete034', (1.0, 1.0, 1.0)), 'ConcreteDark': ('Concrete048', (0.55, 0.55, 0.6)),
    'Metal': ('MetalPlates006', (0.6, 0.62, 0.66)), 'MetalLight': ('Metal041B', (1.0, 1.0, 1.0)),
    'Rust': ('Metal063', (1.0, 0.9, 0.85)), 'Plastic': ('PaintedPlaster006', (0.9, 0.9, 0.88)),
    'ClothA': ('Fence007A', (0.6, 0.2, 0.15)),
    'Brick': ('Facade001', (1.0, 1.0, 1.0)), 'Tiles': ('Tiles139', (0.9, 0.9, 0.95)),
    'PlasterA': ('PaintedPlaster006', (1.0, 0.75, 0.6)), 'PlasterB': ('Plaster001', (0.65, 0.8, 0.9)),
    'Panel': ('MetalPlates015A', (0.7, 0.72, 0.78)),
}
TEXTURED = True  # previews only; exported meshes carry slot names + UVs and the engine maps its own materials


def _img(path):
    return bpy.data.images.load(path, check_existing=True) if os.path.exists(path) else None


def pbr_material(slot, setname, tint):
    m = bpy.data.materials.new(slot)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    base = os.path.join(CC0, setname, f'{setname}_2K-JPG_')
    col = _img(base + 'Color.jpg')
    if col:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = col
        mix = nt.nodes.new('ShaderNodeMixRGB'); mix.blend_type = 'MULTIPLY'; mix.inputs[0].default_value = 1.0
        mix.inputs[2].default_value = (*tint, 1)
        nt.links.new(t.outputs['Color'], mix.inputs[1]); nt.links.new(mix.outputs['Color'], bsdf.inputs['Base Color'])
    rough = _img(base + 'Roughness.jpg')
    if rough:
        rough.colorspace_settings.name = 'Non-Color'
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = rough
        nt.links.new(t.outputs['Color'], bsdf.inputs['Roughness'])
    nrm = _img(base + 'NormalGL.jpg')
    if nrm:
        nrm.colorspace_settings.name = 'Non-Color'
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = nrm
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 0.8
        nt.links.new(t.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    if 'Metal' in slot or slot == 'Rust':
        bsdf.inputs['Metallic'].default_value = 0.7
    return m


_mats = {}


def material(slot):
    if slot in _mats:
        return _mats[slot]
    if TEXTURED and slot in PBR:
        _mats[slot] = pbr_material(slot, *PBR[slot])
        return _mats[slot]
    m = bpy.data.materials.new(slot)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    c = (*COLOR[slot], 1)
    bsdf.inputs['Base Color'].default_value = c
    bsdf.inputs['Roughness'].default_value = 0.05 if slot in ('Glass', 'WinDark') else (0.35 if slot in ('Metal', 'MetalLight') else 0.85)
    if slot in ('Glass', 'WinDark'):
        bsdf.inputs['Metallic'].default_value = 0.9
    bsdf.inputs['Metallic'].default_value = 0.8 if slot in ('Metal', 'MetalLight') else 0.0
    if slot in GLOW:
        bsdf.inputs['Emission'].default_value = c
        bsdf.inputs['Emission Strength'].default_value = GLOW[slot]
    _mats[slot] = m
    return m


def clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)


def export(ob, out_dir):
    """FBX in metres; the Unreal side scales the placed actor x100 (the importer reads Blender metres as cm)."""
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    path = os.path.join(out_dir, f'{ob.name}.fbx')
    bpy.ops.export_scene.fbx(filepath=path, use_selection=True, apply_unit_scale=True, mesh_smooth_type='FACE', bake_space_transform=True, path_mode='STRIP')
    return path


def preview_setup(res=(854, 480), samples=24, night=True):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'  # never the GPU: an open Unreal editor gets killed by the Metal watchdog
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception:
        pass
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.view_settings.view_transform = 'Filmic'
    sc.view_settings.look = 'High Contrast'
    w = bpy.data.worlds.new('sky')
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.02, 0.03, 0.07, 1) if night else (0.6, 0.65, 0.75, 1)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
    sc.world = w
    key = bpy.data.objects.new('key', bpy.data.lights.new('key', 'SUN'))
    key.data.energy = 0.8 if night else 3.0
    key.data.color = (0.6, 0.7, 1.0) if night else (1.0, 0.95, 0.9)
    key.rotation_euler = (math.radians(50), 0, math.radians(35))
    sc.collection.objects.link(key)
    g = Builder()
    g.face([(-400, -400, 0), (400, -400, 0), (400, 400, 0), (-400, 400, 0)], 'ConcreteDark')
    g.to_object('ground')
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    return cam


def shoot(cam, path, loc, look, lens=35):
    cam.location = loc
    cam.data.lens = lens
    cam.rotation_euler = (Vector(look) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def point_light(loc, color, energy):
    lt = bpy.data.objects.new('pl', bpy.data.lights.new('pl', 'POINT'))
    lt.data.energy = energy
    lt.data.color = color
    lt.location = loc
    bpy.context.scene.collection.objects.link(lt)
