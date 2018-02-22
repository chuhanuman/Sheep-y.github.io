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
            if ( find( `#${new_id}` ) ) {
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
         for ( const [ id, e ] of dMap.entries() ) {
            console.log( e, id, id in state );
            e.open = !( id in state );
         }
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

})();