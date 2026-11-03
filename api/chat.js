export default async function handler(req,res){
  if(req.method!=="POST"){
    return res.status(405).json({error:"Method not allowed"});
  }

  try{
    const apiKey=process.env.GEMINI_API_KEY;

    if(!apiKey){
      return res.status(500).json({error:"GEMINI_API_KEY belum tersedia di Vercel"});
    }

    const {message="",files=[]}=req.body||{};

    const parts=[];

    for(const file of files){
      if(!file.data||!file.type) continue;

      if(file.type.startsWith("image/")||file.type==="application/pdf"){
        parts.push({
          inline_data:{
            mime_type:file.type,
            data:file.data
          }
        });
      }
    }

    parts.push({
      text:`
Kamu adalah NEX AI, asisten AI yang ramah, jelas, dan membantu.

Jawab pertanyaan pengguna berdasarkan pesan dan file yang diberikan.
Jika pengguna mengirim foto nota, baca isi nota dengan teliti.
Identifikasi nama barang, jumlah, harga, total, tanggal, waktu, dan informasi lain yang terlihat.
Jangan mengarang informasi yang tidak terlihat.

Pesan pengguna:
${message||"Tolong analisis file yang saya kirim."}
`
    });

    const response=await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
      {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "x-goog-api-key":apiKey
        },
        body:JSON.stringify({
          contents:[
            {
              role:"user",
              parts
            }
          ]
        })
      }
    );

    const data=await response.json();

    if(!response.ok){
      console.error("Gemini error:",data);

      return res.status(response.status).json({
        error:data?.error?.message||"Gemini API gagal"
      });
    }

    const reply=
      data?.candidates?.[0]?.content?.parts
        ?.filter(p=>p.text)
        ?.map(p=>p.text)
        ?.join("\n")
        ?.trim();

    if(!reply){
      return res.status(500).json({
        error:"Gemini tidak memberikan jawaban"
      });
    }

    return res.status(200).json({
      success:true,
      reply
    });

  }catch(error){
    console.error(error);

    return res.status(500).json({
      error:"Terjadi kesalahan pada backend NEX AI"
    });
  }
}
