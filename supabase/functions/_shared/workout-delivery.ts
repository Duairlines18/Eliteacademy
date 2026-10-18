// Fetch only canonical active movements referenced by reviewed rows in this bundle.
// Stored URLs never become authority, and no assignment/auth decisions happen here.
export async function loadReviewedBlockExercises(client: any, blocks: any[], exercises: any[]) {
  const names = [...new Set(blocks.flatMap(block => {
    const items = block?.content?.items;
    return (Array.isArray(block?.content?.video_links) ? block.content.video_links : [])
      .filter((link: any) => Array.isArray(items) && Number.isInteger(link?.item_index)
        && link.item_index >= 0 && typeof items[link.item_index] === 'string'
        && typeof link.exercise === 'string' && link.exercise.trim())
      .map((link: any) => link.exercise);
  }))].filter(name => !exercises.some(exercise => exercise.name === name));
  if (!names.length) return exercises;
  const {data, error} = await client.from('exercises')
    .select('id,code,name,category_slug,categories,video_id,video_url,description,purpose,coaching_cues,default_dosage,display_order,active')
    .in('name', names).eq('active', true).order('display_order');
  if (error) throw new Error('Reviewed exercise lookup failed: ' + error.message);
  return [...new Map([...exercises, ...(data || [])].map(exercise => [exercise.code, exercise])).values()];
}
