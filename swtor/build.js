'use strict';
// Run this script with Node JS to generate ready to publish guides

var fs = require('fs');

fs.readFile( 'ac4_sage_sorc/_Balance_Madness.html', 'utf8', (err, data) => {
   if ( err ) throw err;

   data = build( trimData( data ) );

   fs.writeFile ( "ac4/balance.html", data, ( err ) => {
      if ( err ) throw err;
      console.log( "Balance guide built" );
   } );


   fs.writeFile ( "ac4/madness.html", convertToImp( data ), ( err ) => {
      if ( err ) throw err;
      console.log( "Madness guide built" );
   } );

} );

/* Removes whitespaces and comments */
function trimData( data ) {
   // Turns to one line
   data = data.replace( /\s*[\r\n]+\s*/g, '' );
   // Drop comments
   data = data.replace( /\/\*.*?\*\//g, '' ).replace( /<!--.*?-->/g, '' );
   // Drop spaces between and within tags
   data = data.replace( />\s+</g, '><' ).replace( / \/>/g, '/>' );
   // Minor trims
   data = data.replace( /  +>/g, ' ' );

   return data;
}


/* Adds ToC and expand list into details block */
function build ( data ) {

   // Convert list to <details>
   data = data.replace( /(<[ou]l class="desc)/g, '<details open><summary>Description</summary>$1' );
   data = data.replace( /(<[ou]l class="key)/g, '<details open><summary>Basics</summary>$1' );
   data = data.replace( /(<[ou]l class="use)/g, '<details open><summary>Usages</summary>$1' );
   data = data.replace( /(<[ou]l class="note)/g, '<details open><summary>Notes</summary>$1' );
   data = data.replace( /<\/ul>/g, '</ul></details>' );
   data = data.replace( /<\/ol>/g, '</ol></details>' );

   // Scan ToC, before headers are converted
   let tag, header = /<h(\d)[^>]*>([^<]+)<\/h\1>/g, hlist = [];
   while ( tag = header.exec( data ) ) hlist.push( tag[0] );

   // Convert each header to <details>
   let end = data.indexOf( "</article>" );
   for ( let hlv = 6 ; hlv >= 2 ; hlv-- ) {
      const hx = new RegExp( `<h${hlv}([^>]*)>(.*?)<\/h${hlv}>` ),
               next = new RegExp( "<(h[" + "654321".slice( 6-hlv ) + "]|/section|/article)" );
      while ( tag = hx.exec( data ) ) {
         const { 0: txt, index: pos } = tag, endPos = pos + txt.length + next.exec( data.slice( pos + txt.length ) ).index;
         //console.log( `${txt}: ${pos} to ${endPos} ${data.slice(pos,endPos)}` );
         data = data.slice( 0, endPos ) + "</details>" + data.slice( endPos );
         data = data.slice( 0, pos ) + `<details h="h${hlv}"${tag[1]} open><summary>${tag[2].trim()}</summary>` + data.slice( pos + txt.length );
      }
   }

   // Build ToC
   let level = 2, toc = '';
   const prop = / id="([^"]+)"/, text = />([^<]+)</;
   for ( let e of hlist ) {
      if ( e.startsWith( "<h1" ) ) continue;
      let lv = ~~/\d/.exec( e )[0], id = prop.exec( e ), title = text.exec( e )[1].trim();
      if ( ! id ) {
         id = title.toLowerCase().replace( /\W+/g, '_' );
         data = data.replace( e, `<h${lv} id="${id}">${title}</h${lv}>` );
      } else
         id = id[1];

      if ( lv === level )
         toc += `</li><li><a href="#${id}">${title}</a>`;
      else if ( lv > level )
         toc += `<ul><li><a href="#${id}">${title}</a>`;
      else if ( lv < level ) {
         toc += "</li>";
         while ( level-- > lv ) toc += "</ul></li>";
         toc += `<li><a href="#${id}">${title}</a>`;
      }
      level = lv;
   }
   toc = '<ul class="toc">' + toc.substr( 5 );
   while ( level-- >= 2 ) toc += "</li></ul>";

   // Tag replace
   data = data.replace( '<p class="TOC"></p>', toc );
   data = data.replace( '<time class="BUILD"><\/time>', '<time>' + new Date().toISOString().split( /T/ )[0] + '</time>' );

   // Count open and close tags
   const open = /<(\w+)(?![^>]*\/>)/g, close = /<\/(\w+)/g, tags = new Map();
   while ( tag = open.exec( data ) ) tags.set( tag[1], ~~tags.get( tag[1] ) + 1 );
   while ( tag = close.exec( data ) ) tags.set( tag[1], ~~tags.get( tag[1] ) - 1 );
   for ( const tag of tags ) if ( tag[1] ) console.warn( `Orphan ${tag[0]} ${tag[1]>0?'open':'close'} tag` );

   return data;
}

/* Turns pub side guide into imp side */
function convertToImp ( data ) {
   const map = [
      // Attacks
      "Telekinetic Throw", "Force Lightning",
      "Vanquish", "Demolish",
      "Sever Force", "Creeping Terror",
      "Weaken Mind", "Affliction",
      "Force in Balance", "Death Field",
      "Force Serenity", "Force Leach",
      "Disturbance", "Lightning Strike",
      "Project", "Shock",
      "Force Quake", "Force Storm",
      // Controls
      "Force Lift", "Whirlwind",
      "Force Stun", "Electrocute",
      "Force Wave", "Overload",
      "Lift", "Whirlwind",
      "Stun", "Electrocute",
      "Wave", "Overload",
      "Mind Snap", "Jolt",
      // Heals
      "Force Armor", "Static Barrier",
      "Force Mend", "Unnatural Preservation",
      "Rejuvenate", "Resurgense",
      "Benevolence", "Dark Heal",
      "Restoration", "Expunge",
      "Revival", "Reanimation",
      "Meditation", "Seethe",
      // Buff & Utils
      "Force Valor", "Mark of Power",
      "Mental Alacrity", "Polarity Shift",
      "Force Potency", "Recklessness",
      "Force Empowerment", "Unlimited Power",
      "Vindicate", "Consuming Darkness",
      "Force of Will", "Unbreakable Will",
      "Rescue", "Extrication",
      // Class
      "Jedi Consular", "Sith Inquisitor",
      "Balance Sage", "Madness Sorcerer",
      "Sage", "Sorcerer",
      "Seer", "Corruption",
      "Telekinetic", "Lightning",
      "Balance", "Madness",
      "Republic", "Imperial",
      // Short names
      "skittles", "lightnings"
   ];

   const dict = new Map(), rev = new Map(), list = [];
   for ( let i = 0, len = map.length ; i < len ; i += 2 ) {
      dict.set( map[i], map[i+1] );
      rev.set( map[i+1], map[i] );
      list.push( map[i] );
   }
   list.sort( (a,b) => {
      const al = a.length, bl = b.length;
      if ( al != bl ) return bl - al;
      return a > b ? 1 : ( a === b ? 0 : -1 );
   } );
   for ( let e of list ) {
      const regx = new RegExp( "\\b" + e + "\\b", 'g' );
      data = data.replace( regx, dict.get( e ) );
   }
   
   let counter = /[A-Za-z ]+ counterpart: [A-Za-z ]+/g, part, parts = new Set();
   while ( part = counter.exec( data ) ) parts.add( part[0].trim() );
   for ( let e of parts ) {
      part = e.split( " counterpart: " );
      data = data.replace( new RegExp( e, 'g' ), rev.get( part[0] ) + " counterpart: " + rev.get( part[1] ) );
   }

   return data;
}