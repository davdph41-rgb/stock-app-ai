export default async function handler(req,res){
  if(req.method!=="POST"){
    return res.status(405).json({error:"Method not allowed"});
  }

  try{
    const apiKey=process.env.GEMINI_API_KEY;

    if(!apiKey){
      return res.status(500).json({
        error:"GEMINI_API_KEY belum tersedia di Vercel"
      });
    }

    const {message="",files=[]}=req.body||{};

    // ==============================
    // DATA NEX AI - SISTEM STOK
    // ==============================

    const stockData={
      menus:[
        "French Fries",
        "Chicken Wings",
        "Prawn Mayo",
        "Mekencis",
        "Beef Burger",
        "Fish & Chips",
        "Mix Platters"
      ],

      aliases:{
        "Tempura Shrimp":"Prawn Mayo",
        "Tempura Shrimps":"Prawn Mayo",
        "Tempura Shrimp Mayo":"Prawn Mayo",
        "Prown Mayo":"Prawn Mayo",
        "Perown Mayo":"Prawn Mayo",
        "Prawn Maywo":"Prawn Mayo",
        "Prawn Mayonaise":"Prawn Mayo",

        "Fish n Chips":"Fish & Chips",
        "Fish and Chips":"Fish & Chips",
        "Fish Chips":"Fish & Chips",

        "French Fries SBS":"French Fries",
        "Fries":"French Fries",

        "Sembodro Beef Burger":"Beef Burger",
        "Burger":"Beef Burger",

        "Sembodro Mix Platers":"Mix Platters",
        "Sembodro Mix Platters":"Mix Platters",
        "Mix Platers":"Mix Platters",
        "Mix Platter":"Mix Platters"
      },

      openingStock:{
        "French Fries":30,
        "Chicken Wings":20,
        "Prawn Mayo":14,
        "Mekencis":7,
        "Beef Burger":30,
        "Fish & Chips":15,
        "Mix Platters":10
      },

      sessions:{
        weekday:{
          "Sesi 1":"12:00-15:00",
          "Sesi 2":"15:00-17:00"
        },

        weekend:{
          "Sesi 1":"10:00-12:00",
          "Sesi 2":"12:00-15:00",
          "Sesi 3":"15:00-17:00"
        }
      },

      rules:[
        "Stok akhir = stok awal - reservation - manual sales - session sales.",
        "Tempura Shrimp dan Prawn Mayo adalah produk yang sama.",
        "Nama menu yang berbeda tetapi memiliki alias yang sama harus digabungkan.",
        "Setiap sesi dimulai dari nol untuk penjualan sesi tersebut.",
        "Penjualan sesi sebelumnya tidak boleh dihitung ulang pada sesi berikutnya.",
        "Sesi yang sudah ditutup tidak boleh diubah.",
        "Jangan mengarang jumlah stok, penjualan, reservation, atau data lainnya.",
        "Jika data yang diperlukan belum tersedia, katakan bahwa data tersebut belum tersedia.",
        "Foto nota yang dikirim pengguna hanya dianalisis terlebih dahulu dan belum otomatis mengubah stok."
      ]
    };

    // ==============================
    // FILE
    // ==============================

    const parts=[];

    for(const file of files){
      if(!file.data||!file.type) continue;

      if(
        file.type.startsWith("image/")||
        file.type==="application/pdf"
      ){
        parts.push({
          inline_data:{
            mime_type:file.type,
            data:file.data
          }
        });
      }
    }

    // ==============================
    // INSTRUKSI AI
    // ==============================

    parts.push({
      text:`
Kamu adalah NEX AI.

Kamu adalah AI yang digunakan untuk membantu mengelola,
menganalisis, dan menghitung stok.

Jangan bertindak sebagai chatbot umum jika pertanyaan
berhubungan dengan stok.

DATA SISTEM NEX AI:

${JSON.stringify(stockData,null,2)}

ATURAN PENTING:

1. Gunakan data sistem di atas sebagai data awal.
2. Jangan pernah mengarang angka.
3. Jika pengguna bertanya stok suatu menu, gunakan rumus:

   STOK AKHIR =
   STOK AWAL
   - RESERVATION
   - MANUAL SALES
   - SESSION SALES

4. Jika pengguna menggunakan nama menu yang berbeda,
   cocokkan dengan alias yang tersedia.

5. Jika data reservation, manual sales, atau session sales
   belum tersedia, jangan menganggap nilainya 0 kecuali
   memang sudah diberikan sebagai 0.

6. Jika data belum cukup untuk menghitung, jelaskan
   data apa yang masih diperlukan.

7. Jika pengguna mengirim foto nota:
   - baca tanggal
   - baca waktu
   - baca nama menu
   - baca jumlah
   - baca informasi transaksi yang terlihat
   - cocokkan nama menu dengan alias
   - jangan mengarang informasi yang tidak terlihat

8. Untuk sementara, hasil pembacaan nota hanya menjadi
   ANALISIS. Jangan otomatis mengubah stok.

9. Jika pengguna meminta perhitungan, tampilkan proses
   perhitungan secara singkat agar hasilnya mudah diperiksa.

10. Jika ada kemungkinan data ganda, beri peringatan dan
    jangan menggandakan pengurangan stok.

11. Jika pengguna bertanya mengenai sesi, gunakan jadwal
    sesi yang tersedia di DATA SISTEM.

12. Bedakan antara:
    - stok awal
    - reservation
    - manual sales
    - session sales
    - stok akhir

Pesan pengguna:
${message||"Tolong analisis data yang saya kirim."}
`
    });

    // ==============================
    // GEMINI
    // ==============================

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
