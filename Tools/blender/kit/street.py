"""Street assembly from the kit modules (shared by street_preview.py and street_build.py): storefront ground floors, upper
floors, blade signs and wall lamps with one sign-atlas cell per object, plus CC0 road and sidewalks."""
import math, os, random
import bpy
from common import SLOTS, material, pbr_material

FAC = TEX = ''
rng = random.Random(7)


def init(facades_dir, textures_dir, seed=7):
    global FAC, TEX, rng
    FAC, TEX, rng = facades_dir, textures_dir, random.Random(seed)


_templates = {}


def load(name):
    """Import each module once; later calls share its mesh (instanced in engines, written once in glTF)."""
    if name not in _templates:
        bpy.ops.import_scene.fbx(filepath=os.path.join(FAC, name + '.fbx'))
        _templates[name] = bpy.context.selected_objects[0]
        return _templates[name]
    ob = _templates[name].copy()
    bpy.context.collection.objects.link(ob)
    return ob


def sign_mat(slot, atlas, cell, cols=8, rows=4, power=7.0):
    m = bpy.data.materials.new(f'{slot}_{cell}')
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    uv = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1 / cols, 1 / rows, 1)
    mp.inputs['Location'].default_value = ((cell % cols) / cols, 1 - (cell // cols + 1) / rows, 0)
    tx = nt.nodes.new('ShaderNodeTexImage')
    tx.image = bpy.data.images.load(os.path.join(TEX, atlas), check_existing=True)
    nt.links.new(uv.outputs['UV'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], tx.inputs['Vector'])
    bsdf.inputs['Base Color'].default_value = (0, 0, 0, 1)
    nt.links.new(tx.outputs['Color'], bsdf.inputs['Emission'])
    bsdf.inputs['Emission Strength'].default_value = power
    return m


def assign_signs(ob):
    for i, ms in enumerate(ob.material_slots):
        base = (ms.material.name.split('.')[0] if ms.material else '').split('_')[0]
        if base in SLOTS and base not in ('SignBand', 'SignBlade'):
            ob.material_slots[i].material = material(base)
        if base in ('SignBand', 'SignBlade'):
            ob.material_slots[i].link = 'OBJECT'  # per-object sign cell on a shared mesh
        if base == 'SignBand':
            ob.material_slots[i].material = sign_mat('SignBand', 'T_OCK_SignBand.png', rng.randrange(32))
        elif base == 'SignBlade':
            ob.material_slots[i].material = sign_mat('SignBlade', 'T_OCK_SignBlade.png', rng.randrange(32))


def place(ob, x, y, z, yaw):
    ob.location = (x, y, z)
    ob.rotation_euler[2] += yaw
    assign_signs(ob)
    return ob


def row(bays, y=0.0, yaw=0.0, floors=2, shops='ACEFBDAE', dense=False):
    """One side of a street: `bays` 4 m bays along +X (mirrored when yaw = pi), facing -Y when yaw = 0.
    dense: a neon-canyon street: a vertical blade sign on every bay, stacked one per floor."""
    sx = 1.0 if yaw == 0.0 else -1.0
    x0 = 0.0 if yaw == 0.0 else bays * 4.0
    for k in range(bays):
        x = x0 + sx * 4.0 * k
        v = shops[k % len(shops)]
        place(load(f'OCK_Bay_Storefront_{v}'), x, y, 0.0, yaw)
        for f in range(floors):
            fam = f'OCK_Bay_Residential_{"ABC"[k % 3]}' if (k + f) % 2 else f'OCK_Bay_SlabBlock_{"ABC"[k % 3]}'
            place(load(fam), x, y, 5.0 + 4.0 * f, yaw)
        if dense:
            for f in range(floors):
                if (k + f) % 3 != 2:  # leave gaps so the stacks read as separate signs
                    b = place(load(f'OCK_Prop_BladeSign_{"ABC"[(k + f) % 3]}'), x + sx * (0.2 + 1.8 * (f % 2)), y, 5.6 + 4.0 * f, yaw)
                    b.scale = (b.scale[0] * 1.7, b.scale[1] * 1.7, b.scale[2] * 1.7)  # canyon signs read big
        elif k % 2 == 0:
            place(load(f'OCK_Prop_BladeSign_{"ABC"[k % 3]}'), x + sx * 0.2, y, 5.6, yaw)
        if v in 'BD':
            place(load('OCK_Prop_WallLamp_B'), x + sx * 3.8, y, 3.0, yaw)


def ground(length, y0, y1, setname, tile, name):
    """Flat CC0-textured strip from y0 to y1 along X, UVs scaled so the texture repeats every `tile` metres."""
    bpy.ops.mesh.primitive_plane_add(size=1.0)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = (length, abs(y1 - y0), 1.0)
    ob.location = (length / 2, (y0 + y1) / 2, 0.0)
    bpy.ops.object.transform_apply(scale=True)
    for loop in ob.data.uv_layers.active.data:
        loop.uv = (loop.uv[0] * length / tile, loop.uv[1] * abs(y1 - y0) / tile)
    ob.data.materials.append(pbr_material(name, setname, (0.5, 0.5, 0.55)))
    return ob


def skybridge(x, y0, y1, z, name='Skybridge'):
    """A walkway across the street with a lit LED band on both faces (our geometry, CC0)."""
    from common import material
    span = abs(y1 - y0)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(x, (y0 + y1) / 2, z))
    deck = bpy.context.active_object
    deck.name, deck.scale = name, (3.0, span, 1.4)
    bpy.ops.object.transform_apply(scale=True)
    deck.data.materials.append(material('ConcreteDark'))
    band = bpy.data.materials.new('SkybridgeBand')
    band.use_nodes = True
    b = next(n for n in band.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (0, 0, 0, 1)
    b.inputs['Emission'].default_value = (0.6, 0.27, 1.0, 1)
    b.inputs['Emission Strength'].default_value = 8.0
    for sx in (-1.52, 1.52):
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(x + sx, (y0 + y1) / 2, z + 0.25))
        o = bpy.context.active_object
        o.name, o.scale = name + 'Band', (0.04, span, 0.25)
        bpy.ops.object.transform_apply(scale=True)
        o.data.materials.append(band)
    return deck
