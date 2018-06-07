import { loopFolder, loopJson, log, warn, sorter, sum } from './bt_utils.mjs';

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
         if ( ! missions[ type ] ) missions[ type ] = [];
         missions[ type ].push( e );
      } );
   } );
}

export function showMissions() {
   const sort = sorter( 'contractName' );
   for ( const type of Object.keys( missions ).sort() ) {
      log(); log( '===' + type + '===' ); log();
      for ( const e of missions[ type ].sort( sort ) ) {
         log();
         log( "''" + e.contractName + "''" );
         log( "ID: " + e.ID + ", Difficulty: " + e.difficulty );
         const desc = render( e.shortDescription ).split( /(?=[.!?])/g );
         log( desc[0] + desc[1] + desc[2][0] );
         for ( const obj of e.objectiveList ) {
            const bonus = sum( obj.OnSuccessResults.filter( e => e.Stats ),
               e => sum( e.Stats.filter( e => e.name === "ContractBonusRewardPct" ), e => e.value ) );
            const bonusText = bonus ? " (+"+(bonus*100)+"%)" : "";
            log( ( obj.isPrimary ? "Main" : "Bonus" ) + " Objective: " + render( obj.title ) + bonusText );
         }
      }
   }
}

function render( text ) {
   text = text.replace( /\{TGT_SYSTEM\.[Nn]ame\}/g, "{This System}" );
   text = text.replace( /\{TEAM_TAR\.FactionDef\.(Name|Demonym)\}/g, "{Enemy}" );
   text = text.replace( /\{TEAM_EMP\.FactionDef\.(Name|Demonym)\}/g, "{Employer}" );
   return text;
}