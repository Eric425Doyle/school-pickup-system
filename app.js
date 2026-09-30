let liveQueue = [];
let liveServed = [];
let queueUnsubscribe = null;
let servedUnsubscribe = null;

function queueRef(){ return db.collection("pickupQueue"); }
function servedRef(){ return db.collection("pickupHistory"); }
function getQueue(){ return liveQueue; }
function getServedList(){ return liveServed; }
function nowDisplay(){ return new Date().toLocaleTimeString(); }

async function startRealtimeSync(onChange){
  if (typeof authReady !== "undefined") { const user = await authReady; if (!user) return; }
  if(!queueUnsubscribe){
    queueUnsubscribe = queueRef().orderBy("order","asc").onSnapshot(snap=>{
      liveQueue = snap.docs.map(d=>({id:d.id,...d.data()}));
      renderAllLists();
      if(typeof onChange === "function") onChange();
      window.dispatchEvent(new CustomEvent("pickup-queue-updated"));
    },err=>showSyncError(err));
  }
  if(!servedUnsubscribe){
    servedUnsubscribe = servedRef().orderBy("servedAtIso","desc").limit(20).onSnapshot(snap=>{
      liveServed = snap.docs.map(d=>({id:d.id,...d.data()}));
      renderAllLists();
      window.dispatchEvent(new CustomEvent("pickup-served-updated"));
    },err=>showSyncError(err));
  }
}
function showSyncError(err){
  console.error("Firestore sync error",err);
  document.querySelectorAll(".message,.scan-status").forEach(el=>{
    if(!el.textContent || /ready|camera not started/i.test(el.textContent)) el.textContent="Shared database connection error: "+err.message;
  });
}

async function addPickup(tagNumber,studentName="",source="Manual"){
  const cleaned=String(tagNumber).trim();
  if(!cleaned)return {success:false,message:"Tag number is required."};
  const doc=queueRef().doc(cleaned);
  try{
    return await db.runTransaction(async tx=>{
      const existing=await tx.get(doc);
      if(existing.exists) return {success:false,duplicate:true,message:`Tag ${cleaned} is already in the active queue.`};
      const last=await queueRef().orderBy("order","desc").limit(1).get();
      const order=last.empty?1:Number(last.docs[0].data().order||0)+1;
      const now=new Date();
      tx.set(doc,{tagNumber:cleaned,studentName:String(studentName||"").trim(),source,scannedAt:now.toLocaleTimeString(),scannedAtIso:now.toISOString(),status:"Active",order});
      setTimeout(()=>writeAudit("QUEUE_ADD",{pickupNumber:cleaned,studentName:String(studentName||""),source}),0); return {success:true,message:`Added tag ${cleaned}${studentName?` — ${studentName}`:""} to the pickup queue.`};
    });
  }catch(e){return {success:false,message:"Database error: "+e.message};}
}
async function addScan(tagNumber,source="Manual"){return addPickup(tagNumber,"",source);}
async function clearQueue(){const snap=await queueRef().get();const count=snap.size;const batch=db.batch();snap.forEach(d=>batch.delete(d.ref));await batch.commit();await writeAudit("QUEUE_CLEAR",{count});}
async function clearServedList(){const snap=await servedRef().get();const count=snap.size;const batch=db.batch();snap.forEach(d=>batch.delete(d.ref));await batch.commit();await writeAudit("SERVED_LOG_CLEAR",{count});}
async function rewriteOrder(q){const batch=db.batch();q.forEach((item,i)=>batch.update(queueRef().doc(item.tagNumber),{order:i+1}));await batch.commit();await writeAudit("QUEUE_REORDER",{order:q.map(x=>x.tagNumber)});}
async function moveUp(tag){const q=[...liveQueue],i=q.findIndex(x=>x.tagNumber===tag);if(i>0){[q[i-1],q[i]]=[q[i],q[i-1]];await rewriteOrder(q);}}
async function moveDown(tag){const q=[...liveQueue],i=q.findIndex(x=>x.tagNumber===tag);if(i>=0&&i<q.length-1){[q[i],q[i+1]]=[q[i+1],q[i]];await rewriteOrder(q);}}
async function moveToTop(tag){const q=[...liveQueue],i=q.findIndex(x=>x.tagNumber===tag);if(i>0){q.unshift(q.splice(i,1)[0]);await rewriteOrder(q);}}
async function moveToBottom(tag){const q=[...liveQueue],i=q.findIndex(x=>x.tagNumber===tag);if(i>=0&&i<q.length-1){q.push(q.splice(i,1)[0]);await rewriteOrder(q);}}
async function markServed(tag){
  const ref=queueRef().doc(tag);
  try{await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(!snap.exists)return;const item=snap.data(),now=new Date();const hist=servedRef().doc();tx.set(hist,{...item,servedAt:now.toLocaleTimeString(),servedAtIso:now.toISOString()});tx.delete(ref);});await writeAudit("SERVED",{pickupNumber:tag});}catch(e){console.error(e);}
}
function itemTitle(item,index){return `#${index+1} - ${item.tagNumber}${item.studentName?` — ${item.studentName}`:""}`;}
function renderQueueList(id,buttons=false){const c=document.getElementById(id);if(!c)return;const q=liveQueue;c.innerHTML="";if(!q.length){c.innerHTML='<p class="empty">No cars currently in queue.</p>';return;}q.forEach((item,index)=>{const row=document.createElement("div");row.className="queue-item";const left=document.createElement("div");left.innerHTML=`<div><strong>${itemTitle(item,index)}</strong></div><div class="queue-meta">Added ${item.scannedAt||""}${item.source?` via ${item.source}`:""}</div>`;row.appendChild(left);if(buttons){const controls=document.createElement("div");[["Top","queue-move",moveToTop],["Up","queue-move",moveUp],["Down","queue-move",moveDown],["Bottom","queue-move",moveToBottom],["Served","danger",markServed]].forEach(([label,cls,fn])=>{const b=document.createElement("button");b.className=`small ${cls}`;b.textContent=label;b.style.marginLeft="8px";b.onclick=async()=>{b.disabled=true;await fn(item.tagNumber);};controls.appendChild(b);});row.appendChild(controls);}c.appendChild(row);});}
function renderServedList(id){const c=document.getElementById(id);if(!c)return;c.innerHTML="";if(!liveServed.length){c.innerHTML='<p class="empty">No recently served cars.</p>';return;}liveServed.forEach((item,index)=>{const row=document.createElement("div");row.className="queue-item";row.innerHTML=`<div><div><strong>${itemTitle(item,index)}</strong></div><div class="queue-meta">Served at ${item.servedAt||""}</div></div>`;c.appendChild(row);});}
function renderAllLists(){renderQueueList("queueList",false);renderQueueList("displayQueue",false);renderQueueList("adminQueue",true);renderServedList("servedQueue");}
async function submitScannerForm(inputId,messageId){const input=document.getElementById(inputId),m=document.getElementById(messageId);if(!input||!m)return;const r=await addScan(input.value,"Manual");m.textContent=r.message;if(r.success){input.value="";input.focus();}}
async function submitAdminAdd(inputId,messageId){const input=document.getElementById(inputId),m=document.getElementById(messageId);if(!input||!m)return;const r=await addScan(input.value,"Admin");m.textContent=r.message;if(r.success){input.value="";input.focus();}}

function studentsRef(){ return db.collection("students"); }
async function lookupStudentByQr(qrId){
  const snap=await studentsRef().where("qrId","==",String(qrId).trim()).where("active","==",true).limit(1).get();
  if(snap.empty)return null;
  const d=snap.docs[0]; return {id:d.id,...d.data()};
}
async function lookupStudentByPickupNumber(tagNumber){
  const snap=await studentsRef().where("pickupNumber","==",String(tagNumber).trim()).where("active","==",true).limit(1).get();
  if(snap.empty)return null;
  const d=snap.docs[0]; return {id:d.id,...d.data()};
}
async function saveStudentRecord({id,name,pickupNumber,qrId,active=true}){
  name=String(name||"").trim(); pickupNumber=String(pickupNumber||"").trim(); qrId=String(qrId||"").trim();
  if(!name||!pickupNumber||!qrId)return {success:false,message:"Student name, pickup number, and QR ID are required."};
  const dupNum=await studentsRef().where("pickupNumber","==",pickupNumber).limit(2).get();
  if(dupNum.docs.some(d=>d.id!==id))return {success:false,message:`Pickup #${pickupNumber} is already assigned.`};
  const dupQr=await studentsRef().where("qrId","==",qrId).limit(2).get();
  if(dupQr.docs.some(d=>d.id!==id))return {success:false,message:"That QR ID is already assigned."};
  const ref=id?studentsRef().doc(id):studentsRef().doc();
  await ref.set({name,pickupNumber,qrId,active:Boolean(active),updatedAtIso:new Date().toISOString()},{merge:true});
  await writeAudit(id?"STUDENT_UPDATE":"STUDENT_CREATE",{studentId:ref.id,name,pickupNumber,active:Boolean(active)});
  return {success:true,id:ref.id,message:`Saved ${name} / #${pickupNumber}.`};
}
async function setStudentActive(id,active){await studentsRef().doc(id).update({active:Boolean(active),updatedAtIso:new Date().toISOString()});await writeAudit("STUDENT_STATUS",{studentId:id,active:Boolean(active)});}
async function deleteStudentRecord(id){await studentsRef().doc(id).delete();}
async function ensureDemoStudent(){
  const q=await studentsRef().where("qrId","==","SPU-DEMO-7F29A8C4").limit(1).get();
  if(q.empty) await saveStudentRecord({name:"Test Student",pickupNumber:"42",qrId:"SPU-DEMO-7F29A8C4",active:true});
}
async function addPickupByNumber(tagNumber,source="Manual"){
  const cleaned=String(tagNumber||"").trim(); if(!cleaned)return {success:false,message:"Pickup number is required."};
  try{const student=await lookupStudentByPickupNumber(cleaned);return student?addPickup(student.pickupNumber,student.name,source):addPickup(cleaned,"",source);}catch(e){return {success:false,message:"Student lookup error: "+e.message};}
}
async function submitScannerForm(inputId,messageId){const input=document.getElementById(inputId),m=document.getElementById(messageId);if(!input||!m)return;const r=await addPickupByNumber(input.value,"Manual");m.textContent=r.message;if(r.success){input.value="";input.focus();}}
async function submitAdminAdd(inputId,messageId){const input=document.getElementById(inputId),m=document.getElementById(messageId);if(!input||!m)return;const r=await addPickupByNumber(input.value,"Admin");m.textContent=r.message;if(r.success){input.value="";input.focus();}}

function auditRef(){ return db.collection('auditLog'); }
async function writeAudit(action, details={}){
  try{
    const user = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : await authReady;
    if(!user) return;
    const now = new Date();
    await auditRef().add({
      action,
      details,
      performedByUid:user.uid,
      performedByEmail:user.email||'',
      role:(typeof currentRole !== 'undefined' && currentRole)||'',
      timestamp:now.toLocaleString(),
      timestampIso:now.toISOString()
    });
  }catch(e){ console.error('Audit log error',e); }
}
