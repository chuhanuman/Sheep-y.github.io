/* Run with "node --experimental-modules act_data_tables.mjs" */

import { setDir, log } from './bt_utils.mjs';
import { loadShops } from './bt_shop.mjs';
import { loadMechs, showMechs } from './bt_mech.mjs';
import { loadGears, showWeapons, showGears } from './bt_gear.mjs';
import { loadMissions, showMissions } from './bt_mission.mjs';
import { loadEvents, showEvents } from './bt_event.mjs';

const gears = new Map();

setDir( 'C:/Program Files (x86)/Steam/steamapps/common/BATTLETECH/BattleTech_Data/StreamingAssets/data/' );

Promise.resolve(
).then( loadGears( gears )
).then( loadMechs( gears )
).then( loadShops( gears )
).then( loadMissions()
).then( loadEvents( gears )
).then( () => {

   log( ";format:gf-markup\n" );
   showMechs();
   showWeapons();
   showGears();
   //showEvents();
   //showMissions();

} ).catch( console.error );