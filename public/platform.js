/* Browser implementation of the platform boundary.
   A future native client supplies an authenticated transport, uploads, GPS and
   realtime connection here; screens must not handle native credentials. */
(function(root){
  async function decode(response){
    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      const error=new Error(data.error||'Request failed');
      error.status=response.status;
      throw error;
    }
    return data;
  }
  const web={
    leadLink(hash,user){
      const match=/^#lead-([1-9]\d*)$/.exec(hash);
      if(!match || !user || user.role!=='provider' || user.member_role==='tech')return null;
      const id=Number(match[1]);
      return Number.isSafeInteger(id)?{view:'p-lead',leadId:id}:null;
    },
    liveConnection(onmessage,clock=root){
      let socket=null,timer=null,running=false;
      function clear(){if(timer!==null)clock.clearTimeout(timer);timer=null;}
      function retry(){
        if(running && timer===null)timer=clock.setTimeout(()=>{timer=null;open();},4000);
      }
      function open(){
        if(!running || socket)return;
        let current;
        try{current=web.connect();}catch(error){retry();return;}
        socket=current;
        current.onmessage=event=>{if(socket===current && running)onmessage(event);};
        current.onclose=()=>{
          if(socket!==current)return;
          socket=null;retry();
        };
      }
      return {
        start(){running=true;clear();open();},
        stop(){running=false;clear();const previous=socket;socket=null;if(previous)previous.close();}
      };
    },
    request(method,path,body){
      return fetch('/api'+path,{
        method,credentials:'same-origin',
        headers:{'Content-Type':'application/json'},
        body:body===undefined?undefined:JSON.stringify(body)
      }).then(decode);
    },
    upload(file){
      const form=new FormData();form.append('file',file);
      return fetch('/api/upload',{method:'POST',credentials:'same-origin',body:form}).then(decode);
    },
    connect(){
      return new WebSocket((location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/ws');
    },
    locate(){
      return new Promise((resolve,reject)=>{
        if(!navigator.geolocation)return reject(new Error('GPS unavailable'));
        navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:10000});
      });
    }
  };
  root.RIGRX_PLATFORM=Object.freeze(web);
})(typeof window==='undefined'?globalThis:window);
