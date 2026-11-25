/* ONLYFLORA_ANDROID_CLASSES_START */
const onlyFloraAndroidVersion=navigator.userAgent.match(/OnlyFloraAndroid\/(\d+)\.(\d+)\.(\d+)/);
if(onlyFloraAndroidVersion){
  document.documentElement.classList.add('onlyflora-android');
  const versionCode=Number(onlyFloraAndroidVersion[1])*10000+Number(onlyFloraAndroidVersion[2])*100+Number(onlyFloraAndroidVersion[3]);
  if(versionCode<10005)document.documentElement.classList.add('onlyflora-android-legacy-bottom');
}
/* ONLYFLORA_ANDROID_CLASSES_END */
const views = [...document.querySelectorAll('[data-view]')];
const navButtons = [...document.querySelectorAll('.bottom-nav [data-route]')];
const catalogSearch = document.querySelector('#catalogSearch');
const homeSearch = document.querySelector('#homeSearch');
const productList = document.querySelector('#productList');
const allCategories = document.querySelector('#allCategories');
const resultMeta = document.querySelector('.result-meta');
const emptyState = document.querySelector('#emptyState');
const resultCount = document.querySelector('#resultCount');
const catalogStatus = document.querySelector('#catalogStatus');
const layoutHint = document.querySelector('#layoutHint');
const cartBadge = document.querySelector('#cartBadge');
const cartList = document.querySelector('#cartList');
const cartEmpty = document.querySelector('#cartEmpty');
const cartSummary = document.querySelector('#cartSummary');
const cartItemsTotal = document.querySelector('#cartItemsTotal');
const cartPriceTotal = document.querySelector('#cartPriceTotal');
const checkoutButton = document.querySelector('#checkoutButton');
const cartNote = document.querySelector('#cartNote');
const toast = document.querySelector('#toast');
const hero = document.querySelector('.hero');
let activeProducts = [];
let selectedProduct = null;
let selectedOffer = null;
let liveOffers = [];
let offerFilters = {formType:'',height:'',container:''};
let productRequest=0;
let wheelValues=[];
let wheelTimer=0;
const plantModel=globalThis.OnlyFloraProducts;
let productQuantity = 1;
let livePlan = null;
let resultProducts = [];
let searchSequence = 0;
let searchTimer = 0;
let catalogIndexPromise = null;
let offersSnapshotPromise = null;
let categoryBrowseMode = false;
const CART_KEY = 'onlyflora-mobile-cart-v1';
const APP_URL = 'https://app.onlyflora.ru/';
let cart = loadCart();
let installPrompt = null;

const layoutMap = Object.fromEntries([..."qwertyuiop[]asdfghjkl;'zxcvbnm,.`"].map((letter,index)=>[letter,[..."йцукенгшщзхъфывапролджэячсмитьбюё"][index]]));
const normalize = value => String(value || '').toLocaleLowerCase('ru-RU').replaceAll('ё','е').trim();
const searchKey = value => normalize(value).replace(/[^a-zа-я0-9]+/gi,' ').replace(/(.)\1+/g,'$1').trim();
const convertLayout = value => [...normalize(value)].map(char => layoutMap[char] || char).join('');
const money = value => new Intl.NumberFormat('ru-RU').format(Number(value || 0)) + ' ₽';
const moneyKopecks = value => money(Math.round(Number(value || 0) / 100));
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const absoluteOnlyFloraUrl = value => { try { return new URL(value || '/', 'https://onlyflora.ru').href; } catch { return 'https://onlyflora.ru'; } };

const categoryAsset = file => `/assets/categories/${file}.webp`;
const categoryGroupThumbs = {
  'лиственные деревья':'/assets/category-deciduous.webp',
  'лиственные кустарники':categoryAsset('kustarniki'),
  'хвойные':categoryAsset('khvoynye'),
  'многолетники':'/assets/category-perennials.webp',
  'декоративные злаки':'/assets/category-grasses.webp',
  'почвопокровные':'/assets/category-perennials.webp',
  'розы':'/assets/category-roses.webp',
  'лианы':'/assets/category-euonymus.webp',
  'плодовые':'/assets/category-fruits.webp',
  'крупномеры':'/assets/category-deciduous.webp',
  'формованные растения':'/assets/category-topiary-v3.webp',
  'блоки живой изгороди':'/assets/category-hedges.webp'
};
const categoryThumbs = {
  'лиственные деревья|береза':'/assets/sub-birch.webp',
  'лиственные деревья|вяз':'/assets/sub-elm.webp',
  'лиственные деревья|дуб':'/assets/sub-oak.webp',
  'лиственные деревья|ива':'/assets/sub-willow.webp',
  'лиственные деревья|клен':'/assets/sub-maple-v2.webp',
  'лиственные деревья|липа':'/assets/sub-linden.webp',
  'лиственные деревья|рябина':'/assets/sub-rowan.webp',
  'лиственные деревья|тополь':'/assets/sub-poplar.webp',
  'лиственные деревья|черемуха':'/assets/category-bird-cherry-v2.webp',
  'лиственные деревья|ясень':'/assets/sub-ash.webp',
  'лиственные деревья|декоративная яблоня':'/assets/sub-apple.webp',
  'лиственные деревья|лиственное дерево':'/assets/sub-other-deciduous.webp',
  'лиственные кустарники|барбарис':categoryAsset('barbarisy'),
  'лиственные кустарники|бересклет':categoryAsset('beresklet'),
  'лиственные кустарники|боярышник':categoryAsset('boyaryshnik'),
  'лиственные кустарники|вейгела':categoryAsset('veygela'),
  'лиственные кустарники|гортензия':categoryAsset('gortenziya'),
  'лиственные кустарники|гортензия метельчатая':categoryAsset('gortenziya'),
  'лиственные кустарники|гортензия древовидная':categoryAsset('gortenziya'),
  'лиственные кустарники|гортензия крупнолистная':categoryAsset('gortenziya'),
  'лиственные кустарники|гортензия черешковая':categoryAsset('gortenziya'),
  'лиственные кустарники|дерен':categoryAsset('dyoren'),
  'лиственные кустарники|жимолость':categoryAsset('zhimolost'),
  'лиственные кустарники|калина':categoryAsset('kalina'),
  'лиственные кустарники|кизильник':categoryAsset('kizilnik'),
  'лиственные кустарники|лапчатка':categoryAsset('lapchatka'),
  'лиственные кустарники|пузыреплодник':categoryAsset('puzyreplodnik'),
  'лиственные кустарники|сирень':categoryAsset('siren'),
  'лиственные кустарники|спирея':categoryAsset('spireya'),
  'лиственные кустарники|чубушник':categoryAsset('chubushnik'),
  'лиственные кустарники|кустарник':categoryAsset('drugie-kustarniki'),
  'хвойные|сосна':categoryAsset('sosna'),
  'хвойные|можжевельник':categoryAsset('mozhzhevelnik'),
  'хвойные|ель':categoryAsset('eli'),
  'хвойные|лиственница':categoryAsset('listvennitsa')
};

const categoryImageQueue=[];
let categoryImagesActive=0;

function setCategoryImageSource(image,source,timeout=16000){
  return new Promise(resolve=>{
    let finished=false;
    const finish=loaded=>{
      if(finished)return;
      finished=true;clearTimeout(timer);
      image.removeEventListener('load',onLoad);image.removeEventListener('error',onError);
      resolve(loaded);
    };
    const onLoad=()=>finish(image.naturalWidth>0);
    const onError=()=>finish(false);
    const timer=setTimeout(()=>finish(false),timeout);
    image.addEventListener('load',onLoad,{once:true});
    image.addEventListener('error',onError,{once:true});
    image.src=source;
  });
}

async function runCategoryImageLoad(image){
  const source=image.dataset.categorySource;
  const fallback=image.dataset.categoryFallback;
  let loaded=false;
  for(let attempt=0;attempt<3&&!loaded;attempt+=1){
    const separator=source.includes('?')?'&':'?';
    loaded=await setCategoryImageSource(image,attempt?`${source}${separator}retry=${attempt}`:source);
  }
  if(!loaded)await setCategoryImageSource(image,fallback,5000);
}

function pumpCategoryImageQueue(){
  while(categoryImagesActive<3&&categoryImageQueue.length){
    const image=categoryImageQueue.shift();
    categoryImagesActive+=1;
    runCategoryImageLoad(image).finally(()=>{
      categoryImagesActive-=1;
      pumpCategoryImageQueue();
    });
  }
}

function queueCategoryImage(image,{priority=false}={}){
  if(image.naturalWidth||image.dataset.categoryQueued==='1')return;
  image.dataset.categoryQueued='1';
  if(priority)categoryImageQueue.unshift(image);else categoryImageQueue.push(image);
  pumpCategoryImageQueue();
}

function loadCategoryImage(image,source,fallback,{defer=false}={}){
  image.dataset.categorySource=source;image.dataset.categoryFallback=fallback;
  image.loading=defer?'lazy':'eager';image.decoding='async';
  if(!defer)queueCategoryImage(image);
}

function decorateCategoryChildren(){
  document.querySelectorAll('.category-group').forEach(group=>{
    const groupName=normalize(group.querySelector('summary b')?.textContent);
    const summaryImage=group.querySelector('summary img');
    if(summaryImage&&categoryGroupThumbs[groupName]){
      group.dataset.fallbackThumb=summaryImage.getAttribute('src');
      loadCategoryImage(summaryImage,categoryGroupThumbs[groupName],group.dataset.fallbackThumb);
    }
    group.addEventListener('toggle',()=>{
      if(!group.open)return;
      [...group.querySelectorAll('.category-children img')].reverse().forEach(image=>{
        image.loading='eager';
        queueCategoryImage(image,{priority:true});
      });
    });
  });
  document.querySelectorAll('.category-children button').forEach(button=>{
    if(button.querySelector('img'))return;
    const group=button.closest('.category-group');
    const groupName=normalize(group?.querySelector('summary b')?.textContent);
    const query=normalize(button.dataset.query);
    const fallback=group?.dataset.fallbackThumb || '/assets/category-deciduous.webp';
    const image=document.createElement('img');
    image.alt='';
    loadCategoryImage(image,categoryThumbs[`${groupName}|${query}`] || categoryGroupThumbs[groupName] || fallback,fallback,{defer:true});
    button.prepend(image);
  });
}

function showToast(message){
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(()=>toast.classList.remove('is-visible'),2400);
}

function loadCart(){
  try{
    const value=JSON.parse(localStorage.getItem(CART_KEY)||'[]');
    return Array.isArray(value)?value.filter(item=>item&&item.skuId&&item.productId&&Number(item.quantity)>0):[];
  }catch{return[]}
}

function saveCart(){
  localStorage.setItem(CART_KEY,JSON.stringify(cart));
  renderCart();
}

const ONLYFLORA_API_ORIGIN = 'https://orumberi-onlyflora-bridge-4b6b.twc1.net';
function resolveOnlyFloraApiUrl(url){
  if(url.startsWith('/api/egor/')) return ONLYFLORA_API_ORIGIN + '/egor/api/' + url.slice('/api/egor/'.length);
  if(url.startsWith('/api/')) return ONLYFLORA_API_ORIGIN + '/mobile/api/' + url.slice('/api/'.length);
  return url;
}
async function jsonRequest(url, options={}){
  const response = await fetch(resolveOnlyFloraApiUrl(url),{...options,headers:{'content-type':'application/json',...(options.headers||{})}});
  const result = await response.json().catch(()=>({error:'Некорректный ответ сервера.'}));
  if(!response.ok) throw new Error(result.error || 'Не удалось выполнить запрос.');
  return result;
}

function updateCart(){
  const count=cart.reduce((sum,item)=>sum+Number(item.quantity||0),0);
  cartBadge.textContent = count;
  cartBadge.hidden = count < 1;
}

function cartItemKey(item){return String(item.skuId||`${item.productId}|${item.nursery}|${item.height}|${item.container}`)}

function addCartItem(item,quantity=1){
  const key=cartItemKey(item);
  const existing=cart.find(row=>cartItemKey(row)===key);
  const stock=item.count===null||item.count===undefined?999999:Math.max(0,Math.floor(Number(item.count)));
  if(stock<1)return false;
  const safeQuantity=Math.max(1,Math.floor(Number(quantity)||1));
  if(existing){
    const nextQuantity=Math.min(stock,Number(existing.quantity||0)+safeQuantity);
    if(nextQuantity===existing.quantity)return false;
    existing.quantity=nextQuantity;
  }else{
    cart.push({
      productId:String(item.productId||''),skuId:String(item.skuId||''),sku:String(item.sku||''),
      name:String(item.name||selectedProduct?.name||'Растение'),nursery:String(item.nursery||'Питомник'),
      height:String(item.height||''),container:String(item.container||''),formType:String(item.formType||''),priceKopecks:Number(item.priceKopecks||0),
      count:item.count===null||item.count===undefined?null:Number(item.count),quantity:Math.min(stock,safeQuantity),
      image:String(item.image||'/assets/product-placeholder.webp'),productUrl:absoluteOnlyFloraUrl(item.productUrl||selectedProduct?.url),
    });
  }
  saveCart();
  return true;
}

function renderCart(){
  updateCart();
  const totalQuantity=cart.reduce((sum,item)=>sum+Number(item.quantity||0),0);
  const totalKopecks=cart.reduce((sum,item)=>sum+Number(item.priceKopecks||0)*Number(item.quantity||0),0);
  cartEmpty.hidden=cart.length>0;
  cartSummary.hidden=cart.length===0;
  cartNote.hidden=cart.length===0;
  checkoutButton.hidden=cart.length===0;
  cartItemsTotal.textContent=`${totalQuantity} шт.`;
  cartPriceTotal.textContent=moneyKopecks(totalKopecks);
  cartList.innerHTML=cart.map((item,index)=>`<article class="cart-card" data-cart-index="${index}"><img src="${escapeHtml(item.image||'/assets/product-placeholder.webp')}" alt=""><div class="cart-card-copy"><b>${escapeHtml(item.name)}</b><small>${escapeHtml([item.nursery,item.formType!=='Не указана'&&item.formType,item.height,item.container].filter(Boolean).join(' · '))}</small><strong>${moneyKopecks(Number(item.priceKopecks)*Number(item.quantity))}<small>${moneyKopecks(item.priceKopecks)} × ${escapeHtml(item.quantity)}</small></strong><div class="quantity-control"><button type="button" data-cart-minus="${index}" aria-label="Уменьшить">−</button><span>${escapeHtml(item.quantity)}</span><button type="button" data-cart-plus="${index}" aria-label="Увеличить">+</button></div></div><button class="cart-remove" type="button" data-cart-remove="${index}" aria-label="Удалить">×</button></article>`).join('');
}

function navigate(route,{updateHistory=true}={}){
  const valid = views.some(view=>view.dataset.view===route) ? route : 'home';
  views.forEach(view=>{view.hidden=view.dataset.view!==valid;view.classList.toggle('is-active',view.dataset.view===valid)});
  navButtons.forEach(button=>button.classList.toggle('is-active',button.dataset.route===valid));
  document.querySelector('.app-header').hidden = valid==='egor' || valid==='product' || valid==='cart';
  if(updateHistory && location.hash!==`#${valid}`) window.history.pushState({route:valid},'',`#${valid}`);
  scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  if(valid==='search'){
    if(!categoryBrowseMode&&!catalogSearch.value.trim()&&!activeProducts.length)loadLiveProducts('туя',{initial:true});
    setTimeout(()=>catalogSearch.focus(),80);
  }
}

function showAllCategories(){
  categoryBrowseMode=true;searchSequence+=1;activeProducts=[];
  catalogSearch.value='';homeSearch.value='';productList.innerHTML='';
  allCategories.hidden=false;resultMeta.hidden=true;emptyState.hidden=true;layoutHint.hidden=true;
  document.querySelector('#searchTitle').textContent='Все категории';
  navigate('search');
}

function showProductResults(){
  categoryBrowseMode=false;allCategories.hidden=true;resultMeta.hidden=false;
  document.querySelector('#searchTitle').textContent='Поиск растений';
}

function productImage(product){
  return product.image && !/missing|no[_-]?image|product-card-placeholder|dummy\d*|blank\.png|^data:/i.test(product.image) ? product.image : '/assets/product-placeholder.webp';
}

function renderProductList(products,{status='Живой каталог',total=products.length}={}){
  const originalLength=products.length;
  products=plantModel.groupProducts(products);
  total=Math.max(products.length,total-originalLength+products.length);
  activeProducts = products;
  resultCount.textContent = total>products.length?`${products.length} из ${total} товаров`:`${total} ${total===1?'товар':'товаров'}`;
  catalogStatus.textContent = status;
  emptyState.hidden = products.length>0;
  productList.innerHTML = products.map((product,index)=>`<button class="product-card" type="button" data-product="${index}" aria-label="Открыть товар ${escapeHtml(product.name)}"><img src="${escapeHtml(productImage(product))}" alt=""><span class="product-card-copy"><b>${escapeHtml(product.name)}</b><small>${escapeHtml(product.latin || 'Каталог OnlyFlora')}</small><small>${escapeHtml(product.meta || 'Размеры и варианты — в карточке')}</small></span><span class="product-card-price">${escapeHtml(product.priceText || (product.price ? 'от '+money(product.price) : 'проверить'))}</span></button>`).join('');
}

function loadCatalogIndex(){
  if(!catalogIndexPromise)catalogIndexPromise=fetch('/catalog-index.json?v=7',{cache:'force-cache'})
    .then(response=>{if(!response.ok)throw new Error('Индекс каталога недоступен');return response.json()})
    .then(rows=>Array.isArray(rows)?rows:[])
    .catch(()=>[]);
  return catalogIndexPromise;
}

function findIndexedProducts(rows,query){
  const needle=normalize(query);
  const tolerantNeedle=searchKey(query);
  return plantModel.groupProducts(rows)
    .filter(product=>[product,...product.members].some(member=>normalize(member.name).includes(needle)||(tolerantNeedle&&searchKey(member.name).includes(tolerantNeedle))))
    .sort((left,right)=>{
      const leftName=normalize(left.name);const rightName=normalize(right.name);
      const starts=Number(rightName.startsWith(needle))-Number(leftName.startsWith(needle));
      return starts||leftName.localeCompare(rightName,'ru');
    })
    .map(product=>({...product,url:absoluteOnlyFloraUrl(product.url),priceText:product.price?`от ${money(product.price)}`:'уточнить'}));
}

function parseSearchHtml(html){
  const doc = new DOMParser().parseFromString(html,'text/html');
  const fullProducts=[...doc.querySelectorAll('#product-list [itemscope][itemtype*="schema.org/Product"]')].flatMap((item,index)=>{
    const name=item.querySelector('[itemprop="name"]')?.textContent?.replace(/\s+/g,' ').trim();
    const anchor=item.querySelector('.product_title a[href], .image_holder a[href], a.cover-container[href]');
    if(!name||!anchor)return[];
    const image=item.querySelector('img[itemprop="image"], .image_holder img');
    const imagePath=image?.getAttribute('data-src')||image?.getAttribute('src')||'';
    const priceText=item.querySelector('.pricing .price, [itemprop="price"]')?.textContent?.replace(/\s+/g,' ').trim()||'уточнить';
    const meta=item.querySelector('.summary')?.textContent?.replace(/\s+/g,' ').trim()||'Размеры и варианты — в карточке';
    return [{id:item.dataset.productId||`live-${index}`,name,priceText,url:absoluteOnlyFloraUrl(anchor.getAttribute('href')),image:imagePath?absoluteOnlyFloraUrl(imagePath):'',meta}];
  });
  if(fullProducts.length)return fullProducts;
  return [...doc.querySelectorAll('.list-search li:not(.all-results)')].flatMap((item,index)=>{
    const anchor=item.querySelector('a[href]');
    if(!anchor)return[];
    const image=anchor.querySelector('img');
    const imagePath=image?.getAttribute('data-src')||image?.getAttribute('src')||'';
    const details=[...anchor.children].find(child=>child.querySelector?.('.pricing'));
    const name=[...(details?.children||[])].find(child=>!child.classList.contains('pricing'))?.textContent?.replace(/\s+/g,' ').trim() || image?.alt?.trim() || 'Товар';
    const priceText=details?.querySelector('.price')?.textContent?.replace(/\s+/g,' ').trim() || details?.querySelector('.pricing')?.textContent?.replace(/\s+/g,' ').trim() || 'уточнить';
    return [{id:`live-${index}`,name,priceText,url:absoluteOnlyFloraUrl(anchor.getAttribute('href')),image:imagePath?absoluteOnlyFloraUrl(imagePath):'',meta:'Актуальные предложения OnlyFlora'}];
  });
}

async function loadLiveProducts(query,{initial=false}={}){
  showProductResults();
  const raw=String(query||'').trim();
  const converted=convertLayout(raw);
  if(raw.length<2){
    layoutHint.hidden=true;
    renderProductList([],{status:'Введите название растения'});
    return;
  }
  const sequence=++searchSequence;
  catalogStatus.textContent='Ищем в OnlyFlora…';
  productList.innerHTML='<div class="offer-loading">Получаем актуальные товары и цены…</div>';
  emptyState.hidden=true;
  try{
    let used=converted;
    const index=await loadCatalogIndex();
    if(index.length){
      let products=findIndexedProducts(index,used);
      if(!products.length&&used!==raw){used=raw;products=findIndexedProducts(index,raw)}
      if(sequence!==searchSequence)return;
      layoutHint.hidden=used===raw;
      layoutHint.textContent=used===raw?'':`Ищем как: ${used}`;
      renderProductList(products.slice(0,120),{total:products.length,status:initial?'Популярное · полный каталог':'Полный каталог OnlyFlora'});
      return;
    }
    let response=await fetch(resolveOnlyFloraApiUrl(`/api/catalog?query=${encodeURIComponent(used)}`),{cache:'no-store'});
    let html=await response.text();
    let products=response.ok?parseSearchHtml(html):[];
    if(!products.length&&used!==raw){
      used=raw;response=await fetch(resolveOnlyFloraApiUrl(`/api/catalog?query=${encodeURIComponent(raw)}`),{cache:'no-store'});html=await response.text();products=response.ok?parseSearchHtml(html):[];
    }
    if(sequence!==searchSequence)return;
    layoutHint.hidden=used===raw;
    layoutHint.textContent=used===raw?'':`Ищем как: ${used}`;
    renderProductList(products,{status:response.ok?(initial?'Популярное · живой каталог':'Живой каталог'):'Каталог недоступен'});
  }catch{
    if(sequence!==searchSequence)return;
    layoutHint.hidden=true;
    renderProductList([],{status:'Нет связи с каталогом'});
  }
}

function initials(value){return String(value||'OF').split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()}

function setProduct(product){
  clearTimeout(wheelTimer);productRequest+=1;
  selectedProduct=product;
  selectedOffer=null;liveOffers=[];offerFilters={formType:'',height:'',container:''};productQuantity=1;
  document.querySelector('#productTitle').textContent=product.name;
  document.querySelector('#productImage').src=productImage(product);
  document.querySelector('#productImage').alt=product.name;
  document.querySelector('.product-picture').classList.toggle('is-placeholder',productImage(product)==='/assets/product-placeholder.webp');
  document.querySelector('#productLatin').textContent=product.latin||'Каталог OnlyFlora';
  document.querySelector('#productPrice').textContent=product.priceText||'уточняется';
  document.querySelector('#productAvailability').textContent='Проверяем наличие…';
  document.querySelector('#productAvailability').classList.remove('is-error');
  document.querySelector('#liveOffers').innerHTML='<div class="offer-loading">Получаем актуальные цены и остатки…</div>';
  document.querySelector('#formWheel').innerHTML='<div class="wheel-loading">Загрузка форм…</div>';wheelValues=[];
  for(const id of ['sizeOptions','supplyOptions']){const node=document.querySelector('#'+id);node.innerHTML='<option>Загрузка…</option>';node.disabled=true}
  document.querySelector('#offerNote').hidden=true;
  document.querySelector('.supplier').hidden=true;
  document.querySelector('.product-facts').hidden=true;
  document.querySelector('#sourceProductLink').href=product.url||'https://onlyflora.ru';
  document.querySelector('#addToCart').textContent='Выберите предложение';
  document.querySelector('#addToCart').disabled=true;
  updateProductPurchase();
}

function updateProductPurchase(){
  const quantityNode=document.querySelector('#productQuantity');
  const labelNode=document.querySelector('#productPriceLabel');
  if(quantityNode)quantityNode.textContent=String(productQuantity);
  if(!selectedOffer){if(labelNode)labelNode.textContent='Цена за штуку';return}
  const max=selectedOffer.count===null||selectedOffer.count===undefined?999999:Math.max(1,Math.floor(Number(selectedOffer.count)));
  productQuantity=Math.min(max,Math.max(1,productQuantity));
  if(quantityNode)quantityNode.textContent=String(productQuantity);
  if(labelNode)labelNode.textContent=`Итого за ${productQuantity} шт.`;
  document.querySelector('#productPrice').textContent=moneyKopecks(Number(selectedOffer.priceKopecks)*productQuantity);
}

function selectOffer(index){
  const offer=liveOffers[index];
  if(!offer)return;
  selectedOffer=offer;
  document.querySelector('.supplier').hidden=false;
  document.querySelector('.product-facts').hidden=false;
  productQuantity=1;
  document.querySelectorAll('.live-offer').forEach(button=>button.classList.toggle('is-selected',Number(button.dataset.offer)===index));
  document.querySelector('#supplierName').textContent=offer.nursery||'Питомник';
  document.querySelector('#supplierLogo').textContent=initials(offer.nursery);
  document.querySelector('#supplierStock').textContent=offer.count===null?'Остаток уточняется':`В наличии: ${offer.count} шт.`;
  document.querySelector('#factAge').textContent='не указан';
  document.querySelector('#factHeight').textContent=offer.height||'не указана';
  document.querySelector('#factSupply').textContent=offer.container||'не указана';
  document.querySelector('#sourceProductLink').href=absoluteOnlyFloraUrl(offer.productUrl||selectedProduct?.url);
  document.querySelector('#addToCart').textContent='В корзину';
  document.querySelector('#addToCart').disabled=!offer.productId||!offer.skuId;
  updateProductPurchase();
}

function filteredOffers(){
  return liveOffers.map((offer,index)=>({offer,index})).filter(({offer})=>plantModel.matches(offer,offerFilters));
}

function renderOfferButtons(){
  const matches=filteredOffers();
  const container=document.querySelector('#liveOffers');
  if(!matches.length){
    container.innerHTML='<div class="offer-loading">Такого сочетания формы, размера и поставки сейчас нет. Выберите другой вариант.</div>';
    document.querySelector('.supplier').hidden=true;document.querySelector('.product-facts').hidden=true;
    selectedOffer=null;productQuantity=1;document.querySelector('#productQuantity').textContent='1';document.querySelector('#productPriceLabel').textContent='Вариант недоступен';document.querySelector('#productPrice').textContent='—';document.querySelector('#addToCart').disabled=true;document.querySelector('#addToCart').textContent='Нет такого варианта';
    return;
  }
  container.innerHTML=matches.map(({offer,index})=>`<button class="live-offer${selectedOffer===offer?' is-selected':''}" type="button" data-offer="${index}"><span><b>${escapeHtml(offer.nursery||'Питомник')}</b><small>${escapeHtml([offer.formType!=='Не указана'&&offer.formType,offer.height,offer.girth&&'обхват '+offer.girth,offer.container].filter(Boolean).join(' · '))}</small><small>${offer.count===null?'остаток уточняется':`в наличии ${escapeHtml(offer.count)} шт.`}</small></span><strong>${moneyKopecks(offer.priceKopecks)}</strong></button>`).join('');
  if(!matches.some(({offer})=>offer===selectedOffer))selectOffer(matches[0].index);
}

function setOfferFilter(type,value){
  if(!['formType','height','container'].includes(type))return;
  offerFilters[type]=value;
  if(type==='formType'){offerFilters.height='';offerFilters.container=''}
  if(type==='height')offerFilters.container='';
  selectedOffer=null;
  renderVariantFields();
  renderOfferButtons();
}

function renderVariantFields(){
  const byForm=liveOffers.filter(offer=>!offerFilters.formType||offer.formType===offerFilters.formType);
  const sizes=[...new Set(byForm.map(offer=>offer.height).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru',{numeric:true}));
  const supplies=[...new Set(byForm.filter(offer=>!offerFilters.height||offer.height===offerFilters.height).map(offer=>offer.container).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru',{numeric:true}));
  for(const [id,field,values,all] of [['sizeOptions','height',sizes,'Все размеры'],['supplyOptions','container',supplies,'Любая поставка']]){
    const select=document.querySelector('#'+id);
    select.innerHTML=`<option value="">${all}</option>`+values.map(value=>`<option value="${escapeHtml(value)}">${escapeHtml(field==='container'?plantModel.supplyLabel(value):value)}</option>`).join('');
    select.value=offerFilters[field];select.disabled=!values.length;
  }
}
function updateWheelAppearance(){
  const wheel=document.querySelector('#formWheel'),rows=[...wheel.querySelectorAll('[data-wheel-index]')];
  const position=wheel.scrollTop/(rows[0]?.offsetHeight||44),nearest=Math.max(0,Math.min(rows.length-1,Math.round(position)));
  rows.forEach((row,index)=>{const distance=Math.abs(index-position);row.style.opacity=String(Math.max(.18,1-distance*.3));row.style.transform=`scale(${Math.max(.86,1-distance*.055)})`;row.setAttribute('aria-selected',String(index===nearest))});
  if(rows[nearest])wheel.setAttribute('aria-activedescendant',rows[nearest].id);
  return nearest;
}
function settleWheel(){
  if(!wheelValues.length)return;
  const wheel=document.querySelector('#formWheel'),index=updateWheelAppearance(),height=wheel.querySelector('[data-wheel-index]')?.offsetHeight||44;
  wheel.scrollTo({top:index*height,behavior:'auto'});
  if(offerFilters.formType!==wheelValues[index])setOfferFilter('formType',wheelValues[index]);
}
function renderFormWheel(){
  clearTimeout(wheelTimer);
  const forms=[...new Set(liveOffers.map(offer=>offer.formType))],order=['Не указана','Многоствольная','Зонт','Шар','Шпалера','Блок изгороди'];
  forms.sort((a,b)=>(order.includes(a)?order.indexOf(a):99)-(order.includes(b)?order.indexOf(b):99)||a.localeCompare(b,'ru'));
  wheelValues=['',...forms];const wheel=document.querySelector('#formWheel');
  wheel.innerHTML=wheelValues.map((value,index)=>`<div id="form-option-${index}" class="wheel-option" role="option" aria-selected="${index===0}" data-wheel-index="${index}">${escapeHtml(value||'Все формы')}</div>`).join('');
  wheel.scrollTop=0;updateWheelAppearance();
  document.querySelector('#formHint').textContent=forms.length===1&&forms[0]==='Не указана'?'Питомник не указал форму растения':'Прокрутите вверх или вниз';
}

function renderOffers(offers){
  const unique=[];const seen=new Set();
  for(const offer of offers){const key=String(offer.skuId||offer.sku||`${offer.nursery}|${offer.height}|${offer.container}|${offer.priceKopecks}`);if(!seen.has(key)){seen.add(key);unique.push(offer)}}
  liveOffers=unique.filter(offer=>offer.count===null||offer.count===undefined||Number(offer.count)>0).sort((a,b)=>Number(a.priceKopecks)-Number(b.priceKopecks));offerFilters={formType:'',height:'',container:''};selectedOffer=null;
  const availability=document.querySelector('#productAvailability');
  if(!liveOffers.length){
    availability.textContent='Нет предложений в наличии';availability.classList.add('is-error');
    document.querySelector('#liveOffers').innerHTML='<div class="offer-loading">В каталоге нет доступных вариантов этого товара.</div>';
    document.querySelector('#formWheel').innerHTML='<div class="wheel-loading">Нет доступных форм</div>';wheelValues=[];
    for(const id of ['sizeOptions','supplyOptions']){const node=document.querySelector('#'+id);node.innerHTML='<option>Нет данных</option>';node.disabled=true}
    selectedOffer=null;productQuantity=1;
    document.querySelector('#productQuantity').textContent='1';
    const catalogPrice=Number(selectedProduct?.price||0);
    document.querySelector('#productPriceLabel').textContent='Цена по каталогу';
    document.querySelector('#productPrice').textContent=catalogPrice>0?money(catalogPrice):(selectedProduct?.priceText||'уточняется');
    document.querySelector('#addToCart').disabled=true;
    document.querySelector('#addToCart').textContent='Нет в наличии';
    return;
  }
  availability.textContent=`В наличии · ${liveOffers.length} ${liveOffers.length===1?'предложение':'предложений'}`;
  availability.classList.remove('is-error');
  renderFormWheel();renderVariantFields();
  renderOfferButtons();
}

function offersFromPlan(plan,name){
  const row=plan.rows?.[0];
  const exactAlternatives=(row?.alternatives||[]).filter(offer=>normalize(offer.name)===normalize(name));
  return [...(row?.allocations||[]),...exactAlternatives];
}

async function offerNameCandidates(product){
  const name=String(product?.name||product||'').trim();
  const wanted=searchKey(name).split(' ').filter(Boolean);
  const candidates=[name];
  if(wanted[0]==='туя'&&!wanted.includes('западная'))candidates.push(`Туя западная ${wanted.slice(1).join(' ')}`);
  if(wanted.length>1){
    const rows=await loadCatalogIndex();
    const first=wanted[0];const cultivar=wanted.at(-1);
    rows
      .map(row=>({name:String(row.name||''),tokens:searchKey(row.name).split(' ').filter(Boolean)}))
      .filter(item=>item.name&&normalize(item.name)!==normalize(name)&&item.tokens[0]===first&&item.tokens.at(-1)===cultivar)
      .sort((left,right)=>{
        const shared=item=>item.tokens.filter(token=>wanted.includes(token)).length;
        return shared(right)-shared(left)||Math.abs(left.tokens.length-wanted.length)-Math.abs(right.tokens.length-wanted.length);
      })
      .slice(0,3)
      .forEach(item=>candidates.push(item.name));
  }
  return [...new Set(candidates.map(value=>value.trim()).filter(Boolean))].slice(0,4);
}

function loadOffersSnapshot(){
  if(!offersSnapshotPromise)offersSnapshotPromise=fetch('/offers-snapshot.json?v=1',{cache:'force-cache'})
    .then(response=>{if(!response.ok)throw new Error('Снимок предложений недоступен.');return response.json()});
  return offersSnapshotPromise;
}

function offersFromSnapshot(snapshot,product,name){
  let path='';
  try{path=new URL(product?.url||'',location.origin).pathname}catch{return[]}
  if(!path.endsWith('/'))path+='/'
  const entry=snapshot?.p?.[path];
  if(!entry)return[];
  const [productId,rows]=entry;const strings=snapshot.s||[];
  return rows.map(row=>({productId,skuId:row[0],name,productUrl:absoluteOnlyFloraUrl(path),nursery:strings[row[1]]||'Питомник',height:strings[row[2]]||'',girth:strings[row[3]]||'',container:strings[row[4]]||'',priceKopecks:row[5],count:row[6]}));
}

async function loadProductOffers(product){
  const request=productRequest;
  try{
    const index=await loadCatalogIndex();
    const group=plantModel.groupProducts(index).find(row=>row.plantKey===plantModel.identity(product).plantKey)||plantModel.groupProducts([product])[0];
    if(request!==productRequest)return;
    selectedProduct=group;document.querySelector('#productTitle').textContent=group.name;
    document.querySelector('#productLatin').textContent=group.latin||'';document.querySelector('#productLatin').hidden=!group.latin;
    const snapshot=await loadOffersSnapshot().catch(()=>null),offers=[];let failed=0,next=0;const members=group.members;
    await Promise.all(Array.from({length:Math.min(4,members.length)},async()=>{
      while(next<members.length){const member=members[next++];try{
        let rows=offersFromSnapshot(snapshot,member,member.name);
        if(!rows.length){const name=member.name;const result=await jsonRequest('/api/offers',{method:'POST',body:JSON.stringify({name,productUrl:absoluteOnlyFloraUrl(member.url)})});rows=Array.isArray(result.offers)?result.offers:offersFromPlan(result,name)}
        offers.push(...rows.map(offer=>plantModel.decorateOffer(offer,member,group)));
      }catch{failed++}}
    }));
    if(request!==productRequest)return;
    renderOffers(offers);
    if(failed){const note=document.querySelector('#offerNote');note.hidden=false;note.textContent='Часть предложений не загрузилась. Откройте карточку повторно, чтобы проверить остальные формы.'}
  }catch(error){
    if(request!==productRequest)return;
    const availability=document.querySelector('#productAvailability');
    availability.textContent='Не удалось проверить остатки';availability.classList.add('is-error');
    renderOffers([]);
    const note=document.querySelector('#offerNote');note.hidden=false;note.textContent='Не удалось загрузить предложения. Откройте карточку повторно.';
  }
}

function registerResultProduct(product){
  const key=String(product.id||product.url||product.name);
  const existing=resultProducts.findIndex(item=>String(item.id||item.url||item.name)===key);
  if(existing>=0)return existing;
  resultProducts.push(product);
  return resultProducts.length-1;
}

async function renderPlan(plan){
  livePlan=plan;
  resultProducts=[];
  document.querySelector('#resultsEmpty').hidden=true;
  document.querySelector('#resultsData').hidden=false;
  const requested=(plan.rows||[]).reduce((sum,row)=>sum+Number(row.request?.quantity||0),0);
  const matched=(plan.rows||[]).flatMap(row=>row.allocations||[]).reduce((sum,offer)=>sum+Number(offer.quantity||0),0);
  document.querySelector('#resultFound').textContent=`${matched} из ${requested}`;
  document.querySelector('#resultSuppliers').textContent=String(plan.supplierCount||0);
  document.querySelector('#resultTotal').textContent=moneyKopecks(plan.totalKopecks);
  const index=await loadCatalogIndex();
  const sections=[];
  for(const row of plan.rows||[]){
    const requestName=row.request?.name||'Позиция';
    const catalogMatches=findIndexedProducts(index,requestName);
    const selected=[];
    for(const offer of row.allocations||[]){
      const age=row.request?.age?`Возраст <b>${escapeHtml(row.request.age)}</b>`:'';
      const offerUrl=absoluteOnlyFloraUrl(offer.productUrl||'');
      const catalogProduct=catalogMatches.find(product=>absoluteOnlyFloraUrl(product.url)===offerUrl)||catalogMatches.find(product=>normalize(product.name)===normalize(offer.name));
      const product=catalogProduct||{id:offer.productId||offer.skuId,name:offer.name||requestName,url:offer.productUrl||'https://onlyflora.ru',image:offer.image||'',priceText:moneyKopecks(offer.priceKopecks),meta:'Предложение питомника'};
      const productIndex=registerResultProduct(product);
      selected.push(`<button class="match-card is-clickable" type="button" data-result-product="${productIndex}" aria-label="Открыть товар ${escapeHtml(product.name)}"><div class="match-top"><span class="plant-thumb">🌿</span><span><h2>${escapeHtml(offer.name)}</h2><p>${escapeHtml(offer.nursery)} · ${offer.count===null?'остаток уточняется':`в наличии ${offer.count}`}</p></span><strong>${moneyKopecks(offer.totalKopecks)}</strong></div><div class="spec-row">${age?`<span>${age}</span>`:''}<span>Высота <b>${escapeHtml(offer.height||'не указана')}</b></span><span>${escapeHtml(offer.container||'без контейнера')}</span><span>${escapeHtml(offer.quantity)} шт.</span></div><small class="unit-price">${moneyKopecks(offer.priceKopecks)} × ${escapeHtml(offer.quantity)}</small><span class="open-product-hint">Открыть товар и все предложения →</span></button>`);
    }
    if(!(row.allocations||[]).length)selected.push(`<article class="match-card"><div class="match-top"><span class="plant-thumb">?</span><span><h2>${escapeHtml(requestName)}</h2><p>Предложение не найдено</p></span><strong>${escapeHtml(row.shortage||row.request?.quantity||0)} шт.</strong></div></article>`);
    const catalogCards=catalogMatches.map(product=>{
      const productIndex=registerResultProduct(product);
      return `<button class="product-card result-product-card" type="button" data-result-product="${productIndex}" aria-label="Открыть товар ${escapeHtml(product.name)}"><img src="${escapeHtml(productImage(product))}" alt=""><span class="product-card-copy"><b>${escapeHtml(product.name)}</b><small>Каталог OnlyFlora</small><small>Открыть размеры и предложения питомников</small></span><span class="product-card-price">${escapeHtml(product.priceText||'уточнить')}</span></button>`;
    }).join('');
    sections.push(`<section class="result-query"><div class="result-query-heading"><span><small>Запрос</small><b>${escapeHtml(requestName)}</b></span><strong>${catalogMatches.length} ${catalogMatches.length===1?'товар':'товаров'} в каталоге</strong></div><div class="selected-offers"><h3>Выбрано для заявки</h3>${selected.join('')}</div>${catalogCards?`<div class="result-catalog"><h3>Все подходящие товары</h3><div class="result-product-list">${catalogCards}</div></div>`:''}</section>`);
  }
  document.querySelector('#matchList').innerHTML=sections.join('');
  document.querySelector('#addSelection').disabled=!plan.rows?.some(row=>row.allocations?.some(offer=>offer.productId&&offer.skuId));
  document.querySelector('#addSelection').textContent='Добавить подбор в корзину';
}

function fileDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Не удалось прочитать файл.'));reader.readAsDataURL(file)})}

async function runSelection(){
  const text=document.querySelector('#plantRequest').value.trim();
  const file=document.querySelector('#plantFile').files[0];
  if(!text&&!file)throw new Error('Добавьте список или фотографию.');
  let extracted;
  if(file){
    if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw new Error('Сейчас распознаются фотографии JPEG, PNG и WebP. PDF и Excel подключим следующим этапом.');
    if(file.size>5*1024*1024)throw new Error('Фотография должна быть меньше 5 МБ.');
    extracted=await jsonRequest('/api/egor/extract',{method:'POST',body:JSON.stringify({image:await fileDataUrl(file)})});
  }else extracted=await jsonRequest('/api/egor/parse',{method:'POST',body:JSON.stringify({text})});
  const lines=(extracted.lines||[]).map(line=>({...line,quantity:Number(line.quantity)}));
  if(!lines.length)throw new Error('Растения в запросе не найдены.');
  if(lines.some(line=>!Number.isInteger(line.quantity)||line.quantity<1))throw new Error('Укажите количество для каждой позиции, например «клён — 3 шт.».');
  return jsonRequest('/api/egor/plan',{method:'POST',body:JSON.stringify({lines,confirmed:true,strategy:'price'})});
}

const formWheel=document.querySelector('#formWheel');
formWheel.addEventListener('scroll',()=>{updateWheelAppearance();clearTimeout(wheelTimer);wheelTimer=setTimeout(settleWheel,160)},{passive:true});
formWheel.addEventListener('scrollend',settleWheel);
formWheel.addEventListener('click',event=>{const row=event.target.closest('[data-wheel-index]');if(!row)return;formWheel.scrollTo({top:Number(row.dataset.wheelIndex)*row.offsetHeight,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});clearTimeout(wheelTimer);wheelTimer=setTimeout(settleWheel,240)});
formWheel.addEventListener('keydown',event=>{
  if(!['ArrowDown','ArrowUp','Home','End','PageDown','PageUp'].includes(event.key)||!wheelValues.length)return;
  event.preventDefault();const height=formWheel.querySelector('[data-wheel-index]')?.offsetHeight||44;let index=Math.round(formWheel.scrollTop/height);
  index=event.key==='Home'?0:event.key==='End'?wheelValues.length-1:index+({ArrowDown:1,ArrowUp:-1,PageDown:3,PageUp:-3}[event.key]||0);
  index=Math.max(0,Math.min(wheelValues.length-1,index));formWheel.scrollTo({top:index*height,behavior:'auto'});settleWheel();
});
document.querySelector('#sizeOptions').addEventListener('change',event=>setOfferFilter('height',event.target.value));
document.querySelector('#supplyOptions').addEventListener('change',event=>setOfferFilter('container',event.target.value));
document.addEventListener('click',event=>{
  const allCategoriesTarget=event.target.closest('[data-all-categories]');
  if(allCategoriesTarget){showAllCategories();return}
  const routeTarget=event.target.closest('[data-route]');
  if(routeTarget){
    const query=routeTarget.dataset.query;
    if(query){catalogSearch.value=query;loadLiveProducts(query)}
    navigate(routeTarget.dataset.route);
  }
  const productTarget=event.target.closest('[data-product]');
  if(productTarget){const product=activeProducts[Number(productTarget.dataset.product)];if(product){setProduct(product);navigate('product');loadProductOffers(product)}return}
  const resultProductTarget=event.target.closest('[data-result-product]');
  if(resultProductTarget){const product=resultProducts[Number(resultProductTarget.dataset.resultProduct)];if(product){setProduct(product);navigate('product');loadProductOffers(product)}return}
  const offerTarget=event.target.closest('[data-offer]');
  if(offerTarget)selectOffer(Number(offerTarget.dataset.offer));
  const cartMinus=event.target.closest('[data-cart-minus]');
  if(cartMinus){const index=Number(cartMinus.dataset.cartMinus);if(cart[index]){cart[index].quantity-=1;if(cart[index].quantity<1)cart.splice(index,1);saveCart()}}
  const cartPlus=event.target.closest('[data-cart-plus]');
  if(cartPlus){const index=Number(cartPlus.dataset.cartPlus);const item=cart[index];if(item){const max=item.count===null?999999:Math.max(0,Math.floor(item.count));if(item.quantity>=max)return showToast('Больше нет в наличии');item.quantity+=1;saveCart()}}
  const cartRemove=event.target.closest('[data-cart-remove]');
  if(cartRemove){cart.splice(Number(cartRemove.dataset.cartRemove),1);saveCart();showToast('Товар удалён')}
  const option=event.target.closest('[data-filter]');
  if(option)setOfferFilter(option.dataset.filter,option.dataset.filterValue||'');
});

homeSearch.addEventListener('input',()=>{
  clearTimeout(searchTimer);
  const value=homeSearch.value;
  if(value.trim().length<2)return;
  searchTimer=setTimeout(()=>{catalogSearch.value=value;navigate('search');loadLiveProducts(value)},220);
});
homeSearch.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();catalogSearch.value=homeSearch.value;navigate('search');loadLiveProducts(homeSearch.value)}});
catalogSearch.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>catalogSearch.value.trim()?loadLiveProducts(catalogSearch.value):showAllCategories(),280)});
document.querySelector('#clearSearch').addEventListener('click',showAllCategories);

document.querySelector('#plantFile').addEventListener('change',event=>{
  const file=event.target.files[0];if(!file)return;
  document.querySelector('#uploadTitle').textContent=file.name;
  document.querySelector('#uploadNote').textContent=`${Math.max(1,Math.round(file.size/1024))} КБ · готов к анализу`;
});

document.querySelector('#startSelection').addEventListener('click',async()=>{
  const button=document.querySelector('#startSelection');button.disabled=true;button.textContent='Проверяю каталог…';
  try{const plan=await runSelection();await renderPlan(plan);navigate('results');showToast(plan.complete?'Подбор готов по живому каталогу':'Подобрана часть списка')}
  catch(error){showToast(error.message)}finally{button.disabled=false;button.textContent='Подобрать растения'}
});

document.querySelector('#addToCart').addEventListener('click',()=>{
  if(!selectedOffer?.productId||!selectedOffer?.skuId)return showToast('Сначала выберите предложение питомника.');
  if(addCartItem({...selectedOffer,image:productImage(selectedProduct||{})},productQuantity))showToast(`${productQuantity} шт. добавлено в корзину`);
  else showToast('Достигнут доступный остаток');
});

document.querySelector('#productQtyMinus').addEventListener('click',()=>{productQuantity=Math.max(1,productQuantity-1);updateProductPurchase()});
document.querySelector('#productQtyPlus').addEventListener('click',()=>{
  if(!selectedOffer)return;
  const max=selectedOffer.count===null||selectedOffer.count===undefined?999999:Math.max(1,Math.floor(Number(selectedOffer.count)));
  if(productQuantity>=max)return showToast('Больше нет в наличии');
  productQuantity+=1;updateProductPurchase();
});

document.querySelector('#addSelection').addEventListener('click',()=>{
  const offers=livePlan?.rows?.flatMap(row=>row.allocations||[]).filter(item=>item.productId&&item.skuId)||[];
  if(!offers.length)return showToast('Нет доступных товаров.');
  for(const offer of offers)addCartItem(offer,Number(offer.quantity||1));
  navigate('cart');showToast('Подбор добавлен в корзину');
});

function submitCartItem(item,index){
  return new Promise(resolve=>{
    const frame=document.createElement('iframe');
    const frameName=`onlyflora-cart-${Date.now()}-${index}`;
    frame.name=frameName;frame.hidden=true;frame.setAttribute('title','Синхронизация корзины');
    const form=document.createElement('form');
    form.method='post';form.action='https://onlyflora.ru/cart/add/';form.target=frameName;form.hidden=true;
    for(const [name,value] of Object.entries({product_id:item.productId,sku_id:item.skuId,quantity:item.quantity})){
      const input=document.createElement('input');input.name=name;input.value=String(value);form.append(input);
    }
    let done=false;const finish=()=>{if(done)return;done=true;setTimeout(()=>{form.remove();frame.remove();resolve()},80)};
    document.body.append(frame,form);
    setTimeout(()=>{frame.addEventListener('load',finish,{once:true});form.submit()},40);
    setTimeout(finish,4000);
  });
}

checkoutButton.addEventListener('click',async()=>{
  if(!cart.length)return;
  checkoutButton.disabled=true;checkoutButton.textContent='Передаю товары…';
  const snapshot=cart.map(item=>({...item}));
  try{
    for(let index=0;index<snapshot.length;index++)await submitCartItem(snapshot[index],index);
    cart=[];saveCart();
    location.assign('https://onlyflora.ru/order/');
  }catch{
    checkoutButton.disabled=false;checkoutButton.textContent='Перейти к оформлению';showToast('Не удалось передать корзину. Попробуйте ещё раз.');
  }
});

function updateParallax(){
  if(!hero||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const rect=hero.getBoundingClientRect();
  const shift=Math.max(-18,Math.min(18,(innerHeight*.5-rect.top-rect.height*.5)*.045));
  hero.style.setProperty('--parallax-y',`${shift.toFixed(1)}px`);
}
addEventListener('scroll',()=>requestAnimationFrame(updateParallax),{passive:true});

const installButton=document.querySelector('#installButton');
const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const isEmbedded=()=>{try{return window.top!==window.self}catch{return true}};

addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  installPrompt=event;
  installButton.hidden=false;
  installButton.classList.add('is-ready');
});

addEventListener('appinstalled',()=>{
  installPrompt=null;
  installButton.hidden=true;
  showToast('OnlyFlora установлена');
});

installButton.addEventListener('click',async()=>{
  if(isStandalone()){
    showToast('Приложение уже установлено');
    return;
  }

  if(isEmbedded()){
    const opened=window.open(`${APP_URL}?install=1`,'_blank','noopener');
    if(!opened)window.location.assign(`${APP_URL}?install=1`);
    return;
  }

  if(installPrompt){
    await installPrompt.prompt();
    const choice=await installPrompt.userChoice.catch(()=>null);
    if(choice?.outcome==='accepted')installButton.hidden=true;
    installPrompt=null;
    installButton.classList.remove('is-ready');
    return;
  }

  showToast('Подождите пару секунд и нажмите кнопку ещё раз');
  navigator.serviceWorker?.ready.then(()=>setTimeout(()=>installButton.classList.add('is-ready'),500));
});

addEventListener('popstate',()=>navigate(location.hash.slice(1)||'home',{updateHistory:false}));
decorateCategoryChildren();renderProductList([],{status:'Введите название растения'});renderCart();navigate(location.hash.slice(1)||'home',{updateHistory:false});updateParallax();
if('serviceWorker'in navigator&&!/OnlyFloraAndroid\//.test(navigator.userAgent))navigator.serviceWorker.register('/sw.js?v=46');
