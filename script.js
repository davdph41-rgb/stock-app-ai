const chat=document.querySelector("#chat");
const form=document.querySelector("#form");
const msg=document.querySelector("#msg");
const pick=document.querySelector("#pick");
const filesBox=document.querySelector("#files");
const newBtn=document.querySelector("#new");

let files=[];

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
      const result=reader.result;
      const base64=result.split(",")[1];

      resolve({
        name:file.name,
        type:file.type,
        size:file.size,
        data:base64
      });
    };

    reader.onerror=reject;
    reader.readAsDataURL(file);
  });
}

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

  typing();

  try{
    const converted=[];

    for(const file of selected){
      converted.push(await fileToBase64(file));
    }

    const response=await fetch("/api/chat",{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        message:text,
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

newBtn.onclick=()=>{
  chat.innerHTML=`
    <section class="welcome">
      <strong>NEX</strong>
      <h1>Halo! 👋</h1>
      <p>Kirim pesan atau tambahkan file/nota untuk mulai.</p>
    </section>
  `;
};
