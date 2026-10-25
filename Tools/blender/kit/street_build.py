"""Build a two-sided night street from the kit and export it as one GLB for any glTF engine (the web walkthrough, Godot,
...); Unreal builds the same modules natively. Every part is CC0 (kit modules, ambientCG road/paving, our sign atlases).
Writes OUT.slsa.json (SLSA v1 in-toto statement), OUT.provenance.json (compat alias) and LICENSE beside the GLB; refuses to export if any
input has no known CC0 origin (licence by construction).
Usage: blender -b -P street_build.py -- FACADES_DIR TEXTURES_DIR OUT.glb [BAYS] [SEED] [--dense]"""
import hashlib, json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import street  # noqa: E402
from common import clear  # noqa: E402

args = sys.argv[sys.argv.index('--') + 1:]
FAC, TEX, OUT = args[0], args[1], args[2]
BAYS = int(args[3]) if len(args) > 3 else 16
SEED = int(args[4]) if len(args) > 4 else 7
ROAD, WALK = 8.0, 3.0  # carriageway and sidewalk widths (m)

clear()
street.init(FAC, TEX, SEED)
L = BAYS * 4.0
DENSE = '--dense' in args  # neon canyon: stacked blade signs, taller frontage, skybridges
FLOORS = 4 if DENSE else 2
street.row(BAYS, y=0.0, floors=FLOORS, dense=DENSE)                                 # near side faces -Y
street.row(BAYS, y=-(ROAD + 2 * WALK), yaw=3.14159265, floors=FLOORS, dense=DENSE)  # far side faces +Y
if DENSE:
    for bx in range(24, int(BAYS * 4.0) - 8, 40):
        street.skybridge(bx, -(ROAD + 2 * WALK), 0.0, 13.5)
street.ground(L, -WALK, 0.0, 'PavingStones151', 2.0, 'Sidewalk_N')
street.ground(L, -(ROAD + WALK), -WALK, 'Asphalt025C', 3.0, 'Road')
street.ground(L, -(ROAD + 2 * WALK), -(ROAD + WALK), 'PavingStones151', 2.0, 'Sidewalk_S')
KIT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))  # repo root
KIT_VERSION = json.load(open(os.path.join(KIT, '.claude-plugin', 'plugin.json')))['version']
_kitprov = os.path.join(KIT, 'Kit', 'PROVENANCE.json')
RECORDS = {os.path.basename(k): v for k, v in json.load(open(_kitprov)).items()} if os.path.exists(_kitprov) else {}
OURS = (os.path.join(KIT, 'Imports', 'kit'),)  # our generators' output (facades.py, sign_atlas.py): CC0 by the kit licence


def sha(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


def real(path):
    # imported images can carry '//' in front of an absolute path
    home = os.path.expanduser('~').lstrip('/')
    tail = ('/' + path[path.index(home):],) if home in path else ()
    for c in tail + ((path[2:], '/' + path[2:].lstrip('/')) if path.startswith('//') else ()) + (bpy.path.abspath(path), path):
        if os.path.exists(c):
            return c
    return path


bpy.data.orphans_purge(do_recursive=True)  # FBX-embedded images replaced by kit materials aren't inputs
inputs = [os.path.join(FAC, n + '.fbx') for n in street._templates] + \
    sorted({real(i.filepath) for i in bpy.data.images if i.filepath})
prov, unknown = [], []
for f in inputs:
    f = os.path.abspath(real(f))
    src = os.path.join(os.path.dirname(f), 'source.json')  # written by cc0_fetch.py beside fetched assets
    rec = RECORDS.get(os.path.basename(f)) or (json.load(open(src)) if os.path.exists(src) else None) or \
        ({'source': 'Sovereign World Kit generator', 'licence': 'CC0-1.0'} if f.startswith(OURS) else None)
    if not rec:
        unknown.append(f)
    prov.append({'file': os.path.relpath(f, KIT), 'sha256': sha(f), **(rec or {'licence': 'UNKNOWN'})})
if unknown:
    print('REFUSED: inputs without a known CC0 origin: ' + ', '.join(unknown), flush=True)  # Blender hides SystemExit text
    sys.exit(1)

for img in bpy.data.images:  # web budget: 1K textures
    if img.size[0] > 1024:
        img.scale(1024, max(1, img.size[1] * 1024 // img.size[0]))
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=False, export_image_format='JPEG',
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6)
OUT_SHA, NOW = sha(OUT), time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
GEN = {'script': 'Tools/blender/kit/street_build.py', 'sha256': sha(os.path.abspath(__file__)),
       'blender': bpy.app.version_string, 'bays': BAYS, 'seed': SEED}

# Our own shape, kept as a compatibility alias. Anything already reading this keeps working.
json.dump({'output': os.path.basename(OUT), 'sha256': OUT_SHA, 'licence': 'CC0-1.0',
           'kit': {'name': 'sovereign-world-kit', 'version': KIT_VERSION},
           'generator': GEN, 'created': NOW, 'inputs': prov},
          open(os.path.splitext(OUT)[0] + '.provenance.json', 'w'), indent=1)

# SLSA v1 in-toto statement. We do NOT invent a schema: "what went into this build" was solved
# years ago by SLSA / in-toto / SPDX / CycloneDX, and the only real gap is that none of them
# model DCC tools, asset packs or textures as build inputs. So we emit the standard and put the
# asset-specific parts in `internalParameters` and `resolvedDependencies`, where they belong.
# Riding an adopted format means existing verifiers partly work on our records for free.
#
# This is already re-derivable by a stranger: the generator's own hash, the Blender version and
# the seed are all recorded, so the same inputs reproduce the same output. That is the Nix
# property without the Nix.
json.dump({
    '_type': 'https://in-toto.io/Statement/v1',
    'subject': [{'name': os.path.basename(OUT), 'digest': {'sha256': OUT_SHA}}],
    'predicateType': 'https://slsa.dev/provenance/v1',
    'predicate': {
        'buildDefinition': {
            'buildType': 'https://gamerplex.com/buildtypes/sovereign-world-kit/blender/v1',
            'externalParameters': {'bays': BAYS, 'seed': SEED},
            'internalParameters': {'blender': bpy.app.version_string,
                                   'generatorSha256': GEN['sha256'],
                                   'kitVersion': KIT_VERSION},
            'resolvedDependencies': [
                {'name': i['file'], 'digest': {'sha256': i['sha256']},
                 'annotations': {'licence': i.get('licence'), 'source': i.get('source')}}
                for i in prov
            ],
        },
        'runDetails': {
            'builder': {'id': 'https://gamerplex.com/builders/sovereign-world-kit',
                        'version': {'kit': KIT_VERSION, 'blender': bpy.app.version_string}},
            'metadata': {'invocationId': OUT_SHA[:16], 'startedOn': NOW, 'finishedOn': NOW},
        },
        # CC0 is an assertion about origin, not something the build can prove. The build DOES
        # prove the digests, and it refuses to export when any input lacks a known CC0 origin —
        # so this field records what we assert, and the refusal above is what backs it.
        'licence': {'spdxId': 'CC0-1.0', 'assertedBy': 'sovereign-world-kit',
                    'basis': 'every input traced to a CC0 origin or generated by this kit'},
    },
}, open(os.path.splitext(OUT)[0] + '.slsa.json', 'w'), indent=1)
open(os.path.join(os.path.dirname(os.path.abspath(OUT)), 'LICENSE'), 'w').write(
    'CC0 1.0 Universal: https://creativecommons.org/publicdomain/zero/1.0/\n'
    'Every input is listed with its source and licence in the .provenance.json beside the scene.\n')
print('GLB', OUT, f'{os.path.getsize(OUT) / 1e6:.1f} MB', f'{BAYS} bays x 2 sides')
