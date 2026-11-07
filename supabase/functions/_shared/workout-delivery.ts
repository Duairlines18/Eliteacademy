// Refresh reviewed references from the current authorized library on every bundle load.
// Stored URLs and ambiguous names never become demo authority.
export async function loadReviewedBlockExercises(client: any, blocks: any[], exercises: any[]) {
  const refs=blocks.flatMap(block=>(Array.isArray(block?.content?.video_links)?block.content.video_links:[])
    .filter((link:any)=>Array.isArray(block?.content?.items)&&Number.isInteger(link?.item_index)
      &&link.item_index>=0&&typeof block.content.items[link.item_index]==='string'));
  const codes=[...new Set(refs.map((link:any)=>link.exerciseCode).filter((code:any)=>typeof code==='string'&&code.trim()))];
  const names=[...new Set(refs.filter((link:any)=>!link.exerciseCode).map((link:any)=>link.exercise)
    .filter((name:any)=>typeof name==='string'&&name.trim()))];
  if(!codes.length&&!names.length)return exercises;
  const fresh:any[]=[];
  for(const [column,values] of [['code',codes],['name',names]] as const){
    if(!values.length)continue;
    const {data,error}=await client.from('exercises')
      .select('id,code,name,category_slug,categories,video_id,video_url,description,purpose,coaching_cues,default_dosage,display_order,active')
      .in(column,values).eq('active',true).order('display_order');
    if(error)throw new Error('Reviewed exercise lookup failed: '+error.message);
    fresh.push(...(data||[]));
  }
  const retained=exercises.filter(e=>!codes.includes(e.code)&&!names.includes(e.name));
  return [...new Map([...retained,...fresh].map(e=>[e.code,e])).values()];
}
