(function(){
const $=s=>document.querySelector(s);
const WIRE_COUNT=11,WASTE=1.05,WIRE_MAX_RUN=10000;
const RAIL_STOCK_MM=6000;
const SPAN={residential:{level:1480,stair:1500},commercial:{level:1300,stair:1300}};
const levelSpan=()=>SPAN[ws.jobType||'residential'].level;
const stairSpan=()=>SPAN[ws.jobType||'residential'].stair;
const PRICE={end:140,corner:150,mid:100,breakpost:150,twoend:140,stairEnd:201,stairMid:176,postfixing:4,wire:1.48,turnbuckle:10,fork:5,eyebolt:1.20,screw:0.6,plug:0.45,grommet:0.25,lag:4,crimpPer:5.45,crimpMin:100,pcBlack:20,pcCustom:30,pcCustomMin:150,touchup:20,railPerM:35,railPerMPc:70,sleeve:12,elbow90:30,elbowAdj:50,railCap:12,railFlange:12,saddle:9,saddleCorner:14,toolHire:50,wireCutter:40,crimper:190};
const FIXINGS_PER_POST=4;
const JOB_LABEL={residential:'Residential',commercial:'Commercial'};
const FINISH_LABEL={brushed:'Brushed finish',mirror:'Mirror finish',black:'Matt black'};
const POST_SIZE_LABEL={round50:'50mm round',square38:'38×38mm square'};
const RAIL_SIZE_LABEL={round38:'38mm round',round50:'50mm round',rect5025:'50×25mm rectangular'};
const RAIL_IMG={'round38|brushed':'images/handrail-round38-brushed.jpg','round38|mirror':'images/handrail-round38-mirror.jpg','round50|brushed':'images/handrail-round50-brushed.jpg','round50|mirror':'images/handrail-round50-mirror.jpg','round38|black':'images/handrail-round-black.jpg','round50|black':'images/handrail-round-black.jpg','rect5025|brushed':'images/handrail-rect5025-brushed.jpg','rect5025|mirror':'images/handrail-rect5025-mirror.jpg'};
const SHAPES={
  straight:{label:'Straight run',count:1,desc:'One flat, uninterrupted length',icon:'<path d="M10 60h80"/><circle cx="10" cy="60" r="4" fill="#1f2a2c"/><circle cx="90" cy="60" r="4" fill="#1f2a2c"/>'},
  l:{label:'L-shape · 1 corner',count:2,desc:'Two lengths meeting at a 90° turn',icon:'<path d="M12 60h48v-30"/><circle cx="12" cy="60" r="4" fill="#1f2a2c"/><circle cx="60" cy="60" r="4" fill="#e0a23a"/><circle cx="60" cy="30" r="4" fill="#1f2a2c"/>'},
  u:{label:'U-shape · 2 corners',count:3,desc:'Wraps a void or balcony on three sides',icon:'<path d="M14 30v30h44v-30"/><circle cx="14" cy="30" r="4" fill="#1f2a2c"/><circle cx="14" cy="60" r="4" fill="#e0a23a"/><circle cx="58" cy="60" r="4" fill="#e0a23a"/><circle cx="58" cy="30" r="4" fill="#1f2a2c"/>'},
  z:{label:'Zigzag · 3+ corners',count:4,desc:'Turns back on itself — steps in and out',icon:'<path d="M10 58h20v-22h20v22h20"/><circle cx="10" cy="58" r="4" fill="#1f2a2c"/><circle cx="30" cy="58" r="4" fill="#e0a23a"/><circle cx="50" cy="36" r="4" fill="#e0a23a"/><circle cx="70" cy="58" r="4" fill="#1f2a2c"/>'},
  stair:{label:'Stair flight',count:0,desc:'A raking flight, with or without a landing',icon:'<path d="M12 62h16V46h16V30h16V16"/><circle cx="12" cy="62" r="4" fill="#1f2a2c"/><circle cx="76" cy="16" r="4" fill="#1f2a2c"/>'},
  custom:{label:'Build it section by section',count:1,desc:'More corners, or an irregular wraparound',icon:'<path d="M10 55h20M40 55h5M55 55h20" stroke-dasharray="4 4"/><circle cx="10" cy="55" r="4" fill="#1f2a2c"/><circle cx="75" cy="55" r="4" fill="#1f2a2c"/>'}
};
let ws={stage:'intro',jobType:null,runs:[],finish:null,pcColour:'',postSize:null,handrail:false,railSize:null,fixingSurface:null,plateQty:null,viewRunIdx:null};
let extrasQty={screw:null,plug:null};
let history=[];
function snapshot(){return JSON.parse(JSON.stringify(ws));}
function pushHistory(){history.push(snapshot());}
function goBack(){if(!history.length)return;ws=history.pop();render();}
function resetWire(){ws={stage:'intro',jobType:null,runs:[],finish:null,pcColour:'',postSize:null,handrail:false,railSize:null,fixingSurface:null,plateQty:null,viewRunIdx:null};extrasQty={screw:null,plug:null};Object.keys(addedExtras).forEach(k=>delete addedExtras[k]);history=[];render();}
function runHasLen(r){return r.shape==='stair'?Number(r.steps)>0:r.sections.some(s=>Number(s)>0);}
function stairGeom(r){
  const steps=Number(r.steps)||0,perStep=Number(r.perStep)||330,ang=Number(r.angle)||34;
  const going=steps*perStep,rad=ang*Math.PI/180;
  const rise=going*Math.tan(rad),rake=going/Math.cos(rad);
  const flat=r.hasFlat?(Number(r.flatLen)||0):0;
  return{steps,perStep,ang,going,rise,rake,flat,totalLen:rake+flat};
}
function hasAnyLen(){return ws.runs.some(runHasLen);}
window.resetWireBuilder=resetWire;
const addedExtras={};

function computeParts(){
  const runsList=ws.runs;
  let endPosts=0,cornerPosts=0,intermediate=0,breakPosts=0,twoEndCorners=0,stairEndPosts=0,stairMidPosts=0,totalLenMM=0,wireMetres=0,turnbuckles=0,forkTerminals=0,eyebolts=0,numSectionsTotal=0,railSleeves=0,railElbows90=0,railElbowsAdj=0,railCaps=0,railFlanges=0,railMetres=0;
  const runSummaries=runsList.map(r=>{
    if(r.shape==='stair'){
      const g=stairGeom(r);
      const spans=Math.max(1,Math.ceil(g.going/stairSpan()));
      const stairMid=spans-1;
      const flatMid=g.flat>0?Math.max(0,Math.ceil(g.flat/levelSpan())-1):0;
      stairEndPosts+=2;stairMidPosts+=stairMid;
      if(g.flat>0){endPosts+=1;intermediate+=flatMid;}
      totalLenMM+=g.totalLen;
      wireMetres+=Math.ceil((g.totalLen/1000)*WIRE_COUNT*WASTE);
      turnbuckles+=WIRE_COUNT;forkTerminals+=WIRE_COUNT;eyebolts+=WIRE_COUNT*2;
      numSectionsTotal+=1;
      if(ws.handrail){
        railMetres+=g.totalLen/1000;
        railSleeves+=Math.max(0,Math.ceil(g.totalLen/RAIL_STOCK_MM)-1);
        if(g.flat>0)railElbowsAdj+=1;
        const et=r.endTreatment||{start:null,end:null};
        if(et.start==='flange')railFlanges++;else if(et.start==='cap')railCaps++;
        if(et.end==='flange')railFlanges++;else if(et.end==='cap')railCaps++;
      }
      return{shape:'stair',lens:g.flat>0?[g.rake,g.flat]:[g.rake],numSections:1,corners:0,breaks:0,lenMM:g.totalLen,stair:g};
    }
    const lens=r.sections.map(s=>Number(s)>0?Number(s):3000);
    const numSections=lens.length||1;
    const corners=Math.max(0,numSections-1);
    const lenMM=lens.reduce((a,b)=>a+b,0);
    let inter=0,breaks=0;lens.forEach(L=>{inter+=Math.max(0,Math.ceil(L/levelSpan())-1);breaks+=Math.max(0,Math.ceil(L/WIRE_MAX_RUN)-1);});
    const cpt=r.cornerPostType||[];
    let twoEnd=0;for(let k=0;k<corners;k++){if(cpt[k]==='twoend')twoEnd++;}
    endPosts+=2+twoEnd*2;cornerPosts+=corners-twoEnd;intermediate+=inter;breakPosts+=breaks;twoEndCorners+=twoEnd;totalLenMM+=lenMM;
    wireMetres+=Math.ceil((lenMM/1000)*WIRE_COUNT*WASTE);
    turnbuckles+=WIRE_COUNT*(numSections+breaks);forkTerminals+=WIRE_COUNT*(numSections+breaks);eyebolts+=WIRE_COUNT*(numSections+breaks)*2;numSectionsTotal+=numSections;
    if(ws.handrail){
      railMetres+=lenMM/1000;
      railSleeves+=lens.reduce((a,L)=>a+Math.max(0,Math.ceil(L/RAIL_STOCK_MM)-1),0);
      const cet=r.cornerElbow||[];const cang=r.cornerAngle||[];
      for(let k=0;k<corners;k++){const isOffSquare=Number(cang[k])>0&&Number(cang[k])!==90;if(isOffSquare||cet[k]==='adjustable')railElbowsAdj++;else railElbows90++;}
      const et=r.endTreatment||{start:null,end:null};
      if(et.start==='flange')railFlanges++;else if(et.start==='cap')railCaps++;
      if(et.end==='flange')railFlanges++;else if(et.end==='cap')railCaps++;
    }
    return{shape:r.shape,lens,numSections,corners,breaks,lenMM};
  });
  const totalPosts=endPosts+cornerPosts+intermediate+breakPosts+stairEndPosts+stairMidPosts;
  const postFixings=totalPosts*FIXINGS_PER_POST;
  const recommendedScrews=totalPosts*FIXINGS_PER_POST;
  const recommendedPlugs=ws.fixingSurface==='timber'?0:totalPosts*FIXINGS_PER_POST;
  return{runSummaries,numRuns:runsList.length,numSections:numSectionsTotal,corners:cornerPosts,twoEndCorners,totalLenMM,intermediate,breakPosts,endPosts,cornerPosts,stairEndPosts,stairMidPosts,totalPosts,postFixings,wireMetres,turnbuckles,forkTerminals,eyebolts,recommendedScrews,recommendedPlugs,railMetres,railSleeves,railElbows90,railElbowsAdj,railCaps,railFlanges};
}
function buildKitRows(p){
  const fl=FINISH_LABEL[ws.finish]||(ws.finish==='custom'?(ws.pcColour?'Powder-coat '+ws.pcColour:'Powder-coat colour'):''),ps=POST_SIZE_LABEL[ws.postSize]||'';
  const rows=[];
  const incl='incl. base plate + cover';
  if(p.endPosts>0)rows.push({key:'end',name:`End post — pre-drilled, ${incl} (${ps}, ${fl})`,qty:p.endPosts-p.twoEndCorners*2,unit:PRICE.end,thumb:'images/part-endpost.jpg'});
  if(p.cornerPosts>0)rows.push({key:'corner',name:`Corner post — pre-drilled, ${incl} (${ps}, ${fl})`,qty:p.cornerPosts,unit:PRICE.corner,thumb:'images/part-cornerpost.jpg'});
  if(p.intermediate>0)rows.push({key:'mid',name:`Intermediate post — pre-drilled, ${incl} (${ps}, ${fl})`,qty:p.intermediate,unit:PRICE.mid,thumb:'images/part-intermediate-w.jpg'});
  if(p.stairEndPosts>0)rows.push({key:'stairend',name:`Stair end post — raked, pre-drilled, ${incl} (${ps}, ${fl})`,qty:p.stairEndPosts,unit:PRICE.stairEnd,thumb:'images/part-endpost.jpg'});
  if(p.stairMidPosts>0)rows.push({key:'stairmid',name:`Stair intermediate post — raked, pre-drilled, ${incl} (${ps}, ${fl})`,qty:p.stairMidPosts,unit:PRICE.stairMid,thumb:'images/part-intermediate-w.jpg'});
  if(p.breakPosts>0)rows.push({key:'breakpost',name:`Mid-run post — pre-drilled both faces, ${incl} (${ps}, ${fl})`,qty:p.breakPosts,unit:PRICE.breakpost,thumb:'images/part-endpost.jpg',note:'One of your sections is longer than 10m — a single wire run can\'t span that far, so we split it with an extra post drilled on both faces, doubling the eyebolts, turnbuckles and forks at that point'});
  if(p.twoEndCorners>0)rows.push({key:'twoend',name:`End post — pre-drilled, used as corner pair (${ps}, ${fl})`,qty:p.twoEndCorners*2,unit:PRICE.twoend,thumb:'images/part-endpost.jpg',note:'You chose two separate end posts instead of a corner post for an off-square corner'});
  rows.push({key:'wire',name:`316 wire 3.2mm — ${WIRE_COUNT} runs (per m)`,qty:p.wireMetres,unit:PRICE.wire,thumb:'images/part-wire.png'});
  rows.push({key:'turnbuckle',name:'Adjustable swage (turnbuckle)',qty:p.turnbuckles,unit:PRICE.turnbuckle,thumb:'images/part-turnbuckle-w.jpg'});
  rows.push({key:'fork',name:'Fork terminal',qty:p.forkTerminals,unit:PRICE.fork,thumb:'images/part-fork-w.jpg'});
  rows.push({key:'eyebolt',name:'Eyebolt',qty:p.eyebolts,unit:PRICE.eyebolt,thumb:'images/part-eyebolt.jpg'});
  rows.push({key:'postfixing',name:`Post fixings (${FIXINGS_PER_POST} per post)`,qty:p.postFixings,unit:PRICE.postfixing,thumb:'images/part-fixing-screw.jpg'});
  if(ws.finish==='black')rows.push({key:'pc',name:'Powder coat — matt black (per post)',qty:p.totalPosts,unit:PRICE.pcBlack});
  if(ws.finish==='custom'){
    rows.push({key:'pc',name:`Powder coat — ${ws.pcColour||'custom colour'} (per post)`,qty:p.totalPosts,unit:PRICE.pcCustom});
    const short=PRICE.pcCustomMin-p.totalPosts*PRICE.pcCustom;
    if(short>0)rows.push({key:'pcmin',name:'Custom colour minimum charge top-up',qty:1,unit:short,note:`Custom powder-coat colours carry a ${money(PRICE.pcCustomMin)} minimum charge`});
  }
  if(ws.finish==='black'||ws.finish==='custom')rows.push({key:'touchup',name:'Powder-coat touch-up can',qty:1,unit:PRICE.touchup,note:'One touch-up can, for marks on powder-coated posts or handrail'});
  if(ws.handrail){
    const rl=RAIL_SIZE_LABEL[ws.railSize]||'';
    const pc=ws.finish==='black'||ws.finish==='custom';
    rows.push({key:'rail',name:`Top handrail — ${rl}, ${fl} (per m)`,qty:Math.round(p.railMetres*100)/100,unit:pc?PRICE.railPerMPc:PRICE.railPerM,thumb:'images/part-handrail-w.jpg'});
    if(p.railSleeves>0)rows.push({key:'sleeve',name:'Handrail sleeve / joiner',qty:p.railSleeves,unit:PRICE.sleeve,thumb:'images/part-sleeve.jpg',note:'Needed because one of your section lengths is longer than a 6m stock length — joins two lengths together'});
    if(p.railElbows90>0)rows.push({key:'elbow90',name:'Handrail elbow — 90° (per corner)',qty:p.railElbows90,unit:PRICE.elbow90,thumb:'images/part-elbow90.jpg'});
    if(p.railElbowsAdj>0)rows.push({key:'elbowadj',name:'Handrail elbow — adjustable angle (per corner)',qty:p.railElbowsAdj,unit:PRICE.elbowAdj,thumb:'images/part-elbowadj.jpg'});
    if(p.railCaps>0)rows.push({key:'railcap',name:'Handrail end cap',qty:p.railCaps,unit:PRICE.railCap,thumb:'images/part-endcap.jpg'});
    if(p.railFlanges>0)rows.push({key:'railflange',name:'Handrail wall flange',qty:p.railFlanges,unit:PRICE.railFlange,thumb:ws.railSize==='rect5025'?'images/part-flange-rect.jpg':'images/part-flange-round.jpg'});
    const straightSaddles=p.endPosts+p.intermediate+p.breakPosts+p.stairEndPosts+p.stairMidPosts;
    if(straightSaddles>0)rows.push({key:'saddle',name:'Handrail saddle — straight (per post)',qty:straightSaddles,unit:PRICE.saddle,thumb:'images/part-saddle-straight.jpg'});
    if(p.cornerPosts>0)rows.push({key:'saddlecorner',name:'Handrail saddle — 90° corner (per post)',qty:p.cornerPosts,unit:PRICE.saddleCorner,thumb:'images/part-saddle-corner.jpg'});
  }
  return rows.filter(r=>r.qty>0);
}

function resolveViewIdx(){
  const filledRuns=ws.runs.filter(runHasLen);
  let viewIdx=ws.viewRunIdx;
  if(viewIdx==null||!ws.runs[viewIdx]){
    viewIdx=filledRuns.length?ws.runs.indexOf(filledRuns[filledRuns.length-1]):(ws.runs.length?ws.runs.length-1:-1);
  }
  return viewIdx;
}
function renderPlan(){
  const svg=$('#wire-plan-svg'),cap=$('#wire-plan-cap'),box=$('#wire-plan-box'),label=$('#wire-plan-label'),runsBox=$('#wire-plan-runs');
  const viewIdx=resolveViewIdx();
  const lastRun=viewIdx>=0?ws.runs[viewIdx]:null;
  if(label)label.textContent=lastRun?`${viewIdx+1}. ${SHAPES[lastRun.shape].label} — ${lastRun.shape==='stair'?'side elevation':'plan view'}`:(ws.runs.length>1?'Your runs — plan view':'Your run — plan view');
  const displaySections=lastRun?(lastRun.shape==='stair'?[]:lastRun.sections):[];
  const hasLen=lastRun?runHasLen(lastRun):false;
  box&&box.classList.toggle('is-empty',!hasLen);
  if(runsBox){
    runsBox.innerHTML=ws.runs.length>1?`<div class="wiz-plan-runs__head">All sections · click to view</div>`+ws.runs.map((r,i)=>{
      const lens=r.shape==='stair'?[stairGeom(r).totalLen]:r.sections.map(s=>Number(s)>0?Number(s):3000);
      const m=(lens.reduce((a,b)=>a+b,0)/1000).toFixed(2);
      return `<div class="wiz-plan-runs__row${i===viewIdx?' is-active':''}" data-view-run="${i}"><span>${i+1}. ${SHAPES[r.shape].label}</span><span>${m}m</span></div>`;
    }).join(''):'';
    runsBox.querySelectorAll('[data-view-run]').forEach(el=>el.onclick=()=>{ws.viewRunIdx=Number(el.dataset.viewRun);renderPlan();});
  }
  if(lastRun&&lastRun.shape==='stair'){renderStairElevation(lastRun,svg,cap);return;}
  if(!hasLen){svg.innerHTML='';cap.textContent='Enter a length to preview your run';return;}
  const lens=displaySections.map(s=>Number(s)>0?Number(s):3000);
  const dirs=[[1,0],[0,-1],[-1,0],[0,1]];
  let x=0,y=0,minX=0,maxX=0,minY=0,maxY=0,hi=0;
  const pts=[[0,0]];
  lens.forEach((L,i)=>{
    const px=Math.max(30,Math.min(150,L/40));
    if(i>0){const cd=(lastRun.cornerDir&&lastRun.cornerDir[i-1])||'L';hi=(hi+(cd==='R'?3:1))%4;}
    const[dx,dy]=dirs[hi];
    x+=dx*px;y+=dy*px;
    pts.push([x,y]);
    minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
  });
  const pad=24,w=(maxX-minX)+pad*2,h=(maxY-minY)+pad*2;
  const ox=pad-minX,oy=pad-minY;
  svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  let path='M'+pts.map(p=>(p[0]+ox).toFixed(1)+','+(p[1]+oy).toFixed(1)).join(' L');
  let dots='';
  const et=(ws.handrail&&lastRun&&lastRun.endTreatment)||{start:null,end:null};
  let flangeLabels='';
  pts.forEach((p,i)=>{
    const isEnd=i===0||i===pts.length-1;
    const isFlange=ws.handrail&&isEnd&&((i===0&&et.start==='flange')||(i===pts.length-1&&et.end==='flange'));
    const r=isEnd?5:4.5;
    const cx=(p[0]+ox).toFixed(1),cy=(p[1]+oy).toFixed(1);
    if(isFlange){
      dots+=`<rect x="${(p[0]+ox-6).toFixed(1)}" y="${(p[1]+oy-6).toFixed(1)}" width="12" height="12" rx="2" fill="#2f6f6d"/>`;
      const lx=p[0]+ox,ly=p[1]+oy-14;
      flangeLabels+=`<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="7" fill="#cfe0df" text-anchor="middle">wall flange</text>`;
    }else{
      const isTwoEnd=!isEnd&&lastRun&&lastRun.cornerPostType&&lastRun.cornerPostType[i-1]==='twoend';
      const fill=isEnd||isTwoEnd?'#dfe6e7':'#e0a23a';
      if(isTwoEnd){
        dots+=`<circle cx="${(p[0]+ox-3).toFixed(1)}" cy="${cy}" r="4" fill="${fill}"/><circle cx="${(p[0]+ox+3).toFixed(1)}" cy="${cy}" r="4" fill="${fill}"/>`;
      }else{
        dots+=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;
      }
      if(ws.handrail&&isEnd){
        const lx=p[0]+ox,ly=p[1]+oy-14;
        flangeLabels+=`<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="7" fill="#8fa9a8" text-anchor="middle">end cap</text>`;
      }
      if(isTwoEnd){
        const lx=p[0]+ox,ly=p[1]+oy-14;
        flangeLabels+=`<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="7" fill="#dfe6e7" text-anchor="middle">2 end posts</text>`;
      }
      if(!isEnd&&!isTwoEnd){
        const cang=lastRun&&lastRun.cornerAngle&&lastRun.cornerAngle[i-1];
        if(cang&&Number(cang)!==90){
          const lx=p[0]+ox,ly=p[1]+oy-14;
          flangeLabels+=`<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="7" fill="#e0a23a" text-anchor="middle">${cang}°</text>`;
        }
      }
    }
  });
  let breakLabels='';
  lens.forEach((L,i)=>{
    const n=Math.max(0,Math.ceil(L/levelSpan())-1);
    const nb=Math.max(0,Math.ceil(L/WIRE_MAX_RUN)-1);
    const[p0,p1]=[pts[i],pts[i+1]];
    if(n)for(let k=1;k<=n;k++){
      const t=k/(n+1);
      const mx=p0[0]+(p1[0]-p0[0])*t,my=p0[1]+(p1[1]-p0[1])*t;
      dots+=`<circle cx="${(mx+ox).toFixed(1)}" cy="${(my+oy).toFixed(1)}" r="3.5" fill="#8fa9a8"/>`;
    }
    if(nb)for(let k=1;k<=nb;k++){
      const t=k/(nb+1);
      const mx=p0[0]+(p1[0]-p0[0])*t,my=p0[1]+(p1[1]-p0[1])*t;
      dots+=`<circle cx="${(mx+ox).toFixed(1)}" cy="${(my+oy).toFixed(1)}" r="5.5" fill="#dfe6e7"/>`;
      breakLabels+=`<text x="${(mx+ox).toFixed(1)}" y="${(my+oy-14).toFixed(1)}" font-size="7" fill="#dfe6e7" text-anchor="middle">mid-run post</text>`;
    }
  });
  svg.innerHTML=`<path d="${path}" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"/>${dots}${flangeLabels}${breakLabels}`;
  const total=(lens.reduce((a,b)=>a+b,0)/1000).toFixed(2);
  cap.textContent=total+'m total run · '+lens.length+' section'+(lens.length>1?'s':'');
}

function renderStairElevation(run,svg,cap){
  const g=stairGeom(run);
  if(!g.steps){svg.innerHTML='';cap.textContent='Enter a step count to preview your flight';return;}
  const spans=Math.max(1,Math.ceil(g.going/stairSpan()));
  const W=340,H=200,pad=30,postH=1000;
  const spanW=(W-pad*2)/Math.max(1,g.going+g.flat);
  const spanH=(H-pad*2)/Math.max(1,g.rise+postH);
  const s=Math.min(spanW,spanH);
  const px=v=>pad+v*s, py=v=>H-pad-v*s;
  const topX=g.going,topY=g.rise;
  let steps='';
  const riseStep=g.rise/g.steps;
  for(let k=0;k<g.steps;k++){
    const x0=k*g.perStep,y0=k*riseStep;
    steps+=`<path d="M${px(x0).toFixed(1)},${py(y0).toFixed(1)} L${px(x0+g.perStep).toFixed(1)},${py(y0).toFixed(1)} L${px(x0+g.perStep).toFixed(1)},${py(y0+riseStep).toFixed(1)}" stroke="#5a6f6e" stroke-width="1.5" fill="none"/>`;
  }
  let line=`<path d="M${px(0)},${py(postH)} L${px(topX).toFixed(1)},${py(topY+postH).toFixed(1)}${g.flat>0?` L${px(topX+g.flat).toFixed(1)},${py(topY+postH).toFixed(1)}`:''}" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"/>`;
  let posts='';
  const postAt=(x,yBase)=>{posts+=`<line x1="${px(x).toFixed(1)}" y1="${py(yBase).toFixed(1)}" x2="${px(x).toFixed(1)}" y2="${py(yBase+postH).toFixed(1)}" stroke="#8fa9a8" stroke-width="2"/>`;};
  for(let k=0;k<=spans;k++){
    const x=(g.going/spans)*k,y=(g.rise/spans)*k;
    postAt(x,y);
    posts+=`<circle cx="${px(x).toFixed(1)}" cy="${py(y+postH).toFixed(1)}" r="${k===0||k===spans?5:3.5}" fill="${k===0||k===spans?'#dfe6e7':'#e0a23a'}"/>`;
  }
  if(g.flat>0){
    const flatSpans=Math.max(1,Math.ceil(g.flat/levelSpan()));
    for(let k=1;k<=flatSpans;k++){
      const x=topX+(g.flat/flatSpans)*k;
      postAt(x,topY);
      posts+=`<circle cx="${px(x).toFixed(1)}" cy="${py(topY+postH).toFixed(1)}" r="${k===flatSpans?5:3.5}" fill="${k===flatSpans?'#dfe6e7':'#e0a23a'}"/>`;
    }
  }
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  svg.innerHTML=steps+line+posts;
  cap.textContent=`${g.steps} steps · ${Math.round(g.going)}mm going · ${Math.round(g.rise)}mm rise · ${Math.round(g.rake)}mm rake${g.flat>0?' + '+g.flat+'mm flat':''} · ${spans-1} stair intermediate post${spans-1===1?'':'s'}`;
}

const money=n=>'$'+n.toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2});
function renderLiveParts(){
  const panel=$('#live-parts-panel');
  if(!panel)return;
  if(!hasAnyLen()){panel.innerHTML=`<div class="live-parts-panel__head">Your parts list</div><div class="live-parts-empty">Add a section length and we'll start building your parts list here, live, as you go.</div>`;return;}
  const p=computeParts();
  const rows=buildKitRows(p);
  const extraRows=Object.entries(addedExtras).filter(([,r])=>r&&r.qty>0).map(([,r])=>r);
  const total=rows.reduce((a,r)=>a+r.qty*r.unit,0)+extraRows.reduce((a,r)=>a+(r.tbc?0:r.qty*r.unit),0);
  const anyTbc=extraRows.some(r=>r.tbc);
  panel.innerHTML=`<div class="live-parts-panel__head"><span>Your parts list</span><span>${(p.totalLenMM/1000).toFixed(2)}m run</span></div>
  ${rows.map(r=>`<div class="live-parts-row"><div class="live-parts-row__top"><span class="live-parts-row__name">${r.thumb?`<img class="live-parts-thumb" src="${r.thumb}" alt=""/>`:''}${r.name}</span><span>${money(r.qty*r.unit)}</span></div><div class="live-parts-row__bottom">${r.adjustable?`<div class="live-parts-stepper"><button data-plateadj="-1">–</button><b>×${r.qty}</b><button data-plateadj="1">+</button></div>`:`<span class="live-parts-fixed">×${r.qty}</span>`}<span class="live-parts-row__unit">${money(r.unit)} each</span></div>${r.note?`<div class="live-parts-note">${r.note}</div>`:''}</div>`).join('')}
  ${extraRows.map(r=>`<div class="live-parts-row"><div class="live-parts-row__top"><span>${r.name}</span><span>${r.tbc?'Price TBC':money(r.qty*r.unit)}</span></div><div class="live-parts-row__bottom"><span class="live-parts-fixed">×${r.qty}</span><span class="live-parts-row__unit">${r.tbc?'we\u2019ll confirm the price when we call':money(r.unit)+' each'}</span></div></div>`).join('')}
  <div class="live-parts-total"><span>Running total (ex-GST)</span><span>${money(total)} + GST</span></div>
  ${anyTbc?'<div class="live-parts-note">Items marked Price TBC aren\u2019t in this total \u2014 we\u2019ll price them when we call you.</div>':''}`;
  panel.querySelectorAll('[data-plateadj]').forEach(el=>el.onclick=()=>{
    const cur=ws.plateQty==null?p.basePlates:ws.plateQty;
    ws.plateQty=Math.max(0,cur+Number(el.dataset.plateadj));
    render();
  });
}
function shapeCards(){
  return Object.entries(SHAPES).map(([key,s])=>`<div class="wiz-card" data-shape="${key}"><svg viewBox="0 0 100 70" fill="none" stroke-width="4" stroke-linecap="round">${s.icon}</svg><b>${s.label}</b><span>${s.desc}</span></div>`).join('');
}

const GUIDE_PDF=window.__GUIDE_PDF||'guides/how-to-measure.pdf';
function openGuide(){
  if(document.getElementById('guide-modal'))return;
  const w=document.createElement('div');
  w.id='guide-modal';w.className='guide-modal';
  w.innerHTML=`<div class="guide-modal__panel" role="dialog" aria-label="How to Measure guide">
    <div class="guide-modal__bar">
      <div class="guide-modal__ttl"><b>How to Measure guide</b><span>13 pages · scroll to read, or download a copy for the job site</span></div>
      <div class="guide-modal__acts">
        <a class="btn btn--teal" href="${GUIDE_PDF}" download="DIY-Wire-Balustrade-Measurement-Guide.pdf">Download PDF</a>
        <button type="button" class="guide-modal__x" data-guide-close aria-label="Close">&times;</button>
      </div>
    </div>
    <div class="guide-modal__doc"><object type="application/pdf" data="${GUIDE_PDF}#view=FitH" class="guide-modal__obj"><div class="guide-modal__fallback"><b>Your browser won’t display PDFs inline.</b><p>Download the guide instead — it’s handy to have saved on your phone for the job site.</p><div class="guide-modal__fbtns"><a class="btn btn--teal" href="${GUIDE_PDF}" download="DIY-Wire-Balustrade-Measurement-Guide.pdf">Download PDF</a></div></div></object></div>
  </div>`;
  document.body.appendChild(w);
  document.body.style.overflow='hidden';
  const close=()=>{w.remove();document.body.style.overflow='';document.removeEventListener('keydown',esc);};
  const esc=e=>{if(e.key==='Escape')close();};
  w.addEventListener('click',e=>{if(e.target===w||e.target.closest('[data-guide-close]'))close();});
  document.addEventListener('keydown',esc);
}
function stageIntro(){
  $('#wiz-progress').textContent='Step 1 · What we\'ll build together';
  $('#wiz-main').innerHTML=`<div class="wiz-q"><img src="images/wire-hero-complete-w.jpg" alt="Completed wire balustrade installation" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:var(--r-md);margin-bottom:16px"/><h3>Let's build your wire balustrade</h3><p class="wiz-q__sub">Every kit is made of the same handful of parts. Here's what connects where:</p>
  <div class="anatomy-grid">
    <div class="anatomy-item"><div class="ic ic--photo"><img src="images/part-endpost.jpg" alt="End post"/></div><b>End post</b></div>
    <div class="anatomy-item"><div class="ic ic--photo"><img src="images/part-cornerpost.jpg" alt="Corner post"/></div><b>Corner post</b></div>
    <div class="anatomy-item"><div class="ic ic--photo"><img src="images/part-intermediate-w.jpg" alt="Intermediate post"/></div><b>Intermediate post</b></div>
    <div class="anatomy-item"><div class="ic ic--photo"><img src="images/part-wire.png" alt="316 wire"/></div><b>Wire runs</b></div>
    <div class="anatomy-item"><div class="ic ic--photo"><img src="images/part-turnbuckle-w.jpg" alt="Turnbuckle and fork terminal"/></div><b>Turnbuckle</b></div>
    <div class="anatomy-item"><div class="ic ic--photo"><img src="images/part-baseplate-square-w.jpg" alt="Base plate and cover"/></div><b>Base plate & cover</b></div>
  </div></div>`;
  setNav({back:false,next:'Start',onNext:()=>{pushHistory();ws.stage='shape';render();}});
}
function newRun(key){
  if(key==='stair')return{shape:'stair',steps:null,perStep:330,angle:34,hasFlat:false,flatLen:null,sections:[],endTreatment:{start:null,end:null}};
  const run={shape:key,sections:new Array(SHAPES[key].count).fill(null),endTreatment:{start:null,end:null}};
  if(key==='z')run.cornerDir=['L','R','L'];
  return run;
}
function stageShape(){
  $('#wiz-progress').textContent='Step 2 · Your first section\'s shape';
  $('#wiz-main').innerHTML=`<div class="wiz-q"><h3>What shape is your first section?</h3><p class="wiz-q__sub">Pick the closest match — a straight length, or a run with corners. You'll be able to add more sections of any shape afterwards, all on one page.</p><div class="wiz-cards">${shapeCards()}</div></div>`;
  document.querySelectorAll('[data-shape]').forEach(el=>el.onclick=()=>{
    pushHistory();
    const key=el.dataset.shape;
    ws.runs=[newRun(key)];
    ws.stage='finish';render();
  });
  setNav({back:true,hideNext:true});
}
function runComplete(r){
  const et=r.endTreatment||{};
  if(ws.handrail&&!(et.start&&et.end))return false;
  if(r.shape==='stair')return Number(r.steps)>0&&(!r.hasFlat||Number(r.flatLen)>0);
  return r.sections.length>0&&r.sections.every(s=>Number(s)>0);
}
function allFilled(){return ws.runs.length>0&&ws.runs.every(runComplete);}
function stairGroupHtml(r,ri,activeIdx){
  const g=stairGeom(r);
  const spans=g.steps?Math.max(1,Math.ceil(g.going/stairSpan())):0;
  const et=r.endTreatment||{start:null,end:null};
  const endPicker=ws.handrail?`<div class="end-treatment">
    <div class="end-treatment__item"><span>Rail end 1 (bottom)<em class="req">required</em></span><div class="wiz-cards wiz-cards--sm">
      <div class="wiz-card${et.start==='cap'?' is-sel':''}" data-endtreat="${ri}:start:cap"><b>End cap</b></div>
      <div class="wiz-card${et.start==='flange'?' is-sel':''}" data-endtreat="${ri}:start:flange"><b>Wall flange</b></div>
    </div></div>
    <div class="end-treatment__item"><span>Rail end 2 (top)<em class="req">required</em></span><div class="wiz-cards wiz-cards--sm">
      <div class="wiz-card${et.end==='cap'?' is-sel':''}" data-endtreat="${ri}:end:cap"><b>End cap</b></div>
      <div class="wiz-card${et.end==='flange'?' is-sel':''}" data-endtreat="${ri}:end:flange"><b>Wall flange</b></div>
    </div></div>
  </div>`:'';
  return `<div class="run-group${ri===activeIdx?' is-viewing':''}" data-run-group="${ri}">
    <div class="run-group__head"><b>${ri+1}. Stair flight</b>${ws.runs.length>1?`<button type="button" class="run-group__remove" data-remove-run="${ri}">Remove</button>`:''}</div>
    <div class="sec-row"><label>Number of steps</label><div class="num-input"><input type="number" min="1" data-stair="${ri}:steps" class="sec-input" placeholder="e.g. 13" value="${r.steps||''}"/><span class="dim-unit">steps</span></div><span class="sec-row__hint">Count the steps, not the risers — we work the rest out from there.</span></div>
    <div class="corner-angle"><label>Going per step</label><div class="num-input num-input--sm"><input type="number" min="200" max="500" data-stair="${ri}:perStep" value="${g.perStep}"/><span class="dim-unit">mm</span></div><span class="corner-angle__hint">Nosing to nosing. Default 330mm.</span></div>
    ${g.steps?`<div class="live-parts-note">${Math.round(g.going)}mm going · ${Math.round(g.rise)}mm rise · ${Math.round(g.rake)}mm rake · posts spaced on the ${stairSpan()}mm ${(JOB_LABEL[ws.jobType]||'Residential').toLowerCase()} stair maximum — ${spans-1} intermediate post${spans-1===1?'':'s'}</div>`:''}
    <label class="own-toggle"><input type="checkbox" data-stairflat="${ri}" ${r.hasFlat?'checked':''}/>This flight continues into a flat landing run</label>
    ${r.hasFlat?`<div class="sec-row"><label>Flat continuation length</label><div class="num-input"><input type="number" data-stair="${ri}:flatLen" class="sec-input" placeholder="e.g. 2000" value="${r.flatLen||''}"/><span class="dim-unit">mm</span></div><span class="sec-row__hint">Wires and handrail run unbroken from the rake into the flat — the transition is a single shared post.</span></div>`:''}
    ${endPicker}
  </div>`;
}
function runGroupHtml(r,ri,activeIdx){
  if(r.shape==='stair')return stairGroupHtml(r,ri,activeIdx);
  const rows=r.sections.map((val,si)=>{
    const row=`<div class="sec-row"><label>${r.shape==='straight'?'Length':'Section '+(si+1)+(si>0?' — corner from previous':'')}</label><div class="num-input"><input type="number" data-run="${ri}" data-sec="${si}" class="sec-input" placeholder="e.g. 3000" value="${val||''}"/><span class="dim-unit">mm</span></div>${Number(val)>WIRE_MAX_RUN?'<span class="sec-row__hint">Over 10m — we\'ll add an extra post partway to break the wire run</span>':''}</div>`;
    if(si===0)return row;
    const ci=si-1,cang=(r.cornerAngle&&r.cornerAngle[ci])||90,offSquare=Number(cang)!==90;
    const angleRow=`<div class="corner-angle"><label>Corner ${ci+1} angle</label><div class="num-input num-input--sm"><input type="number" min="1" max="179" data-cornerangle="${ri}:${ci}" value="${cang}"/><span class="dim-unit">°</span></div><span class="corner-angle__hint">Default 90°. Change it if this corner isn't square.</span></div>`;
    const cd=(r.cornerDir&&r.cornerDir[ci])||'L';
    const dirRow=`<div class="corner-elbow"><span>Corner ${ci+1} direction</span><div class="wiz-cards wiz-cards--sm">
      <div class="wiz-card${cd==='L'?' is-sel':''}" data-cornerdir="${ri}:${ci}:L"><b>Turn left</b></div>
      <div class="wiz-card${cd==='R'?' is-sel':''}" data-cornerdir="${ri}:${ci}:R"><b>Turn right</b></div>
    </div></div>`;
    const cpt=(r.cornerPostType&&r.cornerPostType[ci])||'corner';
    const postTypeRow=offSquare?`<div class="corner-elbow"><span>Corner ${ci+1} post</span><div class="wiz-cards wiz-cards--sm">
      <div class="wiz-card${cpt==='corner'?' is-sel':''}" data-cornerpost="${ri}:${ci}:corner"><b>Corner post</b><span>One angled post at the vertex</span></div>
      <div class="wiz-card${cpt==='twoend'?' is-sel':''}" data-cornerpost="${ri}:${ci}:twoend"><b>Two end posts</b><span>Two straight posts butted at the vertex</span></div>
    </div></div>`:'';
    if(!ws.handrail)return row+angleRow+dirRow+postTypeRow;
    const cet=(r.cornerElbow&&r.cornerElbow[ci])||(offSquare?'adjustable':'90');
    return row+angleRow+dirRow+postTypeRow+`<div class="corner-elbow"><span>Corner ${ci+1} elbow hardware</span><div class="wiz-cards wiz-cards--sm">
      <div class="wiz-card${cet==='90'&&!offSquare?' is-sel':''}${offSquare?' is-disabled':''}" data-elbowtype="${ri}:${ci}:90"><b>90° elbow</b><span>${offSquare?'Needs an exact right angle':'Exact right angle'}</span></div>
      <div class="wiz-card${cet==='adjustable'||offSquare?' is-sel':''}" data-elbowtype="${ri}:${ci}:adjustable"><b>Adjustable elbow</b><span>${offSquare?'Set to '+cang+'° on site':'Off-90°, fine-tune on site'}</span></div>
    </div></div>`;
  }).join('');
  const canExtend=r.shape!=='straight'&&r.sections.length<8;
  const et=r.endTreatment||{start:null,end:null};
  const endPicker=ws.handrail?`<div class="end-treatment">
    <div class="end-treatment__item"><span>Rail end 1 (start)<em class="req">required</em></span><div class="wiz-cards wiz-cards--sm">
      <div class="wiz-card${et.start==='cap'?' is-sel':''}" data-endtreat="${ri}:start:cap"><b>End cap</b></div>
      <div class="wiz-card${et.start==='flange'?' is-sel':''}" data-endtreat="${ri}:start:flange"><b>Wall flange</b></div>
    </div></div>
    <div class="end-treatment__item"><span>Rail end 2 (finish)<em class="req">required</em></span><div class="wiz-cards wiz-cards--sm">
      <div class="wiz-card${et.end==='cap'?' is-sel':''}" data-endtreat="${ri}:end:cap"><b>End cap</b></div>
      <div class="wiz-card${et.end==='flange'?' is-sel':''}" data-endtreat="${ri}:end:flange"><b>Wall flange</b></div>
    </div></div>
  </div>`:'';
  return `<div class="run-group${ri===activeIdx?' is-viewing':''}" data-run-group="${ri}">
    <div class="run-group__head"><b>${ri+1}. ${SHAPES[r.shape].label}</b>${ws.runs.length>1?`<button type="button" class="run-group__remove" data-remove-run="${ri}">Remove</button>`:''}</div>
    ${rows}
    ${canExtend?`<button type="button" class="add-section-btn" data-extend-run="${ri}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Add another corner to this section</button>`:(r.shape!=='straight'?`<div class="live-parts-note">Maximum 8 sections in one run — add a separate run below if you need more.</div>`:'')}
    ${endPicker}
  </div>`;
}
function stageBuilder(){
  $('#wiz-progress').textContent='Step 4 · Your sections';
  const activeIdx=resolveViewIdx();
  const groups=ws.runs.map((r,ri)=>runGroupHtml(r,ri,activeIdx)).join('');
  $('#wiz-main').innerHTML=`<div class="wiz-q"><h3>Enter your section lengths</h3><p class="wiz-q__sub">Every section stays visible here so you can check or change any measurement at any time. Mix straight lengths with L or U-shaped corners freely — each is its own separate piece.</p>
  <button type="button" class="guide-card" data-guide-open="1">
    <span class="guide-card__sheet">
      <svg viewBox="0 0 200 260" fill="none">
        <rect x="0" y="0" width="200" height="260" fill="#fff"/>
        <rect x="16" y="16" width="70" height="7" rx="3" fill="#0f766e"/>
        <rect x="16" y="30" width="42" height="5" rx="2.5" fill="#cbd5d3"/>
        <g stroke="#1f2937" stroke-width="2.4" stroke-linecap="round">
          <path d="M28 150v-64M84 150v-64M140 150v-64"/>
          <path d="M20 150h150"/>
        </g>
        <g stroke="#0f766e" stroke-width="1.4" opacity=".8"><path d="M28 100h112M28 116h112M28 132h112"/></g>
        <g stroke="#b45309" stroke-width="1.6"><path d="M28 172h56M84 172h56"/><path d="M28 168v8M84 168v8M140 168v8"/></g>
        <rect x="40" y="180" width="32" height="8" rx="4" fill="#fde68a"/>
        <rect x="96" y="180" width="32" height="8" rx="4" fill="#fde68a"/>
        <g stroke="#1f2937" stroke-width="1.6"><path d="M176 86v64M172 86h8M172 150h8"/></g>
        <rect x="16" y="204" width="168" height="5" rx="2.5" fill="#e5e7eb"/>
        <rect x="16" y="216" width="140" height="5" rx="2.5" fill="#e5e7eb"/>
        <rect x="16" y="228" width="156" height="5" rx="2.5" fill="#e5e7eb"/>
        <rect x="16" y="240" width="96" height="5" rx="2.5" fill="#e5e7eb"/>
      </svg>
    </span>
    <span class="guide-card__body">
      <span class="guide-card__tag">Free PDF · 13 pages</span>
      <b>How to Measure guide</b>
      <span class="guide-card__sub">Exactly what to measure and where posts land — flat runs, corners and stairs. You need a tape, a level and about ten measurements.</span>
      <span class="guide-card__btn">View the guide<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 12s3.5-6 8-6 8 6 8 6-3.5 6-8 6-8-6-8-6z"/><circle cx="12" cy="12" r="2.4"/></svg></span>
    </span>
  </button>
  ${groups}
  <div class="add-run-row">
    <span>Need another separate piece too?</span>
    <div class="add-run-row__btns">
      <button type="button" data-add-run="straight">+ Straight section</button>
      <button type="button" data-add-run="l">+ L-shape section</button>
      <button type="button" data-add-run="u">+ U-shape section</button>
      <button type="button" data-add-run="z">+ Zigzag section</button>
      <button type="button" data-add-run="stair">+ Stair flight</button>
    </div>
  </div>
  </div>`;
  const gBtn=document.querySelector('[data-guide-open]');
  if(gBtn)gBtn.onclick=openGuide;
  document.querySelectorAll('[data-run-group]').forEach(el=>el.addEventListener('click',e=>{
    if(e.target.closest('input,button'))return;
    ws.viewRunIdx=Number(el.dataset.runGroup);
    renderPlan();
    document.querySelectorAll('[data-run-group]').forEach(g=>g.classList.remove('is-viewing'));
    el.classList.add('is-viewing');
  }));
  document.querySelectorAll('.sec-input').forEach(inp=>{
    inp.onfocus=()=>{
      const ri=Number(inp.dataset.run);
      if(ws.viewRunIdx!==ri){
        ws.viewRunIdx=ri;
        renderPlan();
        document.querySelectorAll('[data-run-group]').forEach(g=>g.classList.toggle('is-viewing',Number(g.dataset.runGroup)===ri));
      }
    };
    inp.oninput=()=>{
      const ri=Number(inp.dataset.run),si=Number(inp.dataset.sec);
      ws.runs[ri].sections[si]=Number(inp.value)||null;
      if(ws.viewRunIdx!==ri){ws.viewRunIdx=ri;document.querySelectorAll('[data-run-group]').forEach(g=>g.classList.toggle('is-viewing',Number(g.dataset.runGroup)===ri));}
      renderPlan();renderLiveParts();updateContinueState();
    };
  });
  document.querySelectorAll('[data-extend-run]').forEach(btn=>btn.onclick=()=>{
    pushHistory();
    ws.runs[Number(btn.dataset.extendRun)].sections.push(null);
    render();
  });
  document.querySelectorAll('[data-cornerangle]').forEach(inp=>{
    inp.onchange=()=>{
      const[ri,ci]=inp.dataset.cornerangle.split(':');
      const run=ws.runs[Number(ri)];
      run.cornerAngle=run.cornerAngle||[];
      let v=Math.round(Number(inp.value))||90;
      v=Math.max(1,Math.min(179,v));
      run.cornerAngle[Number(ci)]=v;
      render();
    };
  });
  document.querySelectorAll('[data-cornerpost]').forEach(el=>el.onclick=()=>{
    pushHistory();
    const[ri,ci,val]=el.dataset.cornerpost.split(':');
    const run=ws.runs[Number(ri)];
    run.cornerPostType=run.cornerPostType||[];
    run.cornerPostType[Number(ci)]=val;
    render();
  });
  document.querySelectorAll('[data-cornerdir]').forEach(el=>el.onclick=()=>{
    pushHistory();
    const[ri,ci,val]=el.dataset.cornerdir.split(':');
    const run=ws.runs[Number(ri)];
    run.cornerDir=run.cornerDir||[];
    run.cornerDir[Number(ci)]=val;
    render();
  });
  document.querySelectorAll('[data-stair]').forEach(inp=>{
    const[ri,field]=inp.dataset.stair.split(':');
    const run=ws.runs[Number(ri)];
    inp.onfocus=()=>{if(ws.viewRunIdx!==Number(ri)){ws.viewRunIdx=Number(ri);renderPlan();document.querySelectorAll('[data-run-group]').forEach(g=>g.classList.toggle('is-viewing',Number(g.dataset.runGroup)===Number(ri)));}};
    inp.oninput=()=>{
      run[field]=Number(inp.value)||null;
      if(field==='steps'||field==='flatLen'){renderPlan();renderLiveParts();updateContinueState();}
    };
    inp.onchange=()=>{
      if(field==='perStep')run.perStep=Math.max(200,Math.min(500,Number(inp.value)||330));
      if(field==='angle')run.angle=Math.max(10,Math.min(55,Number(inp.value)||34));
      render();
    };
  });
  document.querySelectorAll('[data-stairflat]').forEach(cb=>cb.onchange=()=>{
    pushHistory();
    const run=ws.runs[Number(cb.dataset.stairflat)];
    run.hasFlat=cb.checked;
    if(!cb.checked)run.flatLen=null;
    render();
  });
  document.querySelectorAll('[data-remove-run]').forEach(btn=>btn.onclick=()=>{
    pushHistory();
    ws.runs.splice(Number(btn.dataset.removeRun),1);
    render();
  });
  document.querySelectorAll('[data-add-run]').forEach(btn=>btn.onclick=()=>{
    pushHistory();
    const key=btn.dataset.addRun;
    ws.runs.push(newRun(key));
    render();
  });
  document.querySelectorAll('[data-endtreat]').forEach(el=>el.onclick=()=>{
    pushHistory();
    const[ri,end,val]=el.dataset.endtreat.split(':');
    const run=ws.runs[Number(ri)];
    run.endTreatment=run.endTreatment||{start:null,end:null};
    run.endTreatment[end]=val;
    render();
  });
  document.querySelectorAll('[data-elbowtype]').forEach(el=>el.onclick=()=>{
    if(el.classList.contains('is-disabled'))return;
    pushHistory();
    const[ri,ci,val]=el.dataset.elbowtype.split(':');
    const run=ws.runs[Number(ri)];
    run.cornerElbow=run.cornerElbow||[];
    run.cornerElbow[Number(ci)]=val;
    render();
  });
  setNav({back:true,next:'Continue',onNext:()=>{if(!allFilled())return;pushHistory();ws.stage='summary';render();}});
  updateContinueState();
  function updateContinueState(){$('#wiz-next').disabled=!allFilled();}
}
function finishReady(){return !!ws.jobType&&!!ws.postSize&&!!ws.finish&&(ws.finish!=='custom'||!!(ws.pcColour||'').trim())&&(!ws.handrail||!!ws.railSize);}
function finishMissing(){
  const missing=[];
  if(!ws.jobType)missing.push('where it\'s going');
  if(!ws.postSize)missing.push('post size');
  if(!ws.finish)missing.push('finish');
  if(ws.finish==='custom'&&!(ws.pcColour||'').trim())missing.push('powder-coat colour');
  if(ws.handrail&&!ws.railSize)missing.push('handrail size');
  return missing;
}
function updateFinishGate(){
  const ready=finishReady(),gate=$('#wiz-gate'),next=$('#wiz-next');
  if(gate)gate.textContent=ready?'':'Still to choose: '+finishMissing().join(', ');
  if(next)next.disabled=!ready;
}
function stageFinish(){
  $('#wiz-progress').textContent='Step 3 · Posts, handrail & finish';
  $('#wiz-main').innerHTML=`<div class="wiz-q"><h3>Posts, handrail &amp; finish</h3><p class="wiz-q__sub">Applies to all posts, base plates and fittings in your kit.</p>
  <h4>Where's this going?<span class="req">required</span></h4>
  <p class="wiz-q__sub">Sets the maximum post spacing we design to.</p>
  <div class="wiz-cards">
    <div class="wiz-card${ws.jobType==='residential'?' is-sel':''}" data-jobtype="residential"><b>Residential</b><span>1480mm max span on the flat, 1500mm on stairs</span></div>
    <div class="wiz-card${ws.jobType==='commercial'?' is-sel':''}" data-jobtype="commercial"><b>Commercial</b><span>1300mm max span throughout</span></div>
  </div>
  <h4 style="margin-top:20px">Post size<span class="req">required</span></h4>
  <div class="wiz-cards">
    <div class="wiz-card${ws.postSize==='round50'?' is-sel':''}" data-postsize="round50"><b>50mm round</b><span>Round posts</span></div>
    <div class="wiz-card${ws.postSize==='square38'?' is-sel':''}" data-postsize="square38"><b>38×38mm square</b><span>Square posts</span></div>
  </div>
  <div class="paint-preview" id="post-preview-wrap" style="display:none;margin-top:16px">
    <image-slot id="post-preview-brushed" shape="rounded" radius="10" placeholder="Brushed finish example" src="images/post-square38-brushed.jpg" fit="cover" style="display:none"></image-slot>
    <image-slot id="post-preview-mirror" shape="rounded" radius="10" placeholder="Mirror finish example" src="images/post-square38-mirror.jpg" fit="cover" style="display:none"></image-slot>
    <image-slot id="post-preview-brushed-round" shape="rounded" radius="10" placeholder="Brushed finish example" src="images/post-round50-brushed.jpg" fit="cover" style="display:none"></image-slot>
    <image-slot id="post-preview-mirror-round" shape="rounded" radius="10" placeholder="Mirror finish example" src="images/post-round50-mirror.jpg" fit="cover" style="display:none"></image-slot>
  </div>
  <p class="paint-preview__cap" id="post-preview-cap" style="display:none"></p>
  <h4 style="margin-top:20px">Finish<span class="req">required</span></h4>
  <div class="wiz-cards">
    <div class="wiz-card${ws.finish==='brushed'?' is-sel':''}" data-finish="brushed"><b>Brushed finish</b><span>316 stainless, brushed satin</span></div>
    <div class="wiz-card${ws.finish==='mirror'?' is-sel':''}" data-finish="mirror"><b>Mirror finish</b><span>316 stainless, polished mirror</span></div>
    <div class="wiz-card${ws.finish==='black'?' is-sel':''}" data-finish="black"><b>Matt black</b><span>316 stainless, black powder-coat</span></div>
    <div class="wiz-card${ws.finish==='custom'?' is-sel':''}" data-finish="custom"><b>Custom colour</b><span>Powder-coat to any Dulux or RAL colour</span></div>
  </div>
  <div id="pc-colour-wrap" style="display:${ws.finish==='custom'?'':'none'};margin-top:12px">
    <div class="sec-row"><label>Colour</label><div class="num-input"><input type="text" id="pc-colour" placeholder="e.g. Dulux Monument" value="${ws.pcColour||''}"/></div><span class="sec-row__hint">Custom colours carry a ${money(PRICE.pcCustomMin)} minimum powder-coat charge.</span></div>
  </div>
  <h4 style="margin-top:20px">Top handrail</h4>
  <p class="wiz-q__sub">Optional — a graspable rail along the top of your posts.</p>
  <label class="own-toggle"><input type="checkbox" id="add-handrail" ${ws.handrail?'checked':''}/>Add a top handrail to this kit</label>
  <div id="rail-size-wrap" style="display:${ws.handrail?'':'none'};margin-top:12px">
    <h4 style="margin-top:0">Handrail size<span class="req">required</span></h4>
    <div class="wiz-cards">
      <div class="wiz-card${ws.railSize==='round38'?' is-sel':''}" data-railsize="round38"><b>38mm round</b><span>Round handrail, slimmer profile</span></div>
      <div class="wiz-card${ws.railSize==='round50'?' is-sel':''}" data-railsize="round50"><b>50mm round</b><span>Round handrail</span></div>
      <div class="wiz-card${ws.railSize==='rect5025'?' is-sel':''}" data-railsize="rect5025"><b>50×25mm rectangular</b><span>Rectangular handrail</span></div>
    </div>
    <div class="paint-preview" id="rail-preview-wrap" style="display:none;margin-top:16px">
      <img id="rail-preview-img" src="" alt="Handrail finish example" style="width:100%;border-radius:10px;display:block;background:var(--white)"/>
    </div>
    <p class="paint-preview__cap" id="rail-preview-cap" style="display:none"></p>
  </div>
  <p class="wiz-gate" id="wiz-gate"></p>
  </div>`;
  document.querySelectorAll('[data-jobtype]').forEach(el=>el.onclick=()=>{pushHistory();ws.jobType=el.dataset.jobtype;render();});
  document.querySelectorAll('[data-postsize]').forEach(el=>el.onclick=()=>{pushHistory();ws.postSize=el.dataset.postsize;render();});
  document.querySelectorAll('[data-finish]').forEach(el=>el.onclick=()=>{pushHistory();ws.finish=el.dataset.finish;if(el.dataset.finish!=='custom')ws.pcColour='';render();});
  document.querySelectorAll('[data-railsize]').forEach(el=>el.onclick=()=>{pushHistory();ws.railSize=el.dataset.railsize;render();});
  const pcInput=$('#pc-colour');
  if(pcInput)pcInput.oninput=()=>{ws.pcColour=pcInput.value;renderLiveParts();updateFinishGate();};
  $('#add-handrail').onchange=e=>{ws.handrail=e.target.checked;render();};
  updateRailPreview();
  updatePostPreview();
  updateFinishGate();
  setNav({back:true,next:'Continue',disabled:!finishReady(),onNext:()=>{if(!finishReady())return;pushHistory();ws.stage='builder';render();}});
}
function updatePostPreview(){
  const wrap=$('#post-preview-wrap'),cap=$('#post-preview-cap');
  if(!wrap)return;
  const show=ws.postSize&&(ws.finish==='mirror'||ws.finish==='brushed');
  wrap.style.display=show?'':'none';
  cap.style.display=show?'':'none';
  const isSquare=ws.postSize==='square38';
  $('#post-preview-brushed').style.display=show&&isSquare&&ws.finish==='brushed'?'':'none';
  $('#post-preview-mirror').style.display=show&&isSquare&&ws.finish==='mirror'?'':'none';
  $('#post-preview-brushed-round').style.display=show&&!isSquare&&ws.finish==='brushed'?'':'none';
  $('#post-preview-mirror-round').style.display=show&&!isSquare&&ws.finish==='mirror'?'':'none';
  if(show)cap.textContent='Example: '+ws.finish+' finish, '+(isSquare?'38×38mm square':'50mm round')+' post (intermediate post shown)';
}
function updateRailPreview(){
  const wrap=$('#rail-preview-wrap'),cap=$('#rail-preview-cap'),pic=$('#rail-preview-img');
  if(!wrap||!pic)return;
  const src=RAIL_IMG[ws.railSize+'|'+ws.finish];
  const show=ws.handrail&&!!ws.railSize&&!!src;
  wrap.style.display=show?'':'none';
  cap.style.display=show?'':'none';
  if(show){
    pic.src=src;
    cap.textContent='Example: '+(FINISH_LABEL[ws.finish]||ws.finish)+', '+RAIL_SIZE_LABEL[ws.railSize]+' handrail';
  }
}
const EXTRA_IMG={screw:'images/part-fixing-screw.jpg',plug:'images/part-wallplug-w.jpg'};
function extraCard(key,label,sub,unit,recommended){
  const qty=extrasQty[key]==null?recommended:extrasQty[key];
  const img=EXTRA_IMG[key];
  return `<div class="extra-card">
    <div class="ph-box extra-card__img">${img?`<img src="${img}" alt="${label}" style="width:100%;height:100%;object-fit:contain"/>`:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 16l4-4 4 4 4-6 4 5"/></svg><span class="ph__label">product image</span>`}</div>
    <div class="extra-card__body">
      <b>${label}</b><span class="extra-card__sub">${sub}</span>
      <span class="extra-card__price">${money(unit)} each</span>
      <div class="extra-card__row">
        <div class="live-parts-stepper"><button data-extra-adj="${key}" data-dir="-1">–</button><b id="extra-qty-${key}">${qty}</b><button data-extra-adj="${key}" data-dir="1">+</button></div>
        <button class="btn btn--ink extra-card__add" data-extra-add="${key}" data-label="${label}" data-unit="${unit}">Add to cart</button>
      </div>
    </div>
  </div>`;
}
const TOOLS=[
  {key:'toolhire',label:'Crimping tool hire — wire cutter included',sub:'Hire both tools for your install and send them back when you’re done. Cheapest way to do a one-off job.',unit:PRICE.toolHire,img:'images/tool-crimping-tool.jpg',tag:'Most DIY customers pick this'},
  {key:'cutter',label:'Stainless wire cutter',sub:'Clean, square cuts on 3.2mm and 4mm stainless wire. Yours to keep.',unit:PRICE.wireCutter,img:'images/tool-wire-cutter.jpg'},
  {key:'crimper',label:'Crimping tool',sub:'Hydraulic crimper for swaging the fittings onto your wire. Yours to keep.',unit:PRICE.crimper,img:'images/tool-crimping-tool.jpg'}
];
function toolCard(t){
  const added=!!addedExtras[t.key];
  return `<div class="extra-card extra-card--tool ${t.key==='toolhire'?'extra-card--hire':''}">
    <div class="ph-box extra-card__img"><img src="${t.img}" alt="${t.label}" style="width:100%;height:100%;object-fit:contain"/></div>
    <div class="extra-card__body">
      ${t.tag?`<span class="tool-tag">${t.tag}</span>`:''}
      <b>${t.label}</b><span class="extra-card__sub">${t.sub}</span>
      <span class="extra-card__price"><span class="tool-mode ${t.key==='toolhire'?'tool-mode--hire':'tool-mode--buy'}">${t.key==='toolhire'?'HIRE':'BUY'}</span>${money(t.unit)}${t.key==='toolhire'?' <em>for the job</em>':' <em>yours to keep</em>'}</span>
      <div class="extra-card__row">
        <button class="btn ${added?'btn--ghost':'btn--ink'} extra-card__add" data-tool-add="${t.key}">${added?'Added ✓ — remove':'Add to cart'}</button>
      </div>
    </div>
  </div>`;
}
function stageSummary(){
  $('#wiz-progress').textContent='Step 5 · Your parts list';
  const p=computeParts();
  const runList=p.runSummaries.map((r,i)=>`<div class="run-summary-row"><span>${i+1}. ${SHAPES[r.shape].label}</span><span>${(r.lenMM/1000).toFixed(2)}m${r.corners>0?' · '+r.corners+' corner'+(r.corners>1?'s':''):''}</span></div>`).join('');
  $('#wiz-main').innerHTML=`<div class="wiz-q"><h3>${p.numRuns>1?p.numRuns+' sections · ':''}${(p.totalLenMM/1000).toFixed(2)}m total${p.numRuns>1?'':' · '+p.numSections+' section'+(p.numSections>1?'s':'')}</h3><p class="wiz-q__sub">Your full kit is calculated on the right, updating live — tick a box there if you already have posts or wire. Nothing is added to cart until you confirm below.</p>
  ${p.numRuns>1?`<div class="run-summary-list">${runList}</div>`:''}
  <div class="fix-section">
    <h4>Other parts people buy with this kit</h4>
    <p>Fixing base plates to your floor. We recommend ${FIXINGS_PER_POST} fixings per post (${p.totalPosts} posts) — add what you need, separately from the kit above.</p>
    <div class="fix-surface">
      <div class="wiz-card${ws.fixingSurface==='masonry'?' is-sel':''}" data-surface="masonry"><b>Concrete / brick / limestone</b><span>Masonry screws + wall plugs</span></div>
      <div class="wiz-card${ws.fixingSurface==='timber'?' is-sel':''}" data-surface="timber"><b>Timber deck/frame</b><span>Timber screws only, no plugs</span></div>
    </div>
    <div class="extra-grid">
      ${!ws.fixingSurface?'':extraCard('screw',ws.fixingSurface==='timber'?'Timber fixing screws':'Masonry fixing screws','14G bugle batten screw, base plate fixing',PRICE.screw,p.recommendedScrews)}
      ${!ws.fixingSurface||ws.fixingSurface==='timber'?'':extraCard('plug','Wall plugs','For concrete, brick or limestone',PRICE.plug,p.recommendedPlugs)}
    </div>
  </div>
  <div class="fix-section">
    <h4>Tools for the job</h4>
    <p>You need a wire cutter and a crimping tool to make the wire off. Hire both from us for $50, or buy them outright if you’ll use them again.</p>
    <div class="extra-grid">${TOOLS.map(toolCard).join('')}</div>
  </div>
  </div>`;
  document.querySelectorAll('[data-tool-add]').forEach(el=>el.onclick=()=>{
    const t=TOOLS.find(x=>x.key===el.dataset.toolAdd);
    if(!t)return;
    if(addedExtras[t.key]){delete addedExtras[t.key];window.__cart=(window.__cart||[]).filter(i=>i.name!==t.label);render();return;}
    const unit=t.unit,tbc=false;
    window.__cart=(window.__cart||[]).concat([{name:t.label,tags:['Tools'],qty:1,unit,total:unit,tbc,group:'wire-extra'}]);
    addedExtras[t.key]={name:t.label,qty:1,unit,tbc};
    render();
  });
  document.querySelectorAll('[data-surface]').forEach(el=>el.onclick=()=>{ws.fixingSurface=el.dataset.surface;extrasQty={screw:null,plug:null};Object.keys(addedExtras).forEach(k=>delete addedExtras[k]);render();});
  document.querySelectorAll('[data-extra-adj]').forEach(el=>el.onclick=()=>{
    const key=el.dataset.extraAdj,dir=Number(el.dataset.dir);
    const rec=key==='screw'?p.recommendedScrews:p.recommendedPlugs;
    const cur=extrasQty[key]==null?rec:extrasQty[key];
    extrasQty[key]=Math.max(0,cur+dir);
    render();
  });
  document.querySelectorAll('[data-extra-add]').forEach(el=>el.onclick=()=>{
    const key=el.dataset.extraAdd,label=el.dataset.label,unit=Number(el.dataset.unit);
    const rec=key==='screw'?p.recommendedScrews:p.recommendedPlugs;
    const qty=extrasQty[key]==null?rec:extrasQty[key];
    if(!qty)return;
    window.__cart=(window.__cart||[]).concat([{name:label,tags:['Fixings'],qty,unit,total:qty*unit,group:'wire-extra'}]);
    const cur=addedExtras[key];
    addedExtras[key]={name:label,qty:(cur?cur.qty:0)+qty,unit};
    el.textContent='Added ✓';
    setTimeout(()=>{el.textContent='Add to cart';},1200);
    renderLiveParts();
  });
  setNav({back:true,next:'Add to cart',onNext:()=>addWireToCart(buildKitRows(p))});
}

function addWireToCart(rows){
  window.__lastFlow='wire';
  const wireItems=rows.map(r=>({name:r.name,tags:['Wire Balustrade'],qty:r.qty,unit:r.unit,total:r.qty*r.unit,group:'wire'}));
  window.__cart=(window.__cart||[]).filter(i=>i.group!=='wire').concat(wireItems);
  if(typeof renderReview==='function')renderReview();
  showScreen('review');
}

function setNav(opts){
  const back=$('#wiz-back'),next=$('#wiz-next');
  back.style.display=opts.back?'':'none';
  back.onclick=goBack;
  if(opts.hideNext){next.style.display='none';}
  else{
    next.style.display='';
    next.textContent=opts.next||'Next';
    next.onclick=opts.onNext||(()=>{});
    next.disabled=!!opts.disabled;
  }
}
let lastRenderedStage=null;
function scrollToWizardTop(){
  const card=document.querySelector('#screen-wire .tf-card');
  if(!card)return;
  const y=card.getBoundingClientRect().top+window.scrollY-20;
  window.scrollTo({top:Math.max(0,y),behavior:'auto'});
}
let __imgMap=null;
function resolveImgs(){
  const box=document.getElementById('img-preload');
  if(!box)return;
  if(!__imgMap){__imgMap={};box.querySelectorAll('[data-key]').forEach(im=>{const s=im.getAttribute('src');if(s)__imgMap[im.getAttribute('data-key')]=s;});}
  document.querySelectorAll('#screen-wire img[src],#screen-wire image-slot[src]').forEach(im=>{
    const raw=im.getAttribute('src');
    if(raw&&__imgMap[raw]&&__imgMap[raw]!==raw)im.setAttribute('src',__imgMap[raw]);
  });
}
function render(){
  renderPlan();
  renderLiveParts();
  const stageChanged=ws.stage!==lastRenderedStage;
  ({intro:stageIntro,shape:stageShape,builder:stageBuilder,finish:stageFinish,summary:stageSummary})[ws.stage]();
  if(stageChanged)scrollToWizardTop();
  resolveImgs();
  lastRenderedStage=ws.stage;
}

const _showScreen=window.showScreen;
window.showScreen=function(name){
  _showScreen(name);
  if(name==='wire'){resetWire();}
};
window.wireGoToStage=function(stage){
  ws.stage=stage;
  _showScreen('wire');
  render();
};
document.addEventListener('DOMContentLoaded',()=>{
  if(location.hash==='#wire')window.showScreen('wire');
});
})();
