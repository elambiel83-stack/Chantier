-- MonChantier schema (PostgreSQL)
CREATE TABLE IF NOT EXISTS product (
  id TEXT PRIMARY KEY,
  name_fr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  unit TEXT NOT NULL,
  price_usd NUMERIC(10,2) NOT NULL,
  image_url TEXT
);

CREATE TABLE IF NOT EXISTS customer (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  whatsapp TEXT
);

CREATE TABLE IF NOT EXISTS customer_address (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customer(id) ON DELETE CASCADE,
  label TEXT,
  google_place_id TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customer(id),
  status TEXT CHECK (status IN ('pending','confirmed','delivering','completed','cancelled')) DEFAULT 'pending',
  total_usd NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_item (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES product(id),
  qty NUMERIC(12,3) NOT NULL,
  unit_price_usd NUMERIC(10,2) NOT NULL
);
