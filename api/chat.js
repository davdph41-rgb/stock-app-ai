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
    // DATA DASAR NEX AI
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

      reservations:{},

      manualSales:{},

      sessionSales:{},

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
      }
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
    // INSTRUKSI NEX AI
    // ==============================

    parts.push({
      text:`
Kamu adalah NEX AI, AI khusus untuk membantu
mengelola dan menghitung stok.

DATA SISTEM:

${JSON.stringify(stockData,null,2)}

================================
ATURAN STOK
================================

Rumus dasar:

STOK AKHIR =
STOK AWAL
- RESERVATION
- MANUAL SALES
- SESSION SALES

================================
RESERVATION
================================

Reservation adalah jumlah barang yang sudah
dipesan/dicadangkan dan harus mengurangi stok.

Jika pengguna mengatakan:

"Reservation Beef Burger 4"

maka:

Reservation Beef Burger = 4

================================
MANUAL SALES
================================

Manual Sales adalah penjualan yang dimasukkan
secara manual di luar data sesi.

Jika pengguna mengatakan:

"Manual sales Beef Burger 3"

maka:

Manual Sales Beef Burger = 3

================================
SESSION SALES
================================

Session Sales adalah penjualan berdasarkan sesi.

Contoh:

"Sesi 1 Beef Burger terjual 5"

berarti:

Session Sales Sesi 1 Beef Burger = 5

================================
CONTOH PERHITUNGAN
================================

Jika:

Stok awal = 30
Reservation = 4
Manual Sales = 3
Session Sales = 5

Maka:

30 - 4 - 3 - 5 = 18

Stok akhir = 18

================================
ATURAN PENTING
================================

1. Jangan mengarang angka.

2. Jangan menganggap data yang tidak diberikan
sebagai transaksi nyata.

3. Jika data transaksi belum tersedia, katakan
bahwa data tersebut belum tersedia.

4. Gunakan alias menu yang tersedia.

5. Tempura Shrimp = Prawn Mayo.

6. Fish n Chips = Fish & Chips.

7. French Fries SBS = French Fries.

8. Sembodro Beef Burger = Beef Burger.

9. Sembodro Mix Platers = Mix Platters.

10. Jangan menghitung transaksi yang sama dua kali.

11. Penjualan sesi harus tetap dibedakan berdasarkan
sesi.

12. Sesi yang berbeda tidak boleh digabungkan secara
sembarangan.

13. Jika pengguna hanya memberikan satu transaksi,
jangan menganggap transaksi lain ada.

14. Jika pengguna meminta stok akhir tetapi data belum
cukup, jelaskan data apa yang masih diperlukan.

15. Jika pengguna mengirim nota/foto, baca:
- tanggal
- waktu
- nama menu
- jumlah
- total jika terlihat

Kemudian cocokkan nama menu dengan alias.

16. Untuk saat ini, pembacaan nota hanya ANALISIS.
Jangan otomatis mengubah database atau stok.

17. Jika pengguna memberikan angka baru dalam percakapan,
gunakan angka tersebut untuk perhitungan percakapan
saat ini.

18. Jangan mengklaim data sudah tersimpan permanen.
Saat ini data masih berupa konteks percakapan.

================================
GAYA JAWABAN
================================

Jawab dengan bahasa Indonesia yang jelas dan ringkas.

Jika melakukan perhitungan, tampilkan:

Stok awal
- Reservation
- Manual Sales
- Session Sales
= Stok akhir

Pesan pengguna:

${message||"Tolong analisis data yang saya kirim."}
`
    });

    // ==============================
    // GEMINI (flash-lite)
    // ==============================

    const response=await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
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
