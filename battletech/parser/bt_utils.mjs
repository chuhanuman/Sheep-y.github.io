import fs from 'fs';

let dir = '';
let str = "";

export const DAG = "^", DDAG = "*", BR = "<br>", log = console.log, warn = console.warn;

export function setDir( path ) { dir = path; }

export function loopJson( folder, task ) {
   function run( data ) {
      if ( ! data ) throw new Error( "Data is empty" );
      let desc = data.Description;
      if ( ! desc || desc.Name ) task( data );
   }
   return new Promise( ( done, fail ) => {
      fs.readdir( dir + folder + "/", ( err, files ) => {
         if ( err ) fail( err );
         const tasks = files.filter( ( f ) => f.endsWith( '.json' ) ).map( ( f ) => new Promise( ( done ) => {
            let json, err;
            fs.readFile( dir + folder + "/" + f, { encoding: 'utf-8' }, ( err, data ) => {
               try {
                  if ( err ) throw err;
                  run( JSON.parse( data ) );
               } catch ( ex ) {
                  if ( ex instanceof SyntaxError ) try {
                     run( new Function( "return " + data + ";" )() );
                  } catch ( ex2 ) {
                     if ( ex2 instanceof SyntaxError ) try {
                        // Fix minor json syntax errors
                        data = data.replace( /"\r?\n\s*"/g, '","' ).replace( /\}\r?\n\s*\{/g, '},{' );
                        run( JSON.parse( data ) );
                     } catch ( ex3 ) {
                        err = ex3 instanceof SyntaxError ? ex : ex3;
                     } else
                        err = ex2;
                  } else
                     err = ex;
               }
               if ( err )
                  return done( console.error( `Cannot parse ${f}: ${err.stack}` ) );
               done();
            } );
         } ) );
         Promise.all( tasks ).then( done ).catch( fail );
      } );
   } );
}

export function td  ( val, size ) { str += "| "    + String( val ).padEnd( size ); } // Append space padded cell
export function tdr ( val, size ) { str += "|r "   + String( val ).padEnd( size ); } // Append right-aligned, space padded cell
export function tdv ( val, size, row = 2 ) { str += `|-${row} `  + String( val ).padEnd( size ); } // Append double row cell (vertical)
export function tdh ( val, size, col = 2 ) { str += `|+${col} `  + String( val ).padEnd( size ); } // Append double col cell (horizontal)
export function newRow() {  log( str + "|" ); str = ""; }

export function kilo( val ) { return Math.round( val / 1000 )  + "K"; } // Format to kilo
export function mil( val ) { return d2( val / 1000000 ) + "M"; }     // Format to mil

// One decimal
export function d1( val ) {
   if ( isNaN( +val ) ) return val;
   let rounded = Math.round( val * 10 ) / 10;
   return ~~rounded === rounded ? `${rounded}.0` : String( rounded );
}

// Two decimals
export function d2( val ) {
   if ( isNaN( +val ) ) return val;
   let rounded = Math.round( val * 100 ) / 100;
   if ( ~~rounded === rounded ) return `${rounded}.00`;
   if ( ~~(rounded*10) === rounded*10 ) return `${rounded}0`;
   return String( rounded );
}

// Add a plus sign if 0 or +ve
export function plus( val ) { return val >= 0 ? `+${val}` : val; }

// Return "-" if 0
export function iff( val ) { return val === 0 ? "-" : val; }

// Turns "Laser + + " into "Laser++", e.g.
export function note( val ) { return val.replace( /\s*([+-])\s*/g, "$1" ).replace( /\.$/, "" ); }

// Uppercase first character
export function ucfirst( val ) { return val ? val[0].toUpperCase() + val.slice( 1 ) : val; }

// Return either note( Description.UIName ) or Description,Name
export function fixName( { Description: desc } ) { return desc.UIName ? note( desc.UIName ) : desc.Name; }

export function sorter() {
   let str = '', conditions = Array.from( arguments ), len = conditions.length;
   conditions.forEach( ( e, i ) => {
      if ( e === '.log' )
         if ( i === 0 ) return str += "console.log([ 'sort input:', a, b ]);\n";
         else return;
      const isStr = typeof( e ) === "string", rev = isStr && e.startsWith( "-" ) || e < 0,
            l = rev ? -1 : 1, r = rev ? 1 : -1, a = "a"+i, b = "b"+i;
      if ( rev ) e = isStr ? e.slice( 1 ) : -e;
      if ( e === "" ) {
         str += `const ${a}=a, ${b}=b;\n`;
      } else if ( ~~e == e ) {
         str += `const ${a}=a[${e}], ${b}=b[${e}];\n`;
      } else if ( e.match( /\be(?=\.|\[\d+\])/ ) ) {
         let ae = e.replace( /\be(?=\.|\[\d+\])/g, 'a' ), be = e.replace( /\be(?=\.|\[\d+\])/g, 'b' );
         str += `const ${a}=${ae}, ${b}=${be};\n`;
      } else {
         str += `const ${a}=a.${e}, ${b}=b.${e};\n`;
      }
      if ( i < len-1 && conditions[i+1] === ".log" )
         str += `console.log([ 'sort ${i} ${rev?'asc':'desc'}:', ${a}, ${b} ]);\n`;
      str += `if ( ${a} !== ${b} ) return ${a} > ${b} ? ${l} : ${r};\n`;
   } );
   str + "return 0;";
   return new Function( "a", "b", str );
}

// Sum up a list with given map function, starting from 0
export function sum( list, map ) { return list.reduce( ( v, e ) => v + map( e ), 0 ); }

// Return a new list without duplicates
export function unique( list ) { return Array.from( new Set( list ) ); }

// Return a Map of item => count
export function count( list ) {
   return list.reduce( ( v, e ) => v.set( e, v.has( e ) ? v.get( e ) + 1 : 1 ), new Map() );
}

// https://stackoverflow.com/a/28458409/893578
export function escHtml( text ) {
   return String(text).replace( /[&<"']/g, function(m) {
      switch (m) {
         case '&': return '&amp;';
         case '<': return '&lt;';
         case '"': return '&quot;';
         default:  return '&#039;';
      }
   } );
}