'use strict';

function isStr ( obj ) { return typeof obj === "string"; }
function isObj ( obj ) { return typeof obj === "object"; }

function find ( css, root ) {
   return root ? css.querySelector( root ) : document.querySelector( css );
}

function findAll ( css, root ) {
   return root ? css.querySelectorAll( root ) : document.querySelectorAll( css );
}

function iter ( obj ) {
   return isObj( obj ) && Symbol.iterator in obj ? obj : [ obj ];
}

function iterElem ( obj ) {
   return isStr( obj ) ? findAll( obj ) : iter( obj );
}

function log () {
   console.log.apply( console, arguments );
}

function xhr ( method, url, options ) {
   if ( options === undefined && isObj( url ) ) [ url, options ] = [ undefined, url ];
   if ( url === undefined ) [ method, url ] = [ "GET", method ];
   return new Promise( ( ok, fail ) => {
      const req = new XMLHttpRequest();
      req.open( method, url );
      req.onload  = () => req.status >= 200 && req.status < 300 ? ok( req ) : fail( req );
      req.onerror = () => fail( req );
      if ( options ) Object.assign( req, options );
      try {
         req.send();
      } catch ( err ) {
         fail( err );
      }
   } );
}