const files=['core','water_wave','wind','folkanim','folkcrowd','noise','registry','models','voxarch','voxtech','voxlife','voxcity','voxhome','voxmodel','voxcells','voxfurn','voxfacade','blocks1','blocks2','blocks3','blocks_heart','blocks5','blocks6','voxmodern','blocks_var','voxplants','voxnova','voxtown','blocks4','items','biomes','gen_common','gen_overworld','gen_realm','shipgen','starship','cockpitkit','shipcabin','cabinkit','gen_village','gen_detail','gen_city','gen_hallcity','gen_modern','gen_plan','gen_villa','gen_villa_rooms','gen_nova','gen_rails','gen_citadel','gen_heart','gen_temple','gen_isles','gen_canyon','gen_hills','gen_station','gen_land','gen_vista','lod','stream','far','gen_dims','light_local','mesher','softnat','physics','custom','style','edits','looks','mirror','forge','forge_kit','forge_tower','forge_house','forge_bridge','forge_civic','forge_park','wonders','wonders_build','adventure','universe'];
files.splice(files.indexOf('gen_dims'), 0, 'dimreg');   // u-dims: the dim registry (VR.DimReg) before the generators
files.splice(files.indexOf('blocks4'), 0, 'bodies'); files.splice(files.indexOf('gen_dims') + 1, 0, 'gen_body');   // u-moons1: the bodies (blocks before blocks4), their generator
files.splice(files.indexOf('blocks4'), 0, 'foeblocks');   // a-foes: the Leuchtfeuer (the last block)
files.splice(files.indexOf('blocks4'), 0, 'voxhangar');   // t-hangar: the hall's and the temple's pieces (vgen 14), after the Leuchtfeuer
files.splice(files.indexOf('blocks4'), 0, 'bodies2'); files.splice(files.indexOf('gen_body') + 1, 0, 'gen_body2');   // u-moons2: Zinnober's blocks (last), the three new kinds
files.splice(files.indexOf('blocks4'), 0, 'fields_blocks'); files.splice(files.indexOf('gen_body2') + 1, 0, 'gen_rubble');   // u-fields: carbon_rubble (last), the rubble bodies
files.push('hzcull');   // (the horizon culling: main thread only, VR.HzCull)
files.push('galaxy');   // u-stars: the neighbourhood (VR.Galaxy), after universe
files.splice(files.indexOf('blocks4'), 0, 'exo_blocks'); files.push('exoworld');   // u-stars2: the exo blocks (last), VR.Exo
files.splice(files.indexOf('blocks4'), 0, 'lifeblocks');   // a-life: the ferry dock and the grow lamp (the last blocks, after u-stars2's exo blocks)
files.splice(files.indexOf('blocks4'), 0, 'stn_blocks'); files.splice(files.indexOf('forge_park') + 1, 0, 'forge_station', 'gen_stn');   // u-stations: the station blocks (the last), the Forge's station kind, the stn.* dims
files.splice(files.indexOf('blocks4'), 0, 'flora_blocks');   // v-flora: the blossom leaves, tall meadow flowers, glowbell, clover (the last blocks)
files.splice(files.indexOf('gen_common') + 1, 0, 'flora');   // v-flora: VR.Flora (the L-system plants, before gen_land)
files.splice(files.indexOf('gen_land') + 1, 0, 'gen_flora');   // v-flora: the land between in bloom (vgen 17)
files.push('worldeco');   // u-worlds: the worlds' ecosystems (after exoworld)
files.splice(files.indexOf('core') + 1, 0, 'names');   // n-names: VR.Names (the one table of names)
files.splice(files.indexOf('lod') + 1, 0, 'isleshell');   // q-art4: VR.IsleShell (the floating isles' round far form), after lod
files.push('chronik');   // r-chronik: VR.Chronik (the world simulation, pure)
files.push('wunder');   // r-wunder: VR.Wunder (the Wundertiere's rules, pure; after chronik: it adds the deeds)
files.push('seelen');   // r-seelen: VR.Seelen (the villagers' souls, pure)
const skip = (process.env.R9_SKIP || '').split(',');   // (test/land_v9_same.js: the shared code without some files)
for (const f of files) { if (skip.includes(f)) continue; const p = __dirname + '/../src/shared/' + f + '.js'; if (require('fs').existsSync(p)) require(p); }
module.exports=globalThis.VR;
