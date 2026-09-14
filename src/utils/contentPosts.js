export const CONTENT_POST_TYPE = 'content_post';
export const parseContentPost = item => { try { const meta=JSON.parse(item?.description||'{}'); if(meta?.type!==CONTENT_POST_TYPE)return null; const locations=Array.isArray(meta.locations)?meta.locations.filter(location=>typeof location==='string'&&location.trim()).map(location=>location.trim()):(meta.location?[meta.location]:[]); return {...item,locations,location:locations.join(', '),short_description:meta.short_description||'',body:meta.body||'',sort_order:Number.isFinite(Number(meta.sort_order))?Number(meta.sort_order):null}; } catch{return null;} };
export const serializeContentPost = ({locations,location,short_description,body,sort_order}) => { const normalizedLocations=(Array.isArray(locations)?locations:(location?[location]:[])).filter(value=>typeof value==='string'&&value.trim()).map(value=>value.trim()); return JSON.stringify({type:CONTENT_POST_TYPE,version:2,locations:normalizedLocations,location:normalizedLocations.join(', '),short_description:short_description.trim(),body,sort_order:Number.isFinite(Number(sort_order))?Number(sort_order):null}); };
export const sortContentPosts = posts => [...posts].sort((a,b)=>{
 const orderA=Number.isFinite(Number(a.sort_order))?Number(a.sort_order):Number.MAX_SAFE_INTEGER;
 const orderB=Number.isFinite(Number(b.sort_order))?Number(b.sort_order):Number.MAX_SAFE_INTEGER;
 if(orderA!==orderB)return orderA-orderB;
 return new Date(b.created_at||0)-new Date(a.created_at||0);
});
export const centerLabel = region => region==='강서'?'이높플레이스':'하이픈';
