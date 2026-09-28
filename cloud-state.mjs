// Private Cloud Storage objects; optimistic concurrency prevents lost updates across revisions.
export function createCloudState({bucket,prefix='chro',fetchImpl=globalThis.fetch,tokenProvider}={}) {
 if(!/^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/.test(bucket||''))throw Error('A valid STATE_BUCKET is required.');
 if(!/^[a-zA-Z0-9/_-]{1,120}$/.test(prefix))throw Error('Invalid cloud state prefix.');
 let cached=null;
 async function token(){
  if(tokenProvider)return tokenProvider();
  if(cached&&cached.until>Date.now()+60000)return cached.value;
  const r=await fetchImpl('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',{headers:{'Metadata-Flavor':'Google'},signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw Object.assign(Error('Cloud runtime identity is unavailable.'),{status:503});
  const data=await r.json();if(typeof data.access_token!=='string')throw Error('Invalid cloud identity response.');
  cached={value:data.access_token,until:Date.now()+Number(data.expires_in||300)*1000};return cached.value;
 }
 const object=name=>{if(!/^[a-z0-9-]+\.json$/.test(name))throw Error('Invalid state object.');return encodeURIComponent(prefix+'/'+name);};
 async function request(url,options={}){try{return await fetchImpl(url,{...options,headers:{...options.headers,Authorization:'Bearer '+await token()},signal:AbortSignal.timeout(20000)});}catch{throw Object.assign(Error('Cloud state storage is temporarily unavailable. Retry the request.'),{status:503});}}
 return {
  async read(name){
   const r=await request(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${object(name)}?alt=media`);
   if(r.status===404)return {data:null,generation:'0'};
   if(!r.ok)throw Object.assign(Error('Cloud state could not be read. Check the runtime bucket permissions.'),{status:503});
   const generation=r.headers.get('x-goog-generation');if(!generation||!/^\d+$/.test(generation))throw Error('Cloud state response did not include its version.');
   let data;try{data=await r.json();}catch{throw Error('Cloud state is invalid JSON. Restore a valid object version.');}
   return {data,generation};
  },
  async write(name,data,generation){
   if(!/^\d+$/.test(String(generation)))throw Error('Cloud state version is required.');
   const r=await request(`https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${object(name)}&ifGenerationMatch=${generation}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
   if(r.status===412)throw Object.assign(Error('The saved workspace changed in another request. Refresh and retry.'),{status:409});
   if(!r.ok)throw Object.assign(Error('Cloud state could not be saved. Check the runtime bucket permissions.'),{status:503});
   const result=await r.json();if(!/^\d+$/.test(String(result.generation)))throw Error('Cloud state write did not return a version.');return String(result.generation);
  }
 };
}
