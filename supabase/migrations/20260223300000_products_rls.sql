-- Enable RLS on products table
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read products
CREATE POLICY "products_select" ON products FOR SELECT TO authenticated USING (true);

-- Allow all authenticated users to insert products
CREATE POLICY "products_insert" ON products FOR INSERT TO authenticated WITH CHECK (true);

-- Allow all authenticated users to update products
CREATE POLICY "products_update" ON products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Allow all authenticated users to delete products
CREATE POLICY "products_delete" ON products FOR DELETE TO authenticated USING (true);
