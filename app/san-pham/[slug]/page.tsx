import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {createClient} from '@supabase/supabase-js';
import {mapApiProduct, vnd, type Product} from '../../lib/catalog';
import ProductPurchase from './purchase';

export const dynamic='force-dynamic';

const FIELDS=`id,slug,name,brand,category,description,price_vnd,compare_at_price_vnd,image_url,product_variants(id,sku,size,color,stock_quantity)`;

async function loadProduct(slug:string):Promise<Product|null>{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return null;
  try{
    const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error}=await supabase.from('products').select(FIELDS).eq('slug',slug).eq('is_active',true).maybeSingle();
    if(error)return null;
    return mapApiProduct(data);
  }catch{return null}
}

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const {slug}=await params;
  const p=await loadProduct(slug);
  return {title:p?`${p.name} | ThangHeStore`:'Sản phẩm không tồn tại | ThangHeStore',description:p?.description};
}

export default async function ProductPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const product=await loadProduct(slug);
  if(!product)notFound();
  return <main className="productPage"><div className="wrap">
    <nav className="breadcrumbs"><a href="/">Trang chủ</a> / <a href="/#products">Sản phẩm</a> / {product.name}</nav>
    <div className="productDetailPage">
      <div className="pdPhoto">
        {product.image?<img src={product.image} alt={product.name}/>:<div style={{aspectRatio:'1',display:'grid',placeItems:'center',background:'#e6eef3',color:'#60788b'}}>Chưa có ảnh sản phẩm</div>}
        <span className="tag">{product.tag}</span>
      </div>
      <div className="pdInfo"><div className="eyebrow darkEye">{product.brand} / THANGHESTORE</div>
        <h1>{product.name}</h1><p className="pdPrice">{vnd(product.price)} {product.oldPrice!==null&&<s>{vnd(product.oldPrice)}</s>}</p>
        <p>{product.description}</p>
        <ProductPurchase product={product}/>
        <div className="pdNotes"><p>• Đây là bản thử nghiệm, chưa nhận đơn hàng thật.</p>
        <p>• Tồn kho hiển thị dựa trên dữ liệu Supabase; chưa có cơ chế giữ hàng.</p>
        <p>• <a href="/huong-dan-chon-size">Xem hướng dẫn chọn size →</a></p></div>
      </div>
    </div>
  </div></main>;
}
