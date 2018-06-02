import { log, loopJson, BR, ucfirst, unique, sorter } from './bt_utils.mjs';

let stars = [], inhabited = [], shops = [];

/* Given a Map of id => gear, create a "Shops" property on all sold items that is an array of shops. */
export function loadShops( gears ) {
   return  () => loopJson( "starsystem", ( e ) => stars.push( e )

   ).then( () => loopJson( "shops", ( e ) => shops.push( e )

   ) ).then( () => {

      stars.sort( sorter( "Description.Id" ) );
      inhabited = stars.filter( e => ! e.Tags.items.some( e => e === "planet_other_empty" || e === "planet_pop_none" ) );
      shops.sort( sorter( "ID" ) ).forEach( ( e ) => {

         /* Load shop list, find their stars, and set items */
         const { RequirementTags: white, ExclusionTags: black } = e;
         if ( white.items.includes( "debug" ) ) return;
         e.Stars = stars.filter( e => { const tags = e.Tags.items;
            return white.items.every( e => tags.includes( e ) )
              && ! black.items.find( e => tags.includes( e ) )
         } );

         if ( gears ) {
            for ( let id of e.Inventory.concat( e.Specials ).map( e => e.ID ) ) {
               const item = gears.get( id );
               if ( ! item ) return console.warn( `${id} not found` );
               if ( ! item.Shops ) item.Shops = [];
               item.Shops.push( e );
            }
         }
      } );

   } );
}

const sortLen = sorter( "length", "" );

export function listShops( callback ) {
   if ( ! callback ) return console.warn( "listShops must be used with callback" );
   callback( shops );
}

export function listStars( callback ) {
   if ( ! callback ) return console.warn( "listStars must be used with callback" );
   callback( stars );
}

export function getShops( item ) {
   if ( ! item.Shops ) return "None";
   // Multiple shops may end up in all stars
   let itemShops = new Set();
   for ( const shop of item.Shops )
      for ( const star of shop.Stars )
         itemShops.add( star );
   if ( itemShops.size >= inhabited.length ) return "Any stars.";
   // Consolidate shops by removing more narrow ones
   itemShops = item.Shops;
   for ( let i = itemShops.length-1 ; i >= 1 ; i-- )
      for ( let j = i-1 ; j >= 0 ; j-- ) {
         // Check whether shop a is wholely included by shop b
         const a = itemShops[i].Stars, b = itemShops[j].Stars;
         if ( b.length < a.length ) continue;
         if ( a.some( e => ! b.includes( e ) ) ) continue; // Abort if any a stars is not in b
         // Remove a and break out of inner loop
         itemShops.splice( i, 1 );
         j = -1;
      }
   return unique( itemShops.map( e => {
      let { RequirementTags: { items: white }, ExclusionTags: { items: black } } = e;
      const trail = `.`; // `. (${e.ID})`; // `. (${e.Stars.length} stars`;
      [ white, black ] = [ planet_keyword( white ), planet_keyword( black ) ];
      let simpleStars = "";
      if ( black.length ) {
         if ( black.includes( "Uninhabited" ) ) { black = black.filter( e => e !== "Uninhabited" ); } /* Uninhabited planets has no stores */
         if ( black.length === 2 && black.includes( "Post-Campaign Planet" ) && black.includes( "Campaign Planet" ) ) { 
            if ( ! white.includes( "Starter Planet" ) )
               white.push( "Starter Planet" ); 
            black = [];
         }
         if ( black.includes( "Starter Planet" ) ) { white.push( "Non-Starter" ); black = black.filter( e => e !== "Starter Planet" ); }
         if ( black.includes( "Campaign Planet" ) ) { white.push( "Non-Post-Campaign" ); black = black.filter( e => e !== "Campaign Planet" ); }
         if ( black.includes( "Post-Campaign Planet" ) ) { white.push( "Non-Campaign" ); black = black.filter( e => e !== "Post-Campaign Planet" ); }
      }
      if ( ! black.length ) simpleStars = "Planets";
      if ( white.length && simpleStars )
         return ( white.join( ", " ) + " " + simpleStars + trail ).replace( /Planets? Planets?/g, 'Planets' );
      else if ( white.length && black.length )
         return "Stars that are " + join( white, "and" ) + ", but not " + join( black, "or" ) + trail;
      else if ( white.length )
         return "Stars that are " + join( white, "and" ) + trail;
      else if ( black.length )
         return "Stars that are not " + join( black, "or" ) + trail;
      else
         return "Any stars.";
   } ) ).map( e => e.replace( /\) Planets.*$/, ')' ) ).sort( sortLen ).join( BR );
   //const stars = item.Shops.reduce( ( v, e ) => v.concat( e.Stars ), [] ).map( e => e.Description.Name );
   //return unique( stars ).join( ", " );
}

function ucword( words ) {
   return words.split( / +/g ).map( ucfirst ).join( ' ' );
}

export function planet_keyword ( list ) {
   return list.map( e => {
      if ( e.endsWith( "_flipped" ) ) return ucword( e.slice( 12, -8 ) ) + " (Restoration)";
      else if ( e.endsWith( "_contested" ) ) return ucword( e.slice( 12, -10 ) ) + " (Directorate)";
      e = e.replace( /^planet_(civ|climate|faction|industry|other)_/, '' );
      switch ( e ) {
         case "planet_progress_1": return "Starter Planet";
         case "planet_progress_2": return "Campaign Planet";
         case "planet_progress_3": return "Post-Campaign Planet";
         case "davion" : return "Fed.Sun";
         case "kurita" : return "Draconis";
         case "liao"   : return "Capellan";
         case "marik"  : return "F.W.League";
         case "steiner": return "Lyran";
         case "magistracy" : return "Canopus";
         case "innersphere": return "Inner Sphere";
         case "starleague" : return "Former Star League";
         case "blackmarket": return "Black Market";
         case "planet_pop_none":
         case "empty": return "Uninhabited";
         default: return ucword( e );
      }
   } ).sort();
}

export function starNotes () {
   function has( e, tags ) { return e.Tags.items.some( e => tags.includes( e ) ); }
   function all( e, tags ) { return tags.every( tag => e.Tags.items.includes( tag ) ); }
   const p1  = inhabited.filter( e => has( e, [ "planet_progress_1"  ] ) ).map( starsName ).sort(),
         p2  = inhabited.filter( e => has( e, [ "planet_progress_2"  ] ) ).map( starsName ).sort(),
         p2a = inhabited.filter( e => has( e, [ "planet_progress_2a" ] ) ).map( starsName ).sort(),
         p3  = inhabited.filter( e => has( e, [ "planet_progress_3"  ] ) ).map( starsName ).sort(),
         pX  = inhabited.filter( e => all( e, [ "planet_industry_manufacturing", "planet_civ_innersphere", "planet_industry_rich", "planet_industry_research", "planet_other_starleague" ] ) ).map( starsName ).sort();
   log( `: * Start Planets: ` + join( p1, "and" ) );
   log( `: * Inhabited Campaign Planets (${p2.length}): ` + join( p2, "and" ) );
   log( `: * Inhabited Taurian Planets: (${p2a.length}): ` + join( p2a, "and" ) );
   log( `: * Inhabited Post-Campaign Planets: (${p3.length}): ` + join( p3, "and" ) );
   log( `: * Former Star League, Inner Sphere, Manufacturing, Research, Rich Planets: ` + join( pX, "and" ) );
   /*log( "* Other Planets: " + stars.filter( e => ! e.Tags.items.some( e => e.startsWith( "planet_progress_" ) ) ).length + " other planets." );*/
}

export function starsName ( e ) {
   const desc = e.Description, id = desc.Id, tags = e.Tags.items;
   if ( id && id.endsWith( "_Flipped" ) ) return desc.Name + " (Restoration)";
   else if ( id && id.endsWith( "_Contested" ) ) return desc.Name + " (Directorate)";
   return desc.Name;
}

// join( [1,2,3], "and" ) => "1, 2 and 3"
export function join( val, word ) {
   if ( val.length > 2 )
      return val.slice( 0, -1 ).join( ", " ) + `, ${word} ` + val.slice( -1 );
   if ( val.length > 1 )
      return `${val[0]} ${word} ${val[1]}`;
   return val.join( ", " );
}