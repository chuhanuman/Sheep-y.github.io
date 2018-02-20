(function(){ 'use strict';

   find( 'body' ).classList.add( 'js' ); // Mark document as supporting js

   // Restore open/close preference and save preference on change

   // Build counterparts
   const { htmlMirror, baseClassAbbr, baseClassMirrorAbbr, baseClassMirror, advClassMirror } = guide_config;

   xhr( htmlMirror, { responseType: "document" } ).then( ( req ) => {
      const advClassMirrorAbbr = advClassMirror.substr( 0, 4 ).toLowerCase();
      const counterparts = findAll( req.response, '#abilities details[h="h4"] > summary, #utilities details[h="h4"] > summary' )

      iterElem( '#abilities details[h="h4"], #utilities details[h="h4"]' ).forEach( ( section, i ) => {
         let mirror = advClassMirrorAbbr, mirrorText = advClassMirror, mirrorName = norm( counterparts[i].textContent ), id = idify( mirrorName );
         if ( mirrorName === norm( find( section, 'summary' ).textContent ) ) return; // Skip if same name
         if ( section.dataset.sprite.startsWith( baseClassAbbr ) )
            [ mirror, mirrorText ] = [ baseClassMirrorAbbr, baseClassMirror ];
         const link = `<a href="${htmlMirror}#${id}" data-sprite="${mirror}${section.dataset.sprite.slice(mirror.length)}">`;
         section.lastChild.lastChild.insertAdjacentHTML( 'beforeend', `<li>${mirrorText} counterpart: ${link}${mirrorName}</a></li>` );
      } );
   } );

   function norm ( text ) {
      return text.replace( /\([^)]+\)/, '' ).trim();
   }

   function idify ( text ) {
      return norm( text ).toLowerCase().replace( /\W+/g, '_' );
   }

})();