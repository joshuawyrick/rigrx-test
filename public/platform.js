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
