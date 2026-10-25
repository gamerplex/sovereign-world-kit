import {
	BoxGeometry,
	Color,
	CylinderGeometry,
	Group,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	SphereGeometry,
	TorusGeometry
} from 'three/webgpu';

/**
 * Builds robots from code, each with its own procedural animation. Kinds: `'drone'` ( a ducted quad-rotor gunship ),
 * `'hound'` ( a four-legged runner ) and `'heavy'` ( a reverse-jointed walker with shoulder cannons ). Sizes are in metres.
 *
 * ```js
 * const robots = new RobotGenerator();
 * const drone = robots.build( 'drone' );
 * scene.add( drone.group );
 * drone.update( dt, speed ); // rotors, gait
 * drone.setFlash( 1 ); // white flash when hit, fades with update()
 * ```
 */
class RobotGenerator {

	/**
	 * @param {Object} [parameters] - overrides for {@link RobotGenerator.defaults}.
	 */
	constructor( parameters = {} ) {

		this.parameters = Object.assign( {}, RobotGenerator.defaults, parameters );

		const p = this.parameters;
		this._shell = new MeshStandardMaterial( { color: p.shell, metalness: 0.35, roughness: 0.45, flatShading: true } );
		this._dark = new MeshStandardMaterial( { color: p.joint, metalness: 0.5, roughness: 0.55, flatShading: true } );

	}

	/**
	 * @param {string} kind - `'drone'`, `'hound'` or `'heavy'`.
	 * @param {string} [palette] - a key of {@link RobotGenerator.palettes}: `'red'`, `'violet'`, `'gold'` or `'cyan'`.
	 * @return {Object} `{ group, update( dt, speed ), setFlash( t ) }`.
	 */
	build( kind, palette = 'red' ) {

		const p = Object.assign( {}, this.parameters, RobotGenerator.palettes[ palette ] || {} );
		const group = new Group();
		group.name = 'Robot_' + kind;

		// each robot gets its own shell material so a hit flash only lights that robot
		const shell = this._shell.clone();
		shell.color.setHex( p.shell );
		const plate = shell.clone();
		plate.color.setHex( p.shell ).offsetHSL( 0, 0, 0.12 );
		const eye = new MeshBasicMaterial( { color: new Color( p.eye ), toneMapped: false } );
		const trim = new MeshBasicMaterial( { color: new Color( p.trim ), toneMapped: false } );
		const dark = this._dark;

		const add = ( geometry, material, x, y, z, parent = group ) => {

			const mesh = new Mesh( geometry, material );
			mesh.position.set( x, y, z );
			parent.add( mesh );
			return mesh;

		};

		const joint = ( x, y, z, rx, parent ) => {

			const g = new Group();
			g.position.set( x, y, z );
			g.rotation.x = rx;
			parent.add( g );
			return g;

		};

		let animate = () => {};

		if ( kind === 'drone' ) {

			const rig = joint( 0, 0, 0, 0, group );
			add( new CylinderGeometry( 0.62, 0.78, 0.22, 8 ), shell, 0, 0.11, 0, rig );
			add( new CylinderGeometry( 0.78, 0.5, 0.26, 8 ), dark, 0, - 0.13, 0, rig );
			add( new CylinderGeometry( 0.4, 0.62, 0.16, 8 ), plate, 0, 0.3, 0, rig );
			add( new CylinderGeometry( 0.8, 0.8, 0.04, 8 ), trim, 0, 0.0, 0, rig ); // waist band
			add( new SphereGeometry( 0.2, 12, 8 ), dark, 0, - 0.02, 0.72, rig );
			add( new SphereGeometry( 0.13, 12, 8 ), eye, 0, - 0.02, 0.8, rig );

			const turret = joint( 0, - 0.3, 0.2, 0, rig );
			add( new SphereGeometry( 0.2, 10, 6 ), dark, 0, 0, 0, turret );
			add( new CylinderGeometry( 0.05, 0.06, 0.8, 6 ).rotateX( Math.PI / 2 ), dark, 0.08, - 0.04, 0.42, turret );
			add( new CylinderGeometry( 0.05, 0.06, 0.8, 6 ).rotateX( Math.PI / 2 ), dark, - 0.08, - 0.04, 0.42, turret );
			for ( const x of [ - 0.45, 0.45 ] ) {

				add( new BoxGeometry( 0.05, 0.34, 0.05 ), dark, x, - 0.36, 0, rig );
				add( new BoxGeometry( 0.06, 0.05, 1.1 ), dark, x, - 0.54, 0, rig );

			}

			const rotors = [];
			for ( const [ x, z ] of [[ - 1, - 1 ], [ 1, - 1 ], [ - 1, 1 ], [ 1, 1 ]] ) {

				const arm = add( new BoxGeometry( 0.14, 0.1, 0.9 ), shell, x * 0.62, 0.08, z * 0.62, rig );
				arm.rotation.y = Math.atan2( x, z );
				const hub = joint( x * 1.08, 0.12, z * 1.08, 0, rig );
				add( new TorusGeometry( 0.46, 0.07, 6, 24 ).rotateX( Math.PI / 2 ), shell, 0, 0, 0, hub );
				add( new TorusGeometry( 0.4, 0.025, 4, 24 ).rotateX( Math.PI / 2 ), trim, 0, - 0.08, 0, hub ); // underglow
				add( new CylinderGeometry( 0.08, 0.1, 0.12, 6 ), dark, 0, 0, 0, hub );
				const blades = joint( 0, 0.02, 0, 0, hub );
				add( new BoxGeometry( 0.8, 0.02, 0.09 ), dark, 0, 0, 0, blades );
				add( new BoxGeometry( 0.09, 0.02, 0.8 ), dark, 0, 0, 0, blades );
				rotors.push( blades );
				add( new SphereGeometry( 0.04, 6, 4 ), z > 0 ? eye : trim, x * 0.5, 0, z * 0.5, hub ); // nav light

			}

			let t = 0;
			animate = ( dt, speed = 0 ) => {

				t += dt;
				for ( const r of rotors ) r.rotation.y += dt * 45;
				rig.position.y = Math.sin( t * 2.2 ) * 0.08; // hover bob
				rig.rotation.x = Math.min( 0.25, speed * 0.02 ); // nose down into the flight
				turret.rotation.y = Math.sin( t * 0.7 ) * 0.5;

			};

		} else if ( kind === 'hound' ) {

			const body = joint( 0, 1.05, 0, 0, group );
			add( new CylinderGeometry( 0.3, 0.4, 1.5, 6 ).rotateX( Math.PI / 2 ).scale( 1, 0.75, 1 ), shell, 0, 0, 0, body );
			add( new BoxGeometry( 0.5, 0.12, 0.9 ), plate, 0, 0.27, 0.15, body );
			add( new BoxGeometry( 0.06, 0.04, 1.1 ), trim, 0, 0.34, 0.05, body ); // spine light
			for ( const x of [ - 1, 1 ] ) add( new BoxGeometry( 0.03, 0.05, 0.9 ), trim, x * 0.33, 0.02, 0.1, body );
			for ( let k = 0; k < 3; k ++ ) add( new BoxGeometry( 0.34 - k * 0.06, 0.08, 0.22 ), plate, 0, 0.24 - k * 0.02, - 0.35 - k * 0.24, body );
			const tail = add( new CylinderGeometry( 0.015, 0.03, 0.7, 4 ), dark, 0, 0.3, - 0.95, body );
			tail.rotation.x = - 0.9;
			add( new SphereGeometry( 0.04, 6, 4 ), eye, 0, 0.35, 0, tail );

			const neck = joint( 0, 0.12, 0.72, - 0.5, body );
			add( new CylinderGeometry( 0.12, 0.16, 0.42, 6 ), dark, 0, 0.2, 0, neck );
			const head = joint( 0, 0.42, 0.08, 0.5, neck );
			add( new BoxGeometry( 0.36, 0.24, 0.5 ), shell, 0, 0, 0.12, head );
			add( new BoxGeometry( 0.3, 0.14, 0.34 ), plate, 0, 0.1, 0.28, head ).rotation.x = 0.35;
			add( new BoxGeometry( 0.26, 0.1, 0.4 ), dark, 0, - 0.14, 0.2, head ); // jaw
			add( new BoxGeometry( 0.34, 0.05, 0.03 ), eye, 0, 0.03, 0.38, head ); // visor
			for ( const x of [ - 1, 1 ] ) add( new BoxGeometry( 0.04, 0.16, 0.12 ), plate, x * 0.15, 0.17, - 0.05, head ).rotation.z = x * 0.4; // ears

			const legs = [];
			const leg = ( x, z, front ) => {

				// front legs bend back at the knee; rear legs are digitigrade ( thigh forward, hock behind )
				const rest = front ? [ 0.25, - 0.5, 0.25 ] : [ - 0.6, 1.3, - 0.7 ];
				const len = front ? [ 0.5, 0.45, 0.12 ] : [ 0.5, 0.45, 0.28 ];
				const hip = joint( x * 0.3, 0, z, rest[ 0 ], body );
				add( new CylinderGeometry( 0.13, 0.17, 0.22, 6 ).rotateZ( Math.PI / 2 ), plate, x * 0.06, 0, 0, hip );
				add( new CylinderGeometry( 0.07, 0.1, len[ 0 ], 6 ).translate( 0, - len[ 0 ] / 2, 0 ), shell, x * 0.08, 0, 0, hip );
				const knee = joint( x * 0.08, - len[ 0 ], 0, rest[ 1 ], hip );
				add( new TorusGeometry( 0.07, 0.02, 4, 10 ).rotateY( Math.PI / 2 ), trim, 0, 0, 0, knee );
				add( new CylinderGeometry( 0.045, 0.06, len[ 1 ], 6 ).translate( 0, - len[ 1 ] / 2, 0 ), dark, 0, 0, 0, knee );
				const ankle = joint( 0, - len[ 1 ], 0, rest[ 2 ], knee );
				add( new CylinderGeometry( 0.035, 0.045, len[ 2 ], 5 ).translate( 0, - len[ 2 ] / 2, 0 ), dark, 0, 0, 0, ankle );
				add( new BoxGeometry( 0.12, 0.04, 0.18 ), shell, 0, - len[ 2 ] - 0.01, 0.04, ankle );
				legs.push( { hip, knee, rest, front, phase: ( x * z > 0 ) ? 0 : Math.PI } );

			};

			leg( - 1, 0.58, true ); leg( 1, 0.58, true ); leg( - 1, - 0.58, false ); leg( 1, - 0.58, false );

			let t = 0;
			animate = ( dt, speed = 0 ) => {

				t += dt * ( 2 + speed * 0.9 );
				const stride = Math.min( 0.6, 0.08 + speed * 0.06 );
				for ( const l of legs ) {

					const lift = Math.max( 0, - Math.cos( t + l.phase ) ) * stride * 1.3;
					l.hip.rotation.x = l.rest[ 0 ] + Math.sin( t + l.phase ) * stride;
					l.knee.rotation.x = l.rest[ 1 ] + ( l.front ? - lift : lift );

				}

				body.position.y = 1.05 + Math.abs( Math.sin( t ) ) * 0.03 * Math.min( 1, speed );
				head.rotation.y = Math.sin( t * 0.3 ) * 0.3;

			};

		} else {

			// heavy walker: reverse-jointed legs under a shoulder-wide armoured torso
			const hipY = 2.7;
			add( new BoxGeometry( 1.0, 0.45, 0.8 ), dark, 0, hipY, 0 );
			const torso = joint( 0, hipY + 0.85, 0, 0, group );
			add( new CylinderGeometry( 1.15, 0.8, 1.2, 6 ).scale( 1, 1, 0.7 ), shell, 0, 0, 0, torso );
			add( new BoxGeometry( 1.2, 0.5, 0.3 ), plate, 0, 0.15, 0.62, torso ).rotation.x = - 0.35; // chest wedge
			add( new BoxGeometry( 0.9, 0.12, 0.04 ), eye, 0, 0.2, 0.79, torso ); // visor
			for ( const x of [ - 0.3, 0.3 ] ) add( new SphereGeometry( 0.06, 8, 6 ), eye, x, - 0.12, 0.74, torso );
			add( new CylinderGeometry( 1.17, 1.17, 0.05, 6 ).scale( 1, 1, 0.71 ), trim, 0, 0.45, 0, torso ); // collar band
			add( new BoxGeometry( 1.4, 0.3, 0.9 ), plate, 0, 0.68, - 0.1, torso );
			for ( const x of [ - 0.35, 0.35 ] ) {

				add( new CylinderGeometry( 0.13, 0.16, 0.6, 6 ), dark, x, 0.75, - 0.55, torso );
				add( new CylinderGeometry( 0.11, 0.11, 0.04, 6 ), eye, x, 1.06, - 0.55, torso ); // exhaust glow

			}

			const mast = add( new CylinderGeometry( 0.015, 0.025, 0.9, 4 ), dark, 0.55, 1.2, - 0.3, torso );
			const beacon = add( new SphereGeometry( 0.05, 6, 4 ), eye, 0, 0.47, 0, mast );

			for ( const side of [ - 1, 1 ] ) {

				const shoulder = joint( side * 1.15, 0.35, 0, 0, torso );
				add( new BoxGeometry( 0.55, 0.55, 0.9 ), shell, side * 0.15, 0, 0, shoulder );
				add( new BoxGeometry( 0.58, 0.05, 0.92 ), trim, side * 0.15, 0.2, 0, shoulder );
				for ( const dy of [ - 0.12, 0.12 ] ) {

					add( new CylinderGeometry( 0.08, 0.1, 1.1, 6 ).rotateX( Math.PI / 2 ), dark, side * 0.15, dy, 0.85, shoulder );
					add( new TorusGeometry( 0.08, 0.025, 4, 10 ), trim, side * 0.15, dy, 1.4, shoulder ); // muzzle

				}

			}

			const legs = [];
			for ( const side of [ - 1, 1 ] ) {

				const rest = [ - 0.5, 1.2, - 0.7 ], len = [ 1.3, 1.2, 0.55 ];
				const hip = joint( side * 0.7, hipY, 0, rest[ 0 ], group );
				add( new CylinderGeometry( 0.28, 0.28, 0.4, 6 ).rotateZ( Math.PI / 2 ), plate, 0, 0, 0, hip );
				add( new CylinderGeometry( 0.2, 0.3, len[ 0 ], 6 ).translate( 0, - len[ 0 ] / 2, 0 ), shell, 0, 0, 0, hip );
				const knee = joint( 0, - len[ 0 ], 0, rest[ 1 ], hip );
				add( new SphereGeometry( 0.24, 8, 6 ), plate, 0, 0, 0, knee );
				add( new TorusGeometry( 0.22, 0.03, 4, 12 ).rotateY( Math.PI / 2 ), trim, 0, 0, 0, knee );
				add( new CylinderGeometry( 0.12, 0.17, len[ 1 ], 6 ).translate( 0, - len[ 1 ] / 2, 0 ), dark, 0, 0, 0, knee );
				add( new CylinderGeometry( 0.05, 0.05, len[ 1 ] * 0.8, 4 ).translate( 0, - len[ 1 ] / 2, 0 ), shell, 0, 0, - 0.2, knee ); // piston
				const ankle = joint( 0, - len[ 1 ], 0, rest[ 2 ], knee );
				add( new CylinderGeometry( 0.1, 0.13, len[ 2 ], 6 ).translate( 0, - len[ 2 ] / 2, 0 ), dark, 0, 0, 0, ankle );
				for ( const a of [ - 0.45, 0, 0.45 ] ) {

					const toe = add( new BoxGeometry( 0.14, 0.1, 0.55 ).translate( 0, 0, 0.27 ), shell, 0, - len[ 2 ] - 0.04, 0, ankle );
					toe.rotation.y = a;

				}

				add( new BoxGeometry( 0.14, 0.1, 0.35 ).translate( 0, 0, - 0.17 ), shell, 0, - len[ 2 ] - 0.04, 0, ankle ); // heel spur
				legs.push( { hip, knee, rest, phase: side > 0 ? 0 : Math.PI } );

			}

			let t = 0;
			animate = ( dt, speed = 0 ) => {

				t += dt * ( 1.2 + speed * 0.5 );
				const stride = Math.min( 0.4, 0.04 + speed * 0.08 );
				for ( const l of legs ) {

					l.hip.rotation.x = l.rest[ 0 ] + Math.sin( t + l.phase ) * stride;
					l.knee.rotation.x = l.rest[ 1 ] + Math.max( 0, - Math.cos( t + l.phase ) ) * stride * 1.5;

				}

				torso.position.y = hipY + 0.85 + Math.abs( Math.sin( t ) ) * 0.08 * Math.min( 1, speed );
				torso.rotation.z = Math.sin( t ) * 0.03 * Math.min( 1, speed );
				beacon.visible = Math.sin( t * 3 ) > 0;

			};

		}

		let flash = 0;
		const base = new Color( p.shell ), white = new Color( 0xffffff );

		return {
			group,
			update( dt, speed ) {

				animate( dt, speed );
				flash = Math.max( 0, flash - dt * 8 );
				shell.emissive.copy( white ).multiplyScalar( flash );
				shell.color.copy( base );

			},
			setFlash( t ) {

				flash = t;

			}
		};

	}

}

RobotGenerator.palettes = {
	red: { eye: 0xff3b4e, trim: 0xff3b4e }, // red glow
	violet: { eye: 0x14f195, trim: 0x9945ff }, // purple + green
	gold: { eye: 0x39ff88, trim: 0xd4af37, shell: 0x1a1a1e }, // obsidian and gold
	cyan: { eye: 0x35e0ff, trim: 0x35e0ff } // cyan glow
};

/**
 * Default parameters ( a palette from {@link RobotGenerator.palettes} overrides the colours ).
 *
 * @type {Object}
 */
RobotGenerator.defaults = {
	shell: 0x4a5160, // armour colour: gunmetal
	joint: 0x14161c,
	eye: 0xff2840, // sensor red
	trim: 0xff3fae // magenta trim: reads at distance at night
};

export { RobotGenerator };
