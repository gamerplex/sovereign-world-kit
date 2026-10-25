import {
	Box3,
	AdditiveBlending,
	BoxGeometry,
	BufferGeometry,
	CanvasTexture,
	Color,
	CylinderGeometry,
	DirectionalLight,
	DoubleSide,
	FogExp2,
	HemisphereLight,
	Float32BufferAttribute,
	InstancedMesh,
	LineSegments,
	Matrix4,
	Mesh,
	PlaneGeometry,
	Quaternion,
	SphereGeometry,
	SRGBColorSpace,
	TorusGeometry,
	Vector3
} from 'three';

import { LineBasicNodeMaterial, MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import { Fn, cameraPosition, float, floor, fract, hash, instanceIndex, mix, mod, mx_noise_float, positionLocal, positionWorld, sin, smoothstep, step, texture, time, uv, vec3 } from 'three/tsl';

/**
 * Turns any built city into a cyberpunk one. It walks a scene, finds the buildings
 * (tall meshes that stand on the ground, instanced or not) and applies composable
 * layers, following how professional cyberpunk cities are dressed: a near-black
 * base with a few warm windows, neon only on signs and structure, wet ground,
 * vertical blade signs, a hero billboard, and clutter on every facade.
 *
 * - `look`: night sky, haze, existing lights dimmed, two violet lights added.
 * - `facades`: dims the daytime colours, lights a sparse grid of mostly warm windows and colour-blocks tower sections with neon panels, vertical LED fins and bright tier edges.
 * - `ground`: neon pools on the streets, a cheap stand-in for wet reflections.
 * - `signs`: vertical blade signs on the Hong Kong grid ( >= 3.5 m up, >= 2.6 m apart ) and flat wall signs, in mixed scripts, some flickering.
 * - `billboards`: a large animated screen on the tallest towers.
 * - `clutter`: air-conditioning units and pipe risers on the facades.
 * - `crowns`: water tanks, antenna forests and dishes on the rooftops.
 * - `cables`: sagging cables between nearby buildings, a few glowing.
 * - `retrofit`: camera domes along the street-level facades.
 * - `rain`: streaks that fall around the camera.
 * - `skyline`: rooftop masts with beacons, halo rings on the tallest towers.
 *
 * Everything is code, deterministic for a given seed, and undone by {@link Cyberfier#dispose}.
 *
 * ```js
 * const city = new CityGenerator( { seed: 94 } );
 * scene.add( city.build( materials ) );
 *
 * const cyberfier = new Cyberfier( { seed: 94 } );
 * cyberfier.apply( scene, renderer );
 * ```
 */
class Cyberfier {

	/**
	 * @param {Object} [parameters] - overrides for {@link Cyberfier.defaults} and the chosen style in {@link Cyberfier.styles}.
	 */
	constructor( parameters = {} ) {

		const style = Cyberfier.styles[ parameters.style || Cyberfier.defaults.style ];

		this.parameters = Object.assign( {}, Cyberfier.defaults, style, parameters );

		/**
		 * The buildings found by the last {@link Cyberfier#apply}, as `{ box, mesh, h, w, d }`.
		 *
		 * @type {Array<Object>}
		 */
		this.buildings = [];

		this._undo = [];

	}

	/**
	 * Applies the layers to a scene.
	 *
	 * @param {Object3D} root - the scene or group that holds the city; added objects go here too.
	 * @param {WebGPURenderer} [renderer] - lets the look layer set the exposure.
	 * @return {Cyberfier} this
	 */
	apply( root, renderer = null ) {

		this.dispose();

		const p = this.parameters;
		const context = { root, renderer, p, random: mulberry32( p.seed ), buildings: this.buildings = focusOn( p.buildings || findBuildings( root, p ), p.focus ) };

		for ( const name of p.layers ) {

			this._undo.push( layers[ name ]( context ) );

		}

		return this;

	}

	/**
	 * Removes everything the layers added and restores the changed materials, fog and background.
	 */
	dispose() {

		while ( this._undo.length ) this._undo.pop()();

	}

}

Cyberfier.defaults = {
	style: 'violetNoir',
	seed: 1,
	layers: [ 'look', 'facades', 'ground', 'signs', 'billboards', 'clutter', 'crowns', 'cables', 'retrofit', 'rain', 'skyline' ],
	minBuildingHeight: 12, // metres: shorter meshes are treated as street furniture
	bladeDensity: 0.95, // chance that a facade carries blade signs
	wallSignDensity: 0.35, // chance that a tall building carries flat wall signs
	billboardCount: 3, // animated screens, on the tallest towers
	clutterDensity: 0.22, // share of window cells that get an air-conditioning unit
	maxClutter: 40000,
	maxSigns: 60000,
	maxDomes: 4000, // cap on camera domes for the whole city // cap on blade and wall signs for the whole city
	buildings: null, // a ready-made list ( { box, h, w, d, cx, cz, ry, halfW, halfD } ) instead of searching the scene
	materials: null, // facade materials to patch, for cities whose building list has no meshes
	focus: null, // { x, z, radius }: only dress the buildings inside, for big cities // cap on air-conditioning units for the whole city
	cableCount: 2, // cables per building, to its nearest neighbours
	rainCount: 6000, // rain streaks around the camera
	beaconMinHeight: 40, // towers at least this tall get a mast and a beacon
	haloCount: 3 // halo rings on the tallest towers
};

Cyberfier.styles = {
	violetNoir: {
		neon: [ 0x00b4ff, 0xff1493, 0x33e6ff, 0xb44cff, 0xffc02e ], // cyan, magenta, ice, violet, amber: signs and structure only
		sky: 0x090318,
		fog: 0x1d0d36,
		fogDensity: 0.0018,
		exposure: null, // null keeps the scene's own exposure; the look and the glow adapt to it
		lightDim: 0.08, // how much of the existing daytime lights is kept
		hemisphere: [ 0x3a2a8a, 0x1a0c33, 0.8 ],
		key: [ 0x7a8cff, 0.9 ],
		dim: 0.1, // how much of the daytime facade colour is kept ( near-black towers )
		windowSize: [ 2.2, 3.2 ], // metres: width along the facade and floor height of one window cell
		windowDensity: 0.14, // share of windows that are lit: sparse
		windowGlow: 1.1,
		panelShare: 0.7, // share of tower sections that are colour-blocked panels
		panelCell: 70, // metres: footprint cell that shares one panel colour ( about one building )
		panelTier: 60, // metres: spacing of the optional tier edge strips
		panelGlow: 0.22,
		panelMinY: 6, // metres: panels start above the shopfronts
		shopHeight: 4.2, // metres: lit shopfront band at street level
		shopGlow: 0.35, // panel fill
		finPitch: 3.2, // metres between vertical LED fins
		finWidth: 0.18, // fin width as a share of the pitch
		finGlow: 1.1,
		edgeWidth: 0.025, // bright strip at each tier edge
		edgeGlow: 0, // off by default: rooflines come from the skyline layer
		warm: 0xffb066, // interior light: 2200 K
		cool: 0x9fd0ff, // a few cold screens
		poolGlow: 0.5, // strength of the neon pools on the ground
		signs: [ 'NOODLE RELAY', 'NEON PHARMA', '夜市面館', '電腦修理', '24H診所', 'サイバー薬局', 'カラオケ24', '호텔 루나', 'HOT POT 火鍋', 'CYBERWARE', 'PAWN 質屋', 'ARCADE 遊戯', 'DATA BAR', 'TEA 茶館', 'CLINIC 24' ], // fictional or generic names only
		billboardTexts: [ 'VOLTA', 'SYNTH 24', 'NEON 夜光' ]
	}
};

function toVec3( hex ) {

	const c = new Color( hex );
	return vec3( c.r, c.g, c.b );

}

// a small seeded generator, so a city plus a seed always gives the same signs
function mulberry32( seed ) {

	let a = seed | 0;

	return function () {

		a = ( a + 0x6d2b79f5 ) | 0;
		let t = Math.imul( a ^ ( a >>> 15 ), 1 | a );
		t = ( t + Math.imul( t ^ ( t >>> 7 ), 61 | t ) ) ^ t;
		return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;

	};

}

// keeps the buildings inside { x, z, radius } when a focus is given ( the expensive layers then only dress that part of a big city )
function focusOn( buildings, focus ) {

	return focus ? buildings.filter( ( b ) => Math.hypot( b.cx - focus.x, b.cz - focus.z ) <= focus.radius ) : buildings;

}

// the generic adapter: tall boxes that stand on the ground are buildings
function findBuildings( root, p ) {

	root.updateMatrixWorld( true );

	const buildings = [];
	const box = new Box3();
	const instance = new Matrix4();
	const matrix = new Matrix4();

	root.traverse( ( object ) => {

		if ( object.isMesh !== true || object.userData.cyberfy === true || ! object.geometry ) return;

		object.geometry.computeBoundingBox();

		const add = ( m ) => {

			box.copy( object.geometry.boundingBox ).applyMatrix4( m );

			const h = box.max.y - box.min.y, w = box.max.x - box.min.x, d = box.max.z - box.min.z;

			if ( h >= p.minBuildingHeight && box.min.y < 8 && w < 400 && d < 400 ) buildings.push( { box: box.clone(), mesh: object, h, w, d, cx: ( box.min.x + box.max.x ) / 2, cz: ( box.min.z + box.max.z ) / 2, ry: 0, outline: computeOutline( object.geometry, m, box ) } );

		};

		if ( object.isInstancedMesh === true ) {

			for ( let i = 0; i < object.count; i ++ ) {

				object.getMatrixAt( i, instance );
				add( matrix.multiplyMatrices( object.matrixWorld, instance ) );

			}

		} else {

			add( object.matrixWorld );

		}

	} );

	return buildings;

}

// the true outline of a building at every height: min / max x and z of its vertices in 2 m bands ( empty bands take their neighbour ), so
// signs and clutter attach to the real wall of a tower with setbacks instead of its bounding box
function computeOutline( geometry, matrix, box, step = 2 ) {

	const position = geometry.attributes.position;
	const count = Math.max( 1, Math.ceil( ( box.max.y - box.min.y ) / step ) );
	const bands = Array.from( { length: count }, () => ( { minX: Infinity, maxX: - Infinity, minZ: Infinity, maxZ: - Infinity } ) );
	const v = new Vector3();

	for ( let i = 0; i < position.count; i ++ ) {

		v.fromBufferAttribute( position, i ).applyMatrix4( matrix );

		const band = bands[ Math.min( count - 1, Math.max( 0, Math.floor( ( v.y - box.min.y ) / step ) ) ) ];
		band.minX = Math.min( band.minX, v.x );
		band.maxX = Math.max( band.maxX, v.x );
		band.minZ = Math.min( band.minZ, v.z );
		band.maxZ = Math.max( band.maxZ, v.z );

	}

	const empty = ( band ) => band.minX === Infinity;

	for ( let i = count - 2; i >= 0; i -- ) if ( empty( bands[ i ] ) ) bands[ i ] = bands[ i + 1 ];
	for ( let i = 1; i < count; i ++ ) if ( empty( bands[ i ] ) ) bands[ i ] = bands[ i - 1 ];

	return { bands, step, y0: box.min.y };

}

// the four faces of a building at height y ( the outline at that height; the whole box if y is omitted ): outward normal ( x, z ), the tangent along the face, and the face length
function facesOf( b, y = null ) {

	// local extents around the building centre ( the building's own axes; b.ry turns them into the world )
	let minX = b.box.min.x - b.cx, maxX = b.box.max.x - b.cx, minZ = b.box.min.z - b.cz, maxZ = b.box.max.z - b.cz;

	if ( b.halfW !== undefined ) {

		minX = - b.halfW;
		maxX = b.halfW;
		minZ = - b.halfD;
		maxZ = b.halfD;

	} else if ( y !== null && b.outline ) {

		const o = b.outline, band = o.bands[ Math.min( o.bands.length - 1, Math.max( 0, Math.floor( ( y - o.y0 ) / o.step ) ) ) ];

		if ( band.minX !== Infinity ) {

			minX = band.minX - b.cx;
			maxX = band.maxX - b.cx;
			minZ = band.minZ - b.cz;
			maxZ = band.maxZ - b.cz;

		}

	}

	const c = Math.cos( b.ry ), s = Math.sin( b.ry ), mx = ( minX + maxX ) / 2, mz = ( minZ + maxZ ) / 2;
	const face = ( lx, lz, nx, nz, tx, tz, length ) => ( { x: b.cx + lx * c + lz * s, z: b.cz - lx * s + lz * c, nx: nx * c + nz * s, nz: - nx * s + nz * c, tx: tx * c + tz * s, tz: - tx * s + tz * c, length } );

	return [
		face( maxX, mz, 1, 0, 0, 1, maxZ - minZ ),
		face( minX, mz, - 1, 0, 0, 1, maxZ - minZ ),
		face( mx, maxZ, 0, 1, 1, 0, maxX - minX ),
		face( mx, minZ, 0, - 1, 1, 0, maxX - minX )
	];

}

const hex = ( c ) => '#' + new Color( c ).getHexString();

const layers = {

	// night sky, haze, the existing daytime lights dimmed and two violet lights added; both follow the scene's exposure
	look( { root, renderer, p } ) {

		const background = root.background, fog = root.fog, exposure = renderer ? renderer.toneMappingExposure : 1;
		const dimmed = [];

		root.traverse( ( object ) => {

			if ( object.isLight === true && object.userData.cyberfy !== true ) {

				dimmed.push( [ object, object.intensity ] );
				object.intensity *= p.lightDim;

			}

		} );

		root.background = new Color( p.sky );
		root.fog = new FogExp2( p.fog, p.fogDensity );

		if ( renderer && p.exposure !== null ) renderer.toneMappingExposure = p.exposure;

		const scale = 1 / Math.max( renderer ? renderer.toneMappingExposure : 1, 0.02 );
		const hemisphere = new HemisphereLight( p.hemisphere[ 0 ], p.hemisphere[ 1 ], p.hemisphere[ 2 ] * scale );
		const key = new DirectionalLight( p.key[ 0 ], p.key[ 1 ] * scale );
		key.position.set( 120, 200, - 80 );
		hemisphere.userData.cyberfy = key.userData.cyberfy = true;
		root.add( hemisphere, key );

		return () => {

			root.remove( hemisphere, key );
			for ( const [ light, intensity ] of dimmed ) light.intensity = intensity;
			root.background = background;
			root.fog = fog;
			if ( renderer ) renderer.toneMappingExposure = exposure;

		};

	},

	// near-black towers with a sparse grid of lit windows: mostly warm interiors, a few cold screens, the odd neon tint
	facades( { renderer, buildings, p, random } ) {

		const materials = new Set();
		const saved = [];
		const warm = new Color( p.warm ), cool = new Color( p.cool ), tint = new Color( p.neon[ 1 ] );
		const seed = random() * 100;
		const palette = p.neon.map( toVec3 );
		const glow = p.windowGlow / Math.max( renderer ? renderer.toneMappingExposure : 1, 0.02 ); // keeps the windows lit whatever the exposure

		for ( const material of p.materials || [] ) materials.add( material );

		for ( const building of buildings ) {

			if ( ! building.mesh ) continue;

			for ( const material of [].concat( building.mesh.material ) ) {

				if ( material && material.isNodeMaterial === true ) materials.add( material );

			}

		}

		for ( const material of materials ) {

			saved.push( [ material, material.colorNode, material.emissiveNode ] );

			if ( material.colorNode ) material.colorNode = material.colorNode.mul( p.dim );

			material.emissiveNode = Fn( () => {

				const u = positionWorld.x.add( positionWorld.z ).div( p.windowSize[ 0 ] );
				const v = positionWorld.y.div( p.windowSize[ 1 ] );
				const cellU = floor( u ), cellV = floor( v );
				const r = hash( cellU.mul( 7.13 ).add( cellV.mul( 31.7 ) ).add( seed ) );
				const lit = step( float( 1 ).sub( p.windowDensity ), r ).mul( step( 0.16, fract( u ) ) ).mul( step( 0.2, fract( v ) ) );
				const pick = hash( cellU.mul( 3.7 ).add( cellV.mul( 11.3 ) ).add( 5.5 ) );
				const colour = mix( vec3( warm.r, warm.g, warm.b ), vec3( cool.r, cool.g, cool.b ), step( 0.82, pick ) );
				const tinted = mix( colour, vec3( tint.r, tint.g, tint.b ), step( 0.97, pick ) );

				const windows = tinted.mul( lit ).mul( glow ).mul( mix( 0.5, 1, hash( cellU.add( cellV.mul( 5.1 ) ) ) ) );

				// colour-blocked tower sections: one neon colour per footprint cell and tier, with vertical LED fins and bright tier edges
				// one colour theme per building-sized cell, the same from street to roof
				const cell = fract( sin( floor( positionWorld.x.div( p.panelCell ) ).mul( 12.9898 ).add( floor( positionWorld.z.div( p.panelCell ) ).mul( 78.233 ) ).add( seed ) ).mul( 43758.5453 ) ); // hash() clusters on these inputs
				const tier = positionWorld.y.div( p.panelTier );
				const zone = cell;
				const panel = step( float( 1 ).sub( p.panelShare ), zone ).mul( step( p.panelMinY, positionWorld.y ) );
				const slot = floor( fract( zone.mul( 91.7 ) ).mul( palette.length ) );
				let neon = palette[ 0 ];
				for ( let i = 1; i < palette.length; i ++ ) neon = mix( neon, palette[ i ], step( float( i ).sub( 0.5 ), slot ) );
				const fins = step( 1 - p.finWidth, fract( positionWorld.x.add( positionWorld.z ).div( p.finPitch ) ) );
				const edge = step( 1 - p.edgeWidth, fract( tier ) );
				const fill = neon.mul( p.panelGlow ).mul( panel ).mul( glow );
				const led = neon.mul( p.finGlow ).mul( fins ).mul( panel ).mul( glow );
				const rim = mix( neon, vec3( 1, 1, 1 ), 0.6 ).mul( p.edgeGlow ).mul( edge ).mul( glow );

				// lit shopfronts along the street: warm interiors tinted by the building's neon
				const shop = step( 0.4, positionWorld.y ).mul( step( positionWorld.y, p.shopHeight ) ).mul( step( 0.12, fract( positionWorld.x.add( positionWorld.z ).div( 4.5 ) ) ) );
				const front = mix( vec3( warm.r, warm.g, warm.b ), neon, 0.65 ).mul( p.shopGlow ).mul( shop ).mul( glow );

				return windows.add( fill ).add( led ).add( rim ).add( front );

			} )();

			material.needsUpdate = true;

		}

		return () => {

			for ( const [ material, colorNode, emissiveNode ] of saved ) {

				material.colorNode = colorNode;
				material.emissiveNode = emissiveNode;
				material.needsUpdate = true;

			}

		};

	},

	// neon pools on the streets: a cheap stand-in for reflections of the signs in wet asphalt
	ground( { root, p } ) {

		const saved = [];
		const box = new Box3();
		const colours = p.neon.map( ( c ) => new Color( c ) );

		root.traverse( ( object ) => {

			if ( object.isMesh !== true || object.userData.cyberfy === true || ! object.material || object.material.isNodeMaterial !== true ) return;

			box.setFromObject( object );

			if ( box.max.y - box.min.y > 2 || box.max.x - box.min.x < 80 || box.max.z - box.min.z < 80 ) return;

			const material = object.material;
			saved.push( [ material, material.emissiveNode ] );

			material.emissiveNode = Fn( () => {

				const p2 = positionWorld.xz;
				const pools = smoothstep( 0.55, 0.85, mx_noise_float( vec3( p2.x.mul( 0.16 ), 0, p2.y.mul( 0.16 ) ) ).mul( 0.5 ).add( 0.5 ) );
				const pick = floor( mx_noise_float( vec3( p2.x.mul( 0.05 ), 3.1, p2.y.mul( 0.05 ) ) ).mul( 0.5 ).add( 0.5 ).mul( colours.length ) );
				let colour = vec3( colours[ 0 ].r, colours[ 0 ].g, colours[ 0 ].b );

				for ( let k = 1; k < colours.length; k ++ ) colour = mix( colour, vec3( colours[ k ].r, colours[ k ].g, colours[ k ].b ), step( k, pick ) );

				return colour.mul( pools ).mul( p.poolGlow * 0.5 );

			} )();

			material.needsUpdate = true;

		} );

		return () => {

			for ( const [ material, emissiveNode ] of saved ) {

				material.emissiveNode = emissiveNode;
				material.needsUpdate = true;

			}

		};

	},

	// blade signs ( vertical, at right angles to the facade, stacked along the street ) and flat wall signs
	signs( { root, buildings, p, random } ) {

		const themes = p.signs.map( ( text, i ) => ( { text, colour: hex( p.neon[ i % p.neon.length ] ) } ) );
		const blades = themes.map( () => [] ), walls = themes.map( () => [] );
		const pick = () => Math.floor( random() * themes.length );
		let total = 0;

		for ( const b of buildings ) {

			if ( total >= p.maxSigns ) break;

			for ( let fi = 0; fi < 4; fi ++ ) {

				const f0 = facesOf( b, b.box.min.y + 8 )[ fi ];

				if ( random() < p.bladeDensity && f0.length > 6 ) {

					// along the face every >= 2.6 m ( the Hong Kong grid ), densest between 4 and 16 m up
					const count = Math.min( 6, Math.floor( f0.length / 3.2 ) );

					for ( let k = 0; k < count; k ++ ) {

						const h = 4 + random() * 4;
						const y = b.box.min.y + 3.8 + h / 2 + random() * Math.min( 12, Math.max( 0, b.h - 10 ) );
						const f = facesOf( b, y )[ fi ];
						const along = ( ( k + 0.5 ) / count - 0.5 ) * f.length * 0.9;

						total ++, blades[ pick() ].push( { x: f.x + f.tx * along + f.nx * 0.9, y, z: f.z + f.tz * along + f.nz * 0.9, ry: Math.atan2( f.nx, f.nz ) + Math.PI / 2, w: 1.3, h } );

					}

				}

				if ( b.h > 28 && random() < p.wallSignDensity ) {

					const h = 7 + random() * Math.min( 14, b.h * 0.25 );
					const y = b.box.min.y + 12 + h / 2 + random() * Math.max( 1, b.h * 0.6 - h );
					const f = facesOf( b, y )[ fi ];
					const along = ( random() - 0.5 ) * f.length * 0.6;

					total ++, walls[ pick() ].push( { x: f.x + f.tx * along + f.nx * 0.4, y, z: f.z + f.tz * along + f.nz * 0.4, ry: Math.atan2( f.nx, f.nz ), w: h / 4, h } );

				}

			}

		}

		const geometry = new PlaneGeometry( 1, 1 );
		const meshes = [];
		const add = ( lists, flickerShare ) => lists.forEach( ( list, i ) => {

			if ( list.length === 0 ) return;

			const map = createSignTexture( themes[ i ].text, themes[ i ].colour );
			const material = new MeshBasicNodeMaterial( { transparent: true, side: DoubleSide, toneMapped: false } );
			const sample = texture( map );
			const flicker = mix( float( 1 ), step( 0.06, hash( floor( time.mul( 7 ) ).add( instanceIndex.mul( 13.7 ) ) ) ), step( 1 - flickerShare, hash( instanceIndex.mul( 3.1 ) ) ) );
			material.colorNode = sample.rgb.mul( flicker ).mul( 1.6 );
			material.opacityNode = sample.a;
			material.userData.map = map;

			const mesh = new InstancedMesh( geometry, material, list.length );
			mesh.userData.cyberfy = true;
			mesh.frustumCulled = false;
			placeInstances( mesh, list );
			root.add( mesh );
			meshes.push( mesh );

		} );

		add( blades, 0.25 );
		add( walls, 0.15 );

		return () => {

			for ( const mesh of meshes ) {

				root.remove( mesh );
				mesh.material.userData.map.dispose();
				mesh.material.dispose();

			}

			geometry.dispose();

		};

	},

	// a large animated screen on the tallest towers: scanlines and a slow pulse over a neon logo
	billboards( { root, buildings, p, random } ) {

		const objects = [];
		const tallest = [ ...buildings ].sort( ( a, b ) => b.h - a.h ).slice( 0, p.billboardCount );

		tallest.forEach( ( b, i ) => {

			const y = b.box.min.y + Math.max( 24, b.h * 0.55 );
			const faces = facesOf( b, y ).sort( ( a, c ) => c.length - a.length );
			const f = faces[ Math.floor( random() * 2 ) ];
			const w = Math.min( 20, f.length * 0.8 ), h = w / 2;
			const map = createBillboardTexture( p.billboardTexts[ i % p.billboardTexts.length ], hex( p.neon[ ( i + 1 ) % p.neon.length ] ), hex( p.neon[ ( i + 2 ) % p.neon.length ] ) );
			const material = new MeshBasicNodeMaterial( { side: DoubleSide, toneMapped: false } );
			const sample = texture( map );
			const scan = sin( uv().y.mul( 160 ).add( time.mul( 4 ) ) ).mul( 0.12 ).add( 0.88 );
			material.colorNode = sample.rgb.mul( scan ).mul( sin( time.mul( 1.3 ).add( i ) ).mul( 0.15 ).add( 1.6 ) );
			material.userData.map = map;

			const mesh = new Mesh( new PlaneGeometry( w, h ), material );
			mesh.position.set( f.x + f.nx * 0.6, y, f.z + f.nz * 0.6 );
			mesh.rotation.y = Math.atan2( f.nx, f.nz );
			mesh.userData.cyberfy = true;
			root.add( mesh );
			objects.push( mesh );

		} );

		return () => {

			for ( const mesh of objects ) {

				root.remove( mesh );
				mesh.material.userData.map.dispose();
				mesh.material.dispose();
				mesh.geometry.dispose();

			}

		};

	},

	// air-conditioning units on the window rows and pipe risers up the corners
	clutter( { root, buildings, p, random } ) {

		const units = [], pipes = [];

		for ( const b of buildings ) {

			const top = Math.min( b.h * 0.75, 70 );

			for ( let fi = 0; fi < 4; fi ++ ) {

				for ( let row = 1; row * p.windowSize[ 1 ] + 2 < top; row ++ ) {

					const f = facesOf( b, b.box.min.y + row * p.windowSize[ 1 ] + 1.2 )[ fi ];
					const cols = Math.floor( f.length / p.windowSize[ 0 ] );

					for ( let col = 0; col < cols; col ++ ) {

						if ( units.length >= p.maxClutter ) break;
						if ( random() > p.clutterDensity ) continue;

						const along = ( ( col + 0.5 ) / cols - 0.5 ) * f.length;

						units.push( { x: f.x + f.tx * along + f.nx * 0.3, y: b.box.min.y + row * p.windowSize[ 1 ] + 1.2, z: f.z + f.tz * along + f.nz * 0.3, ry: Math.atan2( f.nx, f.nz ), w: 0.9, h: 0.55 } );

					}

				}

			}

			if ( random() < 0.6 ) {

				const f = facesOf( b, b.box.min.y + top / 2 )[ Math.floor( random() * 4 ) ];
				const along = ( random() - 0.5 ) * f.length * 0.8;

				pipes.push( { x: f.x + f.tx * along + f.nx * 0.2, y: b.box.min.y + top / 2, z: f.z + f.tz * along + f.nz * 0.2, ry: 0, w: 1, h: top } );

			}

		}

		const objects = [];
		const metal = new MeshStandardNodeMaterial( { color: 0x23262c, metalness: 0.4, roughness: 0.8 } );

		if ( units.length ) {

			const mesh = new InstancedMesh( new BoxGeometry( 1, 1, 0.7 ), metal, units.length );
			placeInstances( mesh, units );
			objects.push( mesh );

		}

		if ( pipes.length ) {

			const mesh = new InstancedMesh( new CylinderGeometry( 0.12, 0.12, 1, 6 ), metal, pipes.length );
			placeInstances( mesh, pipes );
			objects.push( mesh );

		}

		for ( const mesh of objects ) {

			mesh.userData.cyberfy = true;
			mesh.frustumCulled = false;
			root.add( mesh );

		}

		return () => {

			for ( const mesh of objects ) {

				root.remove( mesh );
				mesh.geometry.dispose();

			}

			metal.dispose();

		};

	},

	// water tanks, an antenna forest and a dish or two on the roof of every tower
	crowns( { root, buildings, random } ) {

		const tanks = [], antennas = [], dishes = [];

		for ( const b of buildings ) {

			if ( b.h < 20 ) continue;

			const roof = facesOf( b, b.box.max.y - 1 ), w = roof[ 2 ].length, d = roof[ 0 ].length, y = b.box.max.y;
			const at = () => {

				const lx = ( random() - 0.5 ) * Math.max( 0, w - 4 ), lz = ( random() - 0.5 ) * Math.max( 0, d - 4 ), c = Math.cos( b.ry ), s = Math.sin( b.ry );
				return { x: b.cx + lx * c + lz * s, z: b.cz - lx * s + lz * c };

			};

			if ( random() < 0.5 ) tanks.push( { ...at(), y: y + 2.5, ry: 0, w: 2.6, h: 3 } );

			for ( let k = 0, n = 2 + Math.floor( random() * 6 ); k < n; k ++ ) {

				const h = 3 + random() * 11;
				antennas.push( { ...at(), y: y + h / 2, ry: 0, w: 0.16, h } );

			}

			if ( random() < 0.45 ) dishes.push( { ...at(), y: y + 1.2, ry: random() * Math.PI * 2, w: 1.8, h: 1.8 } );

		}

		const metal = new MeshStandardNodeMaterial( { color: 0x1b1d23, metalness: 0.6, roughness: 0.6 } );
		const objects = [];
		const add = ( geometry, list ) => {

			if ( list.length === 0 ) return;

			const mesh = new InstancedMesh( geometry, metal, list.length );
			mesh.userData.cyberfy = true;
			mesh.frustumCulled = false;
			placeInstances( mesh, list );
			root.add( mesh );
			objects.push( mesh );

		};

		add( new CylinderGeometry( 0.5, 0.5, 1, 10 ), tanks );
		add( new CylinderGeometry( 0.5, 0.5, 1, 4 ), antennas );
		add( new SphereGeometry( 0.5, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2 ), dishes );

		return () => {

			for ( const mesh of objects ) {

				root.remove( mesh );
				mesh.geometry.dispose();

			}

			metal.dispose();

		};

	},

	// sagging cables from a building's wall to its nearest neighbours; most are dark, a few are neon tubes
	cables( { root, buildings, p, random } ) {

		const dark = [], neon = [];
		const centre = ( b ) => [ b.cx, b.cz ];
		const cell = 80, grid = new Map();

		for ( const b of buildings ) {

			const key = Math.floor( b.cx / cell ) + ',' + Math.floor( b.cz / cell );
			if ( ! grid.has( key ) ) grid.set( key, [] );
			grid.get( key ).push( b );

		}

		const around = ( a ) => {

			const out = [], gx = Math.floor( a.cx / cell ), gz = Math.floor( a.cz / cell );

			for ( let i = - 1; i <= 1; i ++ ) for ( let j = - 1; j <= 1; j ++ ) out.push( ...( grid.get( ( gx + i ) + ',' + ( gz + j ) ) || [] ) );

			return out;

		};

		for ( const a of buildings ) {

			const [ ax, az ] = centre( a );
			const near = around( a ).filter( ( b ) => b !== a ).map( ( b ) => ( { b, d: Math.hypot( centre( b )[ 0 ] - ax, centre( b )[ 1 ] - az ) } ) ).filter( ( o ) => o.d > 20 && o.d < 75 ).sort( ( x, y ) => x.d - y.d ).slice( 0, p.cableCount );

			for ( const { b } of near ) {

				const [ bx, bz ] = centre( b );
				const y = a.box.min.y + 9 + random() * Math.min( 20, Math.min( a.h, b.h ) - 10 );
				const fa = facesOf( a, y ).reduce( ( best, f ) => ( f.nx * ( bx - ax ) + f.nz * ( bz - az ) > best.s ? { f, s: f.nx * ( bx - ax ) + f.nz * ( bz - az ) } : best ), { f: null, s: - Infinity } ).f;
				const fb = facesOf( b, y ).reduce( ( best, f ) => ( f.nx * ( ax - bx ) + f.nz * ( az - bz ) > best.s ? { f, s: f.nx * ( ax - bx ) + f.nz * ( az - bz ) } : best ), { f: null, s: - Infinity } ).f;
				const ta = ( random() - 0.5 ) * fa.length * 0.6, tb = ( random() - 0.5 ) * fb.length * 0.6;
				const p0 = [ fa.x + fa.tx * ta + fa.nx * 0.3, y, fa.z + fa.tz * ta + fa.nz * 0.3 ], p1 = [ fb.x + fb.tx * tb + fb.nx * 0.3, y + ( random() - 0.5 ) * 4, fb.z + fb.tz * tb + fb.nz * 0.3 ];
				const span = Math.hypot( p1[ 0 ] - p0[ 0 ], p1[ 2 ] - p0[ 2 ] ), sag = 0.8 + span * 0.05, list = random() < 0.18 ? neon : dark;

				for ( let k = 0; k < 12; k ++ ) {

					for ( const t of [ k / 12, ( k + 1 ) / 12 ] ) list.push( p0[ 0 ] + ( p1[ 0 ] - p0[ 0 ] ) * t, p0[ 1 ] + ( p1[ 1 ] - p0[ 1 ] ) * t - sag * 4 * t * ( 1 - t ), p0[ 2 ] + ( p1[ 2 ] - p0[ 2 ] ) * t );

				}

			}

		}

		const objects = [];

		for ( const [ list, colour ] of [[ dark, 0x2c3038 ], [ neon, p.neon[ 0 ] ]] ) {

			if ( list.length === 0 ) continue;

			const geometry = new BufferGeometry();
			geometry.setAttribute( 'position', new Float32BufferAttribute( list, 3 ) );

			const lines = new LineSegments( geometry, new LineBasicNodeMaterial( { color: colour, toneMapped: colour === 0x2c3038 } ) );
			lines.userData.cyberfy = true;
			lines.frustumCulled = false;
			root.add( lines );
			objects.push( lines );

		}

		return () => {

			for ( const lines of objects ) {

				root.remove( lines );
				lines.geometry.dispose();
				lines.material.dispose();

			}

		};

	},

	// camera domes along the street-level facades, each with a red status light
	retrofit( { root, buildings, p, random } ) {

		const domes = [], lights = [];

		for ( const b of buildings ) {

			for ( let fi = 0; fi < 4; fi ++ ) {

				const f = facesOf( b, b.box.min.y + 5 )[ fi ];

				if ( domes.length >= p.maxDomes || f.length < 8 || random() > 0.5 ) continue;

				const along = ( random() - 0.5 ) * ( f.length - 6 ), x = f.x + f.tx * along + f.nx * 0.2, z = f.z + f.tz * along + f.nz * 0.2;

				domes.push( { x, y: b.box.min.y + 5.2, z, ry: 0, w: 0.5, h: 0.5 } );
				lights.push( { x: x + f.nx * 0.25, y: b.box.min.y + 5.2, z: z + f.nz * 0.25, ry: 0, w: 0.12, h: 0.12 } );

			}

		}

		const objects = [];
		const add = ( geometry, material, list ) => {

			if ( list.length === 0 ) return;

			const mesh = new InstancedMesh( geometry, material, list.length );
			mesh.userData.cyberfy = true;
			mesh.frustumCulled = false;
			placeInstances( mesh, list );
			root.add( mesh );
			objects.push( mesh );

		};

		add( new SphereGeometry( 0.5, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2 ), new MeshStandardNodeMaterial( { color: 0x0a0a0c, metalness: 0.7, roughness: 0.3 } ), domes );
		add( new BoxGeometry( 1, 1, 1 ), new MeshBasicNodeMaterial( { color: 0xff2010, toneMapped: false } ), lights );

		return () => {

			for ( const mesh of objects ) {

				root.remove( mesh );
				mesh.geometry.dispose();
				mesh.material.dispose();

			}

		};

	},

	// rain streaks that wrap around the camera, animated on the GPU
	rain( { root, p } ) {

		const size = 160, height = 90;
		const geometry = new BoxGeometry( 0.03, 1.2, 0.03 );
		const material = new MeshBasicNodeMaterial( { color: 0x9fc4ff, transparent: true, opacity: 0.3, depthWrite: false, toneMapped: false, blending: AdditiveBlending } );
		const id = float( instanceIndex );
		const base = vec3( hash( id.mul( 1.37 ) ).mul( size ), hash( id.mul( 4.13 ) ).mul( height ), hash( id.mul( 2.91 ) ).mul( size ) );
		const floorY = cameraPosition.y.sub( height / 2 );

		material.positionNode = positionLocal.add( vec3(
			mod( base.x.sub( cameraPosition.x ), size ).add( cameraPosition.x ).sub( size / 2 ),
			mod( base.y.sub( time.mul( 40 ) ).sub( floorY ), height ).add( floorY ),
			mod( base.z.sub( cameraPosition.z ), size ).add( cameraPosition.z ).sub( size / 2 )
		) );

		const mesh = new InstancedMesh( geometry, material, p.rainCount );
		const identity = new Matrix4();

		for ( let i = 0; i < p.rainCount; i ++ ) mesh.setMatrixAt( i, identity );

		mesh.userData.cyberfy = true;
		mesh.frustumCulled = false;
		root.add( mesh );

		return () => {

			root.remove( mesh );
			geometry.dispose();
			material.dispose();

		};

	},

	// a mast with a red beacon on every tall building, and halo rings on the tallest
	skyline( { root, buildings, p, random } ) {

		const tall = buildings.filter( ( b ) => b.h >= p.beaconMinHeight );
		const objects = [];

		if ( tall.length === 0 ) return () => {};

		const masts = new InstancedMesh( new CylinderGeometry( 0.15, 0.3, 1, 6 ), new MeshStandardNodeMaterial( { color: 0x0d0d10, metalness: 0.8, roughness: 0.4 } ), tall.length );
		const beacons = new InstancedMesh( new SphereGeometry( 0.7, 8, 6 ), new MeshBasicNodeMaterial( { color: 0xff2010, toneMapped: false } ), tall.length );
		const matrix = new Matrix4(), quaternion = new Quaternion();

		tall.forEach( ( b, i ) => {

			const height = 6 + ( ( i * 7 ) % 5 ) * 2;
			const x = ( b.box.min.x + b.box.max.x ) / 2, z = ( b.box.min.z + b.box.max.z ) / 2;

			masts.setMatrixAt( i, matrix.compose( new Vector3( x, b.box.max.y + height / 2, z ), quaternion, new Vector3( 1, height, 1 ) ) );
			beacons.setMatrixAt( i, matrix.makeTranslation( x, b.box.max.y + height + 0.4, z ) );

		} );

		for ( const mesh of [ masts, beacons ] ) {

			mesh.userData.cyberfy = true;
			mesh.frustumCulled = false;
			root.add( mesh );
			objects.push( mesh );

		}

		// neon structure: a lit roofline on most towers and a vertical corner strip on some, one neon colour per tower
		const trims = [];

		tall.forEach( ( b, i ) => {

			const top = facesOf( b, b.box.max.y - 1 ), y = b.box.max.y - 0.3, colour = i % p.neon.length;

			if ( random() < 0.8 ) {

				for ( const f of top ) trims.push( { colour, x: f.x, y, z: f.z, ry: Math.atan2( - f.tz, f.tx ), w: f.length + 0.6, h: 0.5 } );

			}

			if ( random() < 0.4 ) {

				const f = top[ Math.floor( random() * 4 ) ], side = random() < 0.5 ? 1 : - 1;

				trims.push( { colour: ( colour + 1 ) % p.neon.length, x: f.x + f.tx * side * f.length / 2, y: b.box.min.y + b.h / 2, z: f.z + f.tz * side * f.length / 2, ry: 0, w: 0.4, h: b.h, vertical: true } );

			}

		} );

		p.neon.forEach( ( c, k ) => {

			const list = trims.filter( ( t ) => t.colour === k );

			if ( list.length === 0 ) return;

			const mesh = new InstancedMesh( new BoxGeometry( 1, 1, 1 ), new MeshBasicNodeMaterial( { color: c, toneMapped: false } ), list.length );
			const matrix = new Matrix4(), q = new Quaternion(), up = new Vector3( 0, 1, 0 );

			list.forEach( ( t, n ) => {

				q.setFromAxisAngle( up, t.ry );
				mesh.setMatrixAt( n, matrix.compose( new Vector3( t.x, t.y, t.z ), q, t.vertical ? new Vector3( t.w, t.h, t.w ) : new Vector3( t.w, t.h, 0.5 ) ) );

			} );

			mesh.userData.cyberfy = true;
			mesh.frustumCulled = false;
			root.add( mesh );
			objects.push( mesh );

		} );

		for ( const b of [ ...tall ].sort( ( a, c ) => c.h - a.h ).slice( 0, p.haloCount ) ) {

			const ring = new Mesh( new TorusGeometry( Math.max( b.w, b.d ) * 0.75, 0.35, 8, 64 ), new MeshBasicNodeMaterial( { color: p.neon[ 2 ], toneMapped: false } ) );
			ring.rotation.x = Math.PI / 2;
			ring.position.set( ( b.box.min.x + b.box.max.x ) / 2, b.box.max.y - 4, ( b.box.min.z + b.box.max.z ) / 2 );
			ring.userData.cyberfy = true;
			root.add( ring );
			objects.push( ring );

		}

		return () => {

			for ( const object of objects ) {

				root.remove( object );
				object.geometry.dispose();
				object.material.dispose();

			}

		};

	}

};

// writes { x, y, z, ry, w, h } placements into an instanced mesh
function placeInstances( mesh, list ) {

	const matrix = new Matrix4(), quaternion = new Quaternion(), position = new Vector3(), scale = new Vector3(), up = new Vector3( 0, 1, 0 );

	list.forEach( ( s, k ) => {

		quaternion.setFromAxisAngle( up, s.ry );
		mesh.setMatrixAt( k, matrix.compose( position.set( s.x, s.y, s.z ), quaternion, scale.set( s.w, s.h, s.w ) ) );

	} );

}

// a vertical sign: dark panel, neon frame; Latin text runs sideways, CJK and Hangul characters stack top to bottom
function createSignTexture( text, colour ) {

	const canvas = document.createElement( 'canvas' );
	canvas.width = 128;
	canvas.height = 512;

	const context = canvas.getContext( '2d' );
	context.clearRect( 0, 0, 128, 512 );
	context.fillStyle = 'rgba( 4, 2, 12, 0.94 )';
	context.fillRect( 0, 0, 128, 512 );
	context.strokeStyle = colour;
	context.lineWidth = 6;
	context.strokeRect( 6, 6, 116, 500 );
	context.fillStyle = colour;
	context.shadowColor = colour;
	context.shadowBlur = 16;
	context.textAlign = 'center';
	context.textBaseline = 'middle';

	if ( [ ...text ].some( ( c ) => c.charCodeAt( 0 ) > 127 ) ) {

		const chars = [ ...text.replace( /\s/g, '' ) ].slice( 0, 6 );
		const step = 480 / Math.max( chars.length, 3 );

		context.font = 'bold ' + Math.min( 84, step * 0.85 ) + 'px sans-serif';
		chars.forEach( ( c, i ) => context.fillText( c, 64, 26 + step * ( i + 0.5 ) ) );

	} else {

		context.translate( 64, 256 );
		context.rotate( Math.PI / 2 );
		context.font = 'bold 64px sans-serif';
		context.fillText( text, 0, 0, 470 );

	}

	const map = new CanvasTexture( canvas );
	map.colorSpace = SRGBColorSpace;
	return map;

}

// the hero billboard art: a big logo between two colour bars
function createBillboardTexture( text, colour, accent ) {

	const canvas = document.createElement( 'canvas' );
	canvas.width = 512;
	canvas.height = 256;

	const context = canvas.getContext( '2d' );
	const gradient = context.createLinearGradient( 0, 0, 512, 256 );
	gradient.addColorStop( 0, '#10031f' );
	gradient.addColorStop( 1, '#05102a' );
	context.fillStyle = gradient;
	context.fillRect( 0, 0, 512, 256 );
	context.fillStyle = accent;
	context.fillRect( 0, 0, 512, 14 );
	context.fillRect( 0, 242, 512, 14 );
	context.fillStyle = colour;
	context.shadowColor = colour;
	context.shadowBlur = 30;
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	context.font = 'bold 120px sans-serif';
	context.fillText( text, 256, 128, 470 );

	const map = new CanvasTexture( canvas );
	map.colorSpace = SRGBColorSpace;
	return map;

}

export { Cyberfier };
