import { loopFolder, loopJson, log, warn, sorter, sum, joinComma } from './bt_utils.mjs';

const missions = {};
const missionType = {
   EscortSingle: "Escort",
   SimpleBattle: "Battle",
   Assassinate: "Assassinate",
   DestroyBase: "Base Destroy",
   Rescue: "Rescue",
   AmbushConvoy: "Ambush",
   CaptureBase: "Base Capture",
   CaptureEscort: "Escort",
   DefendBase: "Base Defend"
};

export function loadMissions() {
   return () => loopFolder( "contracts", ( e ) => {
      return loopJson( "contracts/"+e, ( e ) => {
         if ( ! e.ID || ! e.shortDescription ) return;
         if ( e.ID.startsWith( "Story" ) || e.ID.endsWith( "_Template" ) || e.ID.endsWith( "_Default" ) ) return;
         const type = missionType[ e.contractType ];
         if ( ! type ) return;

         const reqText = [];
         for ( const req of e.requirementList )
            reqText.push( parseReq( req ) );
         e.requirementText = joinComma( reqText, "and" );

         e.minSkulls = Math.max( 0.5, (e.difficulty-2)/2 );
         e.maxSkulls = (e.difficulty+2)/2;

         for ( const obj of e.objectiveList ) {
            obj.bonus = sum( obj.OnSuccessResults.filter( e => e.Stats ), // Sum each result, after...
               e => sum( e.Stats.filter( e => e.name === "ContractBonusRewardPct" ), e => e.value ) ); // ...sum each stats
            obj.isTrigger = ! obj.isPrimary && ! obj.bonus;
         }

         if ( ! missions[ type ] ) missions[ type ] = [];
         missions[ type ].push( e );
      } );
   } );
}

function parseReq ( req ) {
   switch ( req.Scope ) {
      case "StarSystem":
         //log( req );
         break;
      case "Company":
         //log( req );
         break;
      default:
         warn( req.Scope );
   }
}

export function showMissions() {
   const msort = sorter( 'difficulty', 'contractName' ), osort = sorter( '-bonus' );
   for ( const type of Object.keys( missions ).sort() ) {
      log(); log( '===' + type + '===' );
      for ( const e of missions[ type ].sort( msort ) ) {
         log();
         log( "''" + e.contractName + "''" );

         //if ( e.requirementList.length ) log( JSON.stringify( e.requirementList ) );
         //continue;

         const desc = render( e.shortDescription ).split( /(?=[.!?])/g );
         log( desc[0] + desc[1] + desc[2][0] );

         log( `ID: ${e.ID}, ${e.minSkulls} to ${e.maxSkulls} skulls` );
         const bonusList = e.objectiveList.filter( e => e.bonus ).sort( osort );
         if ( bonusList.length )
            for ( const obj of bonusList )
               log( "Bonus Objective: " + objective( obj.title ) + " (+"+(obj.bonus*100)+"%)" );
         else
            log( "No Bonus Objective" );
      }
   }
}

function render( text ) {
   text = text.replace( /\{TGT_SYSTEM\.[Nn]ame\}/g, "{This System}" );
   text = text.replace( /\{TEAM_TAR\.FactionDef\.[^}]+\}/g, "{Opposer}" );
   text = text.replace( /\{TEAM_EMP\.FactionDef\.[^}]+\}/g, "{Employer}" );
   return text;
}

function objective( text ) {
   return render( text ).replace( /\{Opposer\}/g, 'OpFor' ).replace( /\{Employer\}/g, 'Ally' );
}