import { loopJson, log, warn, kilo, sorter } from './bt_utils.mjs';
import { planet_keyword } from './bt_shop.mjs';

const events = [];
let gears;

export function loadEvents( gearMap ) {
   gears = gearMap;

   return () => loopJson( "events", ( e ) => {

      const { Requirements: r1, AdditionalRequirements: r2 } = e;
      let reqList = [];
      for ( const r of [r1].concat( r2 ) ) {
         switch ( r.Scope ) {
            case "Company":
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
      e.TextualRequirements = reqList.filter( e => e ).join( ", " );
      events.push( e );
   } );
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

      default:
         if ( obj.startsWith( "Reputation." ) ) {
            const faction = planet_keyword([ obj.substr( "Reputation.".length ).toLowerCase() ])[0];
            return parseCompareCond( faction + " reputation", comp );
         }
         if ( obj.startsWith( "Item.WeaponDef." ) ) {
            const gear = gears.get( obj.substr( "Item.WeaponDef.".length ) );
            if ( nonEmpty( op, val ) )
               return "Has " + gear.Name + " in inventory";
            else
               return parseCompareCond( gear.Name, comp );
         }
   }
   warn( `Unknown company condition: ${obj} (${e.Description.Id})` );
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
      default:
         log( op );
   }
}

export function showEvents() {
   for ( const e of events.sort( sorter( 'Description.Name', 'Description.Id' ) ) ) {
      const { Description: desc } = e;
      if ( e.TextualRequirements ) log( e.TextualRequirements );
      //log();
      //log( `${desc.Name} (${desc.Id})` );
   }

}