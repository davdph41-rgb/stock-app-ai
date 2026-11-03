/* =====================================
   STOCK APP AI — CORE SYSTEM
===================================== */

const DB_KEY = "stock_ai_v1";

const DEFAULT_MENUS = [
  {id:"fries",name:"French Fries",stock:0,reservation:0,manual:0},
  {id:"wings",name:"Chicken Wings",stock:0,reservation:0,manual:0},
  {id:"prawn",name:"Prawn Mayo",stock:0,reservation:0,manual:0},
  {id:"mekencis",name:"Mekencis",stock:0,reservation:0,manual:0},
  {id:"beef",name:"Beef Burger",stock:0,reservation:0,manual:0},
  {id:"fish",name:"Fish & Chips",stock:0,reservation:0,manual:0},
  {id:"mix",name:"Mix Platters",stock:0,reservation:0,manual:0}
];

let db = loadDB();

function loadDB(){
  try{
    const saved = JSON.parse(localStorage.getItem(DB_KEY));
    if(saved && Array.isArray(saved.menus)){
      return {
        ...saved,
        menus:saved.menus,
        sessions:saved.sessions || {},
        history:saved.history || [],
        audits:saved.audits || [],
        settings:{lowLimit:5,...saved.settings}
      };
    }
  }catch(e){console.error(e)}

  return {
    menus:structuredClone(DEFAULT_MENUS),
    sessions:{},
    history:[],
    audits:[],
    settings:{lowLimit:5}
  };
}

function saveDB(){
  localStorage.setItem(DB_KEY,JSON.stringify(db));
}

function money(n){
  return Number(n||0).toLocaleString("id-ID");
}

function getMenu(id){
  return db.menus.find(m=>m.id===id);
}

function sessionSold(id){
  return Object.values(db.sessions).reduce(
    (sum,s)=>sum+(s.items?.[id]||0),0
  );
}

function remaining(m){
  return m.stock-m.reservation-m.manual-sessionSold(m.id);
}

function totalSold(){
  return db.menus.reduce(
    (sum,m)=>sum+m.manual+sessionSold(m.id),0
  );
}

function addHistory(type,menu,qty,detail=""){
  db.history.unshift({
    id:Date.now()+Math.random(),
    date:new Date().toISOString(),
    type,menu,qty,detail
  });
  saveDB();
}

function toast(message){
  const el=document.getElementById("toast");
  el.textContent=message;
  el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"),2400);
}

/* =====================================
   NAVIGATION
===================================== */

function showPage(page){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.querySelectorAll(".nav-item[data-page]").forEach(b=>b.classList.remove("active"));

  document.getElementById(page)?.classList.add("active");
  document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add("active");

  const names={
    dashboard:"Dashboard",
    stock:"Stock Management",
    sessions:"Session Management",
    scanner:"AI Receipt Scanner",
    audit:"AI Stock Audit",
    history:"Transaction History",
    reports:"Reports",
    settings:"Settings & Backup"
  };

  document.getElementById("pageTitle").textContent=names[page]||page;
  document.getElementById("sidebar").classList.remove("open");

  renderAll();
}

document.querySelectorAll(".nav-item[data-page]").forEach(btn=>{
  btn.addEventListener("click",()=>showPage(btn.dataset.page));
});

document.getElementById("menuToggle").onclick=()=>{
  document.getElementById("sidebar").classList.toggle("open");
};

/* =====================================
   DATE & SESSION SYSTEM
===================================== */

function localDate(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function getDayType(date){
  const day=new Date(date+"T12:00:00").getDay();
  return day===0||day===6?"weekend":"weekday";
}

function getSchedule(type){
  if(type==="weekend"){
    return [
      {name:"Sesi 1",time:"10.00 – 12.00"},
      {name:"Sesi 2",time:"12.00 – 15.00"},
      {name:"Sesi 3",time:"15.00 – 17.00"}
    ];
  }

  return [
    {name:"Sesi 1",time:"12.00 – 15.00"},
    {name:"Sesi 2",time:"15.00 – 17.00"}
  ];
}

function getSessionKey(date,index){
  return `${date}_session_${index}`;
}

function getSession(date,index){
  const key=getSessionKey(date,index);

  if(!db.sessions[key]){
    db.sessions[key]={
      date,index,items:{},locked:false,createdAt:new Date().toISOString()
    };
    saveDB();
  }

  return db.sessions[key];
}

function renderSessions(){
  const date=document.getElementById("sessionDate").value||localDate();
  const selected=document.getElementById("dayType").value;
  const type=selected==="auto"?getDayType(date):selected;
  const schedule=getSchedule(type);

  document.getElementById("sessionList").innerHTML=schedule.map((item,i)=>{
    const s=getSession(date,i+1);
    const total=Object.values(s.items).reduce((a,b)=>a+b,0);

    const chips=db.menus.filter(m=>s.items[m.id]>0).map(m=>
      `<span class="session-chip">${m.name}: <b>${s.items[m.id]}</b></span>`
    ).join("");

    return `
      <div class="session-card">
        <div class="session-top">
          <div>
            <h3>${item.name}</h3>
            <div class="session-meta">${item.time} · ${date}</div>
          </div>
          <span class="pill ${s.locked?"good":"low"}">${s.locked?"TERKUNCI":"TERBUKA"}</span>
        </div>
        <div class="session-meta">Total penjualan: <b>${total} item</b></div>
        <div class="session-items">${chips||'<span class="empty">Belum ada data penjualan.</span>'}</div>
        <div class="session-buttons">
          ${!s.locked?`
            <button class="secondary-btn" onclick="openSessionSale('${date}',${i+1})">＋ Input Penjualan</button>
            <button class="primary-btn" onclick="closeSession('${date}',${i+1})">Tutup & Kunci Sesi</button>
          `:`<span class="pill good">✓ Sesi sudah dikunci</span>`}
        </div>
      </div>`;
  }).join("");

  renderDashboardSessions();
}

function openSessionSale(date,index){
  const s=getSession(date,index);

  if(s.locked)return toast("Sesi sudah dikunci.");

  showModal("Input Penjualan Sesi",`
    <div class="form-group">
      <label>PILIH MENU</label>
      <select id="saleMenu">
        ${db.menus.map(m=>`<option value="${m.id}">${m.name}</option>`).join("")}
      </select>
    </div>
    <div class="form-group">
      <label>JUMLAH TERJUAL</label>
      <input type="number" id="saleQty" min="1" placeholder="Masukkan jumlah">
    </div>
    <div class="modal-actions">
      <button class="secondary-btn" onclick="closeModal()">Batal</button>
      <button class="primary-btn" onclick="saveSessionSale('${date}',${index})">Simpan</button>
    </div>
  `);
}

function saveSessionSale(date,index){
  const id=document.getElementById("saleMenu").value;
  const qty=Number(document.getElementById("saleQty").value);
  const s=getSession(date,index);

  if(!Number.isInteger(qty)||qty<1)return toast("Masukkan jumlah yang valid.");

  const m=getMenu(id);
  if(qty>remaining(m))return toast("Jumlah melebihi stok tersedia.");

  s.items[id]=(s.items[id]||0)+qty;

  addHistory("Penjualan Sesi",m.name,qty,`Sesi ${index} · ${date}`);
  saveDB();
  closeModal();
  renderAll();
  toast("Penjualan sesi berhasil disimpan.");
}

function closeSession(date,index){
  const s=getSession(date,index);
  const total=Object.values(s.items).reduce((a,b)=>a+b,0);

  if(!confirm(`Kunci Sesi ${index}?\nTotal penjualan: ${total} item.\nData tidak bisa diubah setelah dikunci.`))return;

  s.locked=true;
  s.closedAt=new Date().toISOString();
  saveDB();
  renderAll();
  toast("Sesi berhasil dikunci.");
}

/* =====================================
   STOCK MANAGEMENT
===================================== */

function renderStock(){
  const search=(document.getElementById("stockSearch")?.value||"").toLowerCase();

  const menus=db.menus.filter(m=>m.name.toLowerCase().includes(search));

  document.getElementById("stockTable").innerHTML=`
    <table>
      <thead><tr>
        <th>MENU</th><th>STOK AWAL</th><th>RESERVASI</th>
        <th>MANUAL</th><th>SESI</th><th>SISA STOK</th><th>AKSI</th>
      </tr></thead>
      <tbody>
        ${menus.map(m=>{
          const sold=sessionSold(m.id);
          const left=remaining(m);
          return `<tr>
            <td><div class="product-name">${m.name}</div></td>
            <td>${m.stock}</td>
            <td>${m.reservation}</td>
            <td>${m.manual}</td>
            <td>${sold}</td>
            <td><b>${left}</b> <span class="pill ${left<=0?"bad":left<=db.settings.lowLimit?"low":"good"}">${left<=0?"Habis":left<=db.settings.lowLimit?"Menipis":"Aman"}</span></td>
            <td><div class="row-actions">
              <button class="icon-btn" onclick="openEditStock('${m.id}')">Edit</button>
              <button class="icon-btn" onclick="openManualSale('${m.id}')">Jual</button>
              <button class="icon-btn" onclick="openReservation('${m.id}')">Reservasi</button>
            </div></td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`;
}

function openEditStock(id){
  const m=getMenu(id);
  showModal("Edit Stok",`
    <div class="form-group"><label>NAMA MENU</label><input value="${m.name}" disabled></div>
    <div class="form-group"><label>STOK AWAL / PENAMBAHAN STOK</label><input type="number" id="stockValue" min="0" value="${m.stock}"></div>
    <div class="modal-actions">
      <button class="secondary-btn" onclick="closeModal()">Batal</button>
      <button class="primary-btn" onclick="updateStock('${id}')">Simpan</button>
    </div>`);
}

function updateStock(id){
  const m=getMenu(id);
  const value=Number(document.getElementById("stockValue").value);

  if(!Number.isInteger(value)||value<0)return toast("Stok tidak valid.");

  const diff=value-m.stock;
  m.stock=value;

  addHistory("Penyesuaian Stok",m.name,diff,"Perubahan stok awal");
  saveDB();
  closeModal();
  renderAll();
  toast("Stok diperbarui.");
}

function openStockModal(){
  showModal("Tambah Menu",`
    <div class="form-group"><label>NAMA MENU</label><input id="newName" placeholder="Nama menu"></div>
    <div class="form-group"><label>STOK AWAL</label><input type="number" id="newStock" min="0" value="0"></div>
    <div class="modal-actions">
      <button class="secondary-btn" onclick="closeModal()">Batal</button>
      <button class="primary-btn" onclick="addMenu()">Tambah</button>
    </div>`);
}

function addMenu(){
  const name=document.getElementById("newName").value.trim();
  const stock=Number(document.getElementById("newStock").value);

  if(!name||!Number.isInteger(stock)||stock<0)return toast("Periksa data menu.");

  if(db.menus.some(m=>m.name.toLowerCase()===name.toLowerCase()))return toast("Menu sudah ada.");

  const id="menu_"+Date.now();
  db.menus.push({id,name,stock,reservation:0,manual:0});

  addHistory("Menu Baru",name,stock,"Menu ditambahkan");
  closeModal();
  renderAll();
  toast("Menu berhasil ditambahkan.");
}

function openReservation(id){
  const m=getMenu(id);
  showModal("Atur Reservasi",`
    <div class="form-group"><label>${m.name}</label><input type="number" id="reservationValue" min="0" value="${m.reservation}"></div>
    <div class="modal-actions">
      <button class="secondary-btn" onclick="closeModal()">Batal</button>
      <button class="primary-btn" onclick="updateReservation('${id}')">Simpan</button>
    </div>`);
}

function updateReservation(id){
  const m=getMenu(id);
  const value=Number(document.getElementById("reservationValue").value);
  const other=m.manual+sessionSold(id);

  if(!Number.isInteger(value)||value<0||value+other>m.stock)return toast("Reservasi melebihi stok tersedia.");

  const diff=value-m.reservation;
  m.reservation=value;

  addHistory("Perubahan Reservasi",m.name,diff,"Reservasi diperbarui");
  saveDB();
  closeModal();
  renderAll();
  toast("Reservasi diperbarui.");
}

function openManualSale(id){
  const m=getMenu(id);
  showModal("Penjualan Manual",`
    <div class="form-group"><label>MENU</label><input value="${m.name}" disabled></div>
    <div class="form-group"><label>JUMLAH TERJUAL</label><input type="number" id="manualQty" min="1" placeholder="Jumlah"></div>
    <div class="modal-actions">
      <button class="secondary-btn" onclick="closeModal()">Batal</button>
      <button class="primary-btn" onclick="saveManualSale('${id}')">Simpan</button>
    </div>`);
}

function saveManualSale(id){
  const qty=Number(document.getElementById("manualQty").value);
  const m=getMenu(id);

  if(!Number.isInteger(qty)||qty<1||qty>remaining(m))return toast("Jumlah tidak valid atau stok tidak cukup.");

  m.manual+=qty;
  addHistory("Penjualan Manual",m.name,qty);
  saveDB();
  closeModal();
  renderAll();
  toast("Transaksi berhasil.");
}

/* =====================================
   DASHBOARD
===================================== */

function renderDashboard(){
  document.getElementById("totalMenus").textContent=db.menus.length;

  document.getElementById("totalStock").textContent=
    db.menus.reduce((a,m)=>a+remaining(m),0);

  document.getElementById("totalSold").textContent=totalSold();

  document.getElementById("lowStock").textContent=
    db.menus.filter(m=>remaining(m)<=db.settings.lowLimit).length;

  document.getElementById("dashboardStock").innerHTML=`
    <table><thead><tr><th>MENU</th><th>STOK TERSISA</th><th>STATUS</th></tr></thead>
    <tbody>${db.menus.map(m=>{
      const n=remaining(m);
      return `<tr><td class="product-name">${m.name}</td><td>${n}</td>
      <td><span class="pill ${n<=0?"bad":n<=db.settings.lowLimit?"low":"good"}">${n<=0?"Habis":n<=db.settings.lowLimit?"Menipis":"Aman"}</span></td></tr>`;
    }).join("")}</tbody></table>`;

  renderDashboardSessions();

  document.getElementById("recentActivity").innerHTML=
    db.history.slice(0,5).map(h=>`
      <div class="history-row">
        <span>${h.type} · ${h.menu}</span>
        <b>${h.qty>0?"+":""}${h.qty}</b>
        <span class="product-sub">${new Date(h.date).toLocaleString("id-ID")}</span>
      </div>
    `).join("")||'<div class="empty">Belum ada aktivitas.</div>';
}

function renderDashboardSessions(){
  const el=document.getElementById("dashboardSessions");
  if(!el)return;

  const date=localDate();
  const schedule=getSchedule(getDayType(date));

  el.innerHTML=schedule.map((item,i)=>{
    const s=getSession(date,i+1);
    return `<div class="session-mini">
      <div><b>${item.name}</b><div class="product-sub">${item.time}</div></div>
      <span class="pill ${s.locked?"good":"low"}">${s.locked?"Selesai":"Terbuka"}</span>
    </div>`;
  }).join("");
}

/* =====================================
   STOCK AUDIT
===================================== */

function renderAudit(){
  document.getElementById("auditTable").innerHTML=`
    <table><thead><tr><th>MENU</th><th>STOK SISTEM</th><th>STOK FISIK</th></tr></thead>
    <tbody>${db.menus.map(m=>`
      <tr>
        <td>${m.name}</td>
        <td>${remaining(m)}</td>
        <td><input class="audit-input" type="number" min="0" id="audit_${m.id}" placeholder="Qty"></td>
      </tr>`).join("")}</tbody></table>`;
}

function saveAudit(){
  const results=[];

  for(const m of db.menus){
    const input=document.getElementById("audit_"+m.id);
    if(input.value==="")return toast("Isi seluruh jumlah stok fisik.");

    const physical=Number(input.value);
    if(!Number.isInteger(physical)||physical<0)return toast("Jumlah fisik tidak valid.");

    const system=remaining(m);
    results.push({menu:m.name,system,physical,difference:physical-system});
  }

  db.audits.unshift({date:new Date().toISOString(),results});
  saveDB();

  document.getElementById("auditResult").innerHTML=`
    <div class="notice" style="margin:20px 0 0">
      <b>Hasil Pemeriksaan</b><br><br>
      ${results.map(r=>`${r.menu}: ${r.difference===0?"Sesuai":`Selisih ${r.difference>0?"+":""}${r.difference}`}`).join("<br>")}
      <br><br>Data stok belum diubah. Lakukan pemeriksaan dan penyesuaian secara manual jika diperlukan.
    </div>`;

  toast("Hasil audit disimpan.");
}

/* =====================================
   HISTORY & REPORTS
===================================== */

function renderHistory(){
  document.getElementById("historyTable").innerHTML=`
    <table><thead><tr><th>WAKTU</th><th>AKTIVITAS</th><th>MENU</th><th>JUMLAH</th><th>KETERANGAN</th></tr></thead>
    <tbody>${db.history.map(h=>`
      <tr>
        <td>${new Date(h.date).toLocaleString("id-ID")}</td>
        <td>${h.type}</td><td>${h.menu}</td>
        <td>${h.qty>0?"+":""}${h.qty}</td>
        <td>${h.detail||"-"}</td>
      </tr>`).join("")}</tbody></table>
    ${db.history.length?"":'<div class="empty">Belum ada riwayat.</div>'}`;
}

function renderReports(){
  const reservation=db.menus.reduce((a,m)=>a+m.reservation,0);
  const sales=totalSold();
  const stock=db.menus.reduce((a,m)=>a+remaining(m),0);

  document.getElementById("reportReservation").textContent=reservation;
  document.getElementById("reportSales").textContent=sales;
  document.getElementById("reportRemaining").textContent=stock;

  document.getElementById("reportTable").innerHTML=`
    <table><thead><tr><th>MENU</th><th>STOK AWAL</th><th>RESERVASI</th><th>TERJUAL</th><th>SISA</th></tr></thead>
    <tbody>${db.menus.map(m=>`
      <tr><td>${m.name}</td><td>${m.stock}</td><td>${m.reservation}</td>
      <td>${m.manual+sessionSold(m.id)}</td><td><b>${remaining(m)}</b></td></tr>
    `).join("")}</tbody></table>`;
}

function exportCSV(){
  const rows=[
    ["Menu","Stok Awal","Reservasi","Manual","Penjualan Sesi","Sisa Stok"],
    ...db.menus.map(m=>[
      m.name,m.stock,m.reservation,m.manual,sessionSold(m.id),remaining(m)
    ])
  ];

  const csv=rows.map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  downloadFile("\uFEFF"+csv,"stock-report.csv","text/csv");
  toast("Laporan berhasil diekspor.");
}

/* =====================================
   BACKUP & RESTORE
===================================== */

function downloadFile(content,name,type){
  const blob=new Blob([content],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=name;a.click();
  URL.revokeObjectURL(url);
}

function backupData(){
  downloadFile(JSON.stringify(db,null,2),"stock-app-backup.json","application/json");
  toast("Backup berhasil dibuat.");
}

function restoreData(){
  const file=document.getElementById("restoreFile").files[0];
  if(!file)return toast("Pilih file backup terlebih dahulu.");

  const reader=new FileReader();

  reader.onload=()=>{
    try{
      const data=JSON.parse(reader.result);

      if(!Array.isArray(data.menus)||!data.sessions||!Array.isArray(data.history))
        throw new Error("Format tidak valid");

      if(!confirm("Pulihkan backup? Data saat ini akan diganti."))return;

      db=data;
      saveDB();
      renderAll();
      toast("Data berhasil dipulihkan.");
    }catch(e){
      toast("File backup tidak valid.");
    }
  };

  reader.readAsText(file);
}

function saveSettings(){
  const value=Number(document.getElementById("lowLimit").value);
  if(!Number.isInteger(value)||value<0)return toast("Batas stok tidak valid.");

  db.settings.lowLimit=value;
  saveDB();
  renderAll();
  toast("Pengaturan disimpan.");
}

function resetApp(){
  if(!confirm("Hapus seluruh data Stock App?"))return;
  if(!confirm("Konfirmasi terakhir: seluruh stok dan riwayat akan hilang."))return;

  localStorage.removeItem(DB_KEY);
  db=loadDB();
  renderAll();
  toast("Aplikasi berhasil direset.");
}

/* =====================================
   MODAL
===================================== */

function showModal(title,content){
  document.getElementById("modalTitle").textContent=title;
  document.getElementById("modalBody").innerHTML=content;
  document.getElementById("modal").classList.add("show");
}

function closeModal(){
  document.getElementById("modal").classList.remove("show");
}

document.getElementById("modal").addEventListener("click",e=>{
  if(e.target.id==="modal")closeModal();
});

/* =====================================
   RENDER ALL
===================================== */

function renderAll(){
  renderDashboard();
  renderStock();
  renderSession
