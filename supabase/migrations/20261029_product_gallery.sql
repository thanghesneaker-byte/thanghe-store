-- ThangHeStore V3: add optional gallery images while keeping image_url as cover.
-- Safe to run more than once. This does not alter product status, stock, orders,
-- or rows previously soft-deleted.
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT ARRAY[]::text[];

COMMENT ON COLUMN public.products.image_urls IS
  'Additional product gallery URLs; image_url remains the selected cover. Admin supports at most 10 unique photos including the cover.';
