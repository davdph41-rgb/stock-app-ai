'use strict';

const DB_KEY='stock_app_ai_v2';
const DEFAULT_MENUS=['French Fries','Chicken Wings','Prawn Mayo','Mekencis','Beef Burger','Fish & Chips','Mix Platters'];
const $=id=>document.getElementById(id);
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const nowText=()=>new Date().toLocaleString('id-ID');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>`id_${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`;

function freshDB(){
  return{version:2,menus:DEFAULT_MENUS.map(name=>({id:uid(),name,stock:0,reservation:0,manual:0})),sessions:{},history:[],audits:[],reservations:[]};
}
function loadDB(){
  try{
    const raw=localStorage.getItem(DB_KEY);
    if(!raw)return freshDB();
    const d=JSON.parse(raw);
    if(!d||!Array.isArray(d.menus))return freshDB();
    d.sessions||={};d.history||=[];d.audits||=[];d.reservations||=[];
    return d;
  }catch(e){console.error(e);return freshDB();}
}
let db=loadDB();
let pendingReceipt=null;

function saveDB(){localStorage.setItem(DB_KEY,JSON.stringify(db))}
function toast(message){
  const el=$('toast');el.textContent=message;el.classList.add('show');
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2600);
}
function log(action,menu,qty,note=''){
  db.history.unshift({id:uid(),time:nowText(),date:today(),action,menu,qty:Number(qty)||0,note});
  saveDB();
}
function getMenu(id){return db.menus.find(m=>m.id===id)}
function daySessions(date=today()){
  const d=new Date(date+'T12:00:00').getDay();
  return[0,6].includes(d)
    ?[{id:'s1',name:'Sesi 1',time:'10:00–12:00'},{id:'s2',name:'Sesi 2',time:'12:00–15:00'},{id:'s3',name:'Sesi 3',time:'15:00–17:00'}]
    :[{id:'s1',name:'Sesi 1',time:'12:00–15:00'},{id:'s2',name:'Sesi 2',time:'15:00–17:00'}];
}
function sessionKey(date,sid){return date+'_'+sid}
function getSession(date,sid){return db.sessions[sessionKey(date,sid)]||{date,sid,closed:false,sales:{}}}
function sessionSold(id){
  return db.history.filter(h=>h.menuId===id&&h.action==='Penjualan sesi').reduce((a,h)=>a+h.qty,0);
}
function available(m){
  return Math.max(0,Number(m.stock||0)-Number(m.reservation||0)-Number(m.manual||0)-sessionSold(m.id));
}
function soldToday(){
  return db.history.filter(h=>h.date===today()&&['Penjualan manual','Penjualan sesi'].includes(h.action)).reduce((a,h)=>a+h.qty,0);
}
function statusHTML(n){
  return n<=0?'<span class="status empty">Habis</span>':n<=5?'<span class="status low">Menipis</span>':'<span class="status good">Aman</span>';
}
function emptyRow(cols,msg='Belum ada data.'){
  return`<tr><td colspan="${cols}" class="empty-cell">${msg}</td></tr>`;
}

function showPage(name){
  const page=$('page-'+name);if(!page)return;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  page.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===name));
  const button=document.querySelector(`.nav-item[data-page="${name}"]`);
  $('pageTitle').textContent=button?button.textContent.trim():'Dashboard';
  $('sidebar').classList.remove('open');
  renderAll();
}
document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>showPage(b.dataset.page)));
document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>showPage(b.dataset.goto)));
$('menuToggle').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
document.addEventListener('click',e=>{
  if(window.innerWidth<=760&&!$('sidebar').contains(e.target)&&!e.target.closest('#menuToggle'))
    $('sidebar').classList.remove('open');
});

function fillMenuSelect(id){
  const el=$(id);if(!el)return;
  const old=el.value;
  el.innerHTML=db.menus.map(m=>`<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('');
  if(db.menus.some(m=>m.id===old))el.value=old;
}
function renderDashboard(){
  $('statStock').textContent=db.menus.reduce((a,m)=>a+available(m),0);
  $('statReservation').textContent=db.menus.reduce((a,m)=>a+Number(m.reservation||0),0);
  $('statSold').textContent=soldToday();
  $('statLow').textContent=db.menus.filter(m=>available(m)<=5).length;
  $('dashboardTable').innerHTML=db.menus.length
    ?db.menus.map(m=>`<tr><td>${esc(m.name)}</td><td>${m.stock}</td><td>${m.reservation}</td><td>${sessionSold(m.id)+m.manual}</td><td><strong>${available(m)}</strong></td><td>${statusHTML(available(m))}</td></tr>`).join('')
    :emptyRow(6);
}
function renderStock(){
  $('stockTable').innerHTML=db.menus.length
    ?db.menus.map(m=>`<tr><td><strong>${esc(m.name)}</strong></td><td>${m.stock}</td><td>${m.reservation}</td><td>${sessionSold(m.id)+m.manual}</td><td>${available(m)} ${statusHTML(available(m))}</td><td><button class="btn ghost" data-stock-edit="${m.id}">Ubah stok</button> <button class="btn ghost" data-stock-add="${m.id}">＋ Stok</button></td></tr>`).join('')
    :emptyRow(6);
  fillMenuSelect('manualMenu');
  fillMenuSelect('reservationMenu');
  fillMenuSelect('sessionMenu');
  fillMenuSelect('auditMenu');
}
function renderReservations(){
  $('reservationTable').innerHTML=db.reservations.length
    ?db.reservations.map(r=>`<tr><td>${esc(r.time)}</td><td>${esc(r.menuName)}</td><td>${r.qty}</td><td>${esc(r.note)}</td><td><button class="btn ghost" data-res-cancel="${r.id}">Batalkan</button></td></tr>`).join('')
    :emptyRow(5);
}
function renderSessions(){
  const sessions=daySessions();
  $('dayType').textContent=sessions.length===3?'Akhir pekan':'Hari kerja';
  $('sessionCards').innerHTML=sessions.map(s=>{
    const x=getSession(today(),s.id);
    const total=Object.values(x.sales||{}).reduce((a,b)=>a+b,0);
    return`<article class="session-card"><h3>${s.name}</h3><p>${s.time}</p><strong>${total} <small>unit terjual</small></strong><p>${x.closed?'Sesi sudah dikunci':'Sesi masih terbuka'}</p><button class="btn ${x.closed?'ghost':'primary'}" data-session-close="${s.id}" ${x.closed?'disabled':''}>${x.closed?'Terkunci':'Tutup & Kunci Sesi'}</button></article>`;
  }).join('');
  $('sessionSelect').innerHTML=sessions.map(s=>`<option value="${s.id}">${s.name} (${s.time})</option>`).join('');
}
function renderHistory(){
  $('historyTable').innerHTML=db.history.length
    ?db.history.slice(0,200).map(h=>`<tr><td>${esc(h.time)}</td><td>${esc(h.action)}</td><td>${esc(h.menu)}</td><td>${h.qty}</td><td>${esc(h.note)}</td></tr>`).join('')
    :emptyRow(5);
}
function renderAudit(){
  $('auditResults').innerHTML=db.audits.length
    ?db.audits.slice(0,20).map(a=>`<div class="audit-result"><span><strong>${esc(a.menu)}</strong><br><span class="muted">${esc(a.time)} · Sistem ${a.system} / Fisik ${a.physical}</span></span><strong class="${a.diff===0?'good':'orange'}">${a.diff===0?'Sesuai':(a.diff>0?'Lebih ':'Kurang ')+Math.abs(a.diff)}</strong></div>`).join('')
    :'<p class="muted">Belum ada audit.</p>';
}
function renderReports(){
  $('reportMenus').textContent=db.menus.length;
  $('reportOpening').textContent=db.menus.reduce((a,m)=>a+m.stock,0);
  $('reportAvailable').textContent=db.menus.reduce((a,m)=>a+available(m),0);
  $('reportActivity').textContent=db.history.length;
  $('reportTable').innerHTML=db.menus.map(m=>`<tr><td>${esc(m.name)}</td><td>${m.stock}</td><td>${m.reservation}</td><td>${m.manual+sessionSold(m.id)}</td><td>${available(m)}</td></tr>`).join('')||emptyRow(5);
}
function renderAll(){
  renderDashboard();renderStock();renderReservations();renderSessions();
  renderHistory();renderAudit();renderReports();
}
function openModal(title,fields,onSave){
  $('modalTitle').textContent=title;
  $('modalFields').innerHTML=fields;
  $('modalBackdrop').classList.add('show');
  $('modalForm').onsubmit=e=>{
    e.preventDefault();
    const result=onSave(new FormData(e.currentTarget));
    if(result!==false){closeModal();renderAll();}
  };
}
function closeModal(){
  $('modalBackdrop').classList.remove('show');
  $('modalForm').onsubmit=null;
}
$('modalClose').addEventListener('click',closeModal);
$('modalCancel').addEventListener('click',closeModal);
$('modalBackdrop').addEventListener('click',e=>{if(e.target===$('modalBackdrop'))closeModal()});

$('addMenuBtn').addEventListener('click',()=>openModal('Tambah Menu',`<div class="modal-fields"><label>Nama menu<input name="name" required maxlength="60"></label><label>Stok awal<input name="stock" type="number" min="0" required value="0"></label></div>`,f=>{
  const name=f.get('name').trim();
  if(db.menus.some(m=>m.name.toLowerCase()===name.toLowerCase())){toast('Menu sudah ada.');return false}
  db.menus.push({id:uid(),name,stock:Number(f.get('stock')),reservation:0,manual:0});
  log('Tambah menu',name,Number(f.get('stock')));
  toast('Menu berhasil ditambahkan.');
}));

$('stockTable').addEventListener('click',e=>{
  const edit=e.target.closest('[data-stock-edit]');
  const add=e.target.closest('[data-stock-add]');
  if(edit){
    const m=getMenu(edit.dataset.stockEdit);
    openModal('Ubah Stok Awal',`<div class="modal-fields"><label>Menu<input value="${esc(m.name)}" disabled></label><label>Stok awal<input name="stock" type="number" min="0" required value="${m.stock}"></label></div>`,f=>{
      const n=Number(f.get('stock'));
      if(n<m.reservation+m.manual+sessionSold(m.id)){toast('Stok tidak boleh lebih kecil dari jumlah yang sudah dialokasikan/terjual.');return false}
      m.stock=n;log('Ubah stok awal',m.name,n);toast('Stok diperbarui.');
    });
  }
  if(add){
    const m=getMenu(add.dataset.stockAdd);
    openModal('Tambah Stok',`<div class="modal-fields"><label>Menu<input value="${esc(m.name)}" disabled></label><label>Jumlah tambahan<input name="qty" type="number" min="1" required></label></div>`,f=>{
      const q=Number(f.get('qty'));m.stock+=q;log('Penambahan stok',m.name,q);toast('Stok berhasil ditambahkan.');
    });
  }
});

$('manualForm').addEventListener('submit',e=>{
  e.preventDefault();
  const m=getMenu($('manualMenu').value),q=Number($('manualQty').value);
  if(!m||q<1)return;
  if(q>available(m)){toast('Jumlah melebihi stok tersedia.');return}
  m.manual+=q;
  db.history.unshift({id:uid(),time:nowText(),date:today(),action:'Penjualan manual',menu:m.name,menuId:m.id,qty:q,note:'Penjualan manual'});
  saveDB();e.target.reset();renderAll();toast('Penjualan tersimpan.');
});

$('reservationForm').addEventListener('submit',e=>{
  e.preventDefault();
  const m=getMenu($('reservationMenu').value),q=Number($('reservationQty').value);
  if(!m||q<1)return;
  if(q>available(m)){toast('Jumlah reservasi melebihi stok tersedia.');return}
  m.reservation+=q;
  db.reservations.unshift({id:uid(),time:nowText(),menuId:m.id,menuName:m.name,qty:q,note:$('reservationNote').value});
  log('Reservasi',m.name,q,$('reservationNote').value);
  e.target.reset();renderAll();toast('Reservasi tersimpan.');
});

$('reservationTable').addEventListener('click',e=>{
  const b=e.target.closest('[data-res-cancel]');if(!b)return;
  const i=db.reservations.findIndex(r=>r.id===b.dataset.resCancel);if(i<0)return;
  const r=db.reservations.splice(i,1)[0],m=getMenu(r.menuId);
  if(m)m.reservation=Math.max(0,m.reservation-r.qty);
  log('Pembatalan reservasi',r.menuName,r.qty,r.note);
  renderAll();toast('Reservasi dibatalkan.');
});

$('sessionForm').addEventListener('submit',e=>{
  e.preventDefault();
  const sid=$('sessionSelect').value,m=getMenu($('sessionMenu').value),q=Number($('sessionQty').value),s=getSession(today(),sid);
  if(!m||q<1)return;
  if(s.closed){toast('Sesi sudah dikunci.');return}
  if(q>available(m)){toast('Jumlah melebihi stok tersedia.');return}
  s.sales[m.id]=(s.sales[m.id]||0)+q;
  db.sessions[sessionKey(today(),sid)]=s;
  db.history.unshift({id:uid(),time:nowText(),date:today(),action:'Penjualan sesi',menu:m.name,menuId:m.id,qty:q,note:$('sessionSelect').selectedOptions[0].textContent});
  saveDB();e.target.reset();renderAll();toast('Penjualan sesi tersimpan.');
});

$('sessionCards').addEventListener('click',e=>{
  const b=e.target.closest('[data-session-close]');if(!b)return;
  const sid=b.dataset.sessionClose,s=getSession(today(),sid);
  if(s.closed)return;
  if(!confirm('Tutup dan kunci sesi ini? Setelah ditutup, data penjualan sesi tidak dapat diubah.'))return;
  s.closed=true;s.closedAt=nowText();
  db.sessions[sessionKey(today(),sid)]=s;
  log('Sesi dikunci',sid,0,'Sesi ditutup permanen');
  renderAll();toast('Sesi berhasil dikunci.');
});

$('auditForm').addEventListener('submit',e=>{
  e.preventDefault();
  const m=getMenu($('auditMenu').value),physical=Number($('physicalQty').value);
  if(!m||physical<0)return;
  const system=available(m);
  const a={id:uid(),time:nowText(),menu:m.name,system,physical,diff:physical-system,note:$('auditNote').value};
  db.audits.unshift(a);
  log('Audit stok',m.name,physical,`Sistem ${system}; fisik ${physical}; selisih ${a.diff}`);
  e.target.reset();renderAll();toast(a.diff===0?'Stok sesuai.':'Ditemukan selisih stok.');
});

/* =========================
   AI RECEIPT SCANNER
========================= */

$('receiptFile').addEventListener('change',()=>{
  const file=$('receiptFile').files[0];
  $('receiptName').textContent=file?file.name:'';
  $('scanReceiptBtn').disabled=!file;
  $('scanResultPanel').hidden=true;
  pendingReceipt=null;
  $('scanMessage').textContent=file?'Foto siap dianalisis.':'';
});

function classifyReceiptSession(dateStr,timeStr){
  if(!dateStr||!timeStr)return null;
  const date=new Date(dateStr+'T12:00:00');
  if(Number.isNaN(date.getTime()))return null;

  const parts=timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if(!parts)return null;

  const hour=Number(parts[1]),minute=Number(parts[2]);
  if(hour>23||minute>59)return null;

  const minutes=hour*60+minute;
  const weekend=[0,6].includes(date.getDay());

  const ranges=weekend
    ?[
      {id:'s1',name:'Sesi 1',start:600,end:720},
      {id:'s2',name:'Sesi 2',start:720,end:900},
      {id:'s3',name:'Sesi 3',start:900,end:1020}
    ]
    :[
      {id:'s1',name:'Sesi 1',start:720,end:900},
      {id:'s2',name:'Sesi 2',start:900,end:1020}
    ];

  const found=ranges.find(x=>minutes>=x.start&&minutes<x.end);
  return found?{...found,date:dateStr,weekend}:null;
}

async function compressReceipt(file){
  if(!file.type.match(/^image\/(jpeg|png|webp)$/))
    throw new Error('Gunakan foto JPG, PNG, atau WEBP.');

  const img=await createImageBitmap(file);
  const scale=Math.min(1,1800/Math.max(img.width,img.height));
  const canvas=document.createElement('canvas');

  canvas.width=Math.round(img.width*scale);
  canvas.height=Math.round(img.height*scale);

  canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);

  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.82));
  if(!blob)throw new Error('Foto tidak dapat diproses.');

  const dataUrl=await new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>resolve(r.result);
    r.onerror=reject;
    r.readAsDataURL(blob);
  });

  return{
    base64:String(dataUrl).split(',')[1],
    mimeType:'image/jpeg'
  };
}

/* =========================
   ALIAS MENU AI
   Semua nama berikut diarahkan
   ke menu resmi aplikasi.
========================= */

const MENU_ALIASES={
  'tempura shrimp':'Prawn Mayo',
  'tempura shrimps':'Prawn Mayo',
  'tempura shrimp mayo':'Prawn Mayo',
  'prawn mayo':'Prawn Mayo',
  'prown mayo':'Prawn Mayo',
  'perown mayo':'Prawn Mayo',
  'prawn maywo':'Prawn Mayo',
  'prawn mayonaise':'Prawn Mayo',

  'fish n chips':'Fish & Chips',
  'fish and chips':'Fish & Chips',
  'fish & chips':'Fish & Chips',
  'fish chips':'Fish & Chips',

  'french fries sbs':'French Fries',
  'french fries':'French Fries',
  'fries':'French Fries',

  'sembodro beef burger':'Beef Burger',
  'beef burger':'Beef Burger',
  'burger':'Beef Burger',

  'sembodro mix platers':'Mix Platters',
  'sembodro mix platters':'Mix Platters',
  'mix platers':'Mix Platters',
  'mix platters':'Mix Platters',
  'mix platter':'Mix Platters'
};

function normalizeMenuName(name){
  return String(name||'')
    .toLowerCase()
    .trim()
    .replace(/[.,:;!?()[\]{}]/g,' ')
    .replace(/\s+/g,' ');
}

function matchReceiptMenu(name){
  const normalized=normalizeMenuName(name);

  /* 1. Cek alias */
  const alias=MENU_ALIASES[normalized];
  if(alias){
    const menu=db.menus.find(m=>normalizeMenuName(m.name)===normalizeMenuName(alias));
    if(menu)return menu;
  }

  /* 2. Cek nama menu persis */
  const exact=db.menus.find(m=>normalizeMenuName(m.name)===normalized);
  if(exact)return exact;

  /* 3. Cek apakah nama nota mengandung nama menu */
  const contains=db.menus.find(m=>{
    const menuName=normalizeMenuName(m.name);
    return normalized.includes(menuName)||menuName.includes(normalized);
  });
  if(contains)return contains;

  /* 4. Cek variasi kata */
  if(normalized.includes('tempura')&&normalized.includes('shrimp')){
    return db.menus.find(m=>normalizeMenuName(m.name)==='prawn mayo')||null;
  }

  if(normalized.includes('prawn')&&normalized.includes('mayo')){
    return db.menus.find(m=>normalizeMenuName(m.name)==='prawn mayo')||null;
  }

  if(normalized.includes('fish')&&normalized.includes('chip')){
    return db.menus.find(m=>normalizeMenuName(m.name)==='fish & chips')||null;
  }

  if(normalized.includes('mix')&&normalized.includes('plater')){
    return db.menus.find(m=>normalizeMenuName(m.name)==='mix platters')||null;
  }

  if(normalized.includes('burger')){
    return db.menus.find(m=>normalizeMenuName(m.name)==='beef burger')||null;
  }

  if(normalized.includes('french')&&normalized.includes('fries')){
    return db.menus.find(m=>normalizeMenuName(m.name)==='french fries')||null;
  }

  return null;
}

$('scanReceiptBtn').addEventListener('click',async()=>{
  const file=$('receiptFile').files[0];
  if(!file)return;

  const btn=$('scanReceiptBtn');
  btn.disabled=true;
  btn.textContent='Sedang membaca nota...';

  $('scanMessage').textContent='AI sedang membaca tanggal, jam, nama menu, dan jumlah.';

  try{
    const image=await compressReceipt(file);

    const response=await fetch('/api/scan-receipt',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        ...image,
        menuNames:db.menus.map(m=>m.name)
      })
    });

    const result=await response.json();

    if(!response.ok)
      throw new Error(result.error||'Gagal membaca nota.');

    if(!result.receiptTime)
      throw new Error('Jam pada nota tidak terbaca. Coba foto yang lebih jelas.');

    const receiptDate=result.receiptDate||today();
    const session=classifyReceiptSession(receiptDate,result.receiptTime);

    if(!session)
      throw new Error('Tanggal atau jam nota tidak masuk jadwal sesi. Periksa nota secara manual.');

    const existing=getSession(session.date,session.id);

    if(existing.closed||existing.receiptProcessed)
      throw new Error('Sesi ini sudah dikunci atau pernah diproses. Nota duplikat ditolak.');

    const mapped=(result.items||[]).map(item=>{
      const menu=matchReceiptMenu(item.menu);

      return{
        ...item,
        matchedMenuId:menu?.id||null,
        matchedMenuName:menu?.name||null
      };
    });

    if(!mapped.length)
      throw new Error('AI tidak menemukan item menu pada nota.');

    pendingReceipt={
      date:session.date,
      sessionId:session.id,
      sessionName:session.name,
      time:result.receiptTime,
      items:mapped,
      rawDate:result.receiptDate||null
    };

    $('detectedSession').textContent=
      session.name+' · '+(session.weekend?'Akhir pekan':'Hari kerja');

    $('scanMeta').innerHTML=`
      <span>Tanggal: <strong>${esc(receiptDate)}${result.receiptDate?'':' (memakai tanggal hari ini)'}</strong></span>
      <span>Jam nota: <strong>${esc(result.receiptTime)}</strong></span>
      <span>Hari: <strong>${session.weekend?'Akhir pekan':'Hari kerja'}</strong></span>
    `;

    $('scanItemsTable').innerHTML=mapped.map(x=>`
      <tr>
        <td>${esc(x.menu)}</td>
        <td>${Number(x.quantity)||0}</td>
        <td>
          ${
            x.matchedMenuId
            ?'<span class="match-ok">Cocok: '+esc(x.matchedMenuName)+'</span>'
            :'<span class="match-warn">Perlu diperiksa: menu tidak dikenal</span>'
          }
        </td>
      </tr>
    `).join('');

    $('scanResultPanel').hidden=false;
    $('scanMessage').textContent='Periksa semua item dan jumlah sebelum konfirmasi.';
    toast('Nota berhasil dianalisis.');

  }catch(err){
    console.error(err);
    $('scanMessage').textContent=err.message;
    toast(err.message);
  }finally{
    btn.disabled=!$('receiptFile').files[0];
    btn.textContent='✦ Analisis Nota dengan AI';
  }
});

$('discardScanBtn').addEventListener('click',()=>{
  pendingReceipt=null;
  $('scanResultPanel').hidden=true;
  $('scanMessage').textContent='Hasil analisis dibatalkan.';
});

$('confirmScanBtn').addEventListener('click',()=>{
  if(!pendingReceipt)return;

  const p=pendingReceipt;
  const s=getSession(p.date,p.sessionId);

  if(s.closed||s.receiptProcessed){
    toast('Sesi sudah diproses.');
    return;
  }

  const sales={};

  for(const item of p.items){
    const m=getMenu(item.matchedMenuId);
    const q=Math.floor(Number(item.quantity));

    if(!m||!Number.isFinite(q)||q<1){
      toast('Ada menu atau jumlah yang belum valid.');
      return;
    }

    sales[m.id]=(sales[m.id]||0)+q;
  }

  for(const[menuId,q]of Object.entries(sales)){
    const m=getMenu(menuId);

    if(q>available(m)){
      toast('Penjualan '+m.name+' melebihi stok tersedia. Periksa hasil AI.');
      return;
    }
  }

  s.sales=sales;
  s.receiptProcessed=true;
  s.closed=true;
  s.receiptTime=p.time;
  s.closedAt=nowText();

  db.sessions[sessionKey(p.date,p.sessionId)]=s;

  /* Hapus penjualan sesi lama agar tidak double count */
  db.history=db.history.filter(h=>
    !(h.action==='Penjualan sesi'&&
      h.date===p.date&&
      String(h.note||'').startsWith(p.sessionName))
  );

  for(const[menuId,q]of Object.entries(sales)){
    const m=getMenu(menuId);

    db.history.unshift({
      id:uid(),
      time:nowText(),
      date:p.date,
      action:'Penjualan sesi',
      menu:m.name,
      menuId:m.id,
      qty:q,
      note:`Nota AI ${p.sessionName} · ${p.time}`
    });
  }

  log(
    'Nota AI dikonfirmasi',
    p.sessionName,
    0,
    `Tanggal ${p.date}, jam ${p.time}; sesi dikunci`
  );

  pendingReceipt=null;
  $('scanResultPanel').hidden=true;
  $('receiptFile').value='';
  $('receiptName').textContent='';
  $('scanReceiptBtn').disabled=true;

  renderAll();
  toast('Nota disimpan dan sesi dikunci.');
});

/* =========================
   HISTORY / EXPORT / BACKUP
========================= */

$('clearHistoryBtn').addEventListener('click',()=>{
  if(!confirm('Hapus seluruh riwayat transaksi? Data stok tidak berubah.'))return;
  db.history=[];
  saveDB();
  renderAll();
  toast('Riwayat dihapus.');
});

$('exportCsvBtn').addEventListener('click',()=>{
  const rows=[
    ['Menu','Stok Awal','Reservasi','Terjual','Tersedia'],
    ...db.menus.map(m=>[
      m.name,
      m.stock,
      m.reservation,
      m.manual+sessionSold(m.id),
      available(m)
    ])
  ];

  const csv=rows
    .map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(','))
    .join('\n');

  download('laporan-stok.csv',csv,'text/csv');
});

function download(name,content,type){
  const blob=new Blob([content],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=name;
  a.click();
  URL.revokeObjectURL(url);
}

$('backupBtn').addEventListener('click',()=>{
  download(
    'stock-app-ai-backup-'+today()+'.json',
    JSON.stringify(db,null,2),
    'application/json'
  );
});

$('restoreFile').addEventListener('change',async e=>{
  const file=e.target.files[0];
  if(!file)return;

  try{
    const parsed=JSON.parse(await file.text());

    if(!parsed||!Array.isArray(parsed.menus)||!parsed.sessions||!Array.isArray(parsed.history))
      throw new Error('Format backup tidak valid');

    if(!confirm('Pulihkan backup? Data saat ini akan diganti.'))return;

    db=parsed;
    saveDB();
    renderAll();
    toast('Backup berhasil dipulihkan.');

  }catch(err){
    toast('File backup tidak valid.');
  }finally{
    e.target.value='';
  }
});

$('resetBtn').addEventListener('click',()=>{
  if(!confirm('Yakin reset semua data? Tindakan ini tidak bisa dibatalkan. Unduh backup terlebih dahulu jika diperlukan.'))return;
  db=freshDB();
  saveDB();
  renderAll();
  toast('Aplikasi berhasil direset.');
});

$('todayLabel').textContent=new Date().toLocaleDateString('id-ID',{
  weekday:'short',
  day:'numeric',
  month:'short',
  year:'numeric'
});

saveDB();
renderAll();
