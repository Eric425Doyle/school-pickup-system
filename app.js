const STORAGE_KEY = "pickupQueue";
const SERVED_KEY = "pickupServed";

function getQueue(){const raw=localStorage.getItem(STORAGE_KEY);return raw?JSON.parse(raw):[];}
function saveQueue(q){localStorage.setItem(STORAGE_KEY,JSON.stringify(q));}
function getServedList(){const raw=localStorage.getItem(SERVED_KEY);return raw?JSON.parse(raw):[];}
function saveServedList(q){localStorage.setItem(SERVED_KEY,JSON.stringify(q));}

function addPickup(tagNumber, studentName="", source="Manual"){
  const cleaned=String(tagNumber).trim();
  if(!cleaned)return {success:false,message:"Tag number is required."};
  const q=getQueue();
  if(q.some(x=>x.tagNumber===cleaned)) return {success:false,message:`Tag ${cleaned} is already in the active queue.`};
  const now=new Date();
  q.push({tagNumber:cleaned,studentName:String(studentName||"").trim(),source,scannedAt:now.toLocaleTimeString(),scannedAtIso:now.toISOString(),status:"Active"});
  saveQueue(q);
  return {success:true,message:`Added tag ${cleaned}${studentName?` — ${studentName}`:""} to the pickup queue.`};
}
function addScan(tagNumber,source="Manual"){return addPickup(tagNumber,"",source);}
function removeTag(tagNumber){saveQueue(getQueue().filter(x=>x.tagNumber!==tagNumber));}
function clearQueue(){saveQueue([]);}
function clearServedList(){saveServedList([]);}
function moveUp(tag){const q=getQueue(),i=q.findIndex(x=>x.tagNumber===tag);if(i>0){[q[i-1],q[i]]=[q[i],q[i-1]];saveQueue(q);}}
function moveDown(tag){const q=getQueue(),i=q.findIndex(x=>x.tagNumber===tag);if(i>=0&&i<q.length-1){[q[i],q[i+1]]=[q[i+1],q[i]];saveQueue(q);}}
function moveToTop(tag){const q=getQueue(),i=q.findIndex(x=>x.tagNumber===tag);if(i>0){q.unshift(q.splice(i,1)[0]);saveQueue(q);}}
function moveToBottom(tag){const q=getQueue(),i=q.findIndex(x=>x.tagNumber===tag);if(i>=0&&i<q.length-1){q.push(q.splice(i,1)[0]);saveQueue(q);}}
function markServed(tag){const q=getQueue(),i=q.findIndex(x=>x.tagNumber===tag);if(i<0)return;const item=q[i];const s=getServedList();s.unshift({...item,servedAt:new Date().toLocaleTimeString()});saveServedList(s.slice(0,20));q.splice(i,1);saveQueue(q);}
function itemTitle(item,index){return `#${index+1} - ${item.tagNumber}${item.studentName?` — ${item.studentName}`:""}`;}
function renderQueueList(id,buttons=false){const c=document.getElementById(id);if(!c)return;const q=getQueue();c.innerHTML="";if(!q.length){c.innerHTML='<p class="empty">No cars currently in queue.</p>';return;}q.forEach((item,index)=>{const row=document.createElement("div");row.className="queue-item";const left=document.createElement("div");left.innerHTML=`<div><strong>${itemTitle(item,index)}</strong></div><div class="queue-meta">Added ${item.scannedAt||""}${item.source?` via ${item.source}`:""}</div>`;row.appendChild(left);if(buttons){const controls=document.createElement("div");[["Top","queue-move",()=>moveToTop(item.tagNumber)],["Up","queue-move",()=>moveUp(item.tagNumber)],["Down","queue-move",()=>moveDown(item.tagNumber)],["Bottom","queue-move",()=>moveToBottom(item.tagNumber)],["Served","danger",()=>markServed(item.tagNumber)]].forEach(([label,cls,fn])=>{const b=document.createElement("button");b.className=`small ${cls}`;b.textContent=label;b.style.marginLeft="8px";b.onclick=()=>{fn();renderAllLists();};controls.appendChild(b);});row.appendChild(controls);}c.appendChild(row);});}
function renderServedList(id){const c=document.getElementById(id);if(!c)return;const s=getServedList();c.innerHTML="";if(!s.length){c.innerHTML='<p class="empty">No recently served cars.</p>';return;}s.forEach((item,index)=>{const row=document.createElement("div");row.className="queue-item";row.innerHTML=`<div><div><strong>${itemTitle(item,index)}</strong></div><div class="queue-meta">Served at ${item.servedAt}</div></div>`;c.appendChild(row);});}
function renderAllLists(){renderQueueList("queueList",false);renderQueueList("displayQueue",false);renderQueueList("adminQueue",true);renderServedList("servedQueue");}
function submitScannerForm(inputId,messageId){const input=document.getElementById(inputId),m=document.getElementById(messageId);if(!input||!m)return;const r=addScan(input.value,"Manual");m.textContent=r.message;if(r.success){input.value="";input.focus();}renderAllLists();}
function submitAdminAdd(inputId,messageId){const input=document.getElementById(inputId),m=document.getElementById(messageId);if(!input||!m)return;const r=addScan(input.value,"Admin");m.textContent=r.message;if(r.success){input.value="";input.focus();}renderAllLists();}
window.addEventListener("storage",renderAllLists);
