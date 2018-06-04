import { loopJson, log, warn, kilo, ucfirst, ucword, sorter, joinComma } from './bt_utils.mjs';
import { planet_tag } from './bt_shop.mjs';

const events = [], tagMap = new Map();
let gears;

export function loadEvents( gearMap ) {
   gears = gearMap;

   return () => loopJson( "shipUpgrades", ( e ) => {

      for ( const tag of e.Tags.items )
         tagMap.set( tag, e.Description.Name );

   } ).then( () => loopJson( "events", ( e ) => {

      const { Requirements: r1, AdditionalRequirements: r2, AdditionalObjects: r3 } = e;
      let reqList = [], objects = [], mwCount = 0;
      const req = [r1].concat( r2 ).concat( r3 ).filter( e => e );

      for ( const r of req ) {
         const white = r.RequirementTags ? r.RequirementTags.items : null,
               black = r.ExclusionTags   ? r.ExclusionTags.items : null;
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

            case "StarSystem":
               whitelist( "Star", white, reqList );
               blacklist( "Star", black, reqList );
               if ( r.RequirementComparisons.length ) warn( "Planet comparison unimplemented." );
               break;

            case "MechWarrior":
               mechwarrior( 'mw1', r, objects, e );
               break;

            case "SecondaryMechWarrior":
               mechwarrior( 'mw2', r, objects, e );
               break;

            case "TertiaryMechWarrior":
               mechwarrior( 'mw3', r, objects, e );
               break;

            case "SecondaryMech":
               if ( ! objects.mech2 ) objects.mech2 = [];
               //log( r );
               break;

            default:
               console.warn( "Unknown scope: " + r.Scope );
         }
      }
      reqList = reqList.filter( e => e )
      e.TextualRequirements = reqList.length ? reqList : null;
      e.Objects = objects;
      events.push( e );
   } ) );
}

function mechwarrior( key, r, objects, e ) {
   const white = r.RequirementTags ? r.RequirementTags.items : null,
         black = r.ExclusionTags   ? r.ExclusionTags.items : null;
   if ( ! objects[key] ) objects[key] = [];
   if ( white ) whitelist( "MechWarrior", white, objects[key] );
   if ( black ) blacklist( "MechWarrior", black, objects[key] );
   if ( r.RequirementComparisons )
      for ( const comp of r.RequirementComparisons )
         objects[key].push( parseMechWarrior( "", comp, e ) );
   if ( ! objects[key].length ) objects[key].push( "Anyone" );
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
      case "MechWarrior":
         for ( const e of text ) reqList.push( "Is " + e );
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
      case "MechWarrior":
         for ( const e of text ) reqList.push( "Is not " + e );
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
   const { obj, op, val } = comp, your = who ? `${who}'s ` : '';
   switch ( obj ) {
      case "Injuries" :
         if ( who )
            return empty( op, val ) ? who + " is uninjured" : parseCompareCond( who +" injuries", comp );
         else
            return empty( op, val ) ? "Is uninjured" : parseCompareCond( "Injuries", comp );
      case "Gunnery"  : return parseCompareCond( your+"Gunnery", comp );
      case "Piloting" : return parseCompareCond( your+"Piloting", comp );
      case "Gut"      : return parseCompareCond( your+"Gut", comp );
      case "Tactic"   : return parseCompareCond( your+"Tactic", comp );
      case "ExperienceSpent" : return parseCompareCond( ucfirst( your+"spent experience" ), comp );
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
   if ( tag.startsWith( 'pilot_' ) ) return ucword( tag.substr( 6 ).replace( /_+/g, ' ' ) );
   return `tag [${tag}]`;
}

export function showEvents() {
   for ( const e of events.sort( sorter( 'Description.Name', 'Description.Id' ) ) ) {
      const { Description: desc } = e;
      log();
      log( `'''${desc.Name}'''` );
      log( "Requirements: " + ( e.TextualRequirements ? joinComma( e.TextualRequirements, "and" ) + "." : "None" ) );
      if ( e.Objects.mw1 ) {
         const str = e.Objects.mw2 ? "MechWarrior [John]" : "MechWarrior";
         log( "Random " + str + ": " + joinComma( e.Objects.mw1, "and" ) + "." );
      }
      if ( e.Objects.mw2 )
         log( "Random MechWarrior [Jane]: " + joinComma( e.Objects.mw2, "and" ) + "." );
      if ( e.Objects.mw3 )
         log( "Random MechWarrior [Legion]: " + joinComma( e.Objects.mw3, "and" ) + "." );
      if ( e.Objects.mech2 )
         log( "Random Mech [Metal]: " + joinComma( e.Objects.mech2, "and" ) + "." );
      log( "Event ID: " + desc.Id );
      log( "First paragraph: " + render( desc.Details.split( /\n/ )[0] ) );
   }
}

function render ( text ) {
   text = text.replace( /<\/?\w+>/g, '' );

   text = text.replace( /\{TGT_SYSTEM.Name\}/g, "[This Star System]" );

   text = text.replace( /\{COMMANDER.FirstName\}/, "Commander" );

   text = text.replace( /\[\[TGT_MW,\{TGT_MW.Callsign\}\]\]/ig, '[John]' );
   text = text.replace( /\{TGT_MW\.(Firstname|Callsign)\}/ig, '[John]' );
   text = text.replace( /\{TGT_MW\.DET\}/ig, 'his' );
   text = text.replace( /\{TGT_MW\.OBJ\}/ig, 'him' );
   text = text.replace( /\{TGT_MW\.SUBJ\}/ig, 'he' );
   text = text.replace( /\{TGT_MW\.SUBJ_C\}/ig, 'He' );
   text = text.replace( /\{TGT_MW.Gender\?Male:(.*?)\|Female:(.*?)\|NonBinary:(.*?)\}/g, "$1" );
   text = text.replace( /\{TGT_MW.Gender\?NonBinary:(.*?)\|Default:(.*?)\}/g, "$2" );

   text = text.replace( /\[\[SCN_MW,\{SCN_MW.Callsign\}\]\]/ig, '[Jane]' );
   text = text.replace( /\{SCN_MW\.(Firstname|Callsign)\}/ig, '[Jane]' );
   text = text.replace( /\{SCN_MW\.DET\}/ig, 'her' );
   text = text.replace( /\{SCN_MW\.OBJ\}/ig, 'her' );
   text = text.replace( /\{SCN_MW\.SUBJ\}/ig, 'She' );
   text = text.replace( /\{SCN_MW\.SUBJ_C\}/ig, 'She' );
   text = text.replace( /\{SCN_MW.Gender\?Male:(.*?)\|Female:(.*?)\|NonBinary:(.*?)\}/g, "$2" );
   text = text.replace( /\{SCN_MW.Gender\?NonBinary:(.*?)\|Default:(.*?)\}/g, "$2" );

   return text;
}