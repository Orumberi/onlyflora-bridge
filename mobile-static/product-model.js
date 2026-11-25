/* Display grouping only. Original Shop-Script product/SKU IDs are never replaced. */
(() => {
  const key = value => String(value || '').toLocaleLowerCase('ru-RU').replaceAll('ё','е').replace(/[‘’`"«»]/g,"'").replace(/\s+/g,' ').trim();
  const forms = {'шар':'Шар','зонт':'Зонт','шпалера':'Шпалера','арка':'Арка','крыша':'Крыша','конус':'Конус','куб':'Куб','пирамида':'Пирамида','спираль':'Спираль','штамб':'Штамб','сфера на штамбе':'Сфера на штамбе'};
  const cache = new WeakMap();
  function identity(product) {
    let name=String(product.name||'').trim(), form=product.formType||'';
    const shape=name.match(/\s*[,()]?\s*форма\s+(сфера на штамбе|шар|зонт|шпалера|арка|крыша|конус|куб|пирамида|спираль|штамб)\s*\)?\s*$/i);
    if(shape){form=forms[key(shape[1])];name=name.slice(0,shape.index)}
    const multi=name.match(/\s*[,()]?\s+(?:mst|многоствольная|многоствольный)\s*\)?\s*$/i);
    if(multi){form='Многоствольная';name=name.slice(0,multi.index)}
    const hedge=name.match(/\s*[,()]?\s+блок\s+(?:живой\s+)?изгороди\s*\)?\s*$/i);
    if(hedge){form='Блок изгороди';name=name.slice(0,hedge.index)}
    // This malformed label has been verified against the actual catalog record.
    if(String(product.id)==='22769'||/\/klen-ginnala-k-7-5-acer-ginnala\/?$/.test(product.url||''))name='Клён Гиннала';
    name=name.replace(/\s+[(]?[cсpркk]\s*-?\s*\d+(?:[.,]\d+)?(?:\s*[-–]\s*[cсpркk]?\s*\d+(?:[.,]\d+)?)?\s*[)]?$/i,'').replace(/[\s,(]+$/,'').trim();
    if(/^клен (?:татарский )?гиннала$/i.test(key(name)))name='Клён Гиннала';
    return {name:name||product.name,plantKey:key(name||product.name),form:form||'Не указана'};
  }
  function groupProducts(rows){
    if(cache.has(rows))return cache.get(rows);
    const groups=new Map();
    for(const row of rows){
      const info=identity(row);let group=groups.get(info.plantKey);
      if(!group){group={...row,name:info.name,plantKey:info.plantKey,members:[],latin:info.plantKey==='клен гиннала'?'Acer ginnala':row.latin||''};groups.set(info.plantKey,group)}
      group.members.push(...(row.members||[row]));
      if(Number(row.price)>0&&(!(Number(group.price)>0)||Number(row.price)<Number(group.price)))group.price=Number(row.price);
      if(!group.image&&row.image)group.image=row.image;
      if(key(row.name)===info.plantKey){group.id=row.id;group.url=row.url}
    }
    const result=[...groups.values()];
    for(const group of result){group.members=[...new Map(group.members.map(row=>[row.url||row.id,row])).values()];group.meta='Формы, размеры и предложения питомников'}
    cache.set(rows,result);return result;
  }
  function normalizeContainer(value){
    const text=String(value||'').trim();const match=text.match(/^[cс]\s*(\d+(?:[.,]\d+)?)$/i);
    return match?`C${Number(match[1].replace(',','.'))}`:text;
  }
  function decorateOffer(offer,source,group){
    let formType=offer.formType||identity(source).form,container=normalizeContainer(offer.container);
    let height=String(offer.height||'').trim();
    const extra=height.match(/\s*[·•]\s*([cс]\d+(?:[.,]\d+)?)\s*$/i);
    if(extra&&(!container||normalizeContainer(extra[1])===container)){container=container||normalizeContainer(extra[1]);height=height.slice(0,extra.index)}
    height=height.replace(/\b0+(\d)/g,'$1');
    if(/^блок (?:живой )?изгороди$/i.test(container)){formType='Блок изгороди';container=''}
    return {...offer,name:group.name,sourceName:source.name,formType,container,height};
  }
  function matches(offer,filters){return ['formType','height','container'].every(field=>!filters[field]||offer[field]===filters[field])}
  function supplyLabel(value){
    if(!value)return 'Не указана';
    if(/^C\d+(?:\.\d+)?$/i.test(value))return `Контейнер ${value.slice(1).replace('.',',')} л · ${value}`;
    if(/^WRB/i.test(value))return `Ком · ${value}`;
    return /^ОКС$/i.test(value)?'Открытые корни · ОКС':value;
  }
  globalThis.OnlyFloraProducts={identity,groupProducts,decorateOffer,matches,supplyLabel};
})();
