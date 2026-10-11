const D=RETAIL_DATA,$=(s,e=document)=>e.querySelector(s),$$=(s,e=document)=>[...e.querySelectorAll(s)];
const Cr=v=>'₹'+(v/1e7).toLocaleString('en-IN',{maximumFractionDigits:1})+' Cr';
const L=v=>'₹'+(v/1e5).toLocaleString('en-IN',{maximumFractionDigits:1})+' L';
const N=v=>Math.round(v).toLocaleString('en-IN');
const P=['#2f63ff','#16b5a0','#8b5cf6','#f2555a','#06b6d4','#84cc16','#ec4899','#64748b'];
const SEG={'Star Performers':['#2f63ff','Highest revenue and order value. Protect stock levels and use these stores to trial new ranges.'],'Steady Core':['#16b5a0','Reliable mid-table stores. Small gains from cross-selling and loyalty offers.'],'Growth Opportunity':['#8b5cf6','Lower revenue or slower growth. Review local assortment, staffing and promotions.']};
const S={store:'All',cat:'All',year:'All',tab:'overview',m:4,g:0,h:6},charts={};
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function mk(id,cfg){charts[id]?.destroy();Chart.defaults.color=css('--mut');Chart.defaults.borderColor=css('--line');Chart.defaults.font.family='Inter,system-ui,sans-serif';
 cfg.options={maintainAspectRatio:false,animation:{duration:600},...cfg.options};charts[id]=new Chart($('#'+id),cfg)}
const rows=(ignoreYear)=>D.cube.filter(r=>(S.store=='All'||r[1]==S.store)&&(S.cat=='All'||r[3]==S.cat)&&(ignoreYear||S.year=='All'||r[0].startsWith(S.year)));
const sum=(rs,i)=>rs.reduce((a,r)=>a+r[i],0);
function by(rs,k,i=4){const m={};rs.forEach(r=>m[r[k]]=(m[r[k]]||0)+r[i]);return m}
const ticksCr={callback:v=>v}; 

/* ---------- filters & nav ---------- */
const opt=(el,list)=>el.innerHTML=['All',...list].map(x=>`<option>${x}</option>`).join('');
opt($('#f-store'),D.filters.stores);opt($('#f-cat'),D.filters.categories);
$('#range').textContent=`Data: ${D.kpis.start} to ${D.kpis.end}`;
const sync=()=>{$('#f-store').value=S.store;$('#f-cat').value=S.cat;$('#f-year').value=S.year};
[['f-store','store'],['f-cat','cat'],['f-year','year']].forEach(([id,k])=>$('#'+id).onchange=e=>{S[k]=e.target.value;render()});
$('#reset').onclick=()=>{S.store=S.cat=S.year='All';sync();render()};
const TITLES={overview:'Overview',patterns:'Sales patterns',stores:'Store segments',forecast:'Sales forecast',ask:'Insights & Ask AI'};
function go(t){S.tab=t;$$('nav button').forEach(b=>b.classList.toggle('on',b.dataset.tab==t));$$('.tab').forEach(s=>s.classList.toggle('on',s.id=='t-'+t));$('#title').textContent=TITLES[t];$('.filters').style.visibility=t=='ask'?'hidden':'visible';render()}
$$('nav button').forEach(b=>b.onclick=()=>go(b.dataset.tab));
$('#theme').onclick=()=>{const d=document.documentElement;d.dataset.theme=d.dataset.theme=='dark'?'light':'dark';render()};
$$('#metric button').forEach(b=>b.onclick=()=>{S.m=+b.dataset.m;$$('#metric button').forEach(x=>x.classList.toggle('on',x==b));overview()});

/* ---------- Overview ---------- */
function countUp(el,to,f){const t0=performance.now();(function s(t){const p=Math.min(1,(t-t0)/700);el.textContent=f(to*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(s)})(t0)}
function overview(){
 const rs=rows(),all=rows(true),r23=sum(all.filter(r=>r[0]<'2024'),4),r24=sum(all.filter(r=>r[0]>='2024'),4),yoy=(r24/r23-1)*100;
 const rev=sum(rs,4),ord=sum(rs,6),un=sum(rs,5);
 const k=[['Revenue',rev,Cr],['Orders',ord,N],['Units sold',un,N],['Average order',rev/ord,L],['Growth 2024 vs 2023',yoy,v=>(v>=0?'+':'')+v.toFixed(2)+'%']];
 $('#kpis').innerHTML=k.map((x,i)=>`<div class="kpi"><span>${x[0]}</span><b id="k${i}">0</b>${i==4?`<i class="${yoy>=0?'up':'dn'}">${yoy>=0?'Growing':'Declining'}</i>`:'<i></i>'}</div>`).join('');
 k.forEach((x,i)=>countUp($('#k'+i),x[1],x[2]));
 const mm=by(rs,0,S.m),ms=Object.keys(mm).sort(),sc=S.m==4?1e7:1,lab=['Revenue (₹ Cr)','Units','Orders'][S.m-4];
 mk('c-trend',{type:'line',data:{labels:ms,datasets:[{label:lab,data:ms.map(m=>mm[m]/sc),borderColor:P[0],backgroundColor:'rgba(47,99,255,.12)',fill:true,tension:.35,pointRadius:2}]},options:{plugins:{legend:{display:false}},interaction:{intersect:false,mode:'index'}}});
 const cm=by(rs,3);mk('c-cat',{type:'doughnut',data:{labels:Object.keys(cm),datasets:[{data:Object.values(cm).map(v=>v/1e7),backgroundColor:P,borderWidth:0}]},options:{cutout:'62%',plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>`${c.label}: ₹${c.parsed.toFixed(0)} Cr`}}},onClick:(e,a)=>{if(a[0]){S.cat=Object.keys(cm)[a[0].index];sync();render()}}}});
 const sm=by(rs,1),sk=Object.keys(sm).sort((a,b)=>sm[b]-sm[a]);
 mk('c-store',{type:'bar',data:{labels:sk,datasets:[{data:sk.map(s=>sm[s]/1e7),backgroundColor:sk.map(s=>s==S.store?'#f5a524':P[0]),borderRadius:6}]},options:{plugins:{legend:{display:false}},onClick:(e,a)=>{if(a[0]){S.store=sk[a[0].index];sync();render()}}}});
 const rm=by(rs,2);mk('c-region',{type:'polarArea',data:{labels:Object.keys(rm),datasets:[{data:Object.values(rm).map(v=>v/1e7),backgroundColor:P.map(c=>c+'bb')}]},options:{plugins:{legend:{position:'right'}},scales:{r:{ticks:{display:false}}}}});
}

/* ---------- Patterns ---------- */
function patterns(){
 const rs=rows(true),M=D.seasonality.months,yr=y=>M.map((_,i)=>sum(rs.filter(r=>r[0]==`${y}-${String(i+1).padStart(2,'0')}`),4)/1e7);
 const a=yr(2023),b=yr(2024),avg=a.map((v,i)=>(v+b[i])/2),mean=avg.reduce((x,y)=>x+y)/12;
 mk('c-season',{type:'bar',data:{labels:M,datasets:[{type:'line',label:'Seasonal index (100 = average)',data:avg.map(v=>v/mean*100),yAxisID:'y1',borderColor:'#f5a524',tension:.35,pointRadius:3},{label:'2023',data:a,backgroundColor:'#9db6ff',borderRadius:4},{label:'2024',data:b,backgroundColor:P[0],borderRadius:4}]},options:{scales:{y1:{position:'right',grid:{drawOnChartArea:false}}},plugins:{legend:{position:'bottom'}}}});
 mk('c-dow',{type:'bar',data:{labels:D.dow.days.map(d=>d.slice(0,3)),datasets:[{data:D.dow.avg.map(v=>v/1e5),backgroundColor:P[1],borderRadius:6}]},options:{plugins:{legend:{display:false}},scales:{y:{title:{display:true,text:'₹ Lakh'},beginAtZero:true}}}});
 const h=D.heatmap,flat=h.z.flat(),mn=Math.min(...flat),mx=Math.max(...flat),el=$('#heat');
 el.style.gridTemplateColumns=`110px repeat(${h.cols.length},1fr)`;
 el.innerHTML='<div></div>'+h.cols.map(c=>`<div class="h">${c}</div>`).join('')+h.rows.map((r,i)=>`<div class="h" style="text-align:left">${r}</div>`+h.z[i].map((v,j)=>{const t=(v-mn)/(mx-mn||1),al=.12+t*.8;return `<div data-s="${r}" data-c="${h.cols[j]}" title="Click to filter" style="background:rgba(47,99,255,${al});color:${al>.5?'#fff':'inherit'}">${Cr(v)}</div>`}).join('')).join('');
 $$('#heat [data-s]').forEach(c=>c.onclick=()=>{S.store=c.dataset.s;S.cat=c.dataset.c;sync();go('overview')});
 const p=D.promo,g=(k,key)=>p[k].find(x=>x.key==key).avg_order/1e5;
 mk('c-promo',{type:'bar',data:{labels:['Promotion','No promotion','Holiday','Regular day','New customer','Returning'],datasets:[{data:[g('Promotion_Applied','Yes'),g('Promotion_Applied','No'),g('Holiday_Flag','1'),g('Holiday_Flag','0'),g('Customer_Type','New'),g('Customer_Type','Returning')],backgroundColor:[P[3],'#f3b1b3',P[2],'#cdbdf9',P[1],'#9fe0d6'],borderRadius:6}]},options:{plugins:{legend:{display:false}},scales:{y:{title:{display:true,text:'Average order, ₹ Lakh'},beginAtZero:true}}}});
 const dc=p.discount_curve,u=dc.map(x=>x.units),spread=(Math.max(...u)-Math.min(...u))/(u.reduce((x,y)=>x+y)/u.length)*100;
 mk('c-disc',{type:'line',data:{labels:dc.map(x=>x.disc+'%'),datasets:[{label:'Average units per order',data:u,borderColor:P[3],tension:.3,pointRadius:4}]},options:{plugins:{legend:{display:false}},scales:{y:{title:{display:true,text:'Units per order'}}}}});
 $('#disc-note').textContent=spread<10?`Units per order move only ${spread.toFixed(1)}% across discount levels, so deeper discounts add little volume here and mostly give margin away.`:`Units per order vary ${spread.toFixed(1)}% across discount levels, so discounts do shift volume.`;
}

/* ---------- Segments ---------- */
function stores(){
 const st=D.segments.stores,mx=Math.max(...st.map(s=>s.revenue));
 const lab={id:'lab',afterDatasetsDraw(c){const x=c.ctx;x.save();x.fillStyle=css('--ink');x.font='12px Inter';c.data.datasets.forEach((d,i)=>c.getDatasetMeta(i).data.forEach((p,j)=>x.fillText(d.data[j].s,p.x+p.options.radius+4,p.y+4)));x.restore()}};
 mk('c-seg',{type:'bubble',plugins:[lab],data:{datasets:Object.keys(SEG).map(g=>({label:g,backgroundColor:SEG[g][0]+'cc',data:st.filter(s=>s.segment==g).map(s=>({x:s.pc1,y:s.pc2,r:8+14*s.revenue/mx,s:s.Store_Location,rev:s.revenue}))}))},
  options:{plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>`${c.raw.s}: ${Cr(c.raw.rev)}`}}},scales:{x:{title:{display:true,text:'Behaviour axis 1'},grid:{display:false}},y:{title:{display:true,text:'Behaviour axis 2'}}}}});
 $('#seg-cards').innerHTML=Object.keys(SEG).map(g=>`<div class="sc" style="border-color:${SEG[g][0]}"><b>${g}</b><small>${st.filter(s=>s.segment==g).map(s=>s.Store_Location).join(', ')}</small><p>${SEG[g][1]}</p></div>`).join('');
 $('#sil').textContent=`Silhouette score ${D.segments.silhouette}: groups overlap, so treat them as a guide, not hard borders. Click a row to drill down.`;
 $('#tbl').innerHTML='<thead><tr><th>Store</th><th>Segment</th><th>Revenue</th><th>Avg order</th><th>Rating</th><th>Growth</th><th>Returning</th><th>Discount</th></tr></thead><tbody>'+st.map(s=>`<tr data-s="${s.Store_Location}"><td>${s.rank}. ${s.Store_Location} <small>${s.Region}</small></td><td><span class="badge" style="background:${SEG[s.segment][0]}">${s.segment}</span></td><td>${Cr(s.revenue)}</td><td>${L(s.aov)}</td><td>${s.rating.toFixed(2)}</td><td class="${s.growth>=0?'up':'dn'}">${s.growth>=0?'+':''}${s.growth.toFixed(1)}%</td><td>${s.returning.toFixed(0)}%</td><td>${s.discount.toFixed(1)}%</td></tr>`).join('')+'</tbody>';
 $$('#tbl tr[data-s]').forEach(r=>r.onclick=()=>{S.store=r.dataset.s;sync();go('overview')});
}

/* ---------- Forecast ---------- */
function scope(){
 const F=D.forecast,o=F.overall,ob={history:F.history,forecast:o.forecast,lo:o.lo,hi:o.hi,model:o.best,mape:o.board.find(b=>b.model==o.best).mape};
 if(S.store=='All'&&S.cat=='All')return[ob,'All stores, all categories'];
 if(S.cat=='All')return[F.by_store[S.store],S.store+', all categories'];
 if(S.store=='All')return[F.by_category[S.cat],'All stores, '+S.cat];
 const st=F.by_store[S.store],sh=sum(rows(true),4)/sum(D.cube.filter(r=>r[1]==S.store),4),sc=a=>a.map(v=>v*sh);
 return[{...st,history:sc(st.history),forecast:sc(st.forecast),lo:sc(st.lo),hi:sc(st.hi),model:st.model+' scaled by category share'},`${S.store}, ${S.cat}`];
}
function forecast(){
 const[f,name]=scope(),F=D.forecast,h=S.h,k=1+S.g/100,fc=f.forecast.slice(0,h).map(v=>v*k),lo=f.lo.slice(0,h).map(v=>v*k),hi=f.hi.slice(0,h).map(v=>v*k);
 const hm=F.history_months,fm=F.future_months.slice(0,h),labels=[...hm,...fm],pad=Array(hm.length-1).fill(null),last=f.history.at(-1);
 mk('c-fc',{type:'line',data:{labels,datasets:[
  {label:'Actual',data:f.history.map(v=>v/1e7),borderColor:P[0],backgroundColor:P[0],tension:.3,pointRadius:2},
  {label:'Low (80%)',data:[...pad,last/1e7,...lo.map(v=>v/1e7)],borderWidth:0,pointRadius:0,tension:.3},
  {label:'High (80%)',data:[...pad,last/1e7,...hi.map(v=>v/1e7)],borderWidth:0,pointRadius:0,fill:'-1',backgroundColor:'rgba(245,165,36,.2)',tension:.3},
  {label:'Forecast',data:[...pad,last/1e7,...fc.map(v=>v/1e7)],borderColor:'#f5a524',backgroundColor:'#f5a524',borderDash:[7,5],borderWidth:3,tension:.3,pointRadius:4}]},
  options:{interaction:{intersect:false,mode:'index'},plugins:{legend:{position:'bottom',labels:{filter:i=>!i.text.includes('Low')}},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ₹${c.parsed.y.toFixed(1)} Cr`}}},scales:{y:{title:{display:true,text:'₹ Crore per month'}}}}});
 $('#fc-title').textContent='Revenue forecast: '+name;$('#fc-sub').textContent=`Model: ${f.model}. Hold-out error (MAPE): ${f.mape}%. Shaded band is an 80% range.`;
 const tot=fc.reduce((a,b)=>a+b),prev=f.history.slice(-h).reduce((a,b)=>a+b);
 $('#fc-chips').innerHTML=[['Forecast total',Cr(tot)],['Versus last '+h+' months',`${((tot/prev-1)*100>=0?'+':'')}${((tot/prev-1)*100).toFixed(1)}%`],['Monthly average',Cr(tot/h)],['Best month',fm[fc.indexOf(Math.max(...fc))]]].map(c=>`<div class="chip"><small>${c[0]}</small><b>${c[1]}</b></div>`).join('');
 $('#hv').textContent=h+(h>1?' months':' month');$('#gv').textContent=(S.g>0?'+':'')+S.g+'%';
 const bd=F.overall.board;$('#board').innerHTML=bd.map(b=>`<div class="bd ${b.model==F.overall.best?'best':''}"><span>${b.model}</span><div class="tr"><i style="width:${Math.max(4,100-b.mape*10)}%"></i></div><b>${b.mape}%</b></div>`).join('')+'<small>Lower error is better. The moving average is only a benchmark; it is never used for the forecast.</small>';
 $('#fc-tbl').innerHTML='<thead><tr><th>Month</th><th>Forecast</th><th>Low</th><th>High</th></tr></thead><tbody>'+fm.map((m,i)=>`<tr><td>${m}</td><td>${Cr(fc[i])}</td><td>${Cr(lo[i])}</td><td>${Cr(hi[i])}</td></tr>`).join('')+'</tbody>';
}
$('#horizon').oninput=e=>{S.h=+e.target.value;forecast()};$('#growth').oninput=e=>{S.g=+e.target.value;forecast()};

/* ---------- Insights & Ask ---------- */
const sg=D.segments.stores,F0=D.forecast.overall;
const bestG=[...sg].sort((a,b)=>b.growth-a.growth),pct=x=>(x>=0?'+':'')+x.toFixed(1)+'%';
function answer(q){q=q.toLowerCase();const has=(...w)=>w.some(x=>q.includes(x));
 if(has('fast','grow','growth','declin'))return`${bestG[0].Store_Location} grew fastest in 2024 (${pct(bestG[0].growth)}). ${bestG.at(-1).Store_Location} fell most (${pct(bestG.at(-1).growth)}). Chain-wide revenue moved ${pct(D.kpis.yoy)}.`;
 if(has('worst','lowest','weak','bottom'))return`${D.store.at(-1).Store_Location} has the lowest revenue at ${Cr(D.store.at(-1).revenue)}, ${(D.store[0].revenue/D.store.at(-1).revenue*100-100).toFixed(0)}% behind ${D.store[0].Store_Location}.`;
 if(has('store','top','best'))return`${D.store[0].Store_Location} leads with ${Cr(D.store[0].revenue)} (${D.store[0].share.toFixed(1)}% of revenue), then ${D.store[1].Store_Location} and ${D.store[2].Store_Location}.`;
 if(has('categor','product','mix'))return D.category.map(c=>`${c.Product_Category} ${c.share.toFixed(1)}%`).join(', ')+'. The mix is very even, so no single category carries the business.';
 if(has('forecast','predict','next','future'))return`Next ${F0.forecast.length} months: ${Cr(F0.forecast.reduce((a,b)=>a+b))} in total using ${F0.best}. Hold-out error is ${F0.board.find(b=>b.model==F0.best).mape}%. Open the Forecast tab to test what-if changes.`;
 if(has('season','peak','month','festival'))return D.insights[3].text;
 if(has('discount','promo'))return`The average discount is ${D.kpis.avg_discount}%, worth ${Cr(D.kpis.discount_given)} in total. ${$('#disc-note').textContent||'See Sales patterns for how discounts affect volume.'}`;
 if(has('segment','cluster','group'))return Object.keys(SEG).map(g=>`${g}: ${sg.filter(s=>s.segment==g).map(s=>s.Store_Location).join(', ')}`).join('. ')+'.';
 if(has('rating','satisf'))return`Average rating is ${D.kpis.avg_rating}. Best: ${[...sg].sort((a,b)=>b.rating-a.rating)[0].Store_Location}, lowest: ${[...sg].sort((a,b)=>a.rating-b.rating)[0].Store_Location}.`;
 if(has('customer','loyal','return'))return`${D.kpis.returning_pct}% of orders come from returning customers.`;
 return'I can answer questions about top or weakest stores, growth, categories, seasonality, discounts, segments, ratings and the forecast.';}
const say=(t,c)=>{const d=document.createElement('div');d.className='m '+c;$('#log').append(d);if(c=='u'||matchMedia('(prefers-reduced-motion:reduce)').matches)d.textContent=t;else{let i=0;(function s(){d.textContent=t.slice(0,i+=3);$('#log').scrollTop=1e9;if(i<t.length)setTimeout(s,12)})()}$('#log').scrollTop=1e9};
function ask(q){q=q.trim();if(!q)return;say(q,'u');say(answer(q),'a');$('#q').value=''}
$('#go').onclick=()=>ask($('#q').value);$('#q').onkeydown=e=>e.key=='Enter'&&ask(e.target.value);
$('#qs').innerHTML=['Which store is growing fastest?','What is the forecast?','When is the peak season?','How do discounts perform?','Show store segments'].map(q=>`<button>${q}</button>`).join('');
$$('#qs button').forEach(b=>b.onclick=()=>ask(b.textContent));
say('Hi, I can answer questions about this dataset. Pick a suggestion or type your own.','a');
function insights(){$('#ins').innerHTML=D.insights.map(i=>`<div class="in"><span class="e">${i.icon}</span><div>${i.text}<small>Next step: ${i.action}</small></div></div>`).join('')}

function render(){({overview,patterns,stores,forecast,ask:insights})[S.tab]()}
render();
