/* Pokémon Champions Reg M-C Team Builder — offline-first PWA */
const $ = id => document.getElementById(id);
const SOURCES = {
  companion: "https://raw.githubusercontent.com/Gheist23/pokemonbattledata/main/data/builder/app-data.json",
  lookup: "https://raw.githubusercontent.com/Gheist23/pokemonbattledata/main/data/api/lookup.json",
  pokeCalcRoster: "https://raw.githubusercontent.com/tinoxo/PokeCalc/main/data/champions-roster.json",
  pokeCalcLegality: "https://raw.githubusercontent.com/tinoxo/PokeCalc/main/data/champions-legality.json",
  pokeCalcData: "https://raw.githubusercontent.com/tinoxo/PokeCalc/main/data/champions-data.json",
  mcOverrides: "https://raw.githubusercontent.com/Seancheey/PokeDD/main/prisma/data/champions-mc.json",
  mcRules: "https://raw.githubusercontent.com/Seancheey/PokeDD/main/src/lib/champions-regulation.ts",
  learnsetsFallback: "https://raw.githubusercontent.com/otterlyclueless/pokemon-champions-data/main/learnsets/learnsets.json"
};
const ASSET_BASE = "https://raw.githubusercontent.com/Gheist23/pokemonbattledata/main/pokemon_champions_assets/";
const DB_KEY = "champions-reg-mc-db-v3";
const STORE_NAME = "championsRegMCTeams";
const STATS = ["HP","Atk","Def","SpA","SpD","Spe"];
const STAT_LABELS = ["HP","Atk","Def","SpA","SpD","Spe"];
const TYPES = ["Normal","Fire","Water","Electric","Grass","Ice","Fighting","Poison","Ground","Flying","Psychic","Bug","Rock","Ghost","Dragon","Dark","Steel","Fairy"];
let db = null;
let team = Array.from({length:6},()=>null);
let selectedSlot = 0;
let moveCatalog = new Map();
let abilityCatalog = new Map();
let itemCatalog = [];
let dex = [];
let isSyncing = false;

function openDB(){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open("ChampionsTeamBuilder",1);
  req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains("cache"))d.createObjectStore("cache");};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
 });
}
async function cacheGet(key){try{const d=await openDB();return await new Promise((res,rej)=>{const r=d.transaction("cache").objectStore("cache").get(key);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error);});}catch{return null;}}
async function cachePut(key,value){const d=await openDB();return new Promise((res,rej)=>{const r=d.transaction("cache","readwrite").objectStore("cache").put(value,key);r.onsuccess=()=>res();r.onerror=()=>rej(r.error);});}
async function fetchJson(url){const r=await fetch(url,{cache:"no-store"});if(!r.ok)throw new Error(`${r.status} ${r.statusText} — ${url}`);return r.json();}
async function fetchText(url){const r=await fetch(url,{cache:"no-store"});if(!r.ok)throw new Error(`${r.status} — ${url}`);return r.text();}
function key(s){return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");}
function title(s){return String(s||"").replace(/[-_]/g," ").replace(/\b\w/g,c=>c.toUpperCase());}
function asArray(x){if(Array.isArray(x))return x;if(x&&typeof x==="object")return Object.entries(x).map(([k,v])=>typeof v==="object"&&v!==null?{name:k,...v}:k);return [];}
function findNamedArrays(root, names, out=[], seen=new Set(), path=""){
 if(!root||typeof root!=="object"||seen.has(root))return out;seen.add(root);
 for(const [k,v] of Object.entries(root)){
  const p=path?path+"."+k:k;
  if(Array.isArray(v)&&names.includes(k.toLowerCase()))out.push({key:k,path:p,value:v});
  else if(v&&typeof v==="object")findNamedArrays(v,names,out,seen,p);
 }
 return out;
}
function collectStrings(root, wantedKeys, out=[], seen=new Set()){
 if(!root||typeof root!=="object"||seen.has(root))return out;seen.add(root);
 for(const [k,v] of Object.entries(root)){
  if(wantedKeys.includes(k.toLowerCase())){
   if(Array.isArray(v))for(const x of v){if(typeof x==="string")out.push(x);else if(x&&typeof x==="object")out.push(x.name||x.species||x.pokemon||x.displayName||x.slug||"");}
   else if(v&&typeof v==="object")for(const [n,x] of Object.entries(v))if(x!==false)out.push(typeof x==="string"?x:n);
  }
  if(v&&typeof v==="object")collectStrings(v,wantedKeys,out,seen);
 }
 return [...new Set(out.filter(Boolean))];
}
function findRecords(root, predicate, out=[], seen=new Set(), depth=0){
 if(!root||typeof root!=="object"||seen.has(root)||depth>8)return out;seen.add(root);
 if(Array.isArray(root)){
  for(const x of root){if(x&&typeof x==="object"&&predicate(x))out.push(x);else if(x&&typeof x==="object")findRecords(x,predicate,out,seen,depth+1);}
 }else{
  for(const [k,v] of Object.entries(root)){
   if(v&&typeof v==="object"){
    if(!Array.isArray(v)&&predicate(v)&&!v.name&&!v.species&&!v.displayName)out.push({name:k,...v});
    else findRecords(v,predicate,out,seen,depth+1);
   }
  }
 }
 return out;
}
function first(o,keys){for(const k of keys){if(o&&o[k]!=null)return o[k];}return null;}
function normalizeAbilities(a){
 if(!a)return [];
 if(Array.isArray(a))return a.map(x=>typeof x==="string"?x:(x.name||x.ability||x.displayName||"")).filter(Boolean);
 if(typeof a==="object")return Object.values(a).map(x=>typeof x==="string"?x:(x?.name||x?.ability||"")).filter(Boolean);
 return String(a).split(/[,|;]/).map(x=>x.trim()).filter(Boolean);
}
function normalizeTypes(a){
 if(!a)return [];
 if(Array.isArray(a))return a.map(x=>typeof x==="string"?x:(x.name||x.type||"")).filter(Boolean);
 if(typeof a==="object")return Object.values(a).map(x=>typeof x==="string"?x:(x?.name||x?.type||"")).filter(Boolean);
 return String(a).split(/[,|/]/).map(x=>x.trim()).filter(Boolean);
}
function normalizeStats(o){
 const src=first(o,["stats","baseStats","base_stats","baseStatsTotal","stat"]);
 if(!src)return null;
 if(Array.isArray(src))return src.slice(0,6).map(Number);
 const aliases=[["hp","HP"],["atk","attack","Attack"],["def","defense","Defense"],["spa","spatk","specialattack","SpA"],["spd","spdef","specialdefense","SpD"],["spe","speed","Speed"]];
 return aliases.map(a=>{for(const k of a)if(src[k]!=null)return Number(src[k]);return 0;});
}
function normalizePokemonRecords(raw){
 let records=[];
 const predicate=o=>(first(o,["name","species","displayName","saved_name","base_name","slug"])!=null)&&
   (first(o,["types","type","abilities","stats","baseStats","form","base_name","saved_name"])!=null);
 records=findRecords(raw,predicate);
 // named arrays whose entries use a slightly different schema
 for(const a of findNamedArrays(raw,["pokemon","species","forms","roster","eligiblepokemon","legalpokemon","members"]))for(const x of a.value){
  if(typeof x==="string")records.push({name:x});
  else if(x&&typeof x==="object")records.push(x);
 }
 const seen=new Set();
 return records.map(o=>{
  const name=String(first(o,["name","species","displayName","saved_name","savedName","pokemon"])||"").trim();
  const baseName=String(first(o,["base_name","baseName","base_species","baseSpecies","basePokemon"])||name).trim();
  return {name,baseName,slug:String(first(o,["slug","id","key"])||key(name)),types:normalizeTypes(first(o,["types","type"])),abilities:normalizeAbilities(first(o,["abilities","ability"])),stats:normalizeStats(o),raw:o};
 }).filter(p=>p.name&&!seen.has(key(p.name))&&seen.add(key(p.name)));
}
function normalizeRosterNames(raw){
 const names=collectStrings(raw,["pokemon","species","roster","eligiblepokemon","legalpokemon","legal","allowed","members","forms","pokemonlist"]);
 if(names.length)return names;
 return normalizePokemonRecords(raw).map(p=>p.name);
}
function parseCsv(text){
 const rows=[];let row=[],cell="",q=false;
 for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'&&q&&n==='"'){cell+='"';i++;}else if(c==='"')q=!q;else if(c===','&&!q){row.push(cell);cell="";}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&n==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell="";}else cell+=c;}
 if(cell.length||row.length){row.push(cell);if(row.some(x=>x.trim()))rows.push(row);}
 return rows;
}
function parseLearnableCsv(txt){
 const rows=parseCsv(txt);if(!rows.length)return [];
 const head=rows[0].map(x=>key(x));
 const nameCol=Math.max(0,head.findIndex(x=>["move","movename","name","move_name","savedname"].includes(x)));
 const hasHeader=head.some(x=>["move","movename","name","type","category"].includes(x));
 const start=hasHeader?1:0;
 return [...new Set(rows.slice(start).map(r=>(r[nameCol]||r[0]||"").trim()).filter(x=>x&&!/^move$/i.test(x)))];
}
function normalizeLearnsets(raw){
 const out={};
 function walk(o,path=[]){
  if(!o||typeof o!=="object")return;
  if(Array.isArray(o)){
   if(o.length&&o.every(x=>typeof x==="string"||typeof x==="object")){
    const names=o.map(x=>typeof x==="string"?x:(x.name||x.move||x.moveName||x.id||"")).filter(Boolean);
    if(names.length&&path.length)out[key(path[path.length-1])]=names;
   }
   o.forEach((x,i)=>{if(x&&typeof x==="object")walk(x,path.concat(String(i)));});
  }else{
   for(const [k,v] of Object.entries(o)){
    if(Array.isArray(v)){
     const names=v.map(x=>typeof x==="string"?x:(x?.name||x?.move||x?.moveName||x?.id||"")).filter(Boolean);
     if(names.length)out[key(k)]=names;
    }else if(v&&typeof v==="object")walk(v,path.concat(k));
   }
  }
 }
 walk(raw);return out;
}
function getItemNames(...roots){
 let vals=[];
 for(const root of roots){
  const arrays=findNamedArrays(root,["items","helditems","itemlist"]);
  for(const a of arrays)for(const x of a.value){const n=typeof x==="string"?x:(x.name||x.displayName||x.item||"");if(n)vals.push(n);}
  if(root&&typeof root==="object"){
   for(const k of ["items","heldItems","held_items"])if(root[k]&&typeof root[k]==="object"&&!Array.isArray(root[k]))vals.push(...Object.keys(root[k]));
  }
 }
 return [...new Set(vals)].sort((a,b)=>a.localeCompare(b));
}
function getMoveNames(...roots){
 let vals=[];
 for(const root of roots){
  for(const a of findNamedArrays(root,["moves","moveList","movelist"]))for(const x of a.value){const n=typeof x==="string"?x:(x.name||x.displayName||x.move||"");if(n)vals.push(n);}
  if(root&&typeof root==="object")for(const k of ["moves","moveList"])if(root[k]&&!Array.isArray(root[k])&&typeof root[k]==="object")vals.push(...Object.keys(root[k]));
 }
 return [...new Set(vals)].sort((a,b)=>a.localeCompare(b));
}
function getAbilityNames(...roots){
 let vals=[];
 for(const root of roots){
  for(const a of findNamedArrays(root,["abilities","abilityList","abilitylist"]))for(const x of a.value){const n=typeof x==="string"?x:(x.name||x.displayName||"");if(n)vals.push(n);}
  if(root&&typeof root==="object")for(const k of ["abilities","abilityList"])if(root[k]&&!Array.isArray(root[k])&&typeof root[k]==="object")vals.push(...Object.keys(root[k]));
 }
 return [...new Set(vals)].sort((a,b)=>a.localeCompare(b));
}
function parseOverrideLearnsets(raw){
 const out={};
 if(!raw)return out;
 function walk(o){
  if(!o||typeof o!=="object")return;
  if(Array.isArray(o)){for(const x of o)walk(x);return;}
  for(const [k,v] of Object.entries(o)){
   if(Array.isArray(v)){
    const names=v.map(x=>typeof x==="string"?x:(x?.name||x?.move||x?.moveName||"")).filter(Boolean);
    if(names.length>3)out[key(k)]=names;
   }else if(v&&typeof v==="object")walk(v);
  }
 }
 walk(raw.learnsets||raw.learnset||raw.pokemon||raw);return out;
}
function parseOverrideForms(raw){
 if(!raw)return [];
 let out=[];
 for(const k of ["forms","pokemon","newPokemon","additions","newEntries"]){
  const v=raw[k];if(Array.isArray(v))out.push(...v.map(x=>typeof x==="string"?{name:x}:x));
 }
 return out;
}
async function fetchMoveCsvForPokemon(p){
 const candidates=[p.baseName,p.name].filter(Boolean);
 const clean=[...new Set(candidates)].map(x=>x.replace(/[\/\\:*?"<>|]/g,"").trim());
 for(const n of clean){
  try{
   const txt=await fetchText(ASSET_BASE+"learnable_moves/"+encodeURIComponent(n)+".csv");
   const moves=parseLearnableCsv(txt);if(moves.length)return moves;
  }catch{}
 }
 return [];
}
async function mapLimit(items,limit,fn,progress){
 let next=0,done=0;
 const workers=Array.from({length:Math.min(limit,items.length)},async()=>{
  while(true){const i=next++;if(i>=items.length)break;try{await fn(items[i],i);}catch{}done++;if(progress)progress(done,items.length);}
 });
 await Promise.all(workers);
}
function mergeRoster(records,names,mcRaw,lookup){
 const map=new Map();
 for(const p of records)map.set(key(p.name),p);
 const namesList=[...names];
 for(const x of parseOverrideForms(mcRaw)){const n=String(x.name||x.species||x.displayName||"").trim();if(n&&!namesList.some(z=>key(z)===key(n)))namesList.push(n);if(n&&!map.has(key(n)))map.set(key(n),{name:n,baseName:x.base_name||x.baseName||n,slug:key(n),types:normalizeTypes(x.types),abilities:normalizeAbilities(x.abilities),stats:normalizeStats(x),raw:x});}
 if(!namesList.length)namesList.push(...records.map(p=>p.name));
 const aliases=lookup?.aliases||lookup?.data?.aliases||{};
 const result=[];
 for(const rawName of namesList){
  const n=String(rawName).trim();if(!n)continue;
  const rec=map.get(key(n))||map.get(key(title(n)))||null;
  let slug=rec?.slug||aliases[key(n)]||key(n);
  result.push({name:rec?.name||n,baseName:rec?.baseName||rec?.name||n,slug,types:rec?.types||[],abilities:rec?.abilities||[],stats:rec?.stats||null,raw:rec?.raw||{}});
 }
 const uniq=new Map();for(const p of result)uniq.set(key(p.name),p);
 return [...uniq.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
function normalizeGlobalItems(raws){
 let names=getItemNames(...raws);
 // Avoid Poké Balls, key items and non-held inventory if a raw source includes them.
 names=names.filter(n=>!/(pok[eé] ?ball|key item|parcel|letter|flute|fossil|bike|rod|repel|incense burner)/i.test(n));
 return names;
}
function normalizeGlobalMoves(raws){return getMoveNames(...raws);}
function normalizeGlobalAbilities(raws){return getAbilityNames(...raws);}
async function syncDatabase(){
 if(isSyncing)return;isSyncing=true;$("syncBtn").disabled=true;$("setupPanel").classList.remove("hidden");$("setupError").textContent="";
 const setProgress=(pct,msg)=>{$("progressBar").style.width=pct+"%";$("progressPct").textContent=Math.round(pct)+"%";$("progressText").textContent=msg;};
 try{
  setProgress(2,"Downloading current Regulation M-C source data…");
  const [companion,lookup,rosterRaw,legality,calcData,mcRaw,mcRules,learnFallback]=await Promise.all([
   fetchJson(SOURCES.companion),fetchJson(SOURCES.lookup),fetchJson(SOURCES.pokeCalcRoster).catch(()=>null),
   fetchJson(SOURCES.pokeCalcLegality).catch(()=>null),fetchJson(SOURCES.pokeCalcData).catch(()=>null),
   fetchJson(SOURCES.mcOverrides).catch(()=>null),fetchText(SOURCES.mcRules).catch(()=>""),fetchJson(SOURCES.learnsetsFallback).catch(()=>null)
  ]);
  setProgress(12,"Reading Pokémon, items, moves, and abilities…");
  const allRoots=[companion,calcData,legality];
  const records=normalizePokemonRecords(companion).concat(normalizePokemonRecords(calcData));
  const rosterNames=normalizeRosterNames(rosterRaw||legality);
  const uniqueRecords=new Map();for(const p of records)uniqueRecords.set(key(p.name),p);
  let pokemon=mergeRoster([...uniqueRecords.values()],rosterNames,mcRaw,lookup);
  // When the eligibility snapshot is not parseable, the Companion data is the game roster.
  if(!pokemon.length)pokemon=mergeRoster([...uniqueRecords.values()],[],mcRaw,lookup);
  const itemNames=normalizeGlobalItems(allRoots);
  const moveNames=normalizeGlobalMoves(allRoots);
  const abilityNames=normalizeGlobalAbilities(allRoots);
  const fallbackLearnsets=normalizeLearnsets(learnFallback);
  const overrideLearnsets=parseOverrideLearnsets(mcRaw);
  if(!pokemon.length)throw new Error("The source data loaded, but its Pokémon roster could not be recognized. Please try Sync again.");
  setProgress(18,`Found ${pokemon.length} Pokémon. Downloading their legal move lists…`);
  let finished=0;
  await mapLimit(pokemon,7,async p=>{
   let moves=await fetchMoveCsvForPokemon(p);
   if(!moves.length)moves=overrideLearnsets[key(p.name)]||overrideLearnsets[key(p.baseName)]||fallbackLearnsets[key(p.name)]||fallbackLearnsets[key(p.baseName)]||[];
   p.moves=[...new Set(moves)];
  },(done,total)=>{finished=done;setProgress(18+70*done/Math.max(1,total),`Downloading learnsets: ${done} / ${total}`);});
  // Merge known abilities from per-Pokémon data and make source data auditable.
  for(const p of pokemon){
   if(!p.abilities.length){
    const rec=[...uniqueRecords.values()].find(x=>key(x.name)===key(p.name)||key(x.name)===key(p.baseName));
    if(rec)p.abilities=rec.abilities||[];
   }
  }
  const dbObj={
   version:new Date().toISOString(),pokemon,items:itemNames,moves:moveNames,abilities:abilityNames,
   globalMoveNames:moveNames,source:"Champions Battle Data + PokeCalc M-C + PokeDD M-C overrides",
   learnsetsCount:pokemon.filter(p=>p.moves.length).length,
   regulationText:mcRules.slice(0,5000)
  };
  await cachePut(DB_KEY,dbObj);
  db=dbObj;prepareCatalogs();renderAll();setProgress(100,`Saved ${pokemon.length} Pokémon and ${dbObj.learnsetsCount} learnsets to this iPhone.`);
  $("connection").textContent="Database saved offline";$("setupPanel").classList.add("hidden");
  $("setupError").textContent="";
 }catch(e){
  $("setupError").textContent="Database sync failed: "+e.message+". Check your connection and tap Sync database again.";
  $("connection").textContent="Database not synced";
  setProgress(0,"Sync could not complete.");
 }finally{isSyncing=false;$("syncBtn").disabled=false;}
}
function prepareCatalogs(){
 if(!db)return;
 dex=db.pokemon||[];
 itemCatalog=db.items||[];
 moveCatalog=new Map((db.moves||[]).map(n=>[key(n),n]));
 abilityCatalog=new Map((db.abilities||[]).map(n=>[key(n),n]));
}
function loadTeam(){
 try{const raw=localStorage.getItem("championsRegMCTeam");if(raw){const parsed=JSON.parse(raw);if(Array.isArray(parsed))team=parsed.slice(0,6);}}catch{}
}
function saveTeam(){localStorage.setItem("championsRegMCTeam",JSON.stringify(team));}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function makeSlot(p,i){
 if(!p)return `<article class="slot-card"><div class="slot-head"><div><div class="slot-number">SLOT 0${i+1}</div><div class="slot-title">Empty slot</div></div></div><div class="empty-slot"><div class="empty-ball"></div><p>Choose a Pokémon from the M-C Pokédex.</p><button class="btn btn-primary add-pokemon" data-slot="${i}">＋ Select Pokémon</button></div></article>`;
 const entry=dex.find(x=>key(x.name)===key(p.species))||{name:p.species,types:[],abilities:[],moves:[]};
 const typeHtml=(entry.types||[]).map(t=>`<span class="type-pill">${esc(t)}</span>`).join("");
 const abilityOptions=(entry.abilities||[]).map(a=>`<option value="${esc(a)}" ${p.ability===a?"selected":""}>${esc(a)}</option>`).join("");
 const itemOptions=`<option value="">No item</option>`+itemCatalog.map(x=>`<option value="${esc(x)}" ${p.item===x?"selected":""}>${esc(x)}</option>`).join("");
 const natureOptions=["Adamant","Bashful","Bold","Brave","Calm","Careful","Docile","Gentle","Hardy","Hasty","Impish","Jolly","Lax","Lonely","Mild","Modest","Naive","Naughty","Quiet","Quirky","Rash","Relaxed","Sassy","Serious","Timid"].map(n=>`<option ${p.nature===n?"selected":""}>${n}</option>`).join("");
 const moves=entry.moves||[];
 const moveFields=[0,1,2,3].map(j=>`<div class="move-field"><label>MOVE ${j+1}</label><input list="move-list-${i}-${j}" data-move="${j}" data-slot="${i}" value="${esc(p.moves?.[j]||"")}" placeholder="${moves.length?"Search legal moves…":"Learnset not synced"}" ${moves.length?"":"disabled"}><datalist id="move-list-${i}-${j}">${moves.map(m=>`<option value="${esc(m)}"></option>`).join("")}</datalist></div>`).join("");
 const total=(p.sp||[0,0,0,0,0,0]).reduce((a,b)=>a+(+b||0),0);
 return `<article class="slot-card" data-slot-card="${i}">
  <div class="slot-head"><div><div class="slot-number">SLOT 0${i+1}</div><div class="slot-title">${esc(p.species)}</div></div><div class="slot-actions"><button class="icon-btn change-pokemon" data-slot="${i}" title="Change Pokémon">↻</button><button class="icon-btn remove-pokemon" data-slot="${i}" title="Remove Pokémon">✕</button></div></div>
  <div class="poke-identity"><div class="poke-avatar">${esc((p.species||"?").split(/[\s-]/).map(x=>x[0]).join("").slice(0,3).toUpperCase())}</div><div><div class="poke-name">${esc(p.species)}</div><div class="type-list">${typeHtml||'<span class="type-pill">Type data pending</span>'}</div></div></div>
  <div class="fields-grid">
   <div class="field"><label>ABILITY</label><select data-field="ability" data-slot="${i}"><option value="">Choose ability</option>${abilityOptions}</select></div>
   <div class="field"><label>HELD ITEM</label><select data-field="item" data-slot="${i}">${itemOptions}</select></div>
   <div class="field"><label>NATURE</label><select data-field="nature" data-slot="${i}"><option value="">Choose nature</option>${natureOptions}</select></div>
   <div class="field"><label>TERA TYPE (OPTIONAL)</label><select data-field="tera" data-slot="${i}"><option value="">None</option>${TYPES.map(t=>`<option ${p.tera===t?"selected":""}>${t}</option>`).join("")}</select></div>
  </div>
  <div class="moves-title">LEARNABLE MOVES <span class="muted">· ${moves.length} available</span></div>
  <div class="moves-grid">${moveFields}</div>
  <div class="sp-heading"><span>STAT POINTS</span><span><b>${total}</b> / 66 · max 32 per stat</span></div>
  <div class="sp-grid">${STATS.map((s,j)=>`<div class="sp-cell"><label>${s}</label><input type="number" min="0" max="32" step="1" data-sp="${j}" data-slot="${i}" value="${p.sp?.[j]??0}"></div>`).join("")}</div>
  <div class="card-foot"><span class="muted">${moves.length?"Moves restricted to the synced Champions learnset.":"No verified learnset found for this entry."}</span><span class="warning">${total>66?"SP over budget":""}</span></div>
 </article>`;
}
function renderAll(){
 if(!db)return;
 $("teamGrid").innerHTML=team.map((p,i)=>makeSlot(p,i)).join("");
 $("teamGrid").querySelectorAll(".add-pokemon,.change-pokemon").forEach(b=>b.onclick=()=>openDex(+b.dataset.slot));
 $("teamGrid").querySelectorAll(".remove-pokemon").forEach(b=>b.onclick=()=>{team[+b.dataset.slot]=null;saveTeam();renderAll();});
 $("teamGrid").querySelectorAll("[data-field]").forEach(el=>el.onchange=()=>{const p=team[+el.dataset.slot];if(!p)return;p[el.dataset.field]=el.value;saveTeam();renderSummary();});
 $("teamGrid").querySelectorAll("[data-move]").forEach(el=>el.onchange=()=>{const i=+el.dataset.slot,j=+el.dataset.move,p=team[i];if(!p)return;const entry=dex.find(x=>key(x.name)===key(p.species));const val=el.value.trim();if(val&&!(entry?.moves||[]).some(m=>key(m)===key(val))){el.value=p.moves[j]||"";return;}p.moves[j]=val;saveTeam();});
 $("teamGrid").querySelectorAll("[data-sp]").forEach(el=>el.onchange=()=>{const p=team[+el.dataset.slot];if(!p)return;const j=+el.dataset.sp;let val=Math.max(0,Math.min(32,Number(el.value)||0));p.sp=p.sp||[0,0,0,0,0,0];const other=p.sp.reduce((a,b,k)=>a+(k===j?0:(+b||0)),0);val=Math.min(val,Math.max(0,66-other));p.sp[j]=val;el.value=val;saveTeam();renderAll();});
 renderSummary();renderChecks();renderDbStats();
}
function renderSummary(){
 const filled=team.filter(Boolean);$("teamCount").textContent=`${filled.length} / 6`;
 const total=filled.reduce((n,p)=>n+(p.sp||[]).reduce((a,b)=>a+(+b||0),0),0);$("spTotal").textContent=`${total} / 396`;
 $("itemCount").textContent=filled.filter(p=>p.item).length;
 $("teamStatus").textContent=filled.length===6?"Full team":filled.length?`${6-filled.length} open slot${filled.length===1?"":"s"}`:"Add a Pokémon to begin.";
}
function renderChecks(){
 const filled=team.filter(Boolean),rows=[];
 if(filled.length!==6)rows.push([false,`Team has ${filled.length} of 6 Pokémon.`]);
 else rows.push([true,"Team has six Pokémon."]);
 const items=filled.map(p=>p.item).filter(Boolean);const dup=items.filter((x,i)=>items.indexOf(x)!==i);
 rows.push([!dup.length,dup.length?`Duplicate held items: ${[...new Set(dup)].join(", ")}.`:"No duplicate held items."]);
 const total=filled.reduce((n,p)=>n+(p.sp||[]).reduce((a,b)=>a+(+b||0),0),0);
 rows.push([total<=396,`Team Stat Points: ${total} / 396.`]);
 filled.forEach(p=>{
  const e=dex.find(x=>key(x.name)===key(p.species));
  if(!e?.abilities?.length)rows.push([false,`${p.species}: ability data unavailable.`]);
  else if(!e.abilities.includes(p.ability))rows.push([false,`${p.species}: select one of its listed abilities.`]);
  const invalid=(p.moves||[]).filter(m=>m&&!(e?.moves||[]).some(x=>key(x)===key(m)));
  if(invalid.length)rows.push([false,`${p.species}: illegal or unverified move(s): ${invalid.join(", ")}.`]);
 });
 $("checks").innerHTML=rows.map(([ok,t])=>`<div class="check-row"><span class="check-dot ${ok?"":"warn"}"></span><span>${esc(t)}</span></div>`).join("");
}
function renderDbStats(){
 const n=dex.length,items=itemCatalog.length,moves=db.moves?.length||0,abilities=db.abilities?.length||0,learn=db.learnsetsCount||0;
 $("dbStats").innerHTML=[["Pokémon / forms",n],["Held items",items],["Moves",moves],["Abilities",abilities],["Learnsets",`${learn} / ${n}`],["Database",db.version?new Date(db.version).toLocaleDateString():"Cached"]].map(([l,v])=>`<div class="db-stat"><strong>${esc(v)}</strong><span>${esc(l)}</span></div>`).join("");
 $("connection").textContent="Offline database ready";
}
function openDex(slot){
 selectedSlot=slot;$("dexSearch").value="";renderDexResults("");$("dexDialog").showModal();$("dexSearch").focus();
}
function renderDexResults(query){
 const q=key(query);const results=dex.filter(p=>!q||key(p.name).includes(q)||key(p.types.join(" ")).includes(q)).slice(0,180);
 $("dexResults").innerHTML=results.map(p=>`<button class="dex-option" data-name="${esc(p.name)}"><span class="dex-monogram">${esc(p.name.split(/[\s-]/).map(x=>x[0]).join("").slice(0,3).toUpperCase())}</span><span><strong>${esc(p.name)}</strong><small>${esc((p.types||[]).join(" · ")||"Pokémon")}${p.abilities?.length?" · "+esc(p.abilities.join(", ")):""}</small></span></button>`).join("")||'<p class="muted">No matching Pokémon in the synced M-C Pokédex.</p>';
 $("dexResults").querySelectorAll("[data-name]").forEach(b=>b.onclick=()=>selectPokemon(b.dataset.name));
}
function selectPokemon(name){
 const entry=dex.find(p=>key(p.name)===key(name));if(!entry)return;
 const existing=team[selectedSlot];
 team[selectedSlot]={species:entry.name,ability:entry.abilities?.[0]||"",item:"",nature:"",tera:"",moves:["","","",""],sp:existing?.sp||[0,0,0,0,0,0]};
 $("dexDialog").close();saveTeam();renderAll();
}
function exportText(){
 const out=[];
 for(const p of team.filter(Boolean)){
  out.push(`${p.species}${p.item?" @ "+p.item:""}`);
  if(p.ability)out.push(`Ability: ${p.ability}`);
  if(p.nature)out.push(`${p.nature} Nature`);
  if(p.tera)out.push(`Tera Type: ${p.tera}`);
  const sp=p.sp||[0,0,0,0,0,0];
  const invested=sp.map((v,i)=>v?`${v} ${STAT_LABELS[i]}`:null).filter(Boolean);
  if(invested.length)out.push(`SP: ${invested.join(" / ")}`);
  for(const m of (p.moves||[]).filter(Boolean))out.push(`- ${m}`);
  out.push("");
 }
 return out.join("\n").trim();
}
function parseTeamText(text){
 const blocks=text.trim().split(/\n\s*\n/).filter(Boolean).slice(0,6);
 return blocks.map(block=>{
  const lines=block.split(/\r?\n/).map(x=>x.trim()).filter(Boolean),head=lines.shift()||"";
  const species=head.split(" @ ")[0].trim();const item=head.includes(" @ ")?head.split(" @ ").slice(1).join(" @ ").trim():"";
  const entry=dex.find(p=>key(p.name)===key(species));
  const p={species:entry?.name||species,item,ability:"",nature:"",tera:"",moves:[],sp:[0,0,0,0,0,0]};
  for(const l of lines){
   if(l.startsWith("Ability:"))p.ability=l.slice(8).trim();
   else if(l.endsWith(" Nature"))p.nature=l.replace(/ Nature$/,"");
   else if(l.startsWith("Tera Type:"))p.tera=l.slice(10).trim();
   else if(l.startsWith("SP:")){const re=/(\d+)\s+(HP|Atk|Def|SpA|SpD|Spe)/g;let m;while((m=re.exec(l)))p.sp[STAT_LABELS.indexOf(m[2])]=+m[1];}
   else if(l.startsWith("- "))p.moves.push(l.slice(2).trim());
  }
  while(p.moves.length<4)p.moves.push("");
  p.moves=p.moves.slice(0,4);
  return p;
 }).filter(p=>p.species);
}
function openExport(){ $("textDialogTitle").textContent="Export Champions team";$("teamText").value=exportText();$("applyImport").classList.add("hidden");$("textMessage").textContent="Champions-style team text. Copy this to back up or share your team.";$("textDialog").showModal();}
function openImport(){ $("textDialogTitle").textContent="Import team text";$("teamText").value="";$("applyImport").classList.remove("hidden");$("textMessage").textContent="Paste a team exported from this builder. Pokémon names must match the synced Pokédex.";$("textDialog").showModal();}
function openSaved(){
 const saved=JSON.parse(localStorage.getItem("championsSavedTeams")||"{}");const names=Object.keys(saved);
 $("savedTeams").innerHTML=names.length?names.map(n=>`<div class="saved-row"><div><strong>${esc(n)}</strong><small>${(saved[n].team||[]).filter(Boolean).length} Pokémon · ${esc(saved[n].saved||"")}</small></div><div><button class="btn btn-secondary" data-load="${esc(n)}">Load</button><button class="btn btn-secondary" data-delete="${esc(n)}">Delete</button></div></div>`).join(""):'<p class="muted">No saved teams yet.</p>';
 $("savedTeams").querySelectorAll("[data-load]").forEach(b=>b.onclick=()=>{const x=saved[b.dataset.load];team=x.team; $("teamName").value=b.dataset.load;saveTeam();renderAll();$("loadDialog").close();});
 $("savedTeams").querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>{delete saved[b.dataset.delete];localStorage.setItem("championsSavedTeams",JSON.stringify(saved));openSaved();});
 $("loadDialog").showModal();
}
function bind(){
 $("syncBtn").onclick=syncDatabase;
 $("newTeamBtn").onclick=()=>{if(confirm("Start a new team? Save the current team first if you want to keep it.")){team=Array(6).fill(null);$("teamName").value="My Champions Team";saveTeam();renderAll();}};
 $("saveBtn").onclick=()=>{const name=$("teamName").value.trim()||"My Champions Team";const saved=JSON.parse(localStorage.getItem("championsSavedTeams")||"{}");saved[name]={team:JSON.parse(JSON.stringify(team)),saved:new Date().toLocaleString()};localStorage.setItem("championsSavedTeams",JSON.stringify(saved));saveTeam();$("teamStatus").textContent=`Saved “${name}”.`;};
 $("loadBtn").onclick=openSaved;$("exportBtn").onclick=openExport;$("importBtn").onclick=openImport;
 $("closeDex").onclick=()=>$("dexDialog").close();$("dexSearch").oninput=e=>renderDexResults(e.target.value);
 $("closeText").onclick=()=>$("textDialog").close();$("closeLoad").onclick=()=>$("loadDialog").close();
 $("copyText").onclick=async()=>{try{await navigator.clipboard.writeText($("teamText").value);$("textMessage").textContent="Copied to clipboard.";}catch{$("teamText").select();$("textMessage").textContent="Select and copy the text manually.";}};
 $("applyImport").onclick=()=>{const parsed=parseTeamText($("teamText").value);if(!parsed.length){$("textMessage").textContent="No recognizable Pokémon found.";return;}team=Array.from({length:6},(_,i)=>parsed[i]||null);saveTeam();renderAll();$("textDialog").close();};
}
async function init(){
 bind();loadTeam();
 const cached=await cacheGet(DB_KEY);
 if(cached){db=cached;prepareCatalogs();renderAll();$("setupPanel").classList.add("hidden");}
 else{$("setupPanel").classList.remove("hidden");$("connection").textContent="First sync required";}
 // If cached DB is available, don't force a network request. The app stays usable offline.
 if(!db){$("teamGrid").innerHTML='<div class="panel"><h3>Sync required</h3><p class="muted">Connect once and tap “Sync database” to download the Regulation M-C Pokédex, items, abilities and Pokémon-specific move lists to this iPhone.</p></div>';}
}
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));
init();
