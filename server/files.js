const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const multer=require('multer');
const {q,one}=require('./db');
const config=require('./config');
const directory=path.resolve(process.env.UPLOAD_DIR || path.join(__dirname,'../uploads'));
fs.mkdirSync(directory,{recursive:true});
const s3=config.storageMode==='s3'?new (require('@aws-sdk/client-s3').S3Client)({region:process.env.S3_REGION,endpoint:process.env.S3_ENDPOINT||undefined,credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY}}):null;
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024,files:1,fields:2}}).single('file');
function type(buffer){
 if(buffer.subarray(0,3).equals(Buffer.from([255,216,255])))return ['jpg','image/jpeg'];
 if(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return ['png','image/png'];
 if(/^GIF8[79]a/.test(buffer.toString('ascii',0,6)))return ['gif','image/gif'];
 if(buffer.toString('ascii',0,4)==='RIFF' && buffer.toString('ascii',8,12)==='WEBP')return ['webp','image/webp'];
 if(buffer.toString('ascii',0,5)==='%PDF-')return ['pdf','application/pdf'];
 if(buffer.toString('ascii',4,8)==='ftyp' && /^(heic|heix|hevc|hevx|mif1|msf1)$/.test(buffer.toString('ascii',8,12)))return ['heic','image/heic'];
 return null;
}
async function save(req,res){
 if(!req.file) return res.status(400).json({error:'Choose a photo or PDF'});
 const kind=type(req.file.buffer);
 if(!kind)return res.status(400).json({error:'Upload a valid JPG, PNG, GIF, WebP, HEIC or PDF'});
 const filename=crypto.randomBytes(24).toString('hex')+'.'+kind[0];
 if(s3){const {PutObjectCommand}=require('@aws-sdk/client-s3');await s3.send(new PutObjectCommand({Bucket:process.env.S3_BUCKET,Key:filename,Body:req.file.buffer,ContentType:kind[1]}));}
 else await fs.promises.writeFile(path.join(directory,filename),req.file.buffer,{flag:'wx'});
 await q('INSERT INTO file_uploads(filename,owner_id,mime,backend) VALUES($1,$2,$3,$4)',[filename,req.user.id,kind[1],config.storageMode]);
 res.json({url:'/uploads/'+filename});
}
async function owned(user,urls){
 if(!Array.isArray(urls)||urls.length>12)return false;
 for(const url of urls){
  if(typeof url!=='string'||!/^\/uploads\/[a-f0-9]+\.[a-z0-9]+$/i.test(url))return false;
  const f=await one('SELECT owner_id FROM file_uploads WHERE filename=$1',[url.slice(9)]);
  if(!f || f.owner_id!==user.id)return false;
 }
 return true;
}
async function download(req,res,next){
 try{
  if(!req.user)return res.status(401).json({error:'Sign in required'});
  const filename=req.params.filename;
  if(!/^[a-f0-9]+\.(jpg|jpeg|png|webp|gif|heic|heif|pdf)$/i.test(filename))return res.sendStatus(404);
  const f=await one('SELECT * FROM file_uploads WHERE filename=$1',[filename]);
  const url='/uploads/'+filename;
  let allowed=req.user.role==='admin'||f?.owner_id===req.user.id;
  if(!allowed){
   const r=await one(`SELECT r.id FROM requests r WHERE r.photos ? $1 AND (
     r.driver_id=$2 OR (r.fleet_id=$3 AND $4::boolean) OR EXISTS(
       SELECT 1 FROM purchases pu WHERE pu.request_id=r.id AND pu.provider_id=$5 AND pu.refunded=FALSE
       AND ($6::boolean OR r.assigned_tech=$2))) LIMIT 1`,
     [url,req.user.id,req.user.fleet_id, ['owner','dispatcher'].includes(req.user.fleet_role),req.user.company_id||req.user.id,req.user.role==='provider'&&req.user.member_role!=='tech']);
   allowed=!!r;
  }
  // Legacy documents remain available to their company owner and admins.
  if(!allowed && req.user.role==='provider' && (!req.user.member_role||req.user.member_role==='owner')){
   allowed=!!await one("SELECT user_id FROM providers WHERE user_id=$1 AND (verification->>'coi_file'=$2 OR verification->>'w9_file'=$2)",[req.user.company_id||req.user.id,url]);
  }
  if(!allowed)return res.sendStatus(404);
  res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"});
  res.type(f?.mime||path.extname(filename));
  if(filename.endsWith('.pdf'))res.set('Content-Disposition','attachment; filename="document.pdf"');
  if(f?.backend==='s3'){
   if(!s3)return res.sendStatus(503);
   const {GetObjectCommand}=require('@aws-sdk/client-s3');
   const object=await s3.send(new GetObjectCommand({Bucket:process.env.S3_BUCKET,Key:filename}));
   object.Body.on('error',next).pipe(res);
  }else res.sendFile(path.join(directory,filename),error=>{if(error)next(error);});
 }catch(error){next(error);}
}
module.exports={upload,save,owned,download,type};
