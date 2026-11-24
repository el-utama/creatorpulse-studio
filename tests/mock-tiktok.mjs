// Only loaded by the Playwright local production-server command. No real TikTok calls.
const originalFetch = globalThis.fetch;
let initCount = 0;
const reply = data => Response.json({data,error:{code:'ok'}});
globalThis.fetch = async (input, options) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if (url.hostname === 'open.tiktokapis.com') {
    const body = options?.body ? JSON.parse(options.body) : {};
    if (url.pathname.endsWith('/user/info/')) return reply({user:{open_id:'mock-stable-account'}});
    if (url.pathname.endsWith('/creator_info/query/')) return reply({creator_nickname:'Test Creator',creator_username:'test',privacy_level_options:['SELF_ONLY','PUBLIC_TO_EVERYONE'],comment_disabled:true,duet_disabled:true,stitch_disabled:true,max_video_post_duration_sec:60});
    if (url.pathname.endsWith('/video/init/')) {
      const source = body.source_info;
      if (!source || source.source_type || !['FILE_UPLOAD','PULL_FROM_URL'].includes(source.source)) return Response.json({error:{code:'invalid_param'}},{status:400});
      if (source.source === 'PULL_FROM_URL' && !source.video_url?.startsWith('https://')) return Response.json({error:{code:'invalid_param'}},{status:400});
      if (source.source === 'FILE_UPLOAD' && (source.video_size !== source.chunk_size || source.total_chunk_count !== 1)) return Response.json({error:{code:'invalid_param'}},{status:400});
      const inbox = url.pathname.includes('/inbox/');
      if (inbox ? !!body.post_info : (body.post_info?.privacy_level !== 'SELF_ONLY' || typeof body.post_info?.brand_content_toggle !== 'boolean')) return Response.json({error:{code:'invalid_param'}},{status:400});
      return reply({publish_id:(inbox?'server-inbox-':'server-direct-')+(++initCount),...(source.source==='FILE_UPLOAD'?{upload_url:'https://open-upload.tiktokapis.com/video/?test=1'}:{})});
    }
    if (url.pathname.endsWith('/status/fetch/')) return body.publish_id ? reply({status:'PUBLISH_COMPLETE'}) : Response.json({error:{code:'invalid_param'}},{status:400});
    return Response.json({error:{code:'unmocked_endpoint'}},{status:502});
  }
  if (url.hostname === 'open-upload.tiktokapis.com') {
    const headers = new Headers(options?.headers);
    return new Response(null,{status:options?.method === 'PUT' && headers.get('Content-Range') === 'bytes 0-3/4' && headers.get('Content-Length') === '4'?201:400});
  }
  return originalFetch(input,options);
};
