import { loopJson, log, warn, kilo, sorter, joinComma } from './bt_utils.mjs';
import { planet_tag } from './bt_shop.mjs';

const events = [], tagMap = new Map();
let gears;

export function loadEvents( gearMap ) {
   gears = gearMap;

   return () => loopJson( "shipUpgrades", ( e ) => {

      for ( const tag of e.Tags.items )
         tagMap.set( tag, e.Description.Name );

   } ).then( () => loopJson( "events", ( e ) => {

      const { Requirements: r1, AdditionalRequirements: r2 } = e;
      let reqList = [];
      for ( const r of [r1].concat( r2 ) ) {
         const { RequirementTags: { items: white }, ExclusionTags: { items: black } } = r;
         switch ( r.Scope ) {
            case "Company":
               whitelist( "Company", white, reqList );
               blacklist( "Company", black, reqList );
               for ( const comp of r.RequirementComparisons )
                  reqList.push( parseCompany( comp, e ) );
               break;

            case "Commander":
               // check guard, loner, commander_underworldEnemies
               whitelist( "Commander", white, reqList );
               blacklist( "Commander", black, reqList );
               for ( const comp of r.RequirementComparisons )
                  reqList.push( parseMechWarrior( "Commander", comp, e ) );
               break;

            case "MechWarrior":
               break;

            case "StarSystem":
               whitelist( "Star", white, reqList );
               blacklist( "Star", black, reqList );
               if ( r.RequirementComparisons.length ) warn( "Planet comparison unimplemented." );
               break;

            default:
               console.warn( "Unknown scope: " + r.Scope );
         }
      }
      e.TextualRequirements = reqList.filter( e => e );
      events.push( e );
   } ) );
}

function whitelist( who, list, reqList ) {
   if ( ! list || ! list.length ) return;
   const text = list.map( translateTag ).filter( e => e );
   switch ( who ) {
      case "Company":
         for ( const e of text ) reqList.push( "Has " + e );
         break;
      case "Commander":
         for ( const e of text ) reqList.push( "Commander is " + e );
         break;
      case "Star":
         for ( const e of text ) reqList.push( "Planet is " + e );
         break;
      default:
         warn( "Unknown list subject: " + who );
   }
}

function blacklist( who, list, reqList ) {
   if ( ! list || ! list.length ) return;
   const text = list.map( translateTag ).filter( e => e );
   switch ( who ) {
      case "Company":
         for ( const e of text ) reqList.push( "No " + e );
         break;
      case "Commander":
         for ( const e of text ) reqList.push( "Commander is not " + e );
         break;
      case "Star":
         for ( const e of text ) reqList.push( "Planet is not " + e );
         break;
      default:
         warn( "Unknown list subject: " + who );
   }
}

function parseCompany( comp, e ) {
   const { obj, op, val } = comp;
   switch ( obj ) {
      case "MedTechSkill" : return parseCompareCond( "Med Level", comp );
      case "MechTechSkill": return parseCompareCond( "Tech Level", comp );
      case "ExpenseLevel" : return parseCompareCond( "Expense Level", comp );
      case "Funds" : return parseCompareCond( "C-Bills", comp, e => '$'+kilo( e ) );
      case "Morale": return parseCompareCond( "Morale", comp );
      case "Travel": return empty( op, val ) ? "Company is in orbit" : "Company is travelling";
      case "TaskDuration" : return nonEmpty( op, val ) ? "MechBay queue is not empty" : parseCompareCond( "MechBay queue", comp, "days" );
   }

   if ( obj.startsWith( "Reputation." ) ) {
      const faction = planet_tag( obj.substr( "Reputation.".length ) );
      return parseCompareCond( faction + " reputation", comp );
   }

   if ( obj.startsWith( "Item.WeaponDef." ) ) {
      const gear = gears.get( obj.substr( "Item.WeaponDef.".length ) );
      if ( nonEmpty( op, val ) )
         return "Has " + gear.Name + " in inventory";
      else
         return parseCompareCond( gear.Name, comp );
   }

   warn( `Unknown company condition: ${obj} (${e.Description.Id})` );
   return obj;
}

function parseMechWarrior( who, comp, e ) {
   const { obj, op, val } = comp;
   switch ( obj ) {
      case "Injuries" : return empty( op, val ) ? who+" is uninjured" : parseCompareCond( who +" injuries", comp );
   }
   warn( `Unknown mechwarrior condition: ${obj} (${e.Description.Id})` );
   return obj;
}

function empty( op, val ) {
   return op === "Equal" && val === 0;
}

function nonEmpty( op, val ) {
   if ( op === "NotEqual" && val === 0 ) return true;
   if ( op === "GreaterThan" && val === 0 ) return true;
   if ( op === "GreaterThanOrEqual" && val === 1 ) return true;
}

function parseCompareCond( name, comp, unit ) {
   let { obj, op, val, valueConstant } = comp;
   if ( String(val) === String(valueConstant) ) valueConstant = '';
   if ( unit && typeof( unit ) === 'string' ) val += " " + unit;
   else if ( unit ) val = unit( val );
   const v = valueConstant ? `${val} ${valueConstant}` : val;
   switch ( op ) {
      case "Equal":
         return `${name} is ${v}`;
      case "NotEqual":
         return `${name} not equals ${v}`;
      case "LessThan":
         return `${name} < ${v}`;
      case "LessThanOrEqual":
         return `${name} <= ${v}`;
      case "GreaterThanOrEqual":
         return `${name} >= ${v}`;
      case "GreaterThan":
         return `${name} > ${v}`;
   }
   warn( `Unknown op: ${op}` );
   return name;
}

function translateTag( tag ) {
   if ( tag === 'MODIFIED_STAT_MechTechSkill' ) return "temporary Tech Level modifier";
   if ( tag === 'MODIFIED_STAT_MedTechSkill' ) return "temporary Med Level modifier";
   if ( tag.startsWith( 'argo_' ) ) return "Argo Upgrade: " + tagMap.get( tag );
   if ( tag === 'commander_youth_merchantGuard' ) return "guard background";
   if ( tag.startsWith( 'commander_' ) ) return tag.replace( /^([^_]+_){2}/, '' ) + " background";
   if ( tag.startsWith( 'planet_' ) ) return planet_tag( tag );
   return `tag [${tag}]`;
}

export function showEvents() {
   for ( const e of events.sort( sorter( 'Description.Name', 'Description.Id' ) ) ) {
      const { Description: desc } = e;
      if ( e.TextualRequirements.length ) log( desc.Id + ": " + joinComma( e.TextualRequirements, "and" ) );
      //log();
      //log( `'''${desc.Name}''' (${desc.Id})` );
   }
}