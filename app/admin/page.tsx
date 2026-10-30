 
'use client';

 
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';


type Product = {
 id: string | number;
  name: string;
  brand: string;
  price: number;
  imageUrl: string;
  galleryUrls: string[];
  description: string;
  sizes: string[];
variants?: {
  id: string;
  size: string;
  stock_quantity: number;
}[];
isActive: boolean;
  stock: number;
};

const inputStyle = {
  width: '100%',
  padding: '12px',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  fontSize: 14,
  boxSizing: 'border-box' as const,
  background: '#fff',
  color: '#10263b',
};

const cardStyle = {
  background: 'white',
  borderRadius: 16,
  padding: 24,
  border: '1px solid #dbe3ea',
};

const money = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(value);

export default function AdminPage() {
  const router = useRouter();
  const [adminStatus, setAdminStatus] =
    useState<'checking' | 'allowed'>('checking');

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('Nike');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [sizes, setSizes] = useState('39, 40, 41, 42, 43');
  const [stock, setStock] = useState('5');
  const [products, setProducts] = useState<Product[]>([]);
  const [notice, setNotice] = useState('');
  const [uploadingNewImage, setUploadingNewImage] = useState(false);
  const [uploadingProductId, setUploadingProductId] = useState<string | null>(null);
  const [galleryReady, setGalleryReady] = useState(false);

  const [adminSearch, setAdminSearch] = useState('');
  const [adminFilter, setAdminFilter] = useState<'all' | 'active' | 'hidden' | 'out'>('all');

  const activeCount = products.filter((p) => p.isActive).length;
  const hiddenCount = products.length - activeCount;
  const outOfStockCount = products.filter((p) => p.stock <= 0).length;
  const normalizeText = (value: string) =>
    value.toLocaleLowerCase('vi-VN')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd');

  const searchTerm = normalizeText(adminSearch.trim());
  const filteredProducts = products.filter((p) => {
    const matchesText = normalizeText(p.name + ' ' + p.brand).includes(searchTerm);
    const matchesStatus =
      adminFilter === 'all' ||
      (adminFilter === 'active' && p.isActive) ||
      (adminFilter === 'hidden' && !p.isActive) ||
      (adminFilter === 'out' && p.stock <= 0);
    return matchesText && matchesStatus;
  });


  useEffect(() => {
    let mounted = true;

    async function checkAdmin() {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key =
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

        if (!url || !key) {
          throw new Error('Supabase configuration missing');
        }

        const supabase = createClient(url, key);

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error('Not authenticated');
        }

        const { data: admin, error: adminError } =
          await supabase
            .from('admin_users')
            .select('user_id')
            .eq('user_id', user.id)
            .maybeSingle();

        if (adminError || !admin) {
          throw new Error('Not an administrator');
        }

        if (mounted) {
          setAdminStatus('allowed');
        }
      } catch {
        if (mounted) {
          router.replace('/admin/dang-nhap');
        }
      }
    }

    void checkAdmin();

    return () => {
      mounted = false;
    };
  }, [router]);


  useEffect(() => {
    if (adminStatus !== 'allowed') return;

    let cancelled = false;

    async function loadProducts() {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

      if (!url || !key) {
        setNotice('Thiếu cấu hình Supabase.');
        return;
      }

      const supabase = createClient(url, key);

      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          brand,
          price_vnd,
          image_url,
          description,
          
is_active,

          product_variants (
          id,
            size,
            stock_quantity
          )
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (cancelled) return;

      if (error) {
        setNotice('Lỗi tải sản phẩm: ' + error.message);
        return;
      }

      type ProductRow = {
      
       
is_active: boolean;

        id: string;
        name: string;
        brand: string;
        price_vnd: number;
        image_url: string | null;
        description: string;
        product_variants: {
         id: string;
          size: string;
          stock_quantity: number;
        }[];
      };

      const rows = (data ?? []) as unknown as ProductRow[];

      // An optional query means the admin keeps working before the one-time
      // SQL migration has been applied to the database.
      const { data: galleryRows, error: galleryError } = await supabase
        .from('products')
        .select('id, image_urls')
        .is('deleted_at', null);

      if (cancelled) return;
      setGalleryReady(!galleryError);

      const galleryById = new Map<string, string[]>(
        (galleryRows ?? []).map((item) => [
          String(item.id),
          Array.isArray(item.image_urls)
            ? item.image_urls.filter((url): url is string =>
                typeof url === 'string' && /^https?:\/\//i.test(url))
            : [],
        ])
      );

      const productsFromDB: Product[] = rows.map((row) => ({
        id: row.id,
        name: row.name,
        brand: row.brand,
        price: Number(row.price_vnd),
        imageUrl: row.image_url ?? '',
        galleryUrls: [...new Set([row.image_url ?? '', ...(galleryById.get(String(row.id)) ?? [])].filter(Boolean))].slice(0, 10),
        description: row.description ?? '',
       
isActive: row.is_active,

        sizes: (row.product_variants ?? []).map((v) => v.size),
       
variants: row.product_variants ?? [],

        stock: (row.product_variants ?? []).reduce(
          (total, v) => total + v.stock_quantity,
          0
        ),
      }));

      setProducts(productsFromDB);
    }

    void loadProducts();

    return () => {
      cancelled = true;
    };
  }, [adminStatus]);


  if (adminStatus !== 'allowed') {
    return (
      <main style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#f1f5f9',
        color: '#10263b',
      }}>
        Đang kiểm tra quyền quản trị...
      </main>
    );
  }


async function updateProductPrice(product: Product) {
  const input = window.prompt(
    `Nhập giá mới cho ${product.name} (VNĐ):`,
    String(product.price)
  );

  if (input === null) return;

  const newPrice = Number(input.trim());

  if (!Number.isSafeInteger(newPrice) || newPrice <= 0) {
    setNotice('Giá bán phải là số nguyên lớn hơn 0.');
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    setNotice('Thiếu cấu hình Supabase.');
    return;
  }

  try {
    const supabase = createClient(url, key);

    const { data: auth, error: authError } =
      await supabase.auth.getUser();

    if (authError || !auth.user) {
      throw new Error('Vui lòng đăng nhập lại.');
    }

    const { data, error } = await supabase
      .from('products')
      .update({ price_vnd: newPrice })
      .eq('id', product.id)
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Không có quyền cập nhật.');
    }

    setProducts((previous) =>
      previous.map((item) =>
        item.id === product.id
          ? { ...item, price: newPrice }
          : item
      )
    );

    setNotice(`Đã cập nhật giá ${product.name} thành ${money(newPrice)}.`);
  } catch (error) {
    setNotice(
      'Không thể cập nhật giá: ' +
      (error instanceof Error ? error.message : 'Lỗi không xác định')
    );
  }
}

async function updateVariantStock(
  product: Product,
  variant: NonNullable<Product['variants']>[number]
) {
  const input = window.prompt(
    `Nhập tồn kho mới cho ${product.name} - Size ${variant.size}:`,
    String(variant.stock_quantity)
  );

  if (input === null) return;

  if (input.trim() === '') {
    setNotice('Vui lòng nhập số lượng tồn kho.');
    return;
  }

  const newStock = Number(input);

  if (!Number.isSafeInteger(newStock) || newStock < 0) {
    setNotice('Tồn kho phải là số nguyên không âm.');
    return;
  }

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      throw new Error('Thiếu cấu hình Supabase.');
    }

    const supabase = createClient(url, key);

    const { data: auth, error: authError } =
      await supabase.auth.getUser();

    if (authError || !auth.user) {
      throw new Error('Vui lòng đăng nhập lại.');
    }

    const { data, error } = await supabase
      .from('product_variants')
      .update({ stock_quantity: newStock })
      .eq('id', variant.id)
      .eq('product_id', String(product.id))
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(
        error?.message || 'Không thể cập nhật tồn kho.'
      );
    }

    setProducts((previous) =>
      previous.map((item) => {
        if (item.id !== product.id) return item;

        const updatedVariants = (item.variants ?? []).map(
          (v) =>
            v.id === variant.id
              ? { ...v, stock_quantity: newStock }
              : v
        );

        return {
          ...item,
          variants: updatedVariants,
          stock: updatedVariants.reduce(
            (total, v) => total + v.stock_quantity,
            0
          ),
        };
      })
    );

    setNotice(
      `Đã cập nhật size ${variant.size} thành ${newStock} đôi.`
    );
  } catch (error) {
    setNotice(
      'Lỗi cập nhật tồn kho: ' +
        (error instanceof Error
          ? error.message
          : 'Lỗi không xác định')
    );
  }
}

async function updateProductDetails(product: Product) {
  const name = window.prompt('Tên sản phẩm mới:', product.name);
  if (name === null) return;

  const brand = window.prompt('Thương hiệu:', product.brand);
  if (brand === null) return;

  const description = window.prompt('Mô tả sản phẩm:', product.description);
  if (description === null) return;

  const imageUrl = window.prompt(
    'Đường dẫn ảnh sản phẩm:',
    product.imageUrl
  );
  if (imageUrl === null) return;

  if (!name.trim() || !brand.trim()) {
    setNotice('Tên và thương hiệu không được để trống.');
    return;
  }

  const image = imageUrl.trim();

  if (image && !/^https?:\/\/\S+$/i.test(image)) {
    setNotice('Đường dẫn ảnh phải bắt đầu bằng http:// hoặc https://');
    return;
  }

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      throw new Error('Thiếu cấu hình Supabase.');
    }

    const supabase = createClient(url, key);

    const { data: auth, error: authError } =
      await supabase.auth.getUser();

    if (authError || !auth.user) {
      throw new Error('Vui lòng đăng nhập lại.');
    }

    const { data: admin, error: adminError } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (adminError || !admin) {
      throw new Error('Tài khoản không có quyền quản trị.');
    }

    const { data, error } = await supabase
      .from('products')
      .update({
        name: name.trim(),
        brand: brand.trim(),
        description: description.trim(),
        image_url: image || null,
      })
      .eq('id', product.id)
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Không thể cập nhật sản phẩm.');
    }

    setProducts((previous) =>
      previous.map((item) =>
        item.id === product.id
          ? {
              ...item,
              name: name.trim(),
              brand: brand.trim(),
              description: description.trim(),
              imageUrl: image,
            }
          : item
      )
    );

    setNotice('Đã cập nhật thông tin sản phẩm thành công.');
  } catch (error) {
    setNotice(
      'Lỗi cập nhật sản phẩm: ' +
        (error instanceof Error ? error.message : 'Lỗi không xác định')
    );
  }
}

async function toggleProductVisibility(product: Product) {
  const nextActive = !product.isActive;

  const confirmed = window.confirm(
    nextActive
      ? `Hiển thị lại sản phẩm "${product.name}" trên website?`
      : `Ẩn sản phẩm "${product.name}" khỏi website?`
  );

  if (!confirmed) return;

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      throw new Error('Thiếu cấu hình Supabase.');
    }

    const supabase = createClient(url, key);

    const { data: auth, error: authError } =
      await supabase.auth.getUser();

    if (authError || !auth.user) {
      throw new Error('Vui lòng đăng nhập lại.');
    }

    const { data: admin, error: adminError } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (adminError || !admin) {
      throw new Error('Tài khoản không có quyền quản trị.');
    }

    const { data, error } = await supabase
      .from('products')
      .update({ is_active: nextActive })
      .eq('id', product.id)
      .select('id, is_active')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Không thể cập nhật trạng thái.');
    }

    setProducts((previous) =>
      previous.map((item) =>
        item.id === product.id
          ? { ...item, isActive: data.is_active }
          : item
      )
    );

    setNotice(
      nextActive
        ? 'Đã bật hiển thị sản phẩm.'
        : 'Đã ẩn sản phẩm thành công.'
    );
  } catch (error) {
    setNotice(
      'Lỗi cập nhật trạng thái: ' +
        (error instanceof Error ? error.message : 'Lỗi không xác định')
    );
  }
}


async function uploadImageFile(file: File): Promise<string> {
  const types: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  if (!types[file.type]) throw new Error('Chỉ chấp nhận ảnh JPG, PNG, WebP.');
  if (file.size === 0 || file.size > 5 * 1024 * 1024) {
    throw new Error('Dung lượng ảnh phải từ 1 byte đến 5 MB.');
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Thiếu cấu hình Supabase.');
  const supabase = createClient(url, key);
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('Vui lòng đăng nhập lại.');
  const { data: admin, error: adminError } = await supabase
    .from('admin_users').select('user_id')
    .eq('user_id', auth.user.id).maybeSingle();
  if (adminError || !admin) throw new Error('Không có quyền quản trị.');

  const filePath = auth.user.id + '/' + crypto.randomUUID() + '.' + types[file.type];
  const { data: uploaded, error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(filePath, file, {
      contentType: file.type, cacheControl: '3600', upsert: false,
    });
  if (uploadError || !uploaded) {
    throw new Error(uploadError?.message || 'Không thể tải ảnh lên.');
  }

  const { data } = supabase.storage
    .from('product-images').getPublicUrl(uploaded.path);
  if (!data.publicUrl) throw new Error('Không lấy được đường dẫn ảnh.');
  return data.publicUrl;
}

async function uploadNewProductImage(file: File) {
  setUploadingNewImage(true);
  setNotice('Đang tải ảnh giày lên Supabase...');
  try {
    const publicUrl = await uploadImageFile(file);
    setImageUrl(publicUrl);
    setNotice('Đã tải ảnh thành công. Có thể lưu sản phẩm.');
  } catch (error) {
    setNotice('Lỗi tải ảnh: ' +
      (error instanceof Error ? error.message : 'Lỗi không xác định'));
  } finally {
    setUploadingNewImage(false);
  }
}


function galleryOf(product: Product): string[] {
  return [...new Set([product.imageUrl, ...(product.galleryUrls ?? [])]
    .filter((url) => url && /^https?:\/\//i.test(url)))].slice(0, 10);
}

async function saveProductGallery(product: Product, urls: string[]) {
  if (!galleryReady) {
    throw new Error('Chưa tạo cột image_urls. Hãy chạy SQL ở bước nâng cấp bộ ảnh.');
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Thiếu cấu hình Supabase.');

  const supabase = createClient(url, key);
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('Vui lòng đăng nhập lại.');
  const { data: admin, error: adminError } = await supabase
    .from('admin_users').select('user_id')
    .eq('user_id', auth.user.id).maybeSingle();
  if (adminError || !admin) throw new Error('Không có quyền quản trị.');

  const unique = [...new Set(urls.filter(Boolean))];
  if (unique.length > 10) throw new Error('Một sản phẩm tối đa 10 ảnh.');
  const cover = unique[0] ?? null;
  const { data, error } = await supabase
    .from('products')
    .update({
      image_url: cover,
      image_urls: unique.slice(1),
    })
    .eq('id', product.id)
    .is('deleted_at', null)
    .select('id')
    .single();
  if (error || !data) {
    throw new Error(error?.message || 'Không lưu được bộ ảnh sản phẩm.');
  }

  setProducts((previous) => previous.map((item) =>
    item.id === product.id
      ? { ...item, imageUrl: cover ?? '', galleryUrls: unique }
      : item
  ));
}

async function addProductGalleryImages(product: Product, files: File[]) {
  if (!galleryReady) {
    setNotice('Bộ ảnh chưa kích hoạt. Cần chạy SQL tạo cột image_urls trong Supabase.');
    return;
  }
  const current = galleryOf(product);
  if (files.length === 0) return;
  if (current.length + files.length > 10) {
    setNotice('Tối đa 10 ảnh/sản phẩm (đã có ' + current.length + ').');
    return;
  }
  if (files.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size === 0 || file.size > 5 * 1024 * 1024)) {
    setNotice('Mỗi ảnh phải là JPG, PNG hoặc WebP và tối đa 5 MB.');
    return;
  }
  setUploadingProductId(String(product.id));
  let added = 0;
  try {
    for (const file of files) {
      setNotice('Đang tải ảnh ' + (added + 1) + '/' + files.length + '...');
      const uploadedUrl = await uploadImageFile(file);
      current.push(uploadedUrl);
      await saveProductGallery(product, current);
      added += 1;
    }
    setNotice('Đã thêm ' + added + ' ảnh cho ' + product.name + '.');
  } catch (error) {
    setNotice('Đã thêm ' + added + ' ảnh. Lỗi ảnh tiếp theo: ' +
      (error instanceof Error ? error.message : 'Không xác định'));
  } finally {
    setUploadingProductId(null);
  }
}

async function setCoverImage(product: Product, chosenUrl: string) {
  const urls = galleryOf(product);
  if (!urls.includes(chosenUrl) || urls[0] === chosenUrl) return;
  try {
    await saveProductGallery(product, [chosenUrl, ...urls.filter(u => u !== chosenUrl)]);
    setNotice('Đã đổi ảnh đại diện cho ' + product.name + '.');
  } catch (error) {
    setNotice('Lỗi chọn ảnh đại diện: ' +
      (error instanceof Error ? error.message : 'Không xác định'));
  }
}

async function removeGalleryImage(product: Product, image: string) {
  const urls = galleryOf(product);
  if (!urls.includes(image)) return;
  if (!window.confirm(
    'Gỡ ảnh này khỏi sản phẩm "' + product.name + '"?\n' +
    'Tệp gốc vẫn được giữ trong Supabase Storage để tránh mất ảnh ngoài ý muốn.'
  )) return;
  try {
    await saveProductGallery(product, urls.filter(u => u !== image));
    setNotice('Đã gỡ ảnh khỏi sản phẩm. Tệp gốc vẫn còn trong Storage.');
  } catch (error) {
    setNotice('Lỗi gỡ ảnh: ' +
      (error instanceof Error ? error.message : 'Không xác định'));
  }
}

async function deleteProduct(product: Product) {
  if (!window.confirm('Xóa mềm "' + product.name + '" khỏi cửa hàng?\n' +
      'Sản phẩm sẽ không hiện trên website, dữ liệu vẫn được giữ trong Supabase.')) {
    return;
  }
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error('Thiếu cấu hình Supabase.');
    const supabase = createClient(url, key);
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) throw new Error('Vui lòng đăng nhập lại.');
    const { data: admin, error: adminError } = await supabase
      .from('admin_users').select('user_id')
      .eq('user_id', auth.user.id).maybeSingle();
    if (adminError || !admin) throw new Error('Không có quyền quản trị.');

    const { data, error } = await supabase
      .from('products')
      .update({ is_active: false, deleted_at: new Date().toISOString() })
      .eq('id', product.id)
      .is('deleted_at', null)
      .select('id')
      .single();
    if (error || !data) {
      throw new Error(error?.message || 'Không thể xóa sản phẩm.');
    }
    setProducts(previous => previous.filter(item => item.id !== product.id));
    setNotice('Đã xóa mềm sản phẩm: ' + product.name);
  } catch (error) {
    setNotice('Lỗi xóa sản phẩm: ' +
      (error instanceof Error ? error.message : 'Lỗi không xác định'));
  }
}

async function addProduct(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if (uploadingNewImage) {
    setNotice('Vui lòng đợi tải ảnh xong.');
    return;
  }

  const priceNumber = Number(price);
  const stockNumber = Number(stock);

  if (
    !name.trim() ||
    !brand.trim() ||
    !Number.isSafeInteger(priceNumber) ||
    priceNumber <= 0 ||
    !Number.isInteger(stockNumber) ||
    stockNumber < 0
  ) {
    setNotice('Vui lòng kiểm tra tên, thương hiệu, giá và tồn kho.');
    return;
  }

  const sizeList = [
    ...new Set(
      sizes
        .split(/[,;\s]+/)
        .map((size) => size.trim())
        .filter(Boolean)
    ),
  ];

  if (sizeList.length === 0) {
    setNotice('Vui lòng nhập ít nhất một size.');
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    setNotice('Thiếu cấu hình Supabase trên Vercel.');
    return;
  }

  const image = imageUrl.trim();

  if (image && !/^https?:\/\//i.test(image)) {
    setNotice('Đường dẫn ảnh phải bắt đầu bằng https:// hoặc http://');
    return;
  }

  const slugBase =
    name
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'giay';

  const slug =
    `${slugBase}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  let createdId: string | null = null;

  try {
    setNotice('Đang lưu sản phẩm vào Supabase...');

    const supabase = createClient(url, key);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    const { data: admin, error: adminError } =
      await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

    if (adminError || !admin) {
      throw new Error('Tài khoản không có quyền quản trị.');
    }

    // Tao san pham o che do an truoc
    const { data: productRow, error: productError } =
      await supabase
        .from('products')
        .insert({
          slug,
          name: name.trim(),
          brand: brand.trim(),
          category: 'Sneaker',
          description: description.trim(),
          price_vnd: priceNumber,
          image_url: image || null,
          is_active: false,
        })
        .select('id')
        .single();

    if (productError || !productRow) {
      throw new Error(
        productError?.message || 'Không tạo được sản phẩm.'
      );
    }

    const productId = String(productRow.id);
    createdId = productId;

    // Luu size va ton kho cho tung size
    const variants = sizeList.map((size, index) => ({
      product_id: productId,
      sku: `${slug}-size-${index + 1}`,
      size,
      color: '',
      stock_quantity: stockNumber,
    }));

    const { error: variantError } =
      await supabase
        .from('product_variants')
        .insert(variants);

    if (variantError) {
      throw new Error(
        'Lỗi lưu size: ' + variantError.message
      );
    }

    // Chi kich hoat sau khi luu size thanh cong
    const { data: published, error: publishError } =
      await supabase
        .from('products')
        .update({ is_active: true })
        .eq('id', productId)
        .select('id')
        .single();

    if (publishError || !published) {
      throw new Error(
        publishError?.message || 'Không thể đăng bán sản phẩm.'
      );
    }

    setName('');
    setPrice('');
    setImageUrl('');
    setDescription('');

    setNotice(
      'Đã lưu sản phẩm vào Supabase thành công! ' +
      'Sản phẩm đã được kích hoạt trên website thử nghiệm.'
    );
  } catch (error) {
    const detail =
      error instanceof Error
        ? error.message
        : 'Lỗi không xác định.';

    setNotice(
      createdId
        ? 'Chưa hoàn tất. Sản phẩm được giữ ẩn trong Supabase. ' + detail
        : 'Không thể lưu sản phẩm. ' + detail
    );
  }
}


  return (
    <main style={{
      minHeight: '100vh',
      background: '#f1f5f9',
      color: '#10263b',
      fontFamily: 'Arial, sans-serif',
      padding: '32px 16px',
    }}>
      <div style={{ maxWidth: 1150, margin: 'auto' }}>

        <header style={{
          background: '#10263b',
          color: 'white',
          padding: 28,
          borderRadius: 16,
          marginBottom: 24,
        }}>
          <h1 style={{ margin: 0 }}>THANGHESTORE V3</h1>
          <p>Hệ thống quản trị sản phẩm giày</p>
          <span style={{
            background: '#fef3c7',
            color: '#92400e',
            padding: '7px 12px',
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 'bold',
          }}>
            QUẢN LÝ SẢN PHẨM - SUPABASE
          </span>
          <a href="/admin/don-hang" style={{
            display: 'inline-block',
            marginLeft: 12, marginTop: 12,
            color: '#10273c', background: '#44e2cc',
            padding: '10px 14px', borderRadius: 9,
            textDecoration: 'none', fontWeight: 'bold',
            fontSize: 13,
          }}>
            QUẢN LÝ ĐƠN HÀNG DEMO →
          </a>
        </header>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
          gap: 24,
          alignItems: 'start',
        }}>
          <section style={cardStyle}>
            <h2>Thêm sản phẩm giày</h2>
            <p style={{ color: '#64748b', fontSize: 14 }}>
              Nhập thông tin sản phẩm cần đăng.
            </p>

            <form onSubmit={addProduct} style={{
              display: 'grid',
              gap: 16,
            }}>
              <label>
                <strong>Tên sản phẩm</strong>
                <input
                  style={inputStyle}
                  placeholder="Ví dụ: Nike Air Force 1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>

              <label>
                <strong>Thương hiệu</strong>
                <select
                  style={inputStyle}
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                >
                  <option>Nike</option>
                  <option>Adidas</option>
                  <option>MLB</option>
                  <option>Puma</option>
                  <option>New Balance</option>
                  <option>Converse</option>
                  <option>Vans</option>
                  <option>Khác</option>
                </select>
              </label>

              <label>
                <strong>Giá bán (VNĐ)</strong>
                <input
                  style={inputStyle}
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Ví dụ: 790000"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </label>

              <label>
                <strong>Đường dẫn ảnh sản phẩm</strong>
                <input
                  style={inputStyle}
                  type="url"
                  placeholder="https://..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
              </label>

              <label>
                <strong>Tải ảnh giày trực tiếp từ máy tính</strong>
                <input
                  style={{ ...inputStyle, padding: 9 }}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploadingNewImage}
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    if (file) void uploadNewProductImage(file);
                    e.currentTarget.value = '';
                  }}
                />
                <small>
                  {uploadingNewImage ? 'Đang tải ảnh...' :
                    'JPG, PNG, WebP · tối đa 5 MB. Link ảnh sẽ được điền tự động.'}
                </small>
              </label>
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Xem trước ảnh giày"
                  style={{ width: '100%', maxHeight: 200, objectFit: 'contain' }}
                />
              )}

              <label>
                <strong>Size giày</strong>
                <input
                  style={inputStyle}
                  value={sizes}
                  onChange={(e) => setSizes(e.target.value)}
                />
                <small>Ngăn cách các size bằng dấu phẩy.</small>
              </label>

              <label>
                <strong> Số lượng tồn kho mỗi size</strong>
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  step="1"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                />
              </label>

              <label>
                <strong>Mô tả sản phẩm</strong>
                <textarea
                  style={{ ...inputStyle, minHeight: 100 }}
                  placeholder="Nhập mô tả đôi giày..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>

              <button type="submit" disabled={uploadingNewImage} style={{
                padding: 15,
                background: '#10bda9',
                color: '#082f33',
                border: 'none',
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 'bold',
                cursor: uploadingNewImage ? 'wait' : 'pointer',
                opacity: uploadingNewImage ? 0.6 : 1,
              }}>
               + LƯU SẢN PHẨM VÀO SUPABASE
              </button>

              {notice && (
                <p role="status" style={{ color: '#176b61' }}>
                  {notice}
                </p>
              )}
            </form>
          </section>

          <section style={cardStyle}>
            <h2>Danh sách sản phẩm Supabase</h2>
            <p style={{ color: '#64748b' }}>
              Tổng sản phẩm chưa xóa: {products.length}
            </p>


            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 8,
              marginBottom: 16,
            }}>
              {[
                { label: 'Đang bán', count: activeCount },
                { label: 'Đang ẩn', count: hiddenCount },
                { label: 'Hết hàng', count: outOfStockCount },
                { label: 'Tổng chưa xóa', count: products.length },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    borderRadius: 8, padding: 12,
                    background: '#f1f5f9', border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ fontSize: 13, color: '#475569' }}>{stat.label}</div>
                  <strong style={{ fontSize: 22 }}>{stat.count}</strong>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
              <label>
                <strong style={{ display: 'block', marginBottom: 6 }}>
                  Tìm sản phẩm
                </strong>
                <input
                  type="search"
                  style={inputStyle}
                  placeholder="Tên giày hoặc thương hiệu..."
                  aria-label="Tìm sản phẩm trong trang quản trị"
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                />
              </label>
              <label>
                <strong style={{ display: 'block', marginBottom: 6 }}>
                  Lọc trạng thái
                </strong>
                <select
                  style={inputStyle}
                  value={adminFilter}
                  onChange={(e) => setAdminFilter(
                    e.target.value as 'all' | 'active' | 'hidden' | 'out'
                  )}
                >
                  <option value="all">Tất cả chưa xóa</option>
                  <option value="active">Đang bán</option>
                  <option value="hidden">Đang ẩn</option>
                  <option value="out">Hết hàng (tồn kho 0)</option>
                </select>
              </label>
              <small style={{ color: '#64748b' }}>
                Hiển thị {filteredProducts.length}/{products.length} sản phẩm.
                Sản phẩm đã xóa mềm không xuất hiện ở đây.
              </small>
            </div>

            {products.length === 0 ? (
              <div style={{
                padding: 35,
                textAlign: 'center',
                background: '#f1f5f9',
                borderRadius: 12,
              }}>
                <p>Chưa có sản phẩm demo.</p>
                <small>Hãy nhập sản phẩm ở biểu mẫu bên trái.</small>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div style={{
                padding: 24, textAlign: 'center',
                background: '#f1f5f9', borderRadius: 12,
              }}>
                <p>Không tìm thấy sản phẩm phù hợp.</p>
                <button
                  type="button"
                  onClick={() => {
                    setAdminSearch('');
                    setAdminFilter('all');
                  }}
                  style={{
                    padding: '9px 16px', borderRadius: 8,
                    background: '#10263b', color: '#fff',
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  Xóa bộ lọc
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 16 }}>
                {filteredProducts.map((product) => (
                  <article key={product.id} style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: 16,
                  }}>
                    {product.imageUrl && (
                      <div style={{
                        height: 180,
                        backgroundImage: `url("${product.imageUrl}")`,
                        backgroundSize: 'contain',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        backgroundColor: '#f1f5f9',
                        borderRadius: 8,
                        marginBottom: 12,
                      }} />
                    )}


                    <div style={{ marginTop: 16 }}>
                      <strong>Bộ ảnh giày ({galleryOf(product).length}/10)</strong>
                      {!galleryReady && (
                        <p style={{ fontSize: 12, color: '#b45309' }}>
                          Chưa kích hoạt bộ ảnh: cần chạy SQL tạo cột image_urls.
                          Chức năng ảnh đại diện cũ vẫn hoạt động.
                        </p>
                      )}
                      <div style={{
                        marginTop: 10, display: 'flex',
                        flexWrap: 'wrap', gap: 10,
                      }}>
                        {galleryOf(product).map((photo, index) => (
                          <div key={photo} style={{
                            border: index === 0 ? '2px solid #0d9488' : '1px solid #cbd5e1',
                            padding: 6, borderRadius: 10, width: 103,
                            background: 'white',
                          }}>
                            <img
                              src={photo}
                              alt={product.name + ' - ảnh ' + (index + 1)}
                              style={{
                                display: 'block', width: '100%', height: 83,
                                objectFit: 'cover', borderRadius: 6,
                              }}
                            />
                            <span style={{
                              display: 'block', fontSize: 11,
                              color: '#475569', margin: '6px 0',
                            }}>
                              {index === 0 ? 'Ảnh đại diện' : 'Ảnh ' + (index + 1)}
                            </span>
                            {index !== 0 && (
                              <button
                                type="button"
                                disabled={!galleryReady || uploadingProductId !== null}
                                onClick={() => void setCoverImage(product, photo)}
                                style={{
                                  width: '100%', padding: '5px 2px',
                                  fontSize: 11, marginBottom: 4,
                                  border: 0, borderRadius: 4,
                                  background: '#d1fae5', cursor: 'pointer',
                                }}
                              >
                                Chọn bìa
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={!galleryReady || uploadingProductId !== null}
                              onClick={() => void removeGalleryImage(product, photo)}
                              style={{
                                width: '100%', padding: '5px 2px',
                                fontSize: 11,
                                border: 0, borderRadius: 4,
                                background: '#fee2e2', cursor: 'pointer',
                              }}
                            >
                              Gỡ ảnh
                            </button>
                          </div>
                        ))}
                      </div>
                      <small style={{ display: 'block', marginTop: 8, color: '#64748b' }}>
                        Để thay ảnh bìa, thêm ảnh mới rồi chọn “Chọn bìa”.
                        “Gỡ ảnh” chỉ gỡ khỏi sản phẩm, không xóa tệp gốc trong Storage.
                      </small>
                    </div>

                    <h3>{product.name}</h3>
                    <p>Thương hiệu: {product.brand}</p>
                    <p><strong>{money(product.price)}</strong></p>
                    <p>Size: {product.sizes.join(', ')}</p>
                   <p>Tổng tồn kho: {product.stock}</p>
                    <p>{product.description}</p>
                   
<button
  type="button"
  onClick={() => updateProductPrice(product)}
  style={{
    marginTop: 12,
    padding: '10px 16px',
    background: '#10263b',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 'bold',
  }}
>
  SỬA GIÁ
</button>
     
<button
  type="button"
  onClick={() => void updateProductDetails(product)}
  style={{
    marginLeft: 8,
    marginTop: 12,
    padding: '10px 16px',
    background: '#0d9488',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 'bold',
  }}
>
  SỬA THÔNG TIN
</button>
 
<button
  type="button"
  onClick={() => void toggleProductVisibility(product)}
  style={{
    marginLeft: 8,
    marginTop: 12,
    padding: '10px 16px',
    background: product.isActive ? '#dc2626' : '#16a34a',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 'bold',
  }}
>
  {product.isActive ? 'ẨN SẢN PHẨM' : 'HIỆN SẢN PHẨM'}
</button>

<label
  style={{
    display: 'inline-block', marginLeft: 8, marginTop: 12,
    padding: '10px 16px', background: '#2563eb', color: 'white',
    borderRadius: 8, fontWeight: 'bold', fontSize: 13,
    cursor: uploadingProductId === String(product.id) ? 'wait' : 'pointer',
    opacity: uploadingProductId === String(product.id) ? 0.6 : 1,
  }}
>
  {uploadingProductId === String(product.id) ? 'ĐANG TẢI ẢNH...' : 'THÊM NHIỀU ẢNH'}
  <input
    type="file"
    accept="image/jpeg,image/png,image/webp"
    multiple
    disabled={!galleryReady || uploadingProductId !== null || galleryOf(product).length >= 10}
    style={{ display: 'none' }}
    onChange={(e) => {
      const files = Array.from(e.currentTarget.files ?? []);
      if (files.length) void addProductGalleryImages(product, files);
      e.currentTarget.value = '';
    }}
  />
</label>
<button
  type="button"
  onClick={() => void deleteProduct(product)}
  style={{
    marginLeft: 8, marginTop: 12, padding: '10px 16px',
    background: '#991b1b', color: 'white', border: 'none',
    borderRadius: 8, cursor: 'pointer', fontWeight: 'bold',
  }}
>
  XÓA SẢN PHẨM
</button>

             
<div
  style={{
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  }}
>
  {(product.variants ?? []).map((variant) => (
    <button
      key={variant.id}
      type="button"
      onClick={() => void updateVariantStock(product, variant)}
      style={{
        padding: '10px 12px',
        background: '#ffffff',
        color: '#10263b',
        border: '1px solid #cbd5e1',
        borderRadius: 8,
        cursor: 'pointer',
        fontWeight: 'bold',
      }}
    >
      Size {variant.size}: {variant.stock_quantity} đôi - SỬA
    </button>
  ))}
</div>



                     
                       
                  </article>
                ))}
              </div>
            )}

            <p style={{
              marginTop: 24,
              fontSize: 13,
              color: '#64748b',
            }}>
               
Danh sách sản phẩm được tải từ Supabase.
Dữ liệu được lưu trong cơ sở dữ liệu.
Nếu chưa thấy sản phẩm mới, hãy tải lại trang.

            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
