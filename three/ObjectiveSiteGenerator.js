import {
	BoxGeometry,
	Color,
	CylinderGeometry,
	DoubleSide,
	Group,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	SphereGeometry,
	TorusGeometry,
	Vector3
} from 'three/webgpu';

/**
 * Builds a district objective site from code. Kinds: `'power'` ( a substation yard: transformers, a busbar gantry, two
 * pylons, a control hut and a central core that relights ), `'datacentre'` ( a finned block with rooftop cooling, an uplink
 * dish and a guarded entrance ), `'drones'` ( a drone hive: raised landing pads around a tiered charging spire ). Sizes are in
 * metres; the site is centred on `x, z` and turned by `ry`.
 *
 * ```js
 * const site = new ObjectiveSiteGenerator().build( { kind: 'power', x, z, ry } );
 * scene.add( site.group );
 * site.setLit( 1 ); // 0 = dark, 1 = relit
 * ```
 */
class ObjectiveSiteGenerator {

	/**
	 * @param {Object} [parameters] - overrides for {@link ObjectiveSiteGenerator.defaults}.
	 */
	constructor( parameters = {} ) {

		this.parameters = Object.assign( {}, ObjectiveSiteGenerator.defaults, parameters );

	}

	/**
	 * @param {Object} site - `{ kind, x, z, ry }`.
	 * @return {Object} `{ group, setLit( t ) }`.
	 */
	build( site ) {

		const p = this.parameters;
		const group = new Group();
		group.name = 'ObjectiveSite';
		group.position.set( site.x, 0, site.z );
		group.rotation.y = site.ry || 0;

		const m = {
			metal: new MeshStandardMaterial( { color: 0x3a3f4a, metalness: 0.35, roughness: 0.5, flatShading: true } ),
			dark: new MeshStandardMaterial( { color: 0x17191f, metalness: 0.3, roughness: 0.6, flatShading: true } ),
			pale: new MeshStandardMaterial( { color: 0x6b7280, metalness: 0.2, roughness: 0.55, flatShading: true } ),
			dish: new MeshStandardMaterial( { color: 0x8a909c, metalness: 0.2, roughness: 0.4, flatShading: true, side: DoubleSide } ),
			ground: new MeshStandardMaterial( { color: 0x24252a, roughness: 0.95 } ),
			glow: new MeshBasicMaterial( { color: new Color( p.dark ), toneMapped: false } ),
			warn: new MeshBasicMaterial( { color: new Color( 0xffb02e ), toneMapped: false } )
		};

		const add = ( geometry, material, x, y, z ) => {

			const mesh = new Mesh( geometry, material );
			mesh.position.set( x, y, z );
			group.add( mesh );
			return mesh;

		};

		const box = ( w, h, d, x, y, z, material = m.metal ) => add( new BoxGeometry( w, h, d ), material, x, y + h / 2, z );
		const cyl = ( rt, rb, h, x, y, z, material = m.metal, seg = 8 ) => add( new CylinderGeometry( rt, rb, h, seg ), material, x, y + h / 2, z );
		const rod = ( a, b, r, material = m.dark ) => { // a thin cylinder between two points ( wires, braces )

			const from = new Vector3( ...a ), to = new Vector3( ...b ), len = from.distanceTo( to );
			const mesh = add( new CylinderGeometry( r, r, len, 4 ), material, 0, 0, 0 );
			mesh.position.copy( from ).lerp( to, 0.5 );
			mesh.quaternion.setFromUnitVectors( new Vector3( 0, 1, 0 ), to.sub( from ).normalize() );
			return mesh;

		};

		const kit = { add, box, cyl, rod, m };

		if ( site.kind === 'datacentre' ) this._datacentre( kit, p );
		else if ( site.kind === 'drones' ) this._hive( kit, p );
		else this._power( kit, p );

		const dark = new Color( p.dark ), lit = new Color( p.lit );
		return {
			group,
			setLit( t ) {

				m.glow.color.copy( dark ).lerp( lit, Math.max( 0, Math.min( 1, t ) ) );

			}
		};

	}

	// substation: gravel yard, transformers under a busbar gantry, pylons feeding it, a control hut and the core
	_power( { box, cyl, rod, m }, p ) {

		const half = p.yard / 2;
		box( p.yard + 2, 0.1, p.yard + 2, 0, 0, 0, m.ground );
		for ( let i = - half; i <= half + 0.01; i += 3.25 ) {

			for ( const [ x, z ] of [[ i, - half ], [ i, half ], [ - half, i ], [ half, i ]] ) box( 0.12, 2.6, 0.12, x, 0, z, m.dark );

		}

		for ( const [ w, d, x, z ] of [[ p.yard, 0.08, 0, - half ], [ p.yard, 0.08, 0, half ], [ 0.08, p.yard, - half, 0 ], [ 0.08, p.yard, half, 0 ]] ) {

			box( w, 0.06, d, x, 1.2, z, m.dark );
			box( w, 0.1, d, x, 2.6, z, m.glow );

		}

		for ( const [ x, z ] of [[ - half, - half ], [ half, - half ], [ - half, half ], [ half, half ]] ) box( 0.3, 0.3, 0.3, x, 2.75, z, m.warn );

		// three transformers: tank, radiator fins, conservator, insulator stacks
		const tz = - half + 5.5;
		for ( let k = - 1; k <= 1; k ++ ) {

			const x = k * 6.5;
			box( 4.2, 0.3, 3.4, x, 0.1, tz, m.dark );
			box( 3.6, 3, 2.6, x, 0.4, tz, m.pale );
			for ( let f = 0; f < 7; f ++ ) box( 0.08, 2.4, 0.9, x - 1.8 + f * 0.6, 0.7, tz + 1.75, m.metal );
			const tank = cyl( 0.45, 0.45, 2.6, x, 3.9, tz - 0.8, m.pale, 10 );
			tank.rotation.z = Math.PI / 2;
			for ( const dx of [ - 1, 0, 1 ] ) {

				for ( let s = 0; s < 4; s ++ ) cyl( 0.22, 0.22, 0.12, x + dx * 1.1, 3.4 + s * 0.28, tz + 0.4, m.dark, 8 );
				rod( [ x + dx * 1.1, 4.5, tz + 0.4 ], [ x + dx * 1.1, 8.3, tz + 0.4 ], 0.03 );

			}

			box( 0.5, 0.25, 0.5, x, 3.4, tz + 1.1, m.glow );

		}

		// busbar gantry over the transformers
		for ( const x of [ - 10, 10 ] ) {

			box( 0.4, 8.6, 0.4, x, 0, tz + 0.4, m.metal );
			rod( [ x, 0.5, tz + 0.4 ], [ x * 0.8, 6, tz + 0.4 ], 0.06, m.metal );

		}

		box( 20.6, 0.5, 0.5, 0, 8.3, tz + 0.4, m.metal );

		// two lattice pylons with braces, wired to the gantry
		const top = p.pylon;
		for ( const side of [ - 1, 1 ] ) {

			const x = side * ( half - 3.5 ), z = half - 4;
			for ( const [ a, b ] of [[ - 1, - 1 ], [ 1, - 1 ], [ - 1, 1 ], [ 1, 1 ]] ) rod( [ x + a * 1.1, 0, z + b * 1.1 ], [ x + a * 0.35, top, z + b * 0.35 ], 0.1, m.metal );
			for ( let y = 3; y < top - 2; y += 3.5 ) {

				const s = 1.1 - ( y / top ) * 0.75;
				rod( [ x - s, y, z - s ], [ x + s, y + 3.5, z - s ], 0.04, m.metal );
				rod( [ x + s, y, z + s ], [ x - s, y + 3.5, z + s ], 0.04, m.metal );
				rod( [ x - s, y, z - s ], [ x - s, y + 3.5, z + s ], 0.04, m.metal );
				rod( [ x + s, y, z + s ], [ x + s, y + 3.5, z - s ], 0.04, m.metal );

			}

			box( 7.5, 0.3, 0.4, x, top - 2, z, m.metal );
			for ( const dx of [ - 3.2, 0, 3.2 ] ) {

				box( 0.25, 0.8, 0.25, x + dx, top - 2.8, z, m.dark );
				rod( [ x + dx, top - 2.8, z ], [ dx * 1.5, 8.3, tz + 0.4 ], 0.03 ); // line down to the gantry

			}

			box( 0.45, 0.45, 0.45, x, top + 0.1, z, m.glow );

		}

		// control hut
		box( 5, 3, 3.6, - half + 4, 0, 1, m.pale );
		box( 5.4, 0.25, 4, - half + 4, 3, 1, m.dark );
		box( 1, 2, 0.06, - half + 6.5, 0, 1, m.glow ).rotation.y = Math.PI / 2;
		box( 1.6, 0.6, 0.06, - half + 4, 1.7, 2.82, m.warn );

		// the core: a hex pillar with stacked rings that relights with the district
		cyl( 1.3, 1.6, 0.6, 0, 0, 2, m.dark, 6 );
		cyl( 0.8, 1.1, 6, 0, 0.6, 2, m.metal, 6 );
		for ( let r = 0; r < 3; r ++ ) cyl( 1.5 - r * 0.15, 1.5 - r * 0.15, 0.18, 0, 1.8 + r * 1.5, 2, m.glow, 6 );

		cyl( 0.35, 0.35, 0.6, 0, 6.6, 2, m.glow, 6 );

	}

	// datacentre: finned block on a plinth, rooftop cooling and HVAC, an uplink dish, a guarded entrance, fuel tanks
	_datacentre( { add, box, cyl, rod, m } ) {

		const W = 22, D = 16, H = 14;
		box( W + 1, 0.6, D + 1, 0, 0, 0, m.dark );
		box( W, H, D, 0, 0.6, 0, m.pale );
		for ( let x = - W / 2 + 1; x <= W / 2 - 1; x += 1.5 ) {

			box( 0.3, H - 1, 0.5, x, 1, D / 2 + 0.2, m.dark );
			box( 0.3, H - 1, 0.5, x, 1, - D / 2 - 0.2, m.dark );

		}

		for ( let z = - D / 2 + 1; z <= D / 2 - 1; z += 1.5 ) for ( const s of [ - 1, 1 ] ) box( 0.5, H - 1, 0.3, s * ( W / 2 + 0.2 ), 1, z, m.dark );
		for ( const y of [ 4.6, 9.2 ] ) box( W + 0.6, 0.18, D + 0.6, 0, y, 0, m.glow ); // floor seams
		for ( const [ x, z ] of [[ - W / 2, - D / 2 ], [ W / 2, - D / 2 ], [ - W / 2, D / 2 ], [ W / 2, D / 2 ]] ) box( 0.35, H, 0.35, x, 0.6, z, m.glow );

		// roof: parapet, cooling towers, HVAC units
		const roof = H + 0.6;
		for ( const [ w, d, x, z ] of [[ W, 0.3, 0, D / 2 ], [ W, 0.3, 0, - D / 2 ], [ 0.3, D, W / 2, 0 ], [ 0.3, D, - W / 2, 0 ]] ) box( w, 0.9, d, x, roof, z, m.dark );
		for ( const x of [ - 6.5, 0, 6.5 ] ) {

			cyl( 2.2, 2.6, 3.4, x, roof, - 3.5, m.metal, 12 );
			const rim = add( new TorusGeometry( 2.2, 0.14, 6, 24 ), m.glow, x, roof + 3.4, - 3.5 );
			rim.rotation.x = Math.PI / 2;
			cyl( 1.9, 1.9, 0.1, x, roof + 3.2, - 3.5, m.dark, 12 );

		}

		for ( let i = 0; i < 4; i ++ ) {

			const x = - 7.5 + i * 4.2;
			box( 3, 1.3, 2.2, x, roof, 3.5, m.metal );
			for ( const dx of [ - 0.7, 0.7 ] ) cyl( 0.55, 0.55, 0.06, x + dx, roof + 1.3, 3.5, m.dark, 12 );

		}

		// uplink: lattice mast and a parabolic dish
		cyl( 0.25, 0.35, 7, 8.5, roof, 0.5, m.metal, 6 );
		const dish = add( new SphereGeometry( 2.6, 20, 8, 0, Math.PI * 2, 0, 0.75 ), m.dish, 8.5, roof + 7.6, 0.5 );
		dish.rotation.x = Math.PI - 0.9;
		rod( [ 8.5, roof + 7.6, 0.5 ], [ 8.5, roof + 9.3, 2.0 ], 0.05 );
		add( new SphereGeometry( 0.15, 8, 6 ), m.glow, 8.5, roof + 9.3, 2.0 );

		// entrance: canopy, terminal, glowing bollards
		box( 6, 0.4, 3, 0, 4, D / 2 + 1.5, m.dark );
		box( 5.6, 0.08, 2.6, 0, 3.92, D / 2 + 1.5, m.glow );
		box( 3, 3.2, 0.1, 0, 0.6, D / 2 + 0.45, m.dark );
		box( 1.2, 2, 0.5, 2.5, 0, D / 2 + 3.4, m.metal );
		box( 0.9, 0.7, 0.06, 2.5, 1.2, D / 2 + 3.66, m.glow );
		for ( let i = - 3; i <= 3; i ++ ) {

			cyl( 0.16, 0.18, 0.9, i * 1.6, 0, D / 2 + 5.5, m.dark, 8 );
			cyl( 0.17, 0.17, 0.12, i * 1.6, 0.9, D / 2 + 5.5, m.glow, 8 );

		}

		// backup fuel tanks on the side
		for ( const z of [ - 3, 3 ] ) {

			const tank = cyl( 1.1, 1.1, 5, W / 2 + 3.2, 1.1, z, m.pale, 12 );
			tank.rotation.x = Math.PI / 2;
			tank.position.y = 1.4;
			box( 0.3, 0.6, 3.6, W / 2 + 3.2, 0, z, m.dark );

		}

	}

	// drone hive: raised hexagonal pads with charging arms around a tiered, ribbed spire
	_hive( { add, box, cyl, rod, m } ) {

		cyl( 6.5, 7, 0.6, 0, 0, 0, m.dark, 8 );
		cyl( 6.6, 6.6, 0.08, 0, 0.6, 0, m.glow, 8 );
		cyl( 2.6, 3.4, 7, 0, 0.6, 0, m.metal, 8 );
		cyl( 1.8, 2.5, 6, 0, 7.6, 0, m.pale, 8 );
		cyl( 1.0, 1.7, 5, 0, 13.6, 0, m.metal, 8 );
		for ( let i = 0; i < 8; i ++ ) {

			const a = ( i + 0.5 ) / 8 * Math.PI * 2, c = Math.cos( a ), s = Math.sin( a );
			rod( [ c * 3.3, 0.6, s * 3.3 ], [ c * 1.7, 18.4, s * 1.7 ], 0.12, m.dark );
			rod( [ c * 3.45, 1.5, s * 3.45 ], [ c * 2.2, 12.5, s * 2.2 ], 0.04, m.glow );

		}

		for ( const y of [ 7.6, 13.6 ] ) cyl( y < 10 ? 2.6 : 1.8, y < 10 ? 2.6 : 1.8, 0.15, 0, y, 0, m.glow, 8 );
		const crown = add( new TorusGeometry( 1.5, 0.18, 6, 24 ), m.glow, 0, 19, 0 );
		crown.rotation.x = Math.PI / 2;
		cyl( 0.3, 0.6, 2.4, 0, 18.6, 0, m.dark, 8 );
		add( new SphereGeometry( 0.35, 10, 8 ), m.glow, 0, 21.2, 0 );

		for ( let i = 0; i < 6; i ++ ) {

			const a = i / 6 * Math.PI * 2, x = Math.cos( a ) * 12, z = Math.sin( a ) * 12;
			for ( const [ dx, dz ] of [[ - 1, - 1 ], [ 1, - 1 ], [ - 1, 1 ], [ 1, 1 ]] ) cyl( 0.12, 0.15, 1.4, x + dx * 1.6, 0, z + dz * 1.6, m.dark, 6 );
			cyl( 3, 3, 0.25, x, 1.4, z, m.metal, 6 );
			cyl( 2.6, 2.6, 0.05, x, 1.65, z, m.dark, 6 );
			const ring = add( new TorusGeometry( 2.2, 0.06, 4, 6 ), m.glow, x, 1.72, z );
			ring.rotation.x = Math.PI / 2;
			for ( let k = 0; k < 3; k ++ ) {

				const b = a + ( k / 3 ) * Math.PI * 2;
				box( 0.25, 0.35, 0.6, x + Math.cos( b ) * 2.7, 1.65, z + Math.sin( b ) * 2.7, m.pale ).rotation.y = - b;

			}

			rod( [ Math.cos( a ) * 3.2, 5, Math.sin( a ) * 3.2 ], [ x * 0.82, 3.2, z * 0.82 ], 0.1, m.metal ); // charging arm
			rod( [ x * 0.82, 3.2, z * 0.82 ], [ x * 0.82, 1.7, z * 0.82 ], 0.06, m.dark );
			add( new SphereGeometry( 0.12, 6, 4 ), m.warn, x * 0.82, 3.2, z * 0.82 );

		}

	}

}

/**
 * Default parameters.
 *
 * @type {Object}
 */
ObjectiveSiteGenerator.defaults = {
	yard: 26, // metres: fenced yard side
	pylon: 22, // metres: pylon height
	dark: 0xff3b4e, // hostile red until the site is relit
	lit: 0x7ff6ff // glow colour once relit
};

export { ObjectiveSiteGenerator };
