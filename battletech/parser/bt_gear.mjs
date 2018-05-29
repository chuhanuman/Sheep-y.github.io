/* Run with "node --experimental-modules bt.mjs" */

import { loopJson, log, newRow, td, tdr, tdh } from './bt_utils.mjs';
import { kilo, d1, plus, note, fixName, sorter } from './bt_utils.mjs';
import { getShops, starNotes } from './bt_shop.mjs';

let weapons = [], equipments = [], gears;

export function loadGears( gearMap ) {
   gears = gearMap;
   return  () => loadGearDir( "ammunitionBox", null )(

   ).then( loadGearDir( "heatsinks", e => [ e.BonusValueA || "Heat -${e.DissipationCapacity}", e.BonusValueB ] )
      
   ).then( loadGearDir( "jumpjets", null )
      
   ).then( loadGearDir( "upgrades/actuators", e => [ e.BonusValueA, e.BonusValueB ] )
      
   ).then( loadGearDir( "upgrades/cockpitMods", e => [ e.BonusValueA, e.BonusValueB ] )
      
   ).then( loadGearDir( "upgrades/gyros", e => [ e.BonusValueA, e.BonusValueB ] )
      
   ).then( loadGearDir( "upgrades/targetTrackingSystem", e => [ e.BonusValueA, e.BonusValueB ] )
      
   ).then( () => loopJson( "weapon", ( e ) => {
      // Load weapon data
      let { AccuracyModifier: acc, CriticalChanceMultiplier: crit } = e;
      classify( e );
      e.Name = fixName( e );
      e.Note = [];
      if ( e.Category === "AntiPersonnel" ) e.Category = "Support";
   //   if ( e.RefireModifier ) e.Note.push( `Recoil ${e.RefireModifier}` );
      if ( e.class === "los" ) e.Note.push( "LosTech" );
      if ( e.BonusValueA ) e.Note.push( note( e.BonusValueA ) );
      if ( e.BonusValueB ) e.Note.push( note( e.BonusValueB ) );
   //   if ( e.Category === "Energy" ) ++acc;
   //   acc = -acc;
   //   if ( acc ) e.Note.push( "Acc " + plus( acc ) );
   //   if ( crit !== 1 ) e.Note.push( `Crit ${plus(crit * 100 - 100)}%` );
   //   if ( e.IndirectFireCapable ) e.Note.push( "Indirect" );
      if ( e.AOECapable ) e.Note.push( "AoE" );
      if ( e.AmmoCategory !== "NotSet" ) {
         e.Shots = gears.get( `Ammo_AmmunitionBox_Generic_${e.AmmoCategory}` ).Capacity;
         const perBox = e.Shots / e.ShotsWhenFired, box12 = Math.ceil( 12 / perBox ), box30 = Math.ceil( 30 / perBox );
         e.DamagePer12ShotTon = ( e.Damage * e.ShotsWhenFired ) / ( e.Tonnage + box12 );
         e.DamagePer30ShotTon = ( e.Damage * e.ShotsWhenFired ) / ( e.Tonnage + box30 );
      } else {
         e.Shots = 0;
         e.DamagePerTon = ( e.Damage * e.ShotsWhenFired ) / ( e.Tonnage || NaN );
      }

      gears.set( e.Description.Id, e );
      weapons.push( e );

   } ) ).then( () => {

      // Sort by type, weight, name, rarity, and manufacturer
      weapons.sort( sorter( "{ B:0, E:1, M:2, S:3 }[e.Category[0]]", "Tonnage", "Name", "Description.Rarity", "Description.Manufacturer" ) );
      equipments.sort( sorter( "e.ComponentType", "Tonnage", "Name", "Description.Rarity", "Description.Manufacturer" ) );

   } );
}

function loadGearDir( path, note ) {
   return () => loopJson( path, ( e ) => {
      /* Load weapon data */
      e.Name = fixName( e );
      e.Note = note ? note( e ) : [];
      gears.set( e.Description.Id, e );
      classify( e );
      if ( e.class === "los" ) e.Note.push( "LosTech" );
      equipments.push( e );
   } );
}

function classify ( e ) {
   const buy = e.Description.Purchasable, tags = e.ComponentTags ? e.ComponentTags.items : [],
         stock = tags.includes( "component_type_stock" ), los = tags.includes( "component_type_lostech" );
   if ( los ) e.class = "los";
   else if ( buy && stock ) e.class = "stock";
   else if ( buy ) e.class = "rare";
   else e.class = "los";
}

//SRM4 = 2t, bin = 100, both shots = 1 bin, dpt = 32dmg over 3t
//SRM6 = 3t, bin = 100, 12 shots = 1 bin, 24 = 2 bin dpt = 48dmg over 4t / 48dmg over 5t

export function showWeapons() {
   listStockWeapons( "Stock Weapons", weapons.filter( e => e.class === "stock" ) );
   listRareWeapons( "Ballistic Weapons", weapons.filter( e => e.Category[0] === "B" ), "ammo" );
   listRareWeapons( "Energy Weapons" , weapons.filter( e => e.Category[0] === "E" ) );
   listRareWeapons( "Missile Weapons", weapons.filter( e => e.Category[0] === "M" ), "all" );
   listRareWeapons( "Support Weapons", weapons.filter( e => e.Category[0] === "S" ) );
}

function listStockWeapons ( title, list ) {
   log();log( title );
   log( "|*-2 Type|*-2 Weapon|*-2 Price|*-2 Ton|*+4 Damage|*+3 Range|*-2 Ammo|*-2 Heat|*+2 Damage/Ton|" );
   log( "|*+2 Raw|*+2 Stability|* Min|* Long|* Max|* 12x|* 30x|" );
   for ( const e of list ) {
      td( e.Category, 9 );
      td( e.Name, 7 );
      tdr( kilo( e.Description.Cost), 4 );
      tdr( e.Tonnage, 3 );
      dmg( e.Damage, e.ShotsWhenFired, 'multi' );
      dmg( e.Instability || e.HeatDamage, e.ShotsWhenFired, 'multi', e.HeatDamage ? " (H)" : "" );
      tdr( e.MinRange, 3 );
      tdr( e.RangeSplit[0], 3 );
      tdr( e.MaxRange, 3 );
      tdr( iff( e.Shots ), 3 );
      tdr( e.HeatGenerated, 2 );
      if ( e.DamagePer12ShotTon ) {
         tdr( d1( e.DamagePer12ShotTon ), 4 );
         tdr( d1( e.DamagePer30ShotTon ), 4 );
      } else
         tdh( d1( e.DamagePerTon ), 10 );
      newRow();
   }
}

function listRareWeapons ( title, list, option ) {
   const hasAll = option === "all", hasAmmo = hasAll || option === "ammo", multishot = hasAll || option === "multi";

   log();log( title );
   switch ( option ) {
      case "all":
         log( "|*-2 Weapon|*-2 Company|*-2 Notes|*-2 Price|*-2 Ton|*-2 Acc|*+4 Damage|*+3 Range|*-2 Ammo|*-2 Heat|* Damage/Ton|" );
         log( "|*+2 Raw|*+2 Stability|* Min|* Long|* Max|* 30x|" ); break;
      case "ammo":
         log( "|*-2 Weapon|*-2 Company|*-2 Notes|*-2 Price|*-2 Ton|*-2 Acc|*+2 Damage|*+3 Range|*-2 Ammo|*-2 Heat|* Damage/Ton|" );
         log( "|* Raw|* Stability|* Min|* Long|* Max|* 30x|" ); break;
      default:
         log( "|*-2 Weapon|*-2 Company|*-2 Notes|*-2 Price|*-2 Ton|*-2 Acc|*+2 Damage|*+3 Range|*-2 Heat|*-2 Damage/Ton|" );
         log( "|* Raw|* Stability|* Min|* Long|* Max|" ); break;
   }
   for ( const e of list ) {
      const { Description: desc } = e;
      td( e.Name, 11 );
      td( desc.Manufacturer, 17 );
      td( e.Note.filter( e => e ).join( ", " ), 22 );
      tdr( kilo(desc.Cost), 6 );
      tdr( e.Tonnage, 4 );
      tdr( acc( e.AccuracyModifier ), 4 );
      dmg( e.Damage, e.ShotsWhenFired, multishot );
      dmg( e.Instability || e.HeatDamage, e.ShotsWhenFired, multishot, e.HeatDamage ? " (H)" : "" );
      tdr( e.MinRange, 3 );
      tdr( e.RangeSplit[0], 3 );
      tdr( e.MaxRange, 3 );
      if ( hasAmmo ) tdr( iff( e.Shots ), 3 );
      tdr( e.HeatGenerated, 2 );
      tdr( d1( e.DamagePer30ShotTon || e.DamagePerTon ), 4 );
      newRow();
   }
   showWeaponsShops( title, list );
}

function showWeaponsShops ( title, list ) {
   log();log( title );
   log( "|* Weapon|* Company|* Notes|* Shop|" );
   for ( const e of list ) {
      td( e.Name, 11 );
      td( e.Description.Manufacturer, 17 );
      td( notes( e ), 22 );
      td( getShops( e ) );
      newRow();
   }
}

export function showGears() {
   listGears( "Stock gears", equipments.filter( e => e.class === "stock" ), 0 );
   listGears( "Rare gears", equipments.filter( e => e.class !== "stock" ), 1 );
}

function listGears ( title, list, rare ) {
   log();log( title );
   if ( rare )
      log( "|* Equipment|* Company|* Price|* Ton|* Effect|* Shop|" );
   else
      log( "|* Equipment|* Price|* Ton|* Effect|" );
   for ( const e of list ) {
      const { Description: desc } = e;
      td( e.Name, 14 );
      if ( rare ) td( desc.Manufacturer, 17 );
      tdr( kilo( desc.Cost ), 6 );
      tdr( e.Tonnage, 4 );
      td( notes( e ), 22 );
      if ( rare ) td( getShops( e ) );
      newRow();
   }
   if ( rare ) starNotes();
}

function iff( val ) {
   return val === 0 ? "-" : val;
}

function dmg( val, shot, multi = false, postfix = "" ) {
   const simple = val ? val + postfix : "-";
   if ( ! multi ) return tdr( simple, 4 );
   if ( val === 0 || shot === 1 ) return tdh( simple, 7 );
   return td( val + postfix + "x" + shot, 4 ) + td( ( val * shot ) + postfix, 3);
}

function acc( mod ) {
   return plus( -mod * 5 ) + "%";
}

function notes( e ) {
   return e.Note.map( note ).filter( e => e ).join( ", " );
}