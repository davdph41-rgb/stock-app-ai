'use strict';

const DB_KEY = 'stock_app_ai_v2';
const DEFAULT_MENUS = ['French Fries','Chicken Wings','Prawn Mayo','Mekencis','Beef Burger','Fish & Chips','Mix Platters'];
const $ = (id) => document.getElementById(id);
const today = () => new Date().toISOString().slice(0,10);
const nowText = () => new Date().toLocaleString('id-ID');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7);

function freshDB(){
  return {version:2,menus:DEFAULT_MENUS.map(name=>({id:uid(),name,stock:0,reservation:0,manual:0})),sessions:{},history:[],audits:[],reservations:[]};
}
function loadDB(){
  try{const raw=localStorage.getItem(DB_KEY);if(!raw)return freshDB();const d=JSON.parse(raw);if(!d||!Array.isArray(d.menus))return freshDB();d.sessions ||= {};d.history ||= [];d.audits ||= [];d.reservations ||= [];return d;}
  catch(e){console.error(e);return freshDB();}
}
let db = loadDB();
function saveDB(){localStorage.setItem(DB_KEY,JSON.stringify(db));}
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2600);}
function log(action,menu,qty,note=''){db.history.unshift({id:uid(),time:nowText(),date:today(),action,menu,qty:Number(qty)||0,note});saveDB();}
function getMenu(id){return db.menus.find(m=>m.id===id);}
function daySessions(date=today()){const d=new Date(date+'T12:00:00').getDay();return [0,6].includes(d)?[{id:'s1',name:'Sesi 1',time:'10:00–12:00'},{id:'s2',name:'Sesi 2',time:'12:00–15:00'},{id:'s3',name:'Sesi 3',time:'15:00–17:00'}]:[{id:'s1',name:'Sesi 1',time:'12:00–15:00'},{id:'s2',name:'Sesi 2',time:'15:00–17:00'}];}
function sessionKey(date,sid){return date+'_'+sid;}
function getSession(date,sid){return db.sessions[sessionKey(date,sid)]||{date,sid,closed:false,sales:{}};}
function soldForMenu(id){return db.history.filter(h=>h.menuId===id&&['Penjualan manual','Penjualan sesi'].includes(h.action)).reduce((a,h)=>a+h.qty,0);}
function sessionSold(id){return soldForMenu(id);}
function available(m){return Math.max(0,Number(m.stock||0)-Number(m.reservation||0)-Number(m.manual||0)-sessionSold(m.id));}
function soldToday(){return db.history.filter(h=>h.date===today()&&['Penjualan manual','Penjualan sesi'].includes(h.action)).reduce((a,h)=>a+h.qty,0);}
function statusHTML(n){return n<=0?'<span class="status empty">Habis</span>':n<=5?'<span class="status low">Menipis</span>':'<span class="status good">Aman</span>';}
function emptyRow(cols,msg='Belum ada data.'){return `<tr><td colspan="${cols}" class="empty-cell">${msg}</td></tr>`;}

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
document.addEventListener('click',e=>{if(window.innerWidth<=760&&!$('sidebar').contains(e.target)&&!e.target.closest('#menuToggle'))$('sidebar').classList.remove('open');});

function fillMenuSelect(id){const el=$(id);if(!el)return;const old=el.value;el.innerHTML=db.menus.map(m=>`<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('');if(db.menus.some(m=>m.id===old))el.value=old;}
function renderDashboard(){
  $('statStock').textContent=db.menus.reduce((a,m)=>a+available(m),0);
  $('statReservation').textContent=db.menus.reduce((a,m)=>a+Number(m.reservation||0),0);
  $('statSold').textContent=soldToday();
  $('statLow').textContent=db.menus.filter(m=>available(m)<=5).length;
  $('dashboardTable').innerHTML=db.menus.length?db.menus.map(m=>`<tr><td>${esc(m.name)}</td><td>${m.stock}</td><td>${m.reservation}</td><td>${sessionSold(m.id)+m.manual}</td><td><strong>${available(m)}</strong></td><td>${statusHTML(available(m))}</td></tr>`).join(''):emptyRow(6);
}
function renderStock(){
  $('stockTable').innerHTML=db.menus.length?db.menus.map(m=>`<tr><td><strong>${esc(m.name)}</strong></td><td>${m.stock}</td><td>${m.reservation}</td><td>${sessionSold(m.id)+m.manual}</td><td>${available(m)} ${statusHTML(available(m))}</td><td><button class="btn ghost" data-stock-edit="${m.id}">Ubah stok</button> <button class="btn ghost" data-stock-add="${m.id}">＋ Stok</button></td></tr>`).join(''):emptyRow(6);
  fillMenuSelect('manualMenu');fillMenuSelect('reservationMenu');fillMenuSelect('sessionMenu');fillMenuSelect('auditMenu');
}
function renderReservations(){
  $('reservationTable').innerHTML=db.reservations.length?db.reservations.map(r=>`<tr><td>${esc(r.time)}</td><td>${esc(r.menuName)}</td><td>${r.qty}</td><td>${esc(r.note)}</td><td><button class="btn ghost" data-res-cancel="${r.id}">Batalkan</button></td></tr>`).join(''):emptyRow(5);
}
function renderSessions(){
  const sessions=daySessions();$('dayType').textContent=sessions.length===3?'Akhir pekan':'Hari kerja';
  $('sessionCards').innerHTML=sessions.map(s=>{const x=getSession(today(),s.id);const total=Object.values(x.sales||{}).reduce((a,b)=>a+b,0);return `<article class="session-card"><h3>${s.name}</h3><p>${s.time}</p><strong>${total} <small>unit terjual</small></strong><p>${x.closed?'Sesi sudah dikunci':'Sesi masih terbuka'}</p><button class="btn ${x.closed?'ghost':'primary'}" data-session-close="${s.id}" ${x.closed?'disabled':''}>${x.closed?'Terkunci':'Tutup & Kunci Sesi'}</button></article>`}).join('');
  $('sessionSelect').innerHTML=sessions.map(s=>`<option value="${s.id}">${s.name} (${s.time})</option>`).join('');
}
function renderHistory(){
  $('historyTable').innerHTML=db.history.length?db.history.slice(0,200).map(h=>`<tr><td>${esc(h.time)}</td><td>${esc(h.action)}</td><td>${esc(h.menu)}</td><td>${h.qty}</td><td>${esc(h.note)}</td></tr>`).join(''):emptyRow(5);
}
function renderAudit(){
  $('auditResults').innerHTML=db.audits.length?db.audits.slice(0,20).map(a=>`<div class="audit-result"><span><strong>${esc(a.menu)}</strong><br><span class="muted">${esc(a.time)} · Sistem ${a.system} / Fisik ${a.physical}</span></span><strong class="${a.diff===0?'good':'orange'}">${a.diff===0?'Sesuai':(a.diff>0?'Lebih ':'Kurang ')+Math.abs(a.diff)}</strong></div>`).join(''):'<p class="muted">Belum ada audit.</p>';
}
function renderReports(){
  $('reportMenus').textContent=db.menus.length;$('reportOpening').textContent=db.menus.reduce((a,m)=>a+m.stock,0);$('reportAvailable').textContent=db.menus.reduce((a,m)=>a+available(m),0);$('reportActivity').textContent=db.history.length;
  $('reportTable').innerHTML=db.menus.map(m=>`<tr><td>${esc(m.name)}</td><td>${m.stock}</td><td>${m.reservation}</td><td>${m.manual+sessionSold(m.id)}</td><td>${available(m)}</td></tr>`).join('')||emptyRow(5);
}
function renderAll(){renderDashboard();renderStock();renderReservations();renderSessions();renderHistory();renderAudit();renderReports();}
function openModal(title,fields,onSave){
  $('modalTitle').textContent=title;$('modalFields').innerHTML=fields;$('modalBackdrop').classList.add('show');
  $('modalForm').onsubmit=e=>{e.preventDefault();const result=onSave(new FormData(e.currentTarget));if(result!==false){closeModal();renderAll();}};
}
function closeModal(){$('modalBackdrop').classList.remove('show');$('modalForm').onsubmit=null;}
$('modalClose').addEventListener('click',closeModal);$('modalCancel').addEventListener('click',closeModal);
$('modalBackdrop').addEventListener('click',e=>{if(e.target===$('modalBackdrop'))closeModal();});
$('addMenuBtn').addEventListener('click',()=>openModal('Tambah Menu',`<div class="modal-fields"><label>Nama menu<input name="name" required maxlength="60"></label><label>Stok awal<input name="stock" type="number" min="0" required value="0"></label></div>`,f=>{const name=f.get('name').trim();if(db.menus.some(m=>m.name.toLowerCase()===name.toLowerCase())){toast('Menu sudah ada.');return false;}db.menus.push({id:uid(),name,stock:Number(f.get('stock')),reservation:0,manual:0});log('Tambah menu',name,Number(f.get('stock')));toast('Menu berhasil ditambahkan.');}));
$('stockTable').addEventListener('click',e=>{const edit=e.target.closest('[data-stock-edit]');const add=e.target.closest('[data-stock-add]');if(edit){const m=getMenu(edit.dataset.stockEdit);openModal('Ubah Stok Awal',`<div class="modal-fields"><label>Menu<input value="${esc(m.name)}" disabled></label><label>Stok awal<input name="stock" type="number" min="0" required value="${m.stock}"></label></div>`,f=>{const n=Number(f.get('stock'));if(n<m.reservation+m.manual+sessionSold(m.id)){toast('Stok tidak boleh lebih kecil dari jumlah yang sudah dialokasikan/terjual.');return false;}m.stock=n;log('Ubah stok awal',m.name,n);toast('Stok diperbarui.');});}if(add){const m=getMenu(add.dataset.stockAdd);openModal('Tambah Stok',`<div class="modal-fields"><label>Menu<input value="${esc(m.name)}" disabled></label><label>Jumlah tambahan<input name="qty" type="number" min="1" required></label></div>`,f=>{const q=Number(f.get('qty'));m.stock+=q;log('Penambahan stok',m.name,q);toast('Stok berhasil ditambahkan.');});}});
$('manualForm').addEventListener('submit',e=>{e.preventDefault();const m=getMenu($('manualMenu').value),q=Number($('manualQty').value);if(!m||q<1)return;if(q>available(m)){toast('Jumlah melebihi stok tersedia.');return;}m.manual+=q;db.history.unshift({id:uid(),time:nowText(),date:today(),action:'Penjualan manual',menu:m.name,menuId:m.id,qty:q,note:'Penjualan manual'});saveDB();e.target.reset();renderAll();toast('Penjualan tersimpan.');});
$('reservationForm').addEventListener('submit',e=>{e.preventDefault();const m=getMenu($('reservationMenu').value),q=Number($('reservationQty').value);if(!m||q<1)return;if(q>available(m)){toast('Jumlah reservasi melebihi stok tersedia.');return;}m.reservation+=q;db.reservations.unshift({id:uid(),time:nowText(),menuId:m.id,menuName:m.name,qty:q,note:$('reservationNote').value});log('Reservasi',m.name,q,$('reservationNote').value);e.target.reset();renderAll();toast('Reservasi tersimpan.');});
$('reservationTable').addEventListener('click',e=>{const b=e.target.closest('[data-res-cancel]');if(!b)return;const i=db.reservations.findIndex(r=>r.id===b.dataset.resCancel);if(i<0)return;const r=db.reservations.splice(i,1)[0],m=getMenu(r.menuId);if(m)m.reservation=Math.max(0,m.reservation-r.qty);log('Pembatalan reservasi',r.menuName,r.qty,r.note);renderAll();toast('Reservasi dibatalkan.');});
$('sessionForm').addEventListener('submit',e=>{e.preventDefault();const sid=$('sessionSelect').value,m=getMenu($('sessionMenu').value),q=Number($('sessionQty').value),s=getSession(today(),sid);if(!m||q<1)return;if(s.closed){toast('Sesi sudah dikunci.');return;}if(q>available(m)){toast('Jumlah melebihi stok tersedia.');return;}s.sales[m.id]=(s.sales[m.id]||0)+q;db.sessions[sessionKey(today(),sid)]=s;db.history.unshift({id:uid(),time:nowText(),date:today(),action:'Penjualan sesi',menu:m.name,menuId:m.id,qty:q,note:$('sessionSelect').selectedOptions[0].textContent});saveDB();e.target.reset();renderAll();toast('Penjualan sesi tersimpan.');});
$('sessionCards').addEventListener('click',e=>{const b=e.target.closest('[data-session-close]');if(!b)return;const sid=b.dataset.sessionClose,s=getSession(today(),sid);if(s.closed)return;if(!confirm('Tutup dan kunci sesi ini? Setelah ditutup, data penjualan sesi tidak dapat diubah.'))return;s.closed=true;s.closedAt=nowText();db.sessions[sessionKey(today(),sid)]=s;log('Sesi dikunci',sid,0,'Sesi ditutup permanen');renderAll();toast('Sesi berhasil dikunci.');});
$('auditForm').addEventListener('submit',e=>{e.preventDefault();const m=getMenu($('auditMenu').value),physical=Number($('physicalQty').value);if(!m||physical<0)return;const system=available(m),a={id:uid(),time:nowText(),menu:m.name,system,physical,diff:physical-system,note:$('auditNote').value};db.audits.unshift(a);log('Audit stok',m.name,physical,`Sistem ${system}; fisik ${physical}; selisih ${a.diff}`);e.target.reset();renderAll();toast(a.diff===0?'Stok sesuai.':'Ditemukan selisih stok.');});
$('receiptFile').addEventListener('change',()=>{$('receiptName').textContent=$('receiptFile').files[0]?.name||'';toast('Foto dipilih. AI scanner belum dihubungkan.');});
$('clearHistoryBtn').addEventListener('click',()=>{if(!confirm('Hapus seluruh riwayat transaksi? Data stok tidak berubah.'))return;db.history=[];saveDB();renderAll();toast('Riwayat dihapus.');});
$('exportCsvBtn').addEventListener('click',()=>{const rows=[['Menu','Stok Awal','Reservasi','Terjual','Tersedia'],...db.menus.map(m=>[m.name,m.stock,m.reservation,m.manual+sessionSold(m.id),available(m)])];const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');download('laporan-stok.csv',csv,'text/csv');});
function download(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
$('backupBtn').addEventListener('click',()=>download('stock-app-ai-backup-'+today()+'.json',JSON.stringify(db,null,2),'application/json'));
$('restoreFile').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const parsed=JSON.parse(await file.text());if(!parsed||!Array.isArray(parsed.menus)||!parsed.sessions||!Array.isArray(parsed.history))throw new Error('Format backup tidak valid');if(!confirm('Pulihkan backup? Data saat ini akan diganti.'))return;db=parsed;saveDB();renderAll();toast('Backup berhasil dipulihkan.');}catch(err){toast('File backup tidak valid.');}finally{e.target.value='';}});
$('resetBtn').addEventListener('click',()=>{if(!confirm('Yakin reset semua data? Tindakan ini tidak bisa dibatalkan. Unduh backup terlebih dahulu jika diperlukan.'))return;db=freshDB();saveDB();renderAll();toast('Aplikasi berhasil direset.');});

$('todayLabel').textContent=new Date().toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
saveDB();renderAll();
