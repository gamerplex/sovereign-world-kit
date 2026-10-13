#!/usr/bin/env python3
"""Fetch CC0 photoscanned materials (ambientCG) HDRIs and models (Poly Haven) listed in cc0_list.json into Imports/cc0/,
each with a source record. Tools/kit/collect.py then copies them into Kit/. Resumable: fetched assets are skipped.
Usage: cc0_fetch.py [--res 2K]"""
import io, json, os, sys, urllib.parse, urllib.request, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'Imports', 'cc0')
RES = sys.argv[sys.argv.index('--res') + 1] if '--res' in sys.argv else '2K'
UA = {'User-Agent': 'SovereignWorldKit/1.0'}


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300).read()


def ambientcg(query, n, by_id=False):
    q = urllib.parse.urlencode({'id': query, 'include': 'downloadData'} if by_id else
                               {'type': 'Material', 'q': query, 'sort': 'Popular', 'limit': n, 'include': 'downloadData'})
    for a in json.loads(get(f'https://ambientcg.com/api/v2/full_json?{q}'))['foundAssets']:
        aid = a['assetId']
        dst = os.path.join(OUT, 'ambientcg', aid)
        if os.path.exists(os.path.join(dst, 'source.json')):
            continue
        dl = next(x for x in a['downloadFolders']['default']['downloadFiletypeCategories']['zip']['downloads']
                  if x['attribute'] == f'{RES}-JPG')
        os.makedirs(dst, exist_ok=True)
        zipfile.ZipFile(io.BytesIO(get(dl['downloadLink']))).extractall(dst)
        json.dump({'source': 'ambientCG', 'id': aid, 'url': f'https://ambientcg.com/view?id={aid}', 'licence': 'CC0-1.0',
                   'query': query, 'resolution': RES}, open(os.path.join(dst, 'source.json'), 'w'), indent=1)
        print('ambientCG', aid, flush=True)


def polyhaven_hdri(aid):
    dst = os.path.join(OUT, 'polyhaven', aid)
    if os.path.exists(os.path.join(dst, 'source.json')):
        return
    info = json.loads(get(f'https://api.polyhaven.com/info/{aid}'))
    url = json.loads(get(f'https://api.polyhaven.com/files/{aid}'))['hdri'][RES.lower()]['hdr']['url']
    os.makedirs(dst, exist_ok=True)
    open(os.path.join(dst, os.path.basename(url)), 'wb').write(get(url))
    json.dump({'source': 'Poly Haven', 'id': aid, 'url': f'https://polyhaven.com/a/{aid}', 'licence': 'CC0-1.0',
               'authors': list(info.get('authors', {})), 'resolution': RES}, open(os.path.join(dst, 'source.json'), 'w'), indent=1)
    print('Poly Haven', aid, flush=True)


def polyhaven_model(aid):
    dst = os.path.join(OUT, 'polyhaven_models', aid)
    if os.path.exists(os.path.join(dst, 'source.json')):
        return
    info = json.loads(get(f'https://api.polyhaven.com/info/{aid}'))
    fbx = json.loads(get(f'https://api.polyhaven.com/files/{aid}'))['fbx'][RES.lower()]['fbx']
    for rel, f in [(os.path.basename(fbx['url']), fbx)] + list(fbx.get('include', {}).items()):
        os.makedirs(os.path.dirname(os.path.join(dst, rel)), exist_ok=True)
        open(os.path.join(dst, rel), 'wb').write(get(f['url']))
    json.dump({'source': 'Poly Haven', 'id': aid, 'url': f'https://polyhaven.com/a/{aid}', 'licence': 'CC0-1.0',
               'authors': list(info.get('authors', {})), 'resolution': RES}, open(os.path.join(dst, 'source.json'), 'w'), indent=1)
    print('Poly Haven model', aid, flush=True)


spec = json.load(open(os.path.join(HERE, 'cc0_list.json')))
for query, n in spec.get('ambientcg', []):
    ambientcg(query, n)
for aid in spec.get('ambientcg_ids', []):  # exact sets (what the generators reference)
    ambientcg(aid, 1, by_id=True)
for aid in spec.get('polyhaven_hdri', []):
    polyhaven_hdri(aid)
for aid in spec.get('polyhaven_model', []):
    polyhaven_model(aid)
