/* Run with "node --experimental-modules act_redix_editor.mjs" */

import { setDir, log as out } from './bt_utils.mjs';
import { loadMechs, showMechs } from './bt_mech.mjs';
import { loadGears, showWeapons, showGears } from './bt_gear.mjs';

const gears = new Map();

setDir( 'C:/Program Files (x86)/Steam/steamapps/common/BATTLETECH/BattleTech_Data/StreamingAssets/data/' )

Promise.resolve(
).then( loadGears( gears )
).then( loadMechs( gears )
).then( () => {

   function loadout( part ) {
      const pos = { 'B': 0, 'E': 1, 'M': 2, 'A': 3 }, count = [ 0, 0, 0, 0 ];
      for ( const e of part.Hardpoints ) count[ pos[ e.WeaponMount[0] ] ]++;
      return count.join( '' );
   }

   showMechs( ( mechs ) => {

      for ( const e of mechs ) {
         const { LeftArm, LeftLeg, LeftTorso, CenterTorso, RightTorso, RightLeg, RightArm, Head } = e.Parts;

         out( `Mech Name: "[ ${e.Tonnage} ] ${e.Name} ${e.VariantName}"` );
         out( "Tonnage: " + e.Tonnage );
         out( "BaseWeight: " + e.InitialTonnage );

         out( "ArmourRightArm: " + RightArm.MaxArmor );
         out( "ArmourRightTorso: " + RightTorso.MaxArmor );
         out( "ArmourRightLeg: " + RightTorso.MaxArmor );
         out( "ArmourHead: " + Head.MaxArmor );
         out( "ArmourCentre': " + CenterTorso.MaxArmor );
         out( "ArmourLeftLeg: " + LeftLeg.MaxArmor );
         out( "ArmourLeftTorso: " + LeftTorso.MaxArmor );
         out( "ArmourLeftArm: " + LeftArm.MaxArmor );
         out( "ArmourLeftTorsoRear: " + LeftTorso.MaxRearArmor );
         out( "ArmourRightTorsoRear: " + RightTorso.MaxRearArmor );
         out( "ArmourCentreRear: " + CenterTorso.MaxRearArmor );

         out( "RightArmLoadout: " + loadout( RightArm ) );
         out( "RightTorsoLoadout: " + loadout( RightTorso ) );
         out( "HeadLoadout: " + loadout( Head ) );
         out( "LeftTorsoLoadout: " + loadout( LeftTorso ) );
         out( "LeftArmLoadout: " + loadout( LeftArm ) );
         out( "CentreLoadout: " + loadout( CenterTorso ) );
         out(); // Blank line

      }

   } );

} ).catch( console.error );