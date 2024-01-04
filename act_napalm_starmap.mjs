/* Run with "node --experimental-modules act_napalm_starmap.mjs" */

import { setDir, log as out, escHtml } from './bt_utils.mjs';
import { loadShops, planet_keyword, listStars } from './bt_shop.mjs';

setDir( 'C:/Program Files (x86)/Steam/steamapps/common/BATTLETECH/BattleTech_Data/StreamingAssets/data/' )

Promise.resolve(
).then( loadShops()
).then( () => {

   listStars( ( shops ) => {
      for ( const { Description: desc, Tags: { items } } of shops ) {
         const id = desc.Id.replace( /^starsystemdef_/,'town_' ), name = escHtml(desc.Name), details = escHtml(desc.Details), tags = {};
         for ( const type of ['climate', 'other', 'industry', 'faction' ] )
            tags[ type ] = planet_keyword( items.filter( e => e.startsWith( `planet_${type}_` ) ) ).join( ', ' );
         out( `var ${id} = L.marker(map.unproject[,], map.getMaxZoom()).bindPopup(\`<h1>${name}</h1><p>${details}<p>Climate: ${tags['climate']}<p>Industries: ${tags['industry']}<p>Tags: ${tags['other']}<p>Authority: ${tags['faction']}\`);` );
      }
   } );

} ).catch( console.error );