export default async function handler(req,res){
  if(req.method!=="POST"){
    return res.status(405).json({error:"Method not allowed"});
  }

  try{
    const {message="",files=[]}=req.body||{};

    return res.status(200).json({
      success:true,
      reply:"Pesan berhasil diterima oleh backend NEX AI.",
      message,
      files:files.map(f=>({
        name:f.name,
        type:f.type,
        size:f.size
      }))
    });

  }catch(error){
    console.error(error);
    return res.status(500).json({
      success:false,
      error:"Terjadi kesalahan pada server."
    });
  }
}
