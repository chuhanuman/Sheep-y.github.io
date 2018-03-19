(function(){ 'use strict';

   // Load page config
   const { spec, specMirror, baseClassAbbr, baseClassMirrorAbbr, baseClassMirror, advClassMirror } = guide_config;

   // Restore open/close state and save state on change
   try {
      // Make sure all details has an id
      const dMap = new Map(), tabSet = new Set();
      for ( const e of iterElem( "#toc ~ details, #toc ~ * details" ) ) {
         if ( ! e.id ) {
            const new_id = e.closest( "[id]" ).id + "-" + idify( find( e, "summary" ).textContent );
            if ( document.getElementById( new_id ) ) {
               console.warn( `Conflicting id: #${new_id}` );
               continue;
            }
            e.id = new_id;
         }
         if ( isLeaf( e ) )
            tabSet.add( e.parentElement );
         dMap.set( e.id, e );
      }
      // Load state
      let state = {}, saveKey = `sheepy.${spec}.openCloseState`, saved = localStorage.getItem( saveKey );
      if ( saved ) {
         state = JSON.parse( saved ); // Has state; remove invalid ids and apply the rest
         for ( const id in state )
            if ( ! dMap.has( id ) ) 
               delete state[ id ];
            else
               dMap.get( id ).open = !( id in state );
      } else {
         for ( const [ id, e ] of dMap.entries() ) // No state; Save tabs that are closed by default 
            if ( ! e.open )
               state[ id ] = 0;
      }
      for ( const tab of tabSet )
         if ( tab.tagName === 'DETAILS' )
            updateTabs( tab );
      // Save state on change
      let saveTimer = 0;
      document.body.addEventListener( "toggle", ( evt ) => {
         const target = evt.target, id = target.id;
         if ( target.open ) delete state[ id ];
         else state[ id ] = 0;
         if ( target.classList.contains( "leaf" ) )
            updateTabs( target.parentElement );
         if ( saveTimer ) return;
         saveTimer = setTimeout( () => {
            localStorage.setItem( saveKey, JSON.stringify( state ) );
            saveTimer = 0;
         }, 1000 );
      }, { capture: true, passive: true } );
   } catch ( err ) {
      console.warn( "Cannot load open/close state.", err );
   }

   try {
      // When clicking link in ToC, auto-expand details to show clicked section
      find( '#toc' ).addEventListener( "click", ({ target, button, ctrlKey })  => {
         if ( button !== 0 || target.tagName !== 'A' || ctrlKey ) return;
         const href = target.getAttribute( "href" ), destination = find( href );
         while ( target = destination.closest( "details:not([open])" ) )
            target.open = true;
      } );
   } catch ( err ) {
      console.warn( "Cannot setup ToC click handler.", err );
   }

   try {
      // Link to abilities, utilities, and glossaries
      const links = [];
      for ( const e of iterElem( "#abilities details[h=h4], #utilities details[h=h4]" ) ) {
         const id = e.id,  sprite = e.dataset.sprite,  title = find( e, "summary" ).textContent.trim().replace( /\)/g, '' ).replace( /\s*\(/g, '|' );
         links.push( [ id, title, `<a class="auto" href="#${id}" data-sprite="${sprite}">` ] );
      }
      replaceLinks ( links, false );
      for ( const e of iterElem( "#glossary dt" ) ) {
         e.id = idify( e.textContent );
         let pattern = e.dataset.regexp;
         if ( pattern === "" ) continue;
         if ( ! pattern ) pattern = e.textContent.trim();
         if ( pattern.match( /^[A-Z][a-z]+$/ ) ) pattern = "[" + pattern[0] + pattern[0].toLowerCase() + "]" + pattern.slice( 1 );
         links.push( [ e.id, pattern, `<a class="auto glossary" href="#${e.id}">` ] );
      }
      replaceLinks ( links, true );

      // Add click handler
      document.body.insertAdjacentHTML( "beforeend", "<aside id='lookup'></aside>" );
      const lookupPopup = find( "#lookup" ), popStyle = lookupPopup.style;
      document.body.addEventListener( "click", ( evt ) => {
         // Hide lookup and stop if we shouldn't continue
         const { target, detail, button, ctrlKey } = evt;
         if ( button !== 0 || ! target || target.tagName !== "A" || ! target.classList.contains( "auto" ) ) {
            popStyle.display = "none";
            lookupPopup.innerHTML = "";
            return;
         }
         if ( detail >= 2 || ctrlKey )
            return;

         // Load target and conditionally reset lookup states
         const href = target.getAttribute( "href" ), id = href.substr( 1 ), e = find( href ), rect = target.getBoundingClientRect();
         if ( ! e ) return console.warn( `Cannot find ${href}` );
         evt.preventDefault();
         if ( target.closest( "#lookup" ) == null ) {
            lookupPopup.innerHTML = "";
            popStyle.display = "block";
            popStyle.top = scrollY + rect.bottom + "px";
            popStyle.left = minMax( 0, scrollX + rect.left, innerWidth - lookupPopup.clientWidth ) + "px";
         }
         let curr = find( lookup, ".active" ), body;
         if ( curr )
            curr.classList.remove( "active" );
         if ( curr = find( lookup, `[data-id=${id}]` ) ) {
            curr.classList.add( "active" );
            curr.scrollIntoView({ block: "nearest", inline: "nearest" });
            return;
         }

         // Add new lookup to popup
         if ( e.tagName === "DT" ) {
            body = e.nextElementSibling.innerHTML;
         } else {
            let desc = find( e, ".desc > * > li" );
            body = desc ? desc.innerHTML : "(Missing Description.)";
         }
         lookupPopup.innerHTML += `<p class="active" data-id="${id}"><button>x</button><b><a href="${href}">${target.textContent}</a></b><br>${body}</p>`;
         find( lookupPopup, "p:last-child" ).scrollIntoView({ block: "nearest", inline: "nearest" });
      } );
      // Delete lookup from popup
      lookupPopup.addEventListener( "click", ( evt ) => {
         const { target } = evt, { tagName, parentNode } = target || {};
         if ( ! target || tagName !== "BUTTON" )
            return;
         parentNode.remove();
         if ( lookupPopup.textContent == "" )
            popStyle.display = "none";
         evt.preventDefault();
      } );

   } catch ( err ) {
      console.warn( "Cannot create intra-links.", err );
   }

   // Build ability counterparts
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
            section.lastChild.lastChild.insertAdjacentHTML( 'beforeend', `<li class="inline_icon">${mirrorText} counterpart: ${link}${mirrorName}</a></li>` );
         } );
      } );
   } catch ( err ) {
      console.warn( "Cannot read counterparts.", err );
   }

   try {
      // Check duplicate ids
      for ( const e of findAll( "[id]" ) )
         if ( findAll( `#${e.id}` ).length > 1 )
            console.warn( `Duplicate id: #${e.id}` );
   } catch ( err ) {
      console.warn( "Cannot validate document.", err );
   }

   find( 'body' ).classList.add( 'js' ); // Mark document as supporting js

   function minMax ( min, val, max ) {
      return Math.max( min, Math.min( val, max ) );
   }

   function norm ( text ) {
      return text.replace( /\([^)]+\)/, '' ).trim();
   }

   function idify ( text ) {
      return norm( text ).toLowerCase().replace( /\W+/g, "_" );
   }

   function matchPos( match ) {
      for ( let i = match.length - 1 ; i >= 1 ; i-- ) {
         if ( match[i] )
            return [ i-1, match[0], match.index ];
      }
      throw "No matching group found";
   }

   function isLeaf ( e ) {
      return e.classList.contains( "leaf" );
   }

   /* Find text in list and replace with automatically generated links */
   function replaceLinks ( links, replaceOnce ) {
      links.sort( (a,b) => {
         const al = a[0].length, bl = b[0].length;
         if ( al != bl ) return bl - al;
         return a[0] > b[0] ? 1 : ( a[0] === b[0] ? 0 : -1 );
      } );
      // Convert text to link
      const pattern = new RegExp( "\\b(?:" + links.map( (e) => `(${e[1]})` ).join( '|' ) + ")\\b(?:'\\w*)?(?![^<>]*(?:>|</a>))", "g" );
      for ( const e of iterElem( "#toc ~ * ul, ol, dd" ) ) {
         let html = e.innerHTML,  match, matches = [], ignore = [ e.tagName == 'DD' ? e.previousElementSibling.id : e.parentElement.parentElement.id ];
         while ( match = pattern.exec( html ) ) matches.push( matchPos( match ) );
         if ( ! matches.length ) continue;
         for ( let i = matches.length - 1 ; i >= 0 ; i-- ) {
            const [ index, text, pos ] = matches[ i ],  [ id,, openTag ] = links[ index ];
            if ( ignore.includes( id ) ) continue;
            if ( replaceOnce ) ignore.push( id );
            html = html.slice( 0, pos ) + openTag + text + '</a>' + html.slice( pos + text.length );
         }
         e.innerHTML = html;
      }
   }

   function updateTabs ( parent ) {
      const siblings = Array.from( parent.children ).filter( e => e.tagName === "DETAILS" );
      for ( const tab of siblings )
         updateTabState( tab, siblings );
   }

   function updateTabState ( e, siblings ) {
      if ( ! isLeaf( e ) ) return;
      let tabCount = 1, index = siblings.indexOf( e );
      for ( let i = index - 1 ; i >= 0 ; i-- ) {
         if ( siblings[i].open || ! isLeaf( e ) ) break;
         ++tabCount;
      }
      if ( ! e.open )
         for ( let i = index + 1 ; i < siblings.length ; i++ ) {
            if ( ! isLeaf( e ) ) break;
            ++tabCount;
            if ( siblings[i].open ) break;
         }
      e.dataset.tabs = tabCount;
   }

})();