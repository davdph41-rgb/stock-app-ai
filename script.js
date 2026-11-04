
const chat=document.querySelector("#chat");
const form=document.querySelector("#form");
const msg=document.querySelector("#msg");
const pick=document.querySelector("#pick");
const filesBox=document.querySelector("#files");
const newBtn=document.querySelector("#new");

let files=[];
let pendingAction=null;

// =================================
// DATA STOK
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

// =================================
// LOCAL STORAGE
// =================================

function loadStock(){
  try{
    const saved=JSON.parse(
      localStorage.getItem(STORAGE_KEY)
    );

    if(saved&&Array.isArray(saved.transactions)){
      return saved;
    }
  }catch(e){
    console.error(e);
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

// =================================
// MENU
// =================================

function normalizeMenu(name){
  const value=name.trim().toLowerCase();

  if(aliases[value])return aliases[value];

  return Object.keys(openingStock).find(
    menu=>menu.toLowerCase()===value
  )||null;
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
// MESIN STOK
// =================================

function getSales(menu,type){
  return stockData.transactions
    .filter(t=>t.menu===menu&&t.type===type)
    .reduce((sum,t)=>sum+t.quantity,0);
}

function getStock(menu){
  const opening=openingStock[menu];
  const reservation=getSales(menu,"reservation");
  const manual=getSales(menu,"manual");
  const session=getSales(menu,"session");

  return{
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

function getAllStock(){
  let report="RINGKASAN STOK NEX AI\n\n";
  let total=0;

  Object.keys(openingStock).forEach(menu=>{
    const s=getStock(menu);
    report+=`${menu}: ${s.remaining} pcs\n`;
    total+=s.remaining;
  });

  report+=`\nTotal seluruh stok: ${total} pcs`;

  return report;
}

// =================================
// TRANSAKSI BARU
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

  if(!menu||!Number.isSafeInteger(quantity)||quantity<=0){
    return{
      error:"Nama menu tidak dikenal atau jumlah tidak valid."
    };
  }

  const current=getStock(menu);

  if(quantity>current.remaining){
    return{
      error:`Transaksi ditolak. Stok ${menu} hanya ${current.remaining} pcs.`
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

  return{
    reply:`Transaksi berhasil disimpan.

Jenis: ${typeName[type]}
Menu: ${menu}
Jumlah: ${quantity} pcs

Stok tersisa: ${updated.remaining} pcs

Data tersimpan di browser ini.`
  };
}

// =================================
// RIWAYAT TRANSAKSI
// =================================

function getHistoryEntries(text=""){
  let history=[...stockData.transactions];

  const menu=findMenu(text);

  if(menu){
    history=history.filter(t=>t.menu===menu);
  }

  const sessionMatch=text.match(/sesi\s*(\d+)/i);

  if(sessionMatch){
    const session="Sesi "+sessionMatch[1];

    history=history.filter(
      t=>t.type==="session"&&t.session===session
    );
  }

  history.sort(
    (a,b)=>new Date(b.date)-new Date(a.date)
  );

  return history;
}

function getTransactionHistory(text){
  const history=getHistoryEntries(text);

  if(!history.length){
    return"Belum ada transaksi yang ditemukan.";
  }

  let report="RIWAYAT TRANSAKSI NEX AI\n\n";

  history.forEach((t,i)=>{
    const date=new Date(t.date).toLocaleString("id-ID",{
      dateStyle:"medium",
      timeStyle:"short"
    });

    const type={
      reservation:"Reservation",
      manual:"Manual Sales",
      session:"Session Sales - "+t.session
    }[t.type]||t.type;

    report+=`${i+1}. ${t.menu}\n`;
    report+=`Jenis: ${type}\n`;
    report+=`Jumlah: ${t.quantity} pcs\n`;
    report+=`Tanggal: ${date}\n\n`;
  });

  const total=history.reduce(
    (sum,t)=>sum+t.quantity,0
  );

  report+=`Total transaksi: ${history.length}\n`;
  report+=`Total jumlah tercatat: ${total} pcs`;

  return report;
}

// =================================
// EDIT DAN HAPUS
// =================================

function requestDelete(text){
  const match=text.match(
    /^hapus\s+transaksi\s+(\d+)$/i
  );

  if(!match)return null;

  const number=Number(match[1]);
  const history=getHistoryEntries();

  const transaction=history[number-1];

  if(!transaction){
    return"Nomor transaksi tidak ditemukan. Periksa riwayat transaksi terlebih dahulu.";
  }

  pendingAction={
    type:"delete",
    id:transaction.id
  };

  return `KONFIRMASI HAPUS TRANSAKSI

Menu: ${transaction.menu}
Jenis: ${transaction.type}
Jumlah: ${transaction.quantity} pcs

Apakah kamu yakin ingin menghapus transaksi nomor ${number}?

Ketik:
KONFIRMASI HAPUS

Atau ketik:
BATAL`;
}

function requestEdit(text){
  const match=text.match(
    /^ubah\s+transaksi\s+(\d+)\s+(?:menjadi|ke)\s+(\d+)$/i
  );

  if(!match)return null;

  const number=Number(match[1]);
  const newQuantity=Number(match[2]);
  const history=getHistoryEntries();

  const transaction=history[number-1];

  if(!transaction){
    return"Nomor transaksi tidak ditemukan. Periksa riwayat transaksi terlebih dahulu.";
  }

  if(!Number.isSafeInteger(newQuantity)||newQuantity<=0){
    return"Jumlah baru harus berupa angka positif.";
  }

  const current=getStock(transaction.menu);

  const available=current.remaining+transaction.quantity;

  if(newQuantity>available){
    return`Perubahan ditolak. Jumlah maksimal yang dapat dimasukkan adalah ${available} pcs.`;
  }

  pendingAction={
    type:"edit",
    id:transaction.id,
    newQuantity
  };

  return `KONFIRMASI EDIT TRANSAKSI

Menu: ${transaction.menu}
Jumlah sebelumnya: ${transaction.quantity} pcs
Jumlah baru: ${newQuantity} pcs

Apakah kamu yakin ingin mengubah transaksi ini?

Ketik:
KONFIRMASI UBAH

Atau ketik:
BATAL`;
}

function confirmAction(text){
  const command=text.trim().toLowerCase();

  if(!pendingAction)return null;

  if(command==="batal"){
    pendingAction=null;
    return"Perubahan dibatalkan. Data transaksi tetap seperti sebelumnya.";
  }

  if(command==="konfirmasi hapus"){
    if(pendingAction.type!=="delete"){
      return"Perintah konfirmasi tidak sesuai. Ketik BATAL atau gunakan konfirmasi yang diminta.";
    }

    const index=stockData.transactions.findIndex(
      t=>t.id===pendingAction.id
    );

    if(index===-1){
      pendingAction=null;
      return"Transaksi tidak ditemukan. Tidak ada perubahan.";
    }

    const deleted=stockData.transactions.splice(index,1)[0];

    saveStock();
    pendingAction=null;

    const updated=getStock(deleted.menu);

    return `TRANSAKSI BERHASIL DIHAPUS

Menu: ${deleted.menu}
Jumlah transaksi: ${deleted.quantity} pcs

Stok sekarang: ${updated.remaining} pcs

Stok telah dihitung ulang.`;
  }

  if(command==="konfirmasi ubah"){
    if(pendingAction.type!=="edit"){
      return"Perintah konfirmasi tidak sesuai. Ketik BATAL atau gunakan konfirmasi yang diminta.";
    }

    const transaction=stockData.transactions.find(
      t=>t.id===pendingAction.id
    );

    if(!transaction){
      pendingAction=null;
      return"Transaksi tidak ditemukan. Tidak ada perubahan.";
    }

    const oldQuantity=transaction.quantity;
    const newQuantity=pendingAction.newQuantity;

    const available=getStock(transaction.menu).remaining+oldQuantity;

    if(newQuantity>available){
      pendingAction=null;
      return`Perubahan ditolak. Stok tidak mencukupi. Maksimal ${available} pcs.`;
    }

    transaction.quantity=newQuantity;

    saveStock();
    pendingAction=null;

    const updated=getStock(transaction.menu);

    return `TRANSAKSI BERHASIL DIUBAH

Menu: ${transaction.menu}
Jumlah sebelumnya: ${oldQuantity} pcs
Jumlah sekarang: ${newQuantity} pcs

Stok terbaru: ${updated.remaining} pcs

Stok telah dihitung ulang.`;
  }

  if(command.startsWith("konfirmasi")){
    return"Konfirmasi tidak dikenali. Ikuti perintah konfirmasi yang ditampilkan atau ketik BATAL.";
  }

  return null;
}

// =================================
// CHAT
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
// FILE
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

  // KONFIRMASI TERTUNDA
  if(text&&pendingAction){
    const result=confirmAction(text);

    if(result){
      add(result,"ai");
      return;
    }
  }

  // HAPUS TRANSAKSI
  if(text){
    const result=requestDelete(text);

    if(result){
      add(result,"ai");
      return;
    }
  }

  // EDIT TRANSAKSI
  if(text){
    const result=requestEdit(text);

    if(result){
      add(result,"ai");
      return;
    }
  }

  // TRANSAKSI BARU
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

  // RIWAYAT
  if(
    text&&
    /riwayat|history|transaksi terakhir/i.test(text)
  ){
    add(getTransactionHistory(text),"ai");
    return;
  }

  // SEMUA STOK
  if(
    text&&
    /stok|persediaan/i.test(text)&&
    /semua|seluruh|total/i.test(text)
  ){
    add(getAllStock(),"ai");
    return;
  }

  // STOK MENU
  if(text&&/stok|persediaan/i.test(text)){
    const menu=findMenu(text);

    if(menu){
      add(getStockReport(menu),"ai");
      return;
    }
  }

  // GEMINI
  typing();

  try{
    const converted=[];

    for(const file of selected){
      converted.push(await fileToBase64(file));
    }

    const localContext=Object.keys(openingStock).map(menu=>({
      menu,
      ...getStock(menu)
    }));

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
  pendingAction=null;

  chat.innerHTML=`
    <section class="welcome">
      <strong>NEX</strong>
      <h1>Halo! 👋</h1>
      <p>Kirim pesan atau tambahkan file/nota untuk mulai.</p>
    </section>
  `;
};
