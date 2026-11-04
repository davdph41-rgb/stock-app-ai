
const chat=document.querySelector("#chat");
const form=document.querySelector("#form");
const msg=document.querySelector("#msg");
const pick=document.querySelector("#pick");
const filesBox=document.querySelector("#files");
const newBtn=document.querySelector("#new");

let files=[];

// =================================
// DATA STOK NEX AI
// =================================

const STORAGE_KEY="nex_stock_data_v1";

const openingStock={
  "French Fries":30,
  "Chicken Wings":20,
  "Prawn Mayo":14,
  "Mekencis":7,
  "Beef Burger":30,
  "Fish & Chips":15,
  "Mix Platters":10
};

const aliases={
  "tempura shrimp":"Prawn Mayo",
  "tempura shrimps":"Prawn Mayo",
  "tempura shrimp mayo":"Prawn Mayo",
  "tempura shrimp mayo":"Prawn Mayo",
  "prown mayo":"Prawn Mayo",
  "perown mayo":"Prawn Mayo",
  "prawn maywo":"Prawn Mayo",
  "prawn mayonaise":"Prawn Mayo",
  "fish n chips":"Fish & Chips",
  "fish and chips":"Fish & Chips",
  "fish chips":"Fish & Chips",
  "french fries sbs":"French Fries",
  "fries":"French Fries",
  "sembodro beef burger":"Beef Burger",
  "burger":"Beef Burger",
  "sembodro mix platers":"Mix Platters",
  "sembodro mix platters":"Mix Platters",
  "mix platers":"Mix Platters",
  "mix platter":"Mix Platters"
};

function loadStock(){
  try{
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY));

    if(saved&&Array.isArray(saved.transactions)){
      return saved;
    }
  }catch(e){
    console.error("Gagal membaca data stok:",e);
  }

  return {transactions:[]};
}

let stockData=loadStock();

function saveStock(){
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(stockData)
  );
}

function normalizeMenu(name){
  const value=name.trim().toLowerCase();

  if(aliases[value])return aliases[value];

  const match=Object.keys(openingStock).find(
    menu=>menu.toLowerCase()===value
  );

  return match||null;
}

function findMenu(text){
  const names=[
    ...Object.keys(aliases),
    ...Object.keys(openingStock)
  ].sort((a,b)=>b.length-a.length);

  const lower=text.toLowerCase();

  for(const name of names){
    if(lower.includes(name.toLowerCase())){
      return normalizeMenu(name);
    }
  }

  return null;
}

// =================================
// MESIN PERHITUNGAN STOK
// =================================

function getSales(menu,type){
  return stockData.transactions
    .filter(t=>t.menu===menu&&t.type===type)
    .reduce((sum,t)=>sum+t.quantity,0);
}

function getStock(menu){
  const reservation=getSales(menu,"reservation");
  const manual=getSales(menu,"manual");
  const session=getSales(menu,"session");

  const opening=openingStock[menu];

  return {
    opening,
    reservation,
    manual,
    session,
    remaining:
      opening-reservation-manual-session
  };
}

function getStockReport(menu){
  const s=getStock(menu);

  return `Perhitungan stok ${menu}:

Stok awal: ${s.opening}
Reservation: -${s.reservation}
Manual Sales: -${s.manual}
Session Sales: -${s.session}

${s.opening} - ${s.reservation} - ${s.manual} - ${s.session} = ${s.remaining}

Stok akhir: ${s.remaining} pcs`;
}

// =================================
// MEMBACA PERINTAH TRANSAKSI
// =================================

function parseTransaction(text){
  let match;
  let type=null;
  let session=null;
  let menuText="";
  let quantity=0;

  match=text.match(
    /^reservation\s+(.+?)\s+(\d+)$/i
  );

  if(match){
    type="reservation";
    menuText=match[1];
    quantity=Number(match[2]);
  }

  if(!match){
    match=text.match(
      /^manual\s+sales\s+(.+?)\s+(\d+)$/i
    );

    if(match){
      type="manual";
      menuText=match[1];
      quantity=Number(match[2]);
    }
  }

  if(!match){
    match=text.match(
      /^sesi\s*(\d+)\s+(.+?)\s+terjual\s+(\d+)$/i
    );

    if(match){
      type="session";
      session="Sesi "+match[1];
      menuText=match[2];
      quantity=Number(match[3]);
    }
  }

  if(!match)return null;

  const menu=normalizeMenu(menuText);

  if(!menu||quantity<=0)return {
    error:"Nama menu tidak dikenal atau jumlah tidak valid."
  };

  const current=getStock(menu);

  if(quantity>current.remaining){
    return {
      error:`Transaksi ditolak. Stok ${menu} saat ini hanya ${current.remaining} pcs.`
    };
  }

  const transaction={
    id:Date.now()+"-"+Math.random().toString(36).slice(2,8),
    type,
    menu,
    quantity,
    session,
    date:new Date().toISOString()
  };

  stockData.transactions.push(transaction);
  saveStock();

  const typeName={
    reservation:"Reservation",
    manual:"Manual Sales",
    session:"Session Sales "+session
  };

  const updated=getStock(menu);

  return {
    transaction,
    reply:`Transaksi berhasil disimpan secara lokal.

Jenis: ${typeName[type]}
Menu: ${menu}
Jumlah: ${quantity} pcs

Stok awal: ${updated.opening}
Total Reservation: ${updated.reservation}
Total Manual Sales: ${updated.manual}
Total Session Sales: ${updated.session}

Stok tersisa: ${updated.remaining} pcs

Data tersimpan di browser ini.`
  };
}

// =================================
// MENAMPILKAN CHAT
// =================================

function add(text,type,fs=[]){
  const row=document.createElement("div");
  row.className="message "+type;

  const b=document.createElement("div");
  b.className="bubble";
  b.textContent=text;

  fs.forEach(f=>{
    const x=document.createElement("div");
    x.className="file-card";
    x.textContent="📎 "+f.name;
    b.appendChild(x);
  });

  row.appendChild(b);
  chat.appendChild(row);
  chat.scrollTop=chat.scrollHeight;
}

function typing(){
  const row=document.createElement("div");
  row.className="message ai";
  row.id="typing";

  const b=document.createElement("div");
  b.className="bubble";
  b.textContent="NEX AI sedang berpikir...";

  row.appendChild(b);
  chat.appendChild(row);
  chat.scrollTop=chat.scrollHeight;
}

function removeTyping(){
  document.querySelector("#typing")?.remove();
}

// =================================
// FILE UPLOAD
// =================================

function render(){
  filesBox.innerHTML="";

  files.forEach((f,i)=>{
    const x=document.createElement("span");
    x.className="chip";
    x.textContent="📎 "+f.name;

    const b=document.createElement("button");
    b.textContent="×";

    b.onclick=()=>{
      files.splice(i,1);
      render();
    };

    x.appendChild(b);
    filesBox.appendChild(x);
  });
}

pick.onchange=()=>{
  files.push(...pick.files);
  render();
  pick.value="";
};

msg.oninput=()=>{
  msg.style.height="auto";
  msg.style.height=Math.min(msg.scrollHeight,130)+"px";
};

function fileToBase64(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();

    reader.onload=()=>{
      resolve({
        name:file.name,
        type:file.type,
        size:file.size,
        data:reader.result.split(",")[1]
      });
    };

    reader.onerror=reject;
    reader.readAsDataURL(file);
  });
}

// =================================
// PROSES PESAN
// =================================

form.onsubmit=async e=>{
  e.preventDefault();

  const text=msg.value.trim();
  const selected=[...files];

  if(!text&&!selected.length)return;

  add(
    text||"Tolong analisis file ini.",
    "user",
    selected
  );

  msg.value="";
  msg.style.height="auto";
  files=[];
  render();

  // TRANSAKSI LOKAL
  if(text){
    const transaction=parseTransaction(text);

    if(transaction){
      add(
        transaction.reply||transaction.error,
        "ai"
      );
      return;
    }
  }

  // PERTANYAAN STOK
  if(text&&/stok|persediaan/i.test(text)){
    const menu=findMenu(text);

    if(menu){
      add(getStockReport(menu),"ai");
      return;
    }

    if(/semua|seluruh|total/i.test(text)){
      let report="RINGKASAN STOK NEX AI\n\n";

      Object.keys(openingStock).forEach(menu=>{
        const s=getStock(menu);
        report+=`${menu}: ${s.remaining} pcs\n`;
      });

      add(report,"ai");
      return;
    }
  }

  // GEMINI AI
  typing();

  try{
    const converted=[];

    for(const file of selected){
      converted.push(await fileToBase64(file));
    }

    const localContext=Object.keys(openingStock).map(menu=>{
      const s=getStock(menu);

      return {
        menu,
        ...s
      };
    });

    const response=await fetch("/api/chat",{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        message:
          text+
          "\n\nDATA STOK LOKAL TERKINI:\n"+
          JSON.stringify(localContext),
        files:converted
      })
    });

    const data=await response.json();

    removeTyping();

    if(!response.ok){
      add(
        "Maaf, terjadi kesalahan: "+
        (data.error||"Gemini API gagal."),
        "ai"
      );
      return;
    }

    add(
      data.reply||"AI tidak memberikan jawaban.",
      "ai"
    );

  }catch(error){
    console.error(error);
    removeTyping();

    add(
      "Tidak dapat terhubung ke server. Periksa koneksi atau backend.",
      "ai"
    );
  }
};

// =================================
// CHAT BARU
// =================================

newBtn.onclick=()=>{
  chat.innerHTML=`
    <section class="welcome">
      <strong>NEX</strong>
      <h1>Halo! 👋</h1>
      <p>Kirim pesan atau tambahkan file/nota untuk mulai.</p>
    </section>
  `;
};
