import fs from 'fs';

let dir = '';
let str = "";

export const DAG = "^", DDAG = "*", BR = "<br>", log = console.log, warn = console.warn;

export function setDir( path ) { dir = path; }

export function loopFolder( folder, task ) {
   return new Promise( ( done, fail ) => {
      fs.readdir( `${dir}${folder}/`, ( err, files ) => {
         if ( err ) fail( err );
         Promise.all( files.map( ( f ) => new Promise( ( done, fail ) => {
            fs.lstat( `${dir}${folder}/${f}`, ( err, stats ) => {
               if ( err ) fail( err );
               done( stats.isDirectory() ? f : null );
            } );
         } ) ) )
         .then( list => Promise.all( list.filter( e => e ).map( e => { try {
            return task( e );
         } catch ( err ) {
            console.error( `Cannot load ${e}: ${err.stack}` );
            return Promise.resolve();
         } } ) ) )
         .then( done ).catch( fail );
      } );
   } );
}

export function loopJson( folder, task ) {
   return new Promise( ( done, fail ) => {
      fs.readdir( `${dir}${folder}/`, ( err, files ) => {
         if ( err ) fail( err );
         const tasks = files.filter( ( f ) => f.endsWith( '.json' ) ).map( ( f ) => new Promise( ( done ) => {
            fs.readFile( `${dir}${folder}/${f}`, { encoding: 'utf-8' }, ( err, data ) => {
               try {
                  if ( err ) throw err;
                  const json = parseJSON( data );
                  if ( ! json ) throw new Error( "Data is empty" );
                  const desc = json.Description;
                  if ( ! desc || desc.Name ) task( json ); // Skip templates which do not have names
               } catch ( err ) {
                  console.error( `Cannot parse ${f}: ${err.stack}` );
               }
               done();
            } );
         } ) );
         Promise.all( tasks ).then( done ).catch( fail );
      } );
   } );
}

function parseJSON ( data ) {
   try {
      // Try simple parse
      return JSON.parse( data );
   } catch ( ex ) {
      // Try append semi-colon
      if ( ex instanceof SyntaxError ) try {
         return new Function( "return " + data + ";" )();
      } catch ( ex2 ) {
         if ( ex2 instanceof SyntaxError ) try {
            // Fix minor json syntax errors: missing comma
            data = data.replace( /"\r?\n\s*"/g, '","' ).replace( /\}\r?\n\s*\{/g, '},{' );
            return JSON.parse( data );
         } catch ( ex3 ) {
            throw ex3 instanceof SyntaxError ? ex : ex3;
         }
         throw ex2;
      }
      throw ex;
   }
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
export function iff( val, postfix = "" ) { return val === 0 ? "-" : ( val + postfix ); }

// Turns "Laser + + " into "Laser++", e.g.
export function note( val ) { return val.replace( /\s*([+-])\s*/g, "$1" ).replace( /\.$/, "" ); }

// Uppercase first character
export function ucfirst( val ) { return val ? val[0].toUpperCase() + val.slice( 1 ) : val; }

// Uppercase every words
export function ucword( words ) { return words.split( / +/g ).map( ucfirst ).join( ' ' ); }

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

// join( [1,2,3], "and" ) => "1, 2, and 3"; join( [1,2], "or" ) => "1 or 2"
export function join( val, word ) {
   if ( val.length > 2 )
      return val.slice( 0, -1 ).join( ", " ) + `, ${word} ` + val.slice( -1 );
   if ( val.length > 1 )
      return `${val[0]} ${word} ${val[1]}`;
   return val.join( ", " );
}

// joinComma( [1,2,3], "and" ) => "1, 2, and 3"; joinComma( [1,2], "or" ) => "1, or 2"
export function joinComma( val, word ) {
   if ( val.length === 2 )
      return `${val[0]}, ${word} ${val[1]}`;
   return join( val, word );
}

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