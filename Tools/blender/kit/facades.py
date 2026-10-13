"""Sovereign World Kit — facade module set (CC0, procedural, seeded). Grid: bay 4 m wide, floor 4 m (ground 5 m).
Every module: pivot bottom-left-front on the grid, facade plane at y=0 facing -Y (out of the building), +X along it.
Families (each A/B/C variants): office ribbon, residential (balcony + AC), glass curtain, concrete slab block,
ground-floor storefront; plus outer/inner corners, setback ledge and parapet. LOD1 = 50% decimate, LOD2 = flat card.
Usage: blender -b -P facades.py -- OUT_DIR [--preview]"""
import math, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from common import Builder, clear, export, preview_setup, shoot, point_light  # noqa: E402

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = args[0] if args and not args[0].startswith('--') else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'Imports', 'kit', 'facades')
os.makedirs(OUT, exist_ok=True)
BAY, FLOOR, GROUND = 4.0, 4.0, 5.0
WALL = 0.3  # wall thickness behind the facade plane


def frame(B, x0, z0, w, h, depth, slot, t):
    """Rectangular frame of thickness t around an opening (x0..x0+w, z0..z0+h), protruding `depth` out of the wall."""
    B.box((x0 + w / 2, -depth / 2, z0), (w, depth, t), slot)
    B.box((x0 + w / 2, -depth / 2, z0 + h - t), (w, depth, t), slot)
    B.box((x0 + t / 2, -depth / 2, z0), (t, depth, h), slot)
    B.box((x0 + w - t / 2, -depth / 2, z0), (t, depth, h), slot)


def window(B, x0, z0, w, h, rng, inset=0.12, panes=None, slot='Glass'):
    """Recessed window: reveal + glass set back; wide glazing is split into ~1 m x 2 m panes so each can be lit on its own."""
    nx = panes[0] if panes else max(1, round(w / 1.0))
    nz = panes[1] if panes else max(1, round(h / 2.0))
    for i in range(nx):
        for j in range(nz):
            a, b = x0 + w * i / nx, x0 + w * (i + 1) / nx
            c, d = z0 + h * j / nz, z0 + h * (j + 1) / nz
            B.face([(a, inset, c), (b, inset, c), (b, inset, d), (a, inset, d)], slot)
    for (a, b, c, d) in (((x0, 0, z0), (x0, inset, z0), (x0, inset, z0 + h), (x0, 0, z0 + h)),
                         ((x0 + w, inset, z0), (x0 + w, 0, z0), (x0 + w, 0, z0 + h), (x0 + w, inset, z0 + h)),
                         ((x0, 0, z0), (x0 + w, 0, z0), (x0 + w, inset, z0), (x0, inset, z0)),
                         ((x0, inset, z0 + h), (x0 + w, inset, z0 + h), (x0 + w, 0, z0 + h), (x0, 0, z0 + h))):
        B.face([a, b, c, d], 'ConcreteDark')


def wall_with_holes(B, w, h, holes, slot='Concrete', back=True):
    """Facade plane split into quads around rectangular holes (holes = list of (x0, z0, hw, hh), non-overlapping, one row)."""
    xs = sorted({0.0, w} | {x for (x, _, hw, _) in holes} | {x + hw for (x, _, hw, _) in holes})
    zs = sorted({0.0, h} | {z for (_, z, _, hh) in holes} | {z + hh for (_, z, _, hh) in holes})
    for i in range(len(xs) - 1):
        for j in range(len(zs) - 1):
            cx, cz = (xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2
            if any(x < cx < x + hw and z < cz < z + hh for (x, z, hw, hh) in holes):
                continue
            B.face([(xs[i], 0, zs[j]), (xs[i + 1], 0, zs[j]), (xs[i + 1], 0, zs[j + 1]), (xs[i], 0, zs[j + 1])], slot)
    if back:  # closes the slab; open shops skip it so their room shows through the opening
        B.face([(w, WALL, 0), (0, WALL, 0), (0, WALL, h), (w, WALL, h)], 'ConcreteDark')


def office(B, rng, var):
    """Office ribbon: continuous glazing band with a spandrel; variants change band height and mullion rhythm."""
    band = (2.2, 2.6, 3.0)[var]
    z0 = (FLOOR - band) / 2
    wall_with_holes(B, BAY, FLOOR, [(0.0001, z0, BAY - 0.0002, band)])
    window(B, 0.0001, z0, BAY - 0.0002, band, rng, 0.15)
    n = (2, 3, 4)[var]
    for k in range(1, n):
        B.box((BAY * k / n, -0.04, z0), (0.08, 0.08, band), 'Metal')
    B.box((BAY / 2, -0.06, z0 - 0.12), (BAY, 0.12, 0.12), 'MetalLight')


def residential(B, rng, var):
    """Residential: two windows, balcony slab with railing, an AC unit on one side; variants: open/caged/enclosed balcony."""
    holes = [(0.4, 0.9, 1.3, 2.0), (2.3, 0.9, 1.3, 2.0)]
    wall_with_holes(B, BAY, FLOOR, holes)
    for (x, z, w, h) in holes:
        window(B, x, z, w, h, rng)
        frame(B, x - 0.05, z - 0.05, w + 0.1, h + 0.1, 0.06, 'ConcreteDark', 0.06)
    B.box((BAY / 2, -0.6, 0.0), (BAY - 0.2, 1.2, 0.18), 'Concrete')  # slab
    if var == 0:
        for k in range(9):
            B.box((0.2 + k * (BAY - 0.4) / 8, -1.15, 0.18), (0.04, 0.04, 1.0), 'Metal')
        B.box((BAY / 2, -1.15, 1.15), (BAY - 0.2, 0.06, 0.05), 'Metal')
    elif var == 1:
        for k in range(13):
            B.box((0.2 + k * (BAY - 0.4) / 12, -1.15, 0.18), (0.03, 0.03, FLOOR - 0.2), 'Rust')
        for zz in (1.0, 2.2, 3.4):
            B.box((BAY / 2, -1.15, zz), (BAY - 0.2, 0.04, 0.04), 'Rust')
    else:
        B.box((BAY / 2, -1.12, 0.18), (BAY - 0.2, 0.1, 1.0), 'ConcreteDark')
        B.box((BAY / 2, -1.12, 1.18), (BAY - 0.2, 0.06, 1.6), 'Glass', top=False, bottom=False)
    ax = (0.9, 3.1)[rng.randrange(2)]
    B.box((ax, -0.3, 3.2), (0.7, 0.5, 0.45), 'Plastic')  # AC unit
    B.box((ax, -0.56, 3.25), (0.5, 0.02, 0.35), 'MetalLight')


def curtain(B, rng, var):
    """Glass curtain wall: full-height glazing on a mullion grid; variants: square grid, vertical fins, horizontal louvres."""
    wall_with_holes(B, BAY, FLOOR, [(0.0001, 0.0001, BAY - 0.0002, FLOOR - 0.0002)])
    window(B, 0.0001, 0.0001, BAY - 0.0002, FLOOR - 0.0002, rng, 0.08)
    if var == 0:
        for k in range(0, 5):
            B.box((BAY * k / 4, -0.03, 0), (0.06, 0.06, FLOOR), 'Metal')
        B.box((BAY / 2, -0.03, FLOOR / 2), (BAY, 0.06, 0.06), 'Metal')
    elif var == 1:
        for k in range(0, 5):
            B.box((BAY * k / 4, -0.2, 0), (0.08, 0.4, FLOOR), 'MetalLight')
    else:
        for k in range(6):
            B.box((BAY / 2, -0.25, 0.4 + k * 0.6), (BAY, 0.5, 0.05), 'Metal')
    B.box((BAY / 2, -0.04, FLOOR - 0.25), (BAY, 0.08, 0.25), 'ConcreteDark')  # floor edge


def slab_block(B, rng, var):
    """Concrete slab block (old public housing): punched windows + horizontal floor band; variants: 1, 2 or 3 windows."""
    n = (1, 2, 3)[var]
    w = (1.6, 1.2, 0.9)[var]
    gap = (BAY - n * w) / (n + 1)
    holes = [(gap + k * (w + gap), 1.0, w, 1.8) for k in range(n)]
    wall_with_holes(B, BAY, FLOOR, holes)
    for (x, z, ww, hh) in holes:
        window(B, x, z, ww, hh, rng, 0.2)
        B.box((x + ww / 2, -0.08, z - 0.08), (ww + 0.2, 0.16, 0.08), 'ConcreteDark')  # sill
    B.box((BAY / 2, -0.05, FLOOR - 0.3), (BAY, 0.1, 0.3), 'ConcreteDark')
    if rng.random() < 0.5:  # water stain strip
        B.box((rng.uniform(0.3, BAY - 0.3), -0.005, 0.0), (0.15, 0.01, FLOOR), 'Rust', top=False, bottom=False)


def shop_room(B, depth, back, light, n_lights=3):
    """Open shop interior behind the facade: floor, side walls, back wall, ceiling with light strips (seen from the street)."""
    w0, w1, top = 0.25, BAY - 0.25, 3.4
    B.face([(w0, 0.3, 0.01), (w1, 0.3, 0.01), (w1, depth, 0.01), (w0, depth, 0.01)], 'Tiles')
    B.face([(w0, depth, 0), (w1, depth, 0), (w1, depth, top), (w0, depth, top)], back)
    B.face([(w0, 0.3, 0), (w0, depth, 0), (w0, depth, top), (w0, 0.3, top)], 'PlasterB')
    B.face([(w1, depth, 0), (w1, 0.3, 0), (w1, 0.3, top), (w1, depth, top)], 'PlasterB')
    B.face([(w0, depth, top), (w1, depth, top), (w1, 0.3, top), (w0, 0.3, top)], 'ConcreteDark')
    for k in range(n_lights):
        y = 0.6 + (depth - 0.9) * (k + 0.5) / n_lights
        B.box((BAY / 2, y, top - 0.06), (BAY - 0.9, 0.12, 0.05), light)


def shelves(B, depth, rng, rows=2, edge=None):
    """Shelf units with rows of coloured product boxes (reads as a stocked shop from the street)."""
    for r in range(rows):
        y = 1.0 + (depth - 1.6) * r / max(1, rows - 1)
        B.box((BAY / 2, y, 0), (BAY - 1.2, 0.45, 0.08), 'Metal')
        for lvl in range(4):
            z = 0.3 + lvl * 0.45
            B.box((BAY / 2, y, z), (BAY - 1.2, 0.45, 0.03), 'MetalLight')
            x = 0.75
            while x < BAY - 0.85:
                w = rng.uniform(0.12, 0.3)
                B.box((x + w / 2, y, z + 0.03), (w * 0.9, 0.3, rng.uniform(0.15, 0.32)), rng.choice(['ClothA', 'ClothB', 'ClothC', 'Plastic', 'Rust']))
                x += w
            if edge:
                B.box((BAY / 2, y - 0.24, z + 0.02), (BAY - 1.2, 0.02, 0.02), edge)


def fascia(B, strip):
    """Sign fascia band above the opening: dark box, a whole-sign panel (atlas cell per instance) and an under-light strip."""
    B.box((BAY / 2, -0.12, 3.45), (BAY, 0.24, 1.0), 'ConcreteDark')
    B.face([(0.3, -0.25, 3.6), (BAY - 0.3, -0.25, 3.6), (BAY - 0.3, -0.25, 4.35), (0.3, -0.25, 4.35)], 'SignBand')
    B.box((BAY / 2, -0.26, 3.45), (BAY - 0.4, 0.03, 0.05), strip)


def mullions(B, door=True):
    """Thin shopfront frame (no glass face: an opaque emissive pane would hide the room)."""
    for x in (0.25, BAY - 0.25):
        B.box((x, 0.05, 0), (0.08, 0.1, 3.4), 'Metal')
    B.box((BAY / 2, 0.05, 3.32), (BAY - 0.5, 0.1, 0.08), 'Metal')
    if door:
        B.box((BAY * 0.62, 0.05, 0), (0.06, 0.1, 3.32), 'Metal')
        B.box((BAY * 0.62 + 0.45, 0.05, 1.0), (0.5, 0.04, 0.04), 'MetalLight')  # push bar


def storefront(B, rng, var):
    """Ground-floor shop (5 m) with a visible interior. A convenience store, B shuttered + side lamp, C eatery with
    awning and lanterns, D lobby entrance with canopy, E electronics (screen wall), F pharmacy (projecting cross)."""
    if var == 3:
        holes = [(1.0, 0.0001, 2.0, 3.0)]
    else:
        holes = [(0.25, 0.0001, BAY - 0.5, 3.4)]
    wall_with_holes(B, BAY, GROUND, holes, 'Tiles' if var == 3 else 'Concrete', back=var in (1, 3))
    if var == 0:
        shop_room(B, 4.0, 'ShopGlow', 'WinCool')  # lit back wall: shelves read as silhouettes from the street
        shelves(B, 4.0, rng)
        B.box((BAY - 0.9, 0.9, 0), (1.0, 0.6, 1.0), 'MetalLight')  # counter
        mullions(B)
        fascia(B, 'NeonCyan')
    elif var == 1:
        B.box((BAY / 2, -0.02, 0.0), (BAY - 0.5, 0.04, 3.4), 'MetalLight')  # shutter
        for k in range(16):
            B.box((BAY / 2, -0.05, 0.2 + k * 0.2), (BAY - 0.5, 0.02, 0.02), 'Metal')
        B.box((rng.uniform(0.8, BAY - 0.8), -0.045, 0.0), (0.25, 0.01, 3.2), 'Rust', top=False, bottom=False)  # streak
        fascia(B, 'NeonPink')
        B.box((BAY - 0.15, -0.12, 2.6), (0.18, 0.24, 0.28), 'Metal')  # wall lamp
        B.box((BAY - 0.15, -0.12, 2.58), (0.14, 0.2, 0.02), 'ShopGlow')
    elif var == 2:
        shop_room(B, 3.2, 'ShopGlow', 'WinWarm', 2)
        B.box((BAY / 2, -0.35, 0), (BAY - 0.6, 0.5, 1.05), 'Metal')  # street counter
        B.box((BAY / 2, -0.35, 1.05), (BAY - 0.5, 0.6, 0.05), 'ClothC')
        for x in (0.9, 2.0, 3.1):
            B.cyl((x, -0.95, 0), 0.18, 0.7, 'Rubber', n=8)  # stools
        B.face([(0.1, -0.05, 3.3), (BAY - 0.1, -0.05, 3.3), (BAY - 0.1, -1.6, 2.7), (0.1, -1.6, 2.7)], 'ClothA')  # awning
        B.face([(0.1, -1.6, 2.7), (BAY - 0.1, -1.6, 2.7), (BAY - 0.1, -1.6, 2.4), (0.1, -1.6, 2.4)], 'ClothA')
        for x in (0.7, 2.0, 3.3):
            B.beam((x, -1.3, 2.75), (x, -1.3, 2.45), 0.01, 'Metal')
            B.cyl((x, -1.3, 2.05), 0.16, 0.4, 'NeonAmber', n=8)  # lantern
        B.face([(0.6, 3.15, 1.6), (BAY - 0.6, 3.15, 1.6), (BAY - 0.6, 3.15, 2.6), (0.6, 3.15, 2.6)], 'SignBand')  # menu board
        fascia(B, 'NeonAmber')
    elif var == 3:
        B.box((BAY / 2, 1.5, 0), (2.0, 0.1, 3.0), 'ConcreteDark')  # recess back
        for x in (1.5, 2.5):
            B.box((x, 1.42, 0.0), (0.9, 0.04, 2.6), 'WinDark')  # doors
            B.box((x + 0.3, 1.38, 1.1), (0.04, 0.04, 0.6), 'MetalLight')
        B.face([(1.0, 1.44, 2.62), (3.0, 1.44, 2.62), (3.0, 1.44, 2.98), (1.0, 1.44, 2.98)], 'ShopGlow')  # transom
        B.box((BAY / 2, -0.7, 3.2), (3.0, 1.4, 0.18), 'Metal')  # canopy
        for x in (1.2, 2.0, 2.8):
            B.cyl((x, -0.8, 3.18), 0.1, 0.02, 'ShopGlow', n=10)  # downlights
        for x in (0.55, BAY - 0.55):
            B.box((x, -0.08, 2.2), (0.16, 0.16, 0.45), 'MetalLight')  # sconces
            B.box((x, -0.17, 2.25), (0.1, 0.02, 0.35), 'ShopGlow')
        B.face([(1.3, -0.02, 3.55), (2.7, -0.02, 3.55), (2.7, -0.02, 4.1), (1.3, -0.02, 4.1)], 'SignBand')
    elif var == 4:
        shop_room(B, 3.6, 'ConcreteDark', 'WinCool', 1)
        for i in range(3):
            for j in range(2):
                B.face([(0.5 + i * 1.03, 3.55, 0.9 + j * 1.1), (1.45 + i * 1.03, 3.55, 0.9 + j * 1.1),
                        (1.45 + i * 1.03, 3.55, 1.85 + j * 1.1), (0.5 + i * 1.03, 3.55, 1.85 + j * 1.1)], 'SignBand')  # screen wall
        shelves(B, 3.0, rng, rows=1, edge='NeonCyan')
        mullions(B)
        fascia(B, 'NeonPink')
    else:
        shop_room(B, 3.8, 'ShopGlow', 'WinCool')
        shelves(B, 3.8, rng)
        mullions(B)
        fascia(B, 'NeonGreen')
        B.beam((BAY - 0.3, 0, 4.0), (BAY - 0.3, -0.5, 4.0), 0.06, 'Metal')  # projecting cross on a bracket
        B.box((BAY - 0.3, -0.9, 3.55), (0.12, 0.3, 0.9), 'NeonGreen')
        B.box((BAY - 0.3, -0.9, 3.85), (0.12, 0.9, 0.3), 'NeonGreen')


def blade_sign(B, rng, var):
    """Projecting vertical sign (the street's signature): bracket arms off the wall, a sign box sticking out over the
    pavement with a whole sign on both faces and a neon frame. Pivot = wall point at the box bottom."""
    h = (3.0, 2.2, 4.2)[var]
    y0, y1, t = -0.35, -1.05, 0.22
    for z in (0.3, h - 0.3):
        B.beam((0, 0, z), (0, y0, z), 0.06, 'Metal')
    B.box((0, (y0 + y1) / 2, 0), (t, y0 - y1, h), 'ConcreteDark')
    for sx in (1, -1):
        x = sx * (t / 2 + 0.005)
        pts = [(x, y0, 0.08), (x, y1, 0.08), (x, y1, h - 0.08), (x, y0, h - 0.08)]
        B.face(pts if sx > 0 else list(reversed(pts)), 'SignBlade')
    edge = ('NeonPink', 'NeonCyan', 'NeonAmber')[var]
    for z in (0.0, h):
        B.box((0, (y0 + y1) / 2, z - 0.02), (t + 0.04, y0 - y1 + 0.04, 0.04), edge)


def wall_lamp(B, rng, var):
    """Wall light for alleys and doors: A box sconce, B caged bulb on an arm."""
    if var == 0:
        B.box((0, -0.1, 0), (0.22, 0.2, 0.3), 'Metal')
        B.box((0, -0.1, -0.01), (0.18, 0.16, 0.02), 'ShopGlow')
    else:
        B.beam((0, 0, 0.2), (0, -0.4, 0.2), 0.04, 'Metal')
        B.cyl((0, -0.45, 0.0), 0.08, 0.18, 'ShopGlow', n=8)
        for k in range(4):
            a = k * math.pi / 2
            B.beam((0.09 * math.cos(a), -0.45 + 0.09 * math.sin(a), 0), (0.09 * math.cos(a), -0.45 + 0.09 * math.sin(a), 0.2), 0.01, 'Metal')


def corner_outer(B, rng, var):
    """Outer corner pier (1 m x 1 m) for one floor; variants: plain, banded, chamfered."""
    if var == 2:
        B.box((0.5, -0.5, 0), (1.0, 1.0, FLOOR), 'Concrete', yaw=45)
    else:
        B.box((0.5, -0.5, 0), (1.0, 1.0, FLOOR), 'Concrete')
    if var == 1:
        B.box((0.5, -0.5, FLOOR - 0.3), (1.1, 1.1, 0.3), 'ConcreteDark')


def corner_inner(B, rng, var):
    """Inner corner fill (0.3 m x 0.3 m)."""
    B.box((0.15, 0.15, 0), (0.3, 0.3, FLOOR), 'ConcreteDark')


def setback(B, rng, var):
    """Setback ledge: 2 m deep terrace slab + parapet + rail, one bay wide; sits on top of a lower mass."""
    B.box((BAY / 2, -1.0, 0), (BAY, 2.0, 0.3), 'Concrete')
    B.box((BAY / 2, -1.95, 0.3), (BAY, 0.1, 1.0 if var != 1 else 0.6), 'ConcreteDark')
    if var == 1:
        B.box((BAY / 2, -1.95, 0.9), (BAY, 0.04, 0.04), 'Metal')
    if var == 2:
        B.box((BAY / 2, -1.9, 1.3), (BAY - 0.2, 0.02, 0.05), 'NeonCyan')  # edge light line


def parapet(B, rng, var):
    """Roof parapet, one bay: coping + optional edge light line (crowns read from far away)."""
    B.box((BAY / 2, -0.15, 0), (BAY, 0.3, 1.1), 'ConcreteDark')
    B.box((BAY / 2, -0.15, 1.1), (BAY + 0.02, 0.36, 0.08), 'Concrete')
    if var >= 1:
        B.box((BAY / 2, -0.33, 1.0), (BAY, 0.02, 0.05), ('NeonCyan', 'NeonPink')[var - 1])


FAMILIES = [('Office', office), ('Residential', residential), ('Curtain', curtain), ('SlabBlock', slab_block),
            ('Storefront', storefront), ('CornerOuter', corner_outer), ('CornerInner', corner_inner),
            ('Setback', setback), ('Parapet', parapet), ('BladeSign', blade_sign), ('WallLamp', wall_lamp)]
VARIANTS = {'Storefront': 6, 'CornerInner': 1, 'WallLamp': 2}


def lods(ob):
    """LOD1 = 50% decimate copy, LOD2 = flat card of the facade plane (exported alongside, same pivot)."""
    out = []
    l1 = ob.copy(); l1.data = ob.data.copy(); l1.name = ob.name + '_LOD1'
    bpy.context.scene.collection.objects.link(l1)
    m = l1.modifiers.new('dec', 'DECIMATE'); m.ratio = 0.5
    bpy.context.view_layer.objects.active = l1
    bpy.ops.object.modifier_apply(modifier='dec')
    out.append(l1)
    xs = [v.co.x for v in ob.data.vertices]; zs = [v.co.z for v in ob.data.vertices]
    B = Builder()
    B.face([(min(xs), 0, min(zs)), (max(xs), 0, min(zs)), (max(xs), 0, max(zs)), (min(xs), 0, max(zs))], 'Concrete')
    out.append(B.to_object(ob.name + '_LOD2'))
    return out


if __name__ == '__main__':
    clear()
    made = []
    report = []
    for fi, (name, fn) in enumerate(FAMILIES):
        for var in range(VARIANTS.get(name, 3)):
            B = Builder()
            fn(B, random.Random(1000 + fi * 10 + var), var)
            ob = B.to_object(f'OCK_{"Prop" if name in ("BladeSign", "WallLamp") else "Bay"}_{name}_{"ABCDEF"[var]}')
            tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
            report.append((ob.name, tris))
            export(ob, OUT)
            for l in lods(ob):
                export(l, OUT)
                l.hide_render = True
            made.append(ob)
    for n, t in report:
        print(f'{n}: {t} tris')
    over = [n for n, t in report if t > (3000 if 'Storefront' in n else 1200 if 'Corner' in n or 'Setback' in n else 800 if 'Bay' in n else 2500)]
    print('OVER BUDGET:', over or 'none')
    if '--preview' in args:
        cam = preview_setup(res=(640, 400), samples=16)
        point_light((3, -8, 6), (1.0, 0.6, 0.3), 2500)
        point_light((-4, -6, 3), (0.4, 0.7, 1.0), 1800)
        cols = 6
        for i, ob in enumerate(made):
            ob.location = ((i % cols) * 5.5, 0, (i // cols) * 6.0)
        mx = cols * 5.5
        my = (len(made) // cols + 1) * 6.0
        shoot(cam, os.path.join(OUT, 'facades_sheet.png'), (mx / 2, -mx * 1.15, my / 2), (mx / 2, 0, my / 2 - 0.5), 35)
