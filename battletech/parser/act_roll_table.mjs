/* Run with "node --experimental-modules act_roll_table.mjs" */

import { td, tdr, tdh, newRow, d2, sum, log } from './bt_utils.mjs';

const rollList = [ 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 18, 16, 14, 12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 ];
const modified = rollList.reduce( ( v, e ) => { v[ e ] = reverse_correction( e ); return v; }, {} );
const bonusList = [];

function correction( roll ) {
   return (Math.pow(1.6*roll-0.8,3)+0.5+roll)/2;
}

function correction2( roll, strength ) {
   strength /= 2;
   const revStr = 1-strength;
   return (Math.pow(1.6*roll-0.8,3)+0.5)*strength + roll*revStr;
}

function reverse_correction( target, strength ) {
   // Solving r for target = ((1.6r-0.8)^3+0.5+r)/2 where r = RNG roll, BattleTech.AttackDirector.AttackSequence.GetCorrectedRoll
   const e = target/100, a = Math.pow( 125*Math.sqrt( 13824*e*e - 13824*e + 3581 ) / ( 4096*Math.pow( 6, 3/2 ) ) + ( 250*e - 125 )/1024, 1/3 );
   return a - 125/(1536*a) + 0.5;
}

function reverse_correction2( target, strength ) {
   // Solving r for target = ((1.6r-0.8)^3+0.5)*(s/2)+r*(1-s/2)
   if ( strength === 0 ) return target;
   const t = target, t2 = t*t, s = strength, s2 = s*s, s3 = s2*s;
   const a = 125 * Math.sqrt( ( 13824*t2*s - 13824*t*s - 125*s3 + 750*s2 + 1956*s + 1000 ) / s );
   const b = Math.pow( a / ( 4096*Math.pow(6,3/2)*s ) + ( 250*t - 125 ) / ( 1024 * s ), 1/3 );
   return b + (125*s-250)/(1536*s*b) + 0.5;
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

// Miss breaker simulator - BattleTech.Team.ProcessRandomRoll
function recur( levelLeft, accuracy, stack ) { 'use strict'; // Make sure tail call can be optimised
   if ( levelLeft <= 0 ) {
      bonusList.length = 0;
      return sum( stack, ( e ) => sum( e, ( e, i ) => e * i ) / stack[0][0] );
   }
   const hit = modified[accuracy], miss = 1 - hit;
   if ( ! stack ) stack = [ [ levelLeft, hit ], [ miss ] ]; // no bonus: no 0 hit, hit% 1 hit. Bonus 1: miss% 0 hit
   else {
      const newStack = [ [ stack[0][0] ] ], noBonus = newStack[ 0 ];
      for ( let bonus = 0 ; bonus < stack.length ; bonus++ ) {
         const hitTable = stack[ bonus ];
         if ( ! hitTable ) continue;
         if ( ! bonusList[ bonus ] ) bonusList[ bonus ] = accuracy + ( accuracy - 50 ) * bonus / 5;
         const bonusAcc = bonusList[ bonus ];
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

const FrontHitTable = { "Head": 1, "CenterTorso": 16, "LeftTorso": 14, "RightTorso": 14, "LeftArm": 10, "RightArm": 10, "LeftLeg": 8, "RightLeg": 8 };
const FrontHeadTable = { "Head": 1, "CenterTorso": 16*4, "LeftTorso": 14*4, "RightTorso": 14*4, "LeftArm": 10, "RightArm": 10, "LeftLeg": 8, "RightLeg": 8 };

function GetHitLocationOrig ( hitTable, /*float*/ roll, bonusLocation, /*float*/ bonusMultiplier) {
   /* int */ let weightSum = 0, i = 0;
   for ( const [ location, weight ] of Object.entries( hitTable ) ) {
      if ( location === bonusLocation )
         weightSum += /* (int) float */ parseInt( weight * bonusMultiplier ); 
      else
         weightSum += /* int */ weight;
      log( `${location} bracket: ${weightSum}` );
   }
   const target = /* (int) float */ parseInt( roll * weightSum );
   for ( const [ location, weight ] of Object.entries( hitTable ) ) {
      if ( ! weight ) continue; // Skip locations that are impossible to hit
      if ( location === bonusLocation )
         i += /* (int) float */ parseInt( weight * bonusMultiplier );
      else
         i += weight;
      log( `${location} i: ${i}` );
      if ( i >= target ) {
         log( "Hit" );
         return location;
      }
   }
   return "None";
}

function ReverseHitLocation ( hitTable, bonusLocation, bonusMultiplier ) {
   let totalWeight = 0;
   for ( const weight of hitTable ) totalWeight += weight;
   if ( bonusLocation ) totalWeight += ( bonusMultiplier - 1 ) * hitTable[ bonusLocation ];

   const percPerWeight = 100/totalWeight;
   
   
}

function GetHitLocation ( hitTable, /*float*/ roll, bonusLocation, /*float*/ bonusMultiplier) {
   const scale = 1024;
   /* int */ let weightSum = 0, i = 0;
   for ( const [ location, weight ] of Object.entries( hitTable ) ) {
      if ( location === bonusLocation )
         weightSum += /* (int) float */ parseInt( weight * bonusMultiplier * scale ); 
      else
         weightSum += /* int */ weight * scale;
   }
   const target = /* (int) float */ parseInt( roll * weightSum );
   for ( const [ location, weight ] of Object.entries( hitTable ) ) {
      if ( ! weight ) continue; // Skip locations that are impossible to hit
      if ( location === bonusLocation )
         i += /* (int) float */ parseInt( weight * bonusMultiplier * scale );
      else
         i += weight * scale;
      if ( i >= target )
         return location;
   }
   return "None";
}


const data = { ... FrontHitTable };
//GetHitLocation( FrontHitTable, 0.02469, "", 0 );

/**
for ( const key in data ) data[ key ] = 0;
for ( let i = 0 ; i < 1000000 ; i++ )
   data[ GetHitLocation( FrontHitTable, i/1000000, "", 0 ) ]++;
log( data );

for ( const key in data ) data[ key ] = 0;
for ( let i = 0 ; i < 1000000 ; i++ )
   data[ GetHitLocation( FrontHeadTable, i/1000000, "Head", 2 ) ]++;
log( data );

for ( const key in data ) data[ key ] = 0;
for ( let i = 0 ; i < 1000000 ; i++ )
   data[ GetHitLocation( FrontHeadTable, i/1000000, "Head", 4.75 ) ]++;
log( data );

for ( const key in data ) data[ key ] = 0;
for ( let i = 0 ; i < 1000000 ; i++ )
   data[ GetHitLocation( FrontHeadTable, i/1000000, "Head", 18 ) ]++;
log( data );
*/