'use strict';
// Run this script with Node JS to generate ready to publish guides

var fs = require('fs');

fs.readFile( 'ac4_sage_sorc/_Balance_Madness.html', 'utf8', (err, data) => {
   if ( err ) throw err;

   data = normalise( data );

   fs.writeFile ( "ac4/balance.html", build( convertToPub( data ) ), ( err ) => {
      if ( err ) throw err;
      console.log( "Balance guide built" );
   } );


   fs.writeFile ( "ac4/madness.html", build( convertToImp( data ) ), ( err ) => {
      if ( err ) throw err;
      console.log( "Madness guide built" );
   } );

} );

/* Removes whitespaces and comments, and convert list to details block */
function normalise ( data ) {
   // Turns to one line
   data = data.replace( /\s*[\r\n]+\s*/g, '' );
   // Drop comments
   data = data.replace( /\/\*.*?\*\//g, '' ).replace( /<!--.*?-->/g, '' );
   // Drop spaces between and within tags
   data = data.replace( />\s+</g, '><' ).replace( / \/>/g, '/>' );
   // Minor trims
   data = data.replace( /  +>/g, ' ' );

   // Fix multiline sentences
   data = data.replace( /\.(?=[A-Z])/g, '. ' );

   // Convert list to <details>
   data = data.replace( /(<[ou]l class="desc)/g, '<details open><summary>Description</summary>$1' );
   data = data.replace( /(<[ou]l class="key)/g, '<details open><summary>Basics</summary>$1' );
   data = data.replace( /(<[ou]l class="use)/g, '<details open><summary>Usages</summary>$1' );
   data = data.replace( /(<[ou]l class="note)/g, '<details open><summary>Notes</summary>$1' );
   data = data.replace( /(<[ou]l summary="([^"]+)")/g, '<details open><summary>$2</summary>$1' );
   data = data.replace( /<\/ul>/g, '</ul></details>' );
   data = data.replace( /<\/ol>/g, '</ol></details>' );
   
   return data;
}


/* Convert headers to details and build ToC */
function build ( data ) {
   const header = /<h(\d)([^>]*)>([^<]+)<\/h\1>/g, idProp = / id="([^"]+)"/;

   // Scan ToC, before headers are converted
   let tag, hlist = [];
   while ( tag = header.exec( data ) )
      if ( tag[1] !== "1" )
         hlist.push( tag );

   // Fill in id to all headers
   hlist = hlist.map( ([ header, lv, prop, title ]) => {
      let id = idProp.exec( prop );
      title = title.trim();
      if ( ! id ) {
         id = title.toLowerCase().replace( /\W+/g, '_' );
         data = data.replace( header, `<h${lv} id="${id}"${prop}>${title}</h${lv}>` );
      } else
         id = id[1];
      return [ lv, id, prop, title ];
   } );

   // Convert each header to <details>
   let end = data.indexOf( "</article>" );
   for ( let hlv = 6 ; hlv >= 2 ; hlv-- ) {
      const hx = new RegExp( `<h${hlv}([^>]*)>(.*?)<\/h${hlv}>` ),
               next = new RegExp( "<(h[" + "654321".slice( 6-hlv ) + "]|/section|/article)" );
      while ( tag = hx.exec( data ) ) {
         const { 0: txt, 1: props, 2: title, index: pos } = tag,
                  endPos = pos + txt.length + next.exec( data.slice( pos + txt.length ) ).index;
         //console.log( `${txt}: ${pos} to ${endPos} ${data.slice(pos,endPos)}` );
         data = data.slice( 0, endPos ) + "</details>" + data.slice( endPos );
         data = data.slice( 0, pos ) + `<details h="h${hlv}"${props} open><summary>${title.trim()}</summary>` + data.slice( pos + txt.length );
      }
   }

   // Put headers into tree structure
   let level = 2, current = [], hstack = [];
   for ( let [ lv, id, prop, title ] of hlist ) {
      if ( lv > level ) {
         hstack.push( current );
         current = current[ current.length - 1 ].subs = [];
      } else if ( lv < level ) {
         while ( level-- > lv ) current = hstack.pop();
      }
      current.push( { h: `<a href="#${id}"${prop}>${title}</a>`, subs: null } );
      level = lv;
   }
   while ( level-- > 2 ) current = hstack.pop();

   // Build ToC from tree
   function buildToC( item ) {
      if ( item.subs ) {
         let html = `<li><details open><summary>${item.h}</summary><ul>`;
         for ( const e of item.subs ) html += buildToC(e);
         return html + "</ul></details></li>";
      } else
         return `<li>${item.h}</li>`;
   }
   const toc = "<ul>" + current.map( buildToC ).join('') + "</ul>";

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

/* Turns pub side template into final form */
function convertToPub ( data ) {
   data = data.replace( /<(\w+) class="imp"[^>]*>.*?<\/\1>/, '' );
   return data;
}

/* Turns pub side template into imp form */
function convertToImp ( data ) {
   data = data.replace( /<(\w+) class="pub"[^>]*>.*?<\/\1>/, '' );

   const map = [];

   // Class
   map.push(
      "Jedi", "Sith",
      "Republic", "Imperial",
      "Jedi Consular", "Sith Inquisitor",          "sprite=\"jc-", "sprite=\"si-",
         "Sage", "Sorcerer",                       "sprite=\"sage", "sprite=\"sorc",
            "Seer", "Corruption",
            "Telekinetic", "Lightning",
            "Balance", "Madness",                  "Balance Sage", "Madness Sorcerer", "madness.html", "balance.html",
   );

   // Sage - Balance
   map.push(
      // Attacks
      "Telekinetic Throw", "Force Lightning",      "Vanquish", "Demolish",
      "Sever Force", "Creeping Terror",            "Weaken Mind", "Affliction",
      "Force in Balance", "Death Field",           "Force Serenity", "Force Leach",
      "Disturbance", "Lightning Strike",           "Project", "Shock",
      "Force Quake", "Force Storm",
      // Controls
      "Force Lift", "Whirlwind",                   "Force Stun", "Electrocute",
      "Force Wave", "Overload",                    "Mind Snap", "Jolt",
      // Heals
      "Force Armor", "Static Barrier",             "Force Mend", "Unnatural Preservation",
      "Rejuvenate", "Resurgense",                  "Benevolence", "Dark Heal",
      "Restoration", "Expunge",                    "Revival", "Reanimation",
      "Meditation", "Seethe",
      // Buff & Utils
      "Force Valor", "Mark of Power",              "Mental Alacrity", "Polarity Shift",
      "Force Potency", "Recklessness",             "Force Empowerment", "Unlimited Power",
      "Vindicate", "Consuming Darkness",           "Force of Will", "Unbreakable Will",
      "Rescue", "Extrication",
      // Skillful
      "Psychic Suffusion", "Force Suffusion",      "Jedi Resistance", "Sith Defiance",
      "Tectonic Master", "Tempest Mastery",        "Pain Bearer", "Empty Body",
                                                   "Benevolent Haste", "Dark Speed",
      // Masterful
      "Blockout", "Supression",                    "Mind Ward", "Corrupted Flest",
      "Valiance", "Dark Resilience",               "Confound", "Conspiring Force",
      "Telekinetic Defense", "Lightning Barrier",  "Staggering Stratagem", "Torturous Tactics",
      // Heroic
      "Egress", "Emersion",                        "Mental Defense", "Shapeless Spirit",
      "Metaphysical Alacrity", "Surging Speed",    "Kinetic Collapse", "Backlash",
      "Containment", "Haunted Dreams",             "Force Wake", "Electric Bindings",
      // Legendary
                                                   "Swift Rejuvenation", "Galvanizing Cleanse",
      "Life Ward", "Corrupted Barrier",            "Valorous Spirit", "Unnatural Vigor",
      "Ethereal Entity", "Shifting Silhouette",    "Impeding Slash", "Enfeebling Strike",
      // Short names
      "skittles", "lightnings" );

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
   
   let counter = /([A-Za-z ]+)( counterpart: (?:<a[^>]+>)?)([A-Za-z ]+)</g, part, parts = new Set();
   while ( part = counter.exec( data ) ) parts.add( part );
   for ( let [ whole, side, join, counter, close ] of parts )
      data = data.replace( new RegExp( whole.trim(), 'g' ), rev.get( side.trim() ) + join + rev.get( counter.trim() ) + "<" );

   return data;
}
