(function(){
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const money=n=>'$'+Number(n||0).toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2});
function showScreen(name,opts){
  if(name==='review'||name==='checkout'||name==='confirmation')name='enquiry';
  if(name!=='wire'&&name!=='enquiry')name='wire';
  $$('.screen').forEach(s=>s.style.display='none');
  const el=$('#screen-'+name);
  if(el)el.style.display='block';
  if(name==='enquiry')renderEnquiry();
  if(window.__lpBooting)return;
  const anchor=$('#calculator');
  if(anchor)window.scrollTo({top:Math.max(0,anchor.getBoundingClientRect().top+window.scrollY-12),behavior:'auto'});
}
function renderEnquiry(){
  const form=$('#wire-enquiry-form'),sent=$('#enq-sent');
  if(form)form.style.display='';
  if(sent)sent.style.display='none';
  const cart=(window.__cart||[]).filter(i=>i&&i.qty>0);
  const sub=cart.reduce((a,i)=>a+(i.total||0),0),gst=sub*0.1;
  const body=$('#enq-table');
  if(body)body.innerHTML=cart.length?cart.map(i=>`<tr><td>${i.name}</td><td class="num">${i.qty}</td><td class="num">${money(i.unit)}</td><td class="num">${money(i.total)}</td></tr>`).join(''):`<tr><td colspan="4" style="color:var(--muted);padding:18px 0">No parts yet — go back and enter your measurements.</td></tr>`;
  const set=(id,v)=>{const e=$(id);if(e)e.textContent=v;};
  set('#enq-sub',money(sub));set('#enq-gst',money(gst));set('#enq-total',money(sub+gst));
  const txt=cart.map(i=>`${i.qty} x ${i.name} @ ${money(i.unit)} ea = ${money(i.total)}`).join('\n')+`\n\nSubtotal (ex-GST): ${money(sub)}\nGST 10%: ${money(gst)}\nEstimated total (inc GST): ${money(sub+gst)}`;
  const pl=$('#parts_list'),pj=$('#parts_json');
  if(pl)pl.value=txt;
  if(pj)pj.value=JSON.stringify(cart);
}
window.showScreen=showScreen;
window.renderReview=renderEnquiry;
window.goPlaceholder=function(){};
function boot(){
  startWhenReady(0);
  const next=$('#wiz-next');
  if(next){
    const relabel=()=>{if(next.textContent.trim()==='Add to cart')next.textContent='Review & send my measurements';};
    new MutationObserver(relabel).observe(next,{childList:true,characterData:true,subtree:true});
    relabel();
  }
  const edit=$('#enq-edit');
  if(edit)edit.onclick=()=>{if(window.wireGoToStage)window.wireGoToStage('summary');else window.showScreen('wire');};
  const bar=$('#lp-stickybar'),hero=document.querySelector('.lp-hero');
  if(bar&&hero&&'IntersectionObserver' in window){
    new IntersectionObserver(es=>{bar.classList.toggle('is-on',!es[0].isIntersecting)},{rootMargin:'-40px 0px 0px 0px'}).observe(hero);
  }
  const photos=$('#f-photos'),plist=$('#f-photos-list'),ptxt=$('#f-photos-txt');
  if(photos)photos.addEventListener('change',()=>{
    const files=Array.from(photos.files||[]);
    if(ptxt)ptxt.textContent=files.length?(files.length+' file'+(files.length>1?'s':'')+' selected — choose again to replace them'):'Add as many as you like — photos, sketches or a PDF plan';
    if(plist)plist.innerHTML=files.map(f=>`<li><span>${f.name.replace(/[<>]/g,'')}</span><span>${(f.size/1024/1024).toFixed(1)} MB</span></li>`).join('');
  });
  const form=$('#wire-enquiry-form');
  if(form)form.addEventListener('submit',e=>{
    if(typeof window.wireEnquirySent==='function'){try{window.wireEnquirySent();}catch(err){}}
    if(!(form.getAttribute('action')||'').trim()){
      e.preventDefault();
      if(!form.reportValidity())return;
      form.style.display='none';
      const sent=$('#enq-sent');
      if(sent){sent.style.display='';window.scrollTo({top:Math.max(0,sent.getBoundingClientRect().top+window.scrollY-80),behavior:'auto'});}
    }
  });
  // Soft-conversion path: "email me the quote" — captures email + parts list without the full form.
  const softBtn=$('#enq-soft-send'),softEmail=$('#enq-soft-email'),softDone=$('#enq-soft-done');
  if(softBtn&&softEmail)softBtn.addEventListener('click',()=>{
    const email=(softEmail.value||'').trim();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){softEmail.focus();softEmail.style.borderColor='#b23';return;}
    softEmail.style.borderColor='';
    if(typeof window.wireQuoteEmailRequested==='function'){try{window.wireQuoteEmailRequested(email);}catch(err){}}
    const action=((form&&form.getAttribute('action'))||'').trim();
    const pl=$('#parts_list'),pj=$('#parts_json');
    if(action&&window.fetch){
      const fd=new FormData();
      fd.append('email',email);fd.append('request_type','quote_copy');
      if(pl)fd.append('parts_list',pl.value||'');
      if(pj)fd.append('parts_json',pj.value||'');
      fetch(action,{method:'POST',body:fd,headers:{'Accept':'application/json'}}).catch(()=>{});
    }
    softEmail.style.display='none';softBtn.style.display='none';
    if(softDone)softDone.style.display='block';
  });
}
function startWhenReady(n){
  if(window.resetWireBuilder){window.__lpBooting=true;window.showScreen('wire');window.__lpBooting=false;setTimeout(()=>window.scrollTo(0,0),0);setTimeout(()=>window.scrollTo(0,0),120);return;}
  if(n<200)setTimeout(()=>startWhenReady(n+1),25);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else setTimeout(boot,0);
})();
