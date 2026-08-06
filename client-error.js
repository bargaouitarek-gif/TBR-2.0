module.exports = async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method==="GET"){
    res.status(200).json({ok:true,service:"tbr-client-error"});
    return;
  }
  if(req.method!=="POST"){
    res.status(405).json({ok:false,error:"method_not_allowed"});
    return;
  }
  try{
    const payload=req.body&&typeof req.body==="object"?req.body:{raw:String(req.body||"")};
    console.error("TBR_CLIENT_ERROR "+JSON.stringify({
      receivedAt:new Date().toISOString(),
      ...payload
    }));
    res.status(204).end();
  }catch(error){
    console.error("TBR_CLIENT_ERROR_ENDPOINT",error);
    res.status(204).end();
  }
};
