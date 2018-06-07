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
                  reqList.push( parseCompany( comp ) );
               break;

            case "Commander":
               // check guard, loner, commander_underworldEnemies
               whitelist( "Commander", white, reqList );
               blacklist( "Commander", black, reqList );
               for ( const comp of r.RequirementComparisons )
                  reqList.push( parseMechWarrior( "Commander", comp ) );
               break;

            case "StarSystem":
               whitelist( "Star", white, reqList );
               blacklist( "Star", black, reqList );
               if ( r.RequirementComparisons && r.RequirementComparisons.length )
                  warn( "Planet comparison unimplemented." );
               break;

            case "MechWarrior":
               mechwarrior( 'mw1', r, objects );
               break;

            case "SecondaryMechWarrior":
               mechwarrior( 'mw2', r, objects );
               break;

            case "TertiaryMechWarrior":
               mechwarrior( 'mw3', r, objects );
               break;

            case "SecondaryMech":
               if ( ! objects.mech2 ) objects.mech2 = [];
               if ( white ) warn( "Mech whitelist not implemented" );
               if ( black ) warn( "Mech blacklist not implemented" );
               if ( r.RequirementComparisons && r.RequirementComparisons.length )
                  warn( "Mech comparison unimplemented." );
               objects.mech2.push( "Any mech" );
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

function mechwarrior( key, r, objects ) {
   const white = r.RequirementTags ? r.RequirementTags.items : null,
         black = r.ExclusionTags   ? r.ExclusionTags.items : null;
   if ( ! objects[key] ) objects[key] = [];
   if ( white ) whitelist( "MechWarrior", white, objects[key] );
   if ( black ) blacklist( "MechWarrior", black, objects[key] );
   if ( r.RequirementComparisons )
      for ( const comp of r.RequirementComparisons )
         objects[key].push( parseMechWarrior( "", comp ) );
   if ( ! objects[key].length ) objects[key].push( "Any body" );
}


function whitelist( who, list, reqList = [] ) {
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
      case "Gain":
         for ( const e of text ) reqList.push( "+" + e );
         break;
      case "Star":
         for ( const e of text ) reqList.push( "Planet is " + e );
         break;
      default:
         warn( "Unknown list subject: " + who );
   }
   return reqList;
}

function blacklist( who, list, reqList = [] ) {
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
      case "Lost":
         for ( const e of text ) reqList.push( "-" + e );
         break;
      case "Star":
         for ( const e of text ) reqList.push( "Planet is not " + e );
         break;
      default:
         warn( "Unknown list subject: " + who );
   }
   return reqList;
}

function parseCompany( comp ) {
   const { obj, op, val } = comp;
   switch ( obj ) {
      case "MedTechSkill" : return parseCompareCond( "Medical", comp );
      case "MechTechSkill": return parseCompareCond( "MechTech", comp );
      case "ExpenseLevel" : return parseCompareCond( "Expense Level", comp ); // Spartan, Restrictive, Normal, Generous, Extravagant
      case "Funds" : return parseCompareCond( "Funds", comp, e => '$'+kilo( e ) );
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

   warn( `Unknown company condition: ${obj}` );
   return obj;
}

function parseMechWarrior( who, comp ) {
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
   warn( `Unknown mechwarrior condition: ${obj}` );
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

function parseResult( input ) {
   const results = [];
   input.forEach( e => {
      let result = [];
      switch ( e.Scope ) {
         case "Company":
         case "Commander":
         case "StarSystem":
            break;
         case "MechWarrior":
            if ( e.AddedTags.items   ) result.push( ...whitelist( "Gain", e.AddedTags.items   ).map( e => "John " + e ) );
            if ( e.RemovedTags.items ) result.push( ...blacklist( "Lost", e.RemovedTags.items ).map( e => "John " + e ) );
            break;
         case "SecondaryMechWarrior":
            if ( e.AddedTags.items   ) result.push( ...whitelist( "Gain", e.AddedTags.items   ).map( e => "Jane " + e ) );
            if ( e.RemovedTags.items ) result.push( ...blacklist( "Lost", e.RemovedTags.items ).map( e => "Jane " + e ) );
            break;
         case "TertiaryMechWarrior":
            if ( e.AddedTags.items   ) result.push( ...whitelist( "Gain", e.AddedTags.items   ).map( e => "Legion " + e ) );
            if ( e.RemovedTags.items ) result.push( ...blacklist( "Lost", e.RemovedTags.items ).map( e => "Legion " + e ) );
            break;
            //return parseMechWarrior( "{Legion}",  );
         case "SecondaryMech":
            break;
         default:
            warn( "Unknown result scope " + e.Scope );
            return result.push( e.Scope + " ???" );
      }
      if ( e.TemporaryResult ) result = result.map( txt => txt + ` (${e.ResultDuration} days)` );
      //if ( e.Stats ) warn( JSON.stringify( e.Stats ) );
      //if ( e.Actions ) warn( JSON.stringify( e.Actions ) );
      //if ( e.ForceEvents ) warn( JSON.stringify( e.ForceEvents ) );
      results.push( ...result );
   } );
   return results;
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
   log( ";format:gf-markup" );
   for ( const e of events.sort( sorter( 'Description.Name', 'Description.Id' ) ) ) {
      const { Description: desc } = e;
      log();
      log();
      line( `''${render(desc.Name)}''` );
      line( "Requirements: " + ( e.TextualRequirements ? joinComma( e.TextualRequirements, "and" ) + "." : "None" ) );
      if ( e.Objects.mw1 )
         line( "MechWarrior [John]: " + joinComma( e.Objects.mw1, "and" ) + "." );
      if ( e.Objects.mw2 )
         line( "MechWarrior [Jane]: " + joinComma( e.Objects.mw2, "and" ) + "." );
      if ( e.Objects.mw3 )
         line( "MechWarrior [Legion]: " + joinComma( e.Objects.mw3, "and" ) + "." );
      if ( e.Objects.mech2 )
         line( "Mech [Metal]: " + joinComma( e.Objects.mech2, "and" ) + "." );
      line( "Event ID: " + desc.Id );
      line( render( desc.Details.split( /[\r\n]+/ ).slice( 0, 2 ).join( " " ) ) );
      e.Options.forEach( ( opt, i ) => {
         log( ":" + (i+1) + ". " + render( opt.Description.Name ) );
         for ( const result of opt.ResultSets ) {
            log( "::" + result.Weight + "% " + joinComma( parseResult( result.Results ), "and" ) );
         }
      } );
   }
}

function line( text ) {
   log( text + "<br>" );
}

function render ( text ) {
   if ( text.includes( "<" ) )
      text = text.replace( /<\/?\w+>/g, '' );
   if ( text.includes( "[[" ) )
      text = text.replace( /\[\[[^,]+,(.*?)\]\]/g, '$1' );
   if ( text.includes( "DM.WeaponDefs" ) )
      text = text.replace( /\{DM\.WeaponDefs\[Weapon_[^_]+_(.*?)\]\.Description\.Name\}/g, '{$1}' );

   text = text.replace( /\{TGT_SYSTEM.Name\}/g, "{This Star}" );

   if ( text.includes( "COMMANDER" ) ) {
      text = text.replace( /\{COMMANDER.(FirstName|Callsign)\}/, "{Commander}" );
      text = text.replace( /\{COMMANDER.Obj\}/, "{Commander}" );
   }

   if ( text.includes( "TGT_MW" ) ) {
      text = text.replace( /\{TGT_MW\.(Firstname|Callsign)\}/ig, '{John}' );
      text = text.replace( /\{TGT_MW\.DET\}/ig, 'his' );
      text = text.replace( /\{TGT_MW\.OBJ\}/ig, 'him' );
      text = text.replace( /\{TGT_MW\.REFL\}/ig, 'himself' );
      text = text.replace( /\{TGT_MW\.SUBJ\}/ig, 'he' );
      text = text.replace( /\{TGT_MW\.SUBJ_C\}/ig, 'He' );
      text = text.replace( /\{TGT_MW.Gender\?Male:(.*?)\|Female:(.*?)\|NonBinary:(.*?)\}/g, "$1" );
      text = text.replace( /\{TGT_MW.Gender\?NonBinary:(.*?)\|Default:(.*?)\}/g, "$2" );
   }

   if ( text.includes( "SCN_MW" ) ) {
      text = text.replace( /\{SCN_MW\.(Firstname|Callsign)\}/ig, '{Jane}' );
      text = text.replace( /\{SCN_MW\.DET\}/ig, 'her' );
      text = text.replace( /\{SCN_MW\.OBJ\}/ig, 'her' );
      text = text.replace( /\{SCN_MW\.REFL\}/ig, 'herself' );
      text = text.replace( /\{SCN_MW\.SUBJ\}/ig, 'She' );
      text = text.replace( /\{SCN_MW\.SUBJ_C\}/ig, 'She' );
      text = text.replace( /\{SCN_MW.Gender\?Male:(.*?)\|Female:(.*?)\|NonBinary:(.*?)\}/g, "$2" );
      text = text.replace( /\{SCN_MW.Gender\?NonBinary:(.*?)\|Default:(.*?)\}/g, "$2" );
   }

   if ( text.includes( "TRT_MW" ) ) {
      text = text.replace( /\{TRT_MW\.(Firstname|Callsign)\}/ig, '{Legion}' );
      text = text.replace( /\{TRT_MW\.DET\}/ig, 'their' );
      text = text.replace( /\{TRT_MW\.OBJ\}/ig, 'their' );
      text = text.replace( /\{TRT_MW\.REFL\}/ig, 'themselves' );
      text = text.replace( /\{TRT_MW\.SUBJ\}/ig, 'them' );
      text = text.replace( /\{TRT_MW\.SUBJ_C\}/ig, 'Them' );
      text = text.replace( /\{TRT_MW.Gender\?Male:(.*?)\|Female:(.*?)\|NonBinary:(.*?)\}/g, "$3" );
      text = text.replace( /\{TRT_MW.Gender\?NonBinary:(.*?)\|Default:(.*?)\}/g, "$1" );
   }

   if ( text.includes( "SCN_UNIT" ) ) {
      text = text.replace( /\{SCN_UNIT.Name\}/g, "{Metal}" );
   }


   return text;
}