const qs=s=>document.querySelector(s), qsa=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
qs('#year').textContent=new Date().getFullYear();

const menu=qs('#nav'), menuBtn=qs('#menuBtn');
menuBtn.addEventListener('click',()=>{const o=menu.classList.toggle('open');menuBtn.setAttribute('aria-expanded',o)});
qsa('#nav a').forEach(a=>a.addEventListener('click',()=>{menu.classList.remove('open');menuBtn.setAttribute('aria-expanded','false')}));

const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target)}}),{threshold:.12});
qsa('.reveal').forEach(el=>io.observe(el));

async function getJSON(url,opt){const r=await fetch(url,opt);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||d.error||'Ошибка');return d}

async function loadContent(){
  try{
    const {data}=await getJSON('/api/content');
    qsa('[data-content]').forEach(el=>{const k=el.dataset.content;if(data?.[k])el.textContent=data[k]});
    if(data?.contactEmail){qs('#contactEmail').textContent=data.contactEmail;qs('#contactEmail').href='mailto:'+data.contactEmail}
    if(data?.contactPhone){const p=qs('#contactPhone');p.textContent=data.contactPhone;p.href='tel:'+data.contactPhone.replace(/\s+/g,'');p.classList.remove('hidden')}
  }catch(e){}
}
async function loadProjects(){
  try{
    const xs=await getJSON('/api/projects');
    qs('#projectsGrid').innerHTML=xs.length?xs.map(x=>`<article class="project-card">
      ${x.imageId?`<img src="/media/${x.imageId}" alt="${esc(x.title)}" loading="lazy">`:''}
      <div class="project-body"><div class="project-category">${esc(x.category)}</div><h3>${esc(x.title)}</h3><p>${esc(x.description)}</p></div>
    </article>`).join(''):'<div class="empty-card">Первые проекты скоро появятся здесь.</div>'
  }catch(e){}
}
function providerCard(x){const links=[];if(x.phone)links.push(`<a href="tel:${esc(x.phone.replace(/\s+/g,''))}">Позвонить</a>`);if(x.website)links.push(`<a href="${esc(x.website)}" target="_blank" rel="noopener">Сайт</a>`);if(x.social)links.push(`<a href="${x.social.startsWith('http')?esc(x.social):'#'}" ${x.social.startsWith('http')?'target="_blank" rel="noopener"':''}>${esc(x.social)}</a>`);return `<article class="provider-card"><div class="provider-top">${x.imageId?`<img class="provider-avatar" src="/media/${x.imageId}" alt="">`:'<div class="provider-avatar"></div>'}<div><div class="provider-meta">${esc(x.category)} · ${esc(x.city||'без города')}</div><h3>${esc(x.name)}</h3></div></div><p>${esc(x.description)}</p><div class="provider-links">${links.join('')}</div></article>`}
async function searchProviders(params=new URLSearchParams()){
  try{
    const xs=await getJSON('/api/providers?'+params.toString());
    qs('#providersGrid').innerHTML=xs.length?xs.map(providerCard).join(''):'<div class="empty-card">Ничего не найдено. Попробуйте изменить параметры.</div>'
  }catch(e){qs('#providersGrid').innerHTML='<div class="empty-card">Каталог подключится после запуска базы данных.</div>'}
}
qs('#providerSearch').addEventListener('submit',e=>{e.preventDefault();searchProviders(new URLSearchParams(new FormData(e.target)))});

const dialog=qs('#offerDialog');
qs('#offerBtn').onclick=()=>dialog.showModal();
qs('#offerClose').onclick=()=>dialog.close();
qs('#offerForm').addEventListener('submit',async e=>{
  e.preventDefault(); const data=Object.fromEntries(new FormData(e.target)); const msg=qs('#offerMsg');
  try{await getJSON('/api/providers/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});msg.textContent='Спасибо. Заявка отправлена на модерацию.';e.target.reset()}
  catch(err){msg.textContent='Не получилось отправить: '+err.message}
});

loadContent();loadProjects();searchProviders();