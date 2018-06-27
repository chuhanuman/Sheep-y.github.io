/* Run with "node --experimental-modules bt.mjs" */

import { loopJson, log, warn, DAG, DDAG, BR, newRow, td, tdr, tdv, tdh } from './bt_utils.mjs';
import { kilo, mil, plus, iff, sorter, sum, count } from './bt_utils.mjs';
import { getShops, starNotes } from './bt_shop.mjs';

const chassis = new Map(), mechs = new Map(), vehicles = new Map(), turrets = new Map(), movements = new Map();
let sortedMechs, sortedVehicles, sortedTurrets;

export function loadMechs( gears ) {

   return () => loopJson( "movement", ( e ) => {
      const id = e.Description.Id;
      if ( id ) movements.set( id, e );

   } ).then( () => loopJson( "chassis", ( e ) => {
      const id = e.Description.Id;
      if ( ! id ) return;
      e.Speed = movements.get( e.MovementCapDefID );
      chassis.set( id, e );

   } ) ).then( () => loopJson( "vehicleChassis", ( e ) => {
      const id = e.Description.Id;
      if ( ! id ) return;
      e.Speed = movements.get( e.MovementCapDefID );
      chassis.set( id, e );

   } ) ).then( () => loopJson( "turretChassis", ( e ) => {
      const id = e.Description.Id;
      if ( ! id ) return;
      chassis.set( id, e );

   } ) ).then( () => loopJson( "mech", ( data ) => {
      /* Load mech loadout and associate with chassis */
      const c = chassis.get( data.ChassisID ), loc = c.Locations;
      if ( ! c ) return warn( `Chassis not found: ${data.ChassisID}` );
      if ( data.MechTags.items.includes( "BLACKLISTED" ) && ! [ "HGN-732B", "AS7-D-HT" ].includes( c.VariantName ) ) return;
      const desc = c.Description = Object.assign( c.Description, data.Description );
      c.Name = desc.Name;
      c.simGameMechPartCost = data.simGameMechPartCost;
      c.Hardpoints = loc.reduce( getHardpoints, getHardpoints() );
      c.ArmsHardpoints = loc.filter( e => e.Location.endsWith( "Arm" ) ).reduce( getHardpoints, getHardpoints() );
      const canHalfTon = c.Tonnage < 60 /* Jump Jet (S) */ || c.Hardpoints['A'] /* S Laser */;
      c.Internal = sum( loc, e => e.InternalStructure );
      c.Parts = c.Locations.reduce( ( v, e ) => { v[ e.Location ] = e; return v; }, {} );
      for ( const location of data.Locations ) c.Parts[ location.Location ] = Object.assign( location, c.Parts[ location.Location ] );
      c.StockArmour = sum( data.Locations, e => e.AssignedArmor + Math.max( 0, e.AssignedRearArmor ) );
      c.MaxArmour = sum( loc, e => e.MaxArmor + Math.max( 0, e.MaxRearArmor ) );
      c.Payload = c.Tonnage - c.InitialTonnage;
      c.MaxArmourTon = Math.min( c.Payload, c.MaxArmour / 80 ); // CDA-2A has lower Payload than MaxArmour
      c.BestPayload = canHalfTon ? Math.ceil( ( c.Payload - c.MaxArmourTon ) * 2 ) / 2 : Math.ceil( c.Payload - c.MaxArmourTon );
      c.BestArmourTon = c.Payload - c.BestPayload;
      c.BestArmour = c.BestArmourTon * 80;
      c.Gears = data.inventory.map( e => gears.get( e.ComponentDefID ) ).filter( e => e );
      c.Dissipation = 30 + sum( c.Gears, e => e.DissipationCapacity || 0 );
      c.Cost = { Total: desc.Cost, Gear: sum( c.Gears, e => e.Description.Cost ),
                 StockArmour: c.StockArmour * 1000000 / 1600, BestArmour: c.BestArmour * 1000000 / 1600, Base: 0 };
      c.Cost.Base = c.Cost.Total - c.Cost.Gear - c.Cost.StockArmour;
      const result = Object.assign( data, c );
      mechs.set( desc.Id, result );
      gears.set( desc.Id, result )

   } ) ).then( () => loopJson( "vehicle", ( data ) => {

      let c = chassis.get( data.ChassisID ), loc = c.Locations;
      if ( ! c ) return warn( `Chassis not found: ${data.ChassisID}` );
      let desc = c.Description = Object.assign( c.Description, data.Description );
      c.Name = desc.Name;
      c.Internal = sum( loc, e => e.InternalStructure );
      c.StockArmour = sum( data.Locations, e => e.AssignedArmor );
      c.Gears = data.inventory.map( e => gears.get( e.ComponentDefID ) ).filter( e => e );
      c = Object.assign( data, c );
      vehicles.set( desc.Id, c );

   } ) ).then( () => loopJson( "turrets", ( data ) => {

      let c = chassis.get( data.ChassisID ), loc = c.Locations;
      if ( ! c ) return warn( `Chassis not found: ${data.ChassisID}` );
      let desc = c.Description = Object.assign( c.Description, data.Description );
      c.Name = desc.Name;
      c.Internal = c.MaxInternalStructure;
      c.StockArmour = data.AssignedArmor;
      c.Gears = data.inventory.map( e => gears.get( e.ComponentDefID ) ).filter( e => e );
      c = Object.assign( data, c );
      turrets.set( desc.Id, c );

   } ) ).then( () => {

      sortedMechs = Array.from( mechs.values() ).sort( sorter( "Tonnage", "-Speed.MaxWalkDistance", "MaxArmour", "Payload", "Description.UIName" ) );
      sortedVehicles = Array.from( vehicles.values() ).sort( sorter( "Tonnage", "-Speed.MaxWalkDistance", "Description.Name" ) );
      sortedTurrets = Array.from( turrets.values() ).sort( sorter( "StockArmour", "Description.Name" ) );

   } );
}

export function showMechs( callback ) {
   if ( callback ) return callback( sortedMechs, sortedVehicles, sortedTurrets );
   listMechs( "Light"  , sortedMechs.filter( e => e.Tonnage < 40 ) );
   listMechs( "Medium" , sortedMechs.filter( e => e.Tonnage >= 40 && e.Tonnage < 60 ) );
   listMechs( "Heavy"  , sortedMechs.filter( e => e.Tonnage >= 60 && e.Tonnage < 80 ) );
   listMechs( "Assault", sortedMechs.filter( e => e.Tonnage >= 80 ) );
   listMechCost( "Light"  , sortedMechs.filter( e => e.Tonnage < 40 ) );
   listMechCost( "Medium" , sortedMechs.filter( e => e.Tonnage >= 40 && e.Tonnage < 60 ) );
   listMechCost( "Heavy"  , sortedMechs.filter( e => e.Tonnage >= 60 && e.Tonnage < 80 ) );
   listMechCost( "Assault", sortedMechs.filter( e => e.Tonnage >= 80 ) );
   starNotes();
   listVehicles();
   listTurrets();
}

function listMechs( cls, list ) {
   log();log( cls + " Stats" );
   log( "|*-2 Mech|*-2 Model|*-2 Ton|*+2 Speed|*-2 Jets|*-2 HP|*+3 Armor|*+2 Payload (Ton)|*+4 Slots (Arms+Other) |*-2 Melee|*-2 DFA|" );
   log( `|* Walk|* Sprint|* Stock|* Top|* Max|* Total|* -Top|* Bal|* Ene|* Mis|* Sup|` );
   for ( const e of list ) {
      td ( e.Name, 12 );
      td ( e.VariantName, 9 );
      tdr( e.Tonnage, 3 );
      tdr( e.Speed.MaxWalkDistance, 3 );
      tdr( e.Speed.MaxSprintDistance, 3 );
      tdr( e.MaxJumpjets, 1 );
      /* Armour and Payload */
      tdr( e.Internal, 3 );
      tdr( e.StockArmour, 4 );
      tdr( e.BestArmour, 4 );
      tdr( e.MaxArmour, 4 );
      tdr( e.Payload, 4 );
      tdr( e.BestPayload, 4 );
      /* Attack and Gear */
      td( hardpoints( "B", e ), 8 );
      td( hardpoints( "E", e ), 8 );
      td( hardpoints( "M", e ), 8 );
      td( hardpoints( "A", e ), 8 );
      tdr( e.MeleeDamage, 3 );
      tdr( e.DFADamage * 2, 3 );
      newRow();
   }
   /* Footnotes */
   log();
   const conflict = " One of the hardpoint(s) is on the head, conflicting with cockpit modules";
   log( `: ${DAG}${conflict}.` );
   log( `: ${DDAG}${conflict} and another hardpoint.` );
}

export function listMechCost( cls, list ) {
   log();log( cls + " Cost" );
   log( `|*-2 Mech|*-2 Model|*-2 Campaign${BR}Price|*+3 PvP Cost|*+4 Config, Damage, and Alpha Heat|` );
   log( `|* Base|* Armored |* $/ton |* Stock |* 270m|* 450m|* Heat |` );
   for ( const e of list ) {
      const weapons = e.Gears.filter( e => ! [ 'HeatSink', 'AmmunitionBox', 'JumpJet' ].includes( e.ComponentType ) );
      const closeRange = weapons.filter( e => e.MaxRange > 90 && e.MaxRange <= 360 ), longRange = weapons.filter( e => e.MaxRange > 360 );
      tdv( e.Name, 12 );
      tdv( e.VariantName, 9 );
      if ( e.MechTags.items.includes( "BLACKLISTED" ) ) {
         tdr( "-", 6 ); tdr( "-", 6 ); tdr( "-", 6 ); tdr( "-", 5 );
      } else {
         tdr( kilo( e.simGameMechPartCost ), 6 );
         tdr( mil( e.Cost.Base ), 6 );
         tdr( mil( e.Cost.Base + e.Cost.BestArmour ), 6 );
         tdr( kilo( e.Cost.Base / e.Payload ), 5 );
      }
      tdh( getWeapons( e ), 48, 4 );
      newRow();
      tdh( getShops( e ), 110, 5 );
      tdr( sumWeapons( e, 'close' ), 3 );
      tdr( sumWeapons( e,  'long' ), 3 );
      tdr( plus( sum( weapons, e => e.HeatGenerated ) - e.Dissipation ), 4 );
      newRow();
   }
}

function listVehicles() {
   log();log( "Vehicles" );
   log( "|*-2 Vehicle|*-2 Ton|*+2 Speed|*-2 Weapons|*+2 Damage|*+4 HP/Armor |" );
   log( "|* Walk|* Sprint|* 270m|* 450m|* Front|* Side|* Rear|* Turret|" );
   for ( const e of sortedVehicles ) {
      const F = e.Locations.find( e => e.Location === 'Front' ), S = e.Locations.find( e => e.Location === 'Left'   ),
            R = e.Locations.find( e => e.Location === 'Rear'  ), T = e.Locations.find( e => e.Location === 'Turret' );
      td ( e.Name, 20 );
      tdr( e.Tonnage, 3 );
      tdr( e.Speed.MaxWalkDistance, 3 );
      tdr( e.Speed.MaxSprintDistance, 3 );
      td ( getWeapons( e ), 25 );
      tdr( sumWeapons( e, 'close' ), 3 );
      tdr( sumWeapons( e,  'long' ), 3 );
      td ( F ? F.InternalStructure + '/' + F.MaxArmor : '-', 7 );
      td ( S ? S.InternalStructure + '/' + S.MaxArmor : '-', 7 );
      td ( R ? R.InternalStructure + '/' + R.MaxArmor : '-', 7 );
      td ( T ? T.InternalStructure + '/' + T.MaxArmor : '-', 7 );
      newRow();
   }
}

function listTurrets() {
   log();log( "Turrets" );
   log( "|*-2 Turrets|*-2 Weapons|*+2 Damage|*-2 HP|*-2 Armor |" );
   log( "|* 270m|* 450m|" );
   for ( const e of sortedTurrets ) {
      td ( e.Name, 24 );
      td ( getWeapons( e ), 30 );
      tdr( sumWeapons( e, 'close' ), 3 );
      tdr( sumWeapons( e,  'long' ), 3 );
      td ( e.Internal, 3 );
      td ( e.StockArmour, 4 );
      newRow();
   }
}

function hardpoints( type, mech ) {
   const head = mech.Locations.filter( e => e.Location === "Head" )[0];
   const arms = mech.ArmsHardpoints[type], all = mech.Hardpoints[type];
   if ( all === 0 ) return "-";
   const count = ( arms ? `''${arms}''` : "0" ) + "+" + ( all - arms );
   if ( ! head || ! head.Hardpoints.length ) return count;
   const points = head.Hardpoints.map( e => e.WeaponMount[0] );
   if ( ! points.includes( type ) ) return count;
   return count + ( points.length <= 1 ? DAG : DDAG );
}

function getHardpoints( v, e ) {
   if ( ! v ) return { B: 0, E: 0, M: 0, A: 0 };
   if ( e.Hardpoints ) for ( const h of e.Hardpoints ) v[ h.WeaponMount[0] ]++;
   return v;
}

const weaponSorter = sorter( "e[0].includes('Jump Jet')", -1, 0 ); // Jumpjet goes last, then by quantity and name

function getWeapons( e ) {
   const config = count( e.Gears.filter( e => ! [ 'HeatSink', 'AmmunitionBox' ].includes( e.ComponentType ) ).map( e => e.Name ) );
   const txt = Array.from( config.entries() ).sort( weaponSorter ).map( e => e[1] > 1 ? `${e[1]}x ${e[0]}` : e[0] ).join( ", " );
   return txt.replace( /Jump Jet \([SHA]\)/, " Jets" );
}

function sumWeapons( e, range ) {
   let weapons = e.Gears.filter( e => ! [ 'HeatSink', 'AmmunitionBox', 'JumpJet' ].includes( e.ComponentType ) );
   if ( range === 'close' )
      weapons = weapons.filter( e => e.MaxRange > 90 && e.MaxRange <= 360 );
   else
      weapons = weapons.filter( e => e.MaxRange > 360 );
   return iff( sum( weapons, e => e.ShotsWhenFired * e.Damage ) )
}