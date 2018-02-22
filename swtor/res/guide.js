(function(){ 'use strict';

   // Load page config
   const { spec, specMirror, baseClassAbbr, baseClassMirrorAbbr, baseClassMirror, advClassMirror } = guide_config;

   // Restore open/close state and save state on change
   try {
      // Make sure all details has an id
      const dMap = new Map();
      for ( const e of iterElem( "#toc ~ details, #toc ~ * details" ) ) {
         if ( ! e.id ) {
            const new_id = e.closest( "[id]" ).id + "-" + idify( find( e, "summary" ).textContent );
            if ( document.getElementById( new_id ) ) {
               console.warn( `Conflicting id: #${new_id}` );
               continue;
            }
            e.id = new_id;
         }
         dMap.set( e.id, e );
      }
      // Load state
      let state = {}, saveKey = `sheepy.${spec}.openCloseState`, saved = localStorage.getItem( saveKey );
      if ( saved ) {
         state = JSON.parse( saved );
         for ( const id in state )
            if ( ! dMap.has( id ) ) 
               delete state[ id ];
         for ( const [ id, e ] of dMap.entries() )
            e.open = !( id in state );
      } else {
         for ( const [ id, e ] of dMap.entries() )
            if ( ! e.open )
               state[ id ] = 0;
      }
      // Save state on change
      let saveTimer = 0;
      document.body.addEventListener( "toggle", ( evt ) => {
         const target = evt.target, id = target.id;
         if ( target.open ) delete state[ id ];
         else state[ id ] = 0;
         if ( saveTimer ) return;
         saveTimer = setTimeout( () => {
            localStorage.setItem( saveKey, JSON.stringify( state ) );
            saveTimer = 0;
         }, 1000 );
      }, { capture: true, passive: true } );
   } catch ( err ) {
      console.warn( "Cannot load open/close state.", err );
   }

   // Link to abilities, utilities, and glossaries
   try {
      const links = [], tail = "\\b(?![^<>]*>)";
      for ( const e of iterElem( "#abilities details[h=h4], #utilities details[h=h4]" ) ) {
         const id = e.id,  sprite = e.dataset.sprite,  title = find( e, 'summary' ).textContent.trim();
         links.push( [ id, new RegExp( title + tail, 'g' ), `<a class="auto" href="#${id}" data-sprite="${sprite}">${title}</a>` ] );
      }
      for ( const e of iterElem( "#glossary dt" ) ) {
         e.id = idify( e.textContent );
         let pattern = e.dataset.regexp || e.textContent.trim();
         if ( pattern.match( /^[A-Z][a-z]+$/ ) ) pattern = "[" + pattern[0] + pattern[0].toLowerCase() + "]" + pattern.slice( 1 );
         links.push( [ e.id, new RegExp( `\\b(${pattern})${tail}`, 'g' ), `<a class="glossary" href="#${e.id}">$1</a>` ] );
      }
      links.sort( revLenSort );
      // Convert text to link
      for ( const e of iterElem( "#toc ~ * ul, ol, dd" ) ) {
         let html = e.innerHTML,  changed = '';
         let ignore = e.tagName == 'DD' ? e.previousElementSibling.id : e.parentElement.parentElement.id;
         for ( const [ id, from, to ] of links ) {
            if ( id === ignore || ! html.match( from ) ) continue;
            changed = html = html.replace( from, to );
         }
         if ( ! changed ) continue;
         e.innerHTML = html;
      }
   } catch ( err ) {
      console.warn( "Cannot create intra-links.", err );
   }

   // Build counterparts
   try {
      xhr( specMirror + ".html", { responseType: "document" } ).then( ( req ) => {
         const advClassMirrorAbbr = advClassMirror.substr( 0, 4 ).toLowerCase();
         const counterparts = findAll( req.response, '#abilities details[h="h4"] > summary, #utilities details[h="h4"] > summary' )

         iterElem( '#abilities details[h="h4"], #utilities details[h="h4"]' ).forEach( ( section, i ) => {
            let mirror = advClassMirrorAbbr, mirrorText = advClassMirror, mirrorName = norm( counterparts[i].textContent ), id = idify( mirrorName );
            if ( mirrorName === norm( find( section, 'summary' ).textContent ) ) return; // Skip if same name
            if ( section.dataset.sprite.startsWith( baseClassAbbr ) )
               [ mirror, mirrorText ] = [ baseClassMirrorAbbr, baseClassMirror ];
            const link = `<a href="${specMirror}.html#${id}" data-sprite="${mirror}${section.dataset.sprite.slice(mirror.length)}">`;
            section.lastChild.lastChild.insertAdjacentHTML( 'beforeend', `<li>${mirrorText} counterpart: ${link}${mirrorName}</a></li>` );
         } );
      } );
   } catch ( err ) {
      console.warn( "Cannot read counterparts.", err );
   }

   find( 'body' ).classList.add( 'js' ); // Mark document as supporting js

   function norm ( text ) {
      return text.replace( /\([^)]+\)/, '' ).trim();
   }

   function idify ( text ) {
      return norm( text ).toLowerCase().replace( /\W+/g, "_" );
   }

   function revLenSort (a,b) {
      const al = a.length, bl = b.length;
      if ( al != bl ) return bl - al;
      return a > b ? 1 : ( a === b ? 0 : -1 );
   }

})();