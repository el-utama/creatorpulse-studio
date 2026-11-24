// Only loaded by the Playwright local production-server command. No real TikTok calls.
const originalFetch = globalThis.fetch;
let initCount = 0;
const mockKeys=new Map(),mockHashes=new Map(),mockLists=new Map();
const reply = data => Response.json({data,error:{code:'ok'}});
globalThis.fetch = async (input, options) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if(url.hostname==='mock-local-bridge.invalid')return originalFetch('http://127.0.0.1:8765/storage/v1',options);
  if(url.hostname==='mock-redis.invalid'){
    const [cmd,...a]=JSON.parse(options.body);let result=null;
    const hash=k=>{if(!mockHashes.has(k))mockHashes.set(k,new Map());return mockHashes.get(k)};
    if(cmd==='SET'){if(!mockKeys.has(a[0])){mockKeys.set(a[0],a[1]);result='OK';}}
    else if(cmd==='HGET')result=hash(a[0]).get(a[1])??null;
    else if(cmd==='HKEYS')result=[...hash(a[0]).keys()];
    else if(cmd==='HDEL')result=Number(hash(a[0]).delete(a[1]));
    else if(cmd==='LRANGE')result=mockLists.get(a[0])||[];
    else if(cmd==='EVAL'){
      const [script,_,k,x,y,z]=a;
      if(script.includes("post_create")){const h=hash(k);if(h.has(x))result=2;else if(h.size>=100)result=0;else{h.set(x,y);result=1;}}
      else if(script.includes("redis.call('HEXISTS'")){const h=hash(k);if(!h.has(x)&&h.size>=3)result=0;else{h.set(x,y);result=1;}}
      else if(script.includes("redis.call('HGET'")){const h=hash(k);if(h.get(x)!==y)result=0;else{h.set(x,z);result=1;}}
      else if(script.includes("redis.call('LPUSH'")){mockLists.set(k,[x,...(mockLists.get(k)||[])].slice(0,500));result=1;}
      else if(script.includes("redis.call('DEL'")){result=mockKeys.get(k)===x?Number(mockKeys.delete(k)):0;}
      else return Response.json({error:'unknown mock script'},{status:400});
    }else return Response.json({error:'unknown mock command'},{status:400});
    return Response.json({result});
  }
  if (url.hostname === 'open.tiktokapis.com') {
    if (url.pathname.endsWith('/oauth/token/')) {
      const params=new URLSearchParams(options.body);
      const code=params.get('code');
      if(code==='account-a'||code==='account-b')return Response.json({open_id:code,access_token:code,refresh_token:code+'-refresh',expires_in:3600,refresh_expires_in:604800});
      return Response.json({access_token:'renewed',refresh_token:'renewed-refresh',expires_in:3600});
    }
    const auth = new Headers(options?.headers).get('Authorization');
    if(auth==='Bearer expired') return Response.json({error:{code:'access_token_invalid'}},{status:401});
    const body = options?.body ? JSON.parse(options.body) : {};
    if (url.pathname.endsWith('/user/info/')) return reply({user:{open_id:auth==='Bearer account-a'?'account-a':auth==='Bearer account-b'?'account-b':'mock-stable-account',display_name:auth==='Bearer account-a'?'Account A':auth==='Bearer account-b'?'Account B':'Mock Creator'}});
    if (url.pathname.endsWith('/video/list/')) return reply({videos:[{id:body.cursor?'v2':'v1',title:body.cursor?'Video lama':'Video terbaru',cover_image_url:'',create_time:1,share_url:'https://www.tiktok.com/',view_count:3,like_count:1,comment_count:0,share_count:0}],cursor:body.cursor?0:123,has_more:!body.cursor});
    if (url.pathname.endsWith('/creator_info/query/')) return reply({creator_nickname:'Test Creator',creator_username:'test',privacy_level_options:['SELF_ONLY','PUBLIC_TO_EVERYONE'],comment_disabled:true,duet_disabled:true,stitch_disabled:true,max_video_post_duration_sec:60});
    if (url.pathname.endsWith('/video/init/')) {
      const source = body.source_info;
      if(source?.video_url?.includes('unverified')) return Response.json({error:{code:'url_ownership_unverified'}},{status:400});
      if (!source || source.source_type || !['FILE_UPLOAD','PULL_FROM_URL'].includes(source.source)) return Response.json({error:{code:'invalid_param'}},{status:400});
      if (source.source === 'PULL_FROM_URL' && !source.video_url?.startsWith('https://')) return Response.json({error:{code:'invalid_param'}},{status:400});
      if (source.source === 'FILE_UPLOAD' && (source.video_size !== source.chunk_size || source.total_chunk_count !== 1)) return Response.json({error:{code:'invalid_param'}},{status:400});
      const inbox = url.pathname.includes('/inbox/');
      if (inbox ? !!body.post_info : (body.post_info?.privacy_level !== 'SELF_ONLY' || typeof body.post_info?.brand_content_toggle !== 'boolean')) return Response.json({error:{code:'invalid_param'}},{status:400});
      return reply({publish_id:(inbox?'server-inbox-':'server-direct-')+(++initCount),...(source.source==='FILE_UPLOAD'?{upload_url:'https://open-upload.tiktokapis.com/video/?test=1'}:{})});
    }
    if (url.pathname.endsWith('/status/fetch/')) return body.publish_id ? reply(body.publish_id==='failed-test'?{status:'FAILED',fail_reason:'video_pull_failed'}:{status:'PUBLISH_COMPLETE'}) : Response.json({error:{code:'invalid_param'}},{status:400});
    return Response.json({error:{code:'unmocked_endpoint'}},{status:502});
  }
  if (url.hostname === 'open-upload.tiktokapis.com') {
    const headers = new Headers(options?.headers);
    return new Response(null,{status:options?.method === 'PUT' && headers.get('Content-Range') === 'bytes 0-3/4' && headers.get('Content-Length') === '4'?201:400});
  }
  return originalFetch(input,options);
};
