'use client';
import {useState} from 'react';
import type {Product} from '../../lib/catalog';
const STORAGE='thanghestore-v3-supabase-cart-v1';
type CartItem={id:string;size:string;qty:number};
export default function ProductPurchase({product}:{product:Product}){
  const [size,setSize]=useState<string|null>(null);
  const [added,setAdded]=useState(false);
  function add(){
    if(size===null)return;
    const stock=product.stockBySize[size]??0;
    if(stock<1)return;
    try{
      const raw:unknown=JSON.parse(localStorage.getItem(STORAGE)||'[]');
      const cart:CartItem[]=Array.isArray(raw)?raw.filter(x=>typeof x.id==='string'&&typeof x.size==='string'&&Number.isInteger(x.qty)&&x.qty>0):[];
      const existing=cart.find(x=>x.id===product.id&&x.size===size);
      if(existing)existing.qty=Math.min(stock,existing.qty+1);
      else cart.push({id:product.id,size,qty:1});
      localStorage.setItem(STORAGE,JSON.stringify(cart));
      setAdded(true);
    }catch{setAdded(false)}
  }
  return <div className="purchase"><strong>CHỌN SIZE EU</strong>
    <div className="sizes">{product.sizes.map(n=><button type="button" key={n} disabled={(product.stockBySize[n]??0)<1} className={size===n?'selected':''} onClick={()=>{setSize(n);setAdded(false)}}>{n}</button>)}</div>
    <p className="sizeHint">{size!==null?`Tồn kho được ghi nhận: ${product.stockBySize[size]??0} đôi`:'Vui lòng chọn size còn hàng.'}</p>
    <button className="solidButton" disabled={size===null||(size!==null&&(product.stockBySize[size]??0)<1)} onClick={add}>THÊM VÀO GIỎ DEMO</button>
    {added&&<div className="purchaseSuccess">Đã thêm size {size} vào giỏ demo. <a href="/">Về trang chủ để xem giỏ hàng →</a></div>}
  </div>;
}
