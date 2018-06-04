import { loopJson, log, warn, kilo, sorter, joinComma } from './bt_utils.mjs';
import { keyword_translate } from './bt_shop.mjs';

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
         switch ( r.Scope ) {
            case "Company":
               const { RequirementTags: { items: white }, ExclusionTags: { items: black } } = r;
               whitelist( white, reqList );
               blacklist( black, reqList );
               for ( const comp of r.RequirementComparisons )
                  reqList.push( parseCompany( comp, e ) );
               break;

            case "Commander":
               break;

            case "MechWarrior":
               break;

            case "StarSystem":
               break;

            default:
               console.warn( "Unknown scope: " + r.Scope );
         }
      }
      e.TextualRequirements = reqList.filter( e => e );
      events.push( e );
   } ) );
}

function whitelist( list, reqList ) {
   if ( ! list || ! list.length ) return;
   for ( const e of list.map( translateTag  ).filter( e => e ) )
      reqList.push( "Has " + e );
}

function blacklist( list, reqList ) {
   if ( ! list || ! list.length ) return;
   for ( const e of list.map( translateTag ).filter( e => e ) )
      reqList.push( "No " + e );
}

function parseCompany( comp, e ) {
   const { obj, op, val } = comp;
   switch ( obj ) {
      case "MedTechSkill" : return parseCompareCond( "Med Level", comp );
      case "MechTechSkill": return parseCompareCond( "Tech Level", comp );
      case "ExpenseLevel" : return parseCompareCond( "Expense Level", comp );
      case "Funds" : return parseCompareCond( "C-Bills", comp, e => '$'+kilo( e ) );
      case "Morale": return parseCompareCond( "Morale", comp );

      case "Travel":
         if ( op === "Equal" && val === 0 )
            return "Company is in orbit";
         else if ( op === "NotEqual" && val === 0 )
            return "Company is travelling";
         else
            return warn( comp );

      case "TaskDuration" :
         if ( nonEmpty( op, val ) )
            return "MechBay queue is not empty";
         else
            return parseCompareCond( "MechBay queue", comp, "days" );
   }
   return "";

   if ( obj.startsWith( "Reputation." ) ) {
      const faction = keyword_translate( obj.substr( "Reputation.".length ) );
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

function nonEmpty( op, val ) {
   return ( op === "GreaterThan" && val === 0 ) || ( op === "GreaterThanOrEqual" && val === 1 );
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

function translateTag( tag, whitelist ) {
   if ( tag.startsWith( 'argo_' ) ) return "Argo Upgrade: " + tagMap.get( tag );
   if ( tag === 'MODIFIED_STAT_MechTechSkill' ) return "temporary Tech Level modifier";
   if ( tag === 'MODIFIED_STAT_MedTechSkill' ) return "temporary Med Level modifier";
   return `tag [${tag}]`;
}

export function showEvents() {
   for ( const e of events.sort( sorter( 'Description.Name', 'Description.Id' ) ) ) {
      const { Description: desc } = e;
      if ( e.TextualRequirements.length ) log( desc.Id + ": " + joinComma( e.TextualRequirements, "and" ) );
      //log();
      //log( `${desc.Name} (${desc.Id})` );
   }
}