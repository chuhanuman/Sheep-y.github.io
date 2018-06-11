/* Run with "node --experimental-modules act_roll_table.mjs" */

import { td, tdr, tdh, newRow, d2, sum, log } from './bt_utils.mjs';

const rollList = [ 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 17, 15, 12, 10, 9, 8, 7, 6, 5, 4, 3, 2.4, 2, 1, 0 ];
const modified = rollList.reduce( ( v, e ) => { v[ e ] = reverse_correction( e ); return v; }, {} );

function reverse_correction( target ) {
   // Solving r for corected = ((1.6r-0.8)^3+0.5+r)/2 where r = RNG roll
   const e = target/100, a = Math.pow( 125*Math.sqrt( 13824*e*e - 13824*e + 3581 ) / ( 4096*Math.pow( 6, 3/2 ) ) + ( 250*e - 125 )/1024, 1/3 );
   return a - 125/(1536*a) + 0.5;
}

log( "|* Shown |* Real |* x2     |* x6     |* x20    |" );
for ( const roll of rollList ) {
   if ( roll >= 100 ) continue;
   tdr( roll + "%", 4 );
   tdr( perc( modified[ roll ] ), 7 );
   if ( roll > 50 ) {
      tdr( perc( recur( 2, roll ) ), 7 );
      tdr( perc( recur( 6, roll ) ), 7 );
      tdr( perc( recur( 20, roll ) ), 7 );
      //tdr( perc( recur( 500, roll ) ), 7 );
   } else {
      tdh( "-", 26, 3 );
   }
   newRow();
}

function perc( val ) {
   return d2( val * 100 ) + "%";
}

function recur( levelLeft, accuracy, stack ) { 'use strict'; // Make sure tail call can be optimised
   if ( levelLeft <= 0 )
      return sum( stack, ( e ) => sum( e, ( e, i ) => e * i ) / stack[0][0] );
   const hit = modified[accuracy], miss = 1 - hit;
   if ( ! stack ) stack = [ [ levelLeft, hit ], [ miss ] ]; // no bonus: no 0 hit, hit% 1 hit. Bonus 1: miss% 0 hit
   else {
      const newStack = [ [ stack[0][0] ] ], noBonus = newStack[ 0 ];
      for ( let bonus = 0 ; bonus < stack.length ; bonus++ ) {
         const hitTable = stack[ bonus ];
         if ( ! hitTable ) continue;
         const bonusAcc = accuracy + 5 * bonus;
         if ( bonusAcc < 100 && ! modified[ bonusAcc ] ) modified[ bonusAcc ] = reverse_correction( bonusAcc );
         const bonusHit = bonusAcc > 100 ? 1 : modified[ bonusAcc ], bonusMiss = 1 - bonusHit;
         for ( let hitCount = 0 ; hitCount < hitTable.length ; hitCount++ ) {
            const rate = hitTable[ hitCount ], newHit = hitCount + 1, newBonus = bonus + 1;
            if ( ! rate || ( bonus === 0 && hitCount === 0 ) ) continue;
            // Add hit, lost all bonus
            if ( ! noBonus[ newHit ] ) noBonus[ newHit ] = 0;
            noBonus[ newHit ] += rate * bonusHit;
            // Add miss
            if ( ! newStack[ newBonus ] ) newStack[ newBonus ] = [];
            newStack[ newBonus ][ hitCount ] = rate * bonusMiss;
         }
      }
      stack = newStack;
   }
   return recur( levelLeft-1, accuracy, stack );
}




