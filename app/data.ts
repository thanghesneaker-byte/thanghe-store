export type Product = {id:number; name:string;brand:string; price:number; oldPrice:number; image:string; tag:string; sizes:number[]; description:string};
// Dữ liệu và hình ảnh mẫu phục vụ trình diễn, KHÔNG phải danh mục hàng thật.
export const products:Product[] = [
{id:1,name:'Court Classic White',brand:'Urban',price:790000,oldPrice:990000,image:'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=850&q=80',tag:'BEST SELLER',sizes:[38,39,40,41,42,43],description:'Thiết kế cổ điển dễ phối đồ, phù hợp phong cách thường ngày.'},
{id:2,name:'Retro Runner 90',brand:'Motion',price:1090000,oldPrice:1290000,image:'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=850&q=80',tag:'NEW',sizes:[39,40,41,42,43,44],description:'Phối màu nổi bật và phom dáng thể thao năng động.'},
{id:3,name:'Street Low Black',brand:'Urban',price:850000,oldPrice:1050000,image:'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=850&q=80',tag:'HOT',sizes:[36,37,38,39,40,41],description:'Một lựa chọn tối giản cho tủ đồ streetwear.'},
{id:4,name:'Everyday Canvas',brand:'Canvas',price:590000,oldPrice:750000,image:'https://images.unsplash.com/photo-1520256862855-398228c41684?w=850&q=80',tag:'SALE',sizes:[37,38,39,40,41,42],description:'Giày casual thoải mái dành cho những ngày năng động.'},
{id:5,name:'High Top Vintage',brand:'Canvas',price:920000,oldPrice:1120000,image:'https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=850&q=80',tag:'TRENDING',sizes:[38,39,40,41,42],description:'Phom cổ cao tạo điểm nhấn phong cách.'},
{id:6,name:'City Walk Neutral',brand:'Motion',price:990000,oldPrice:1190000,image:'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=850&q=80',tag:'NEW',sizes:[39,40,41,42,43],description:'Tông trung tính và đế êm cho nhịp sống thành thị.'},
];
export const vnd=(n:number)=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND'}).format(n);

export const slugify=(value:string)=>value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
