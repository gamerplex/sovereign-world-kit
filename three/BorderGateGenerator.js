import {
	BoxGeometry,
	Color,
	Group,
	InstancedMesh,
	Matrix4,
	MeshBasicMaterial,
	MeshStandardMaterial,
	Quaternion,
	Vector3
} from 'three/webgpu';

/**
 * Places a toll gate wherever a major road crosses a district border. Everything comes from the city data: district
 * polygons ( flat `[ x, z, ... ]` arrays ) and a road graph ( `nodes` as flat `[ x, z, ... ]`, `links` as
 * `[ a, b, name, width, lanes, flags, inner ]` with `inner` the bends as flat `[ x, z, ... ]` ), so any generated city gets gates.
 *
 * ```js
 * const gates = new BorderGateGenerator( { seed: 7 } );
 * scene.add( gates.build( { districts, roadGraph } ) );
 * gates.setStates( ( gate ) => gate.a === home || gate.b === home ? 'open' : 'closed' );
 * ```
 */
class BorderGateGenerator {

	/**
	 * @param {Object} [parameters] - overrides for {@link BorderGateGenerator.defaults}.
	 */
	constructor( parameters = {} ) {

		this.parameters = Object.assign( {}, BorderGateGenerator.defaults, parameters );

		/**
		 * The gates found by the last {@link BorderGateGenerator#build}: `{ x, z, ry, width, a, b }`, where `a` and `b` are the
		 * district indices on either side and `ry` turns the gate to face along the road.
		 *
		 * @type {Array<Object>}
		 */
		this.gates = [];

		this._parts = null;

	}

	/**
	 * Finds the crossings and builds the gates as a few instanced meshes.
	 *
	 * @param {Object} city - `{ districts, roadGraph }`; each district needs a `poly`.
	 * @return {Group} The gates.
	 */
	build( city ) {

		const p = this.parameters;
		this.gates = findCrossings( city.districts, city.roadGraph, p );

		const group = new Group();
		group.name = 'BorderGates';

		const frame = new MeshStandardMaterial( { color: 0x1b1e2a, metalness: 0.7, roughness: 0.4 } );
		const glow = new MeshBasicMaterial( { color: 0xffffff, toneMapped: false } );
		const unit = new BoxGeometry( 1, 1, 1 ).translate( 0, 0.5, 0 );
		const n = this.gates.length;

		const parts = {
			pylons: new InstancedMesh( unit, frame, n * 2 ),
			beam: new InstancedMesh( unit, frame, n ),
			booth: new InstancedMesh( unit, frame, n ),
			strip: new InstancedMesh( unit, glow, n ),
			arm: new InstancedMesh( unit, glow, n )
		};

		const m = new Matrix4(), q = new Quaternion(), s = new Vector3(), t = new Vector3(), up = new Vector3( 0, 1, 0 );

		this.gates.forEach( ( g, i ) => {

			q.setFromAxisAngle( up, g.ry );
			const half = g.width / 2 + 1.5;
			const side = ( d, y ) => t.set( g.x + Math.cos( g.ry ) * d, y, g.z - Math.sin( g.ry ) * d );

			parts.pylons.setMatrixAt( i * 2, m.compose( side( - half, 0 ), q, s.set( 1.2, p.height, 1.2 ) ) );
			parts.pylons.setMatrixAt( i * 2 + 1, m.compose( side( half, 0 ), q, s.set( 1.2, p.height, 1.2 ) ) );
			parts.beam.setMatrixAt( i, m.compose( side( 0, p.height - 1.4 ), q, s.set( half * 2 + 1.2, 1.4, 1.6 ) ) );
			parts.strip.setMatrixAt( i, m.compose( side( 0, p.height - 1.75 ), q, s.set( half * 2, 0.25, 1.7 ) ) );
			parts.booth.setMatrixAt( i, m.compose( side( half + 2.4, 0 ), q, s.set( 2.6, 3, 3 ) ) );

		} );

		for ( const mesh of Object.values( parts ) ) {

			mesh.instanceMatrix.needsUpdate = true;
			mesh.frustumCulled = false;
			group.add( mesh );

		}

		this._parts = parts;
		this.setStates( () => 'closed' );

		return group;

	}

	/**
	 * Sets every gate to `'open'` ( green, arm up ), `'scan'` ( amber, arm up ) or `'closed'` ( red, arm down across the road ).
	 *
	 * @param {function(Object): string} stateOf - called with each gate.
	 */
	setStates( stateOf ) {

		if ( this._parts === null ) return;

		const p = this.parameters, { strip, arm } = this._parts;
		const m = new Matrix4(), q = new Quaternion(), s = new Vector3(), t = new Vector3(), c = new Color();
		const turn = new Quaternion(), up = new Vector3( 0, 1, 0 ), along = new Vector3();

		this.gates.forEach( ( g, i ) => {

			const state = stateOf( g );
			g.state = state;
			c.setHex( p.colours[ state ] || p.colours.closed );
			strip.setColorAt( i, c );
			arm.setColorAt( i, c );

			// the arm hinges at the left pylon: across the road when closed, raised when open or scanning
			const half = g.width / 2 + 1.5;
			along.set( Math.cos( g.ry ), 0, - Math.sin( g.ry ) );
			q.setFromAxisAngle( up, g.ry );
			const raised = state !== 'closed';
			turn.setFromAxisAngle( along.clone().cross( up ).normalize(), raised ? - Math.PI * 0.42 : 0 );
			const length = half * 2 - 0.6;
			const hinge = t.set( g.x - along.x * half, 1.2, g.z - along.z * half );
			const offset = along.clone().multiplyScalar( length / 2 ).applyQuaternion( turn );
			arm.setMatrixAt( i, m.compose( hinge.clone().add( offset ), turn.clone().multiply( q ), s.set( length, 0.3, 0.3 ) ) );

		} );

		strip.instanceColor.needsUpdate = true;
		arm.instanceColor.needsUpdate = true;
		arm.instanceMatrix.needsUpdate = true;

	}

}

/**
 * Default parameters.
 *
 * @type {Object}
 */
BorderGateGenerator.defaults = {
	seed: 1,
	minWidth: 12, // metres: only roads at least this wide get a gate ( tertiary and up in the citygen widths )
	spacing: 80, // metres: no two gates closer than this
	height: 9, // metres: gate portal height
	colours: { open: 0x2bff88, scan: 0xffb02e, closed: 0xff2a4a }
};

function insidePolygon( P, x, z ) {

	let c = false;

	for ( let i = 0, j = P.length - 2; i < P.length; j = i, i += 2 ) {

		if ( ( P[ i + 1 ] > z ) !== ( P[ j + 1 ] > z ) && x < ( P[ j ] - P[ i ] ) * ( z - P[ i + 1 ] ) / ( P[ j + 1 ] - P[ i + 1 ] ) + P[ i ] ) c = ! c;

	}

	return c;

}

// every major road segment whose ends fall in different districts gives a gate at the border, found by bisection
function findCrossings( districts, roadGraph, p ) {

	const boxes = districts.map( ( d ) => {

		let x0 = Infinity, x1 = - Infinity, z0 = Infinity, z1 = - Infinity;
		for ( let i = 0; i < d.poly.length; i += 2 ) {

			x0 = Math.min( x0, d.poly[ i ] ); x1 = Math.max( x1, d.poly[ i ] ); z0 = Math.min( z0, d.poly[ i + 1 ] ); z1 = Math.max( z1, d.poly[ i + 1 ] );

		}

		return { x0, x1, z0, z1 };

	} );

	const districtAt = ( x, z ) => {

		for ( let k = 0; k < districts.length; k ++ ) {

			const b = boxes[ k ];
			if ( x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && insidePolygon( districts[ k ].poly, x, z ) ) return k;

		}

		return - 1;

	};

	const nodes = roadGraph.nodes, gates = [];

	for ( const link of roadGraph.links ) {

		const width = link[ 3 ];
		if ( width < p.minWidth ) continue;

		const pts = [ nodes[ link[ 0 ] * 2 ], nodes[ link[ 0 ] * 2 + 1 ], ...( link[ 6 ] || [] ), nodes[ link[ 1 ] * 2 ], nodes[ link[ 1 ] * 2 + 1 ] ];
		let prev = districtAt( pts[ 0 ], pts[ 1 ] );

		for ( let i = 2; i < pts.length; i += 2 ) {

			const cur = districtAt( pts[ i ], pts[ i + 1 ] );

			if ( cur !== prev && cur >= 0 && prev >= 0 ) {

				let ax = pts[ i - 2 ], az = pts[ i - 1 ], bx = pts[ i ], bz = pts[ i + 1 ];

				for ( let k = 0; k < 12; k ++ ) {

					const mx = ( ax + bx ) / 2, mz = ( az + bz ) / 2;
					if ( districtAt( mx, mz ) === prev ) {

						ax = mx; az = mz;

					} else {

						bx = mx; bz = mz;

					}

				}

				const x = ( ax + bx ) / 2, z = ( az + bz ) / 2;
				const dx = pts[ i ] - pts[ i - 2 ], dz = pts[ i + 1 ] - pts[ i - 1 ];

				if ( ! gates.some( ( g ) => Math.hypot( g.x - x, g.z - z ) < p.spacing ) ) {

					gates.push( { x, z, ry: Math.atan2( dx, dz ), width, a: Math.min( prev, cur ), b: Math.max( prev, cur ) } );

				}

			}

			prev = cur;

		}

	}

	return gates;

}

export { BorderGateGenerator };
