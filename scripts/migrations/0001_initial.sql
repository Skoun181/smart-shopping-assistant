CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name_de TEXT NOT NULL,
  name_en TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  name_de TEXT NOT NULL,
  name_en TEXT NOT NULL,
  dimension TEXT NOT NULL,
  factor REAL NOT NULL CHECK (factor > 0)
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id),
  name_de TEXT NOT NULL CHECK (length(trim(name_de)) BETWEEN 1 AND 120),
  name_en TEXT,
  brand TEXT,
  description TEXT,
  source TEXT NOT NULL CHECK (source IN ('catalog', 'custom')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_de ON products(name_de);
CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label_de TEXT NOT NULL,
  label_en TEXT,
  attributes TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE TABLE IF NOT EXISTS shopping_lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS shopping_items (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  variant_id TEXT REFERENCES product_variants(id) ON DELETE SET NULL,
  name_snapshot TEXT NOT NULL,
  quantity REAL NOT NULL CHECK (quantity > 0 AND quantity <= 1000000),
  unit_id TEXT NOT NULL REFERENCES units(id),
  note TEXT NOT NULL DEFAULT '',
  checked INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  checked_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_shopping_list_order ON shopping_items(list_id, checked, sort_order);
CREATE TABLE IF NOT EXISTS pantry_locations (
  id TEXT PRIMARY KEY,
  name_de TEXT NOT NULL,
  name_en TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pantry_items (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES pantry_locations(id),
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  variant_id TEXT REFERENCES product_variants(id) ON DELETE SET NULL,
  name_snapshot TEXT NOT NULL,
  quantity REAL NOT NULL CHECK (quantity > 0 AND quantity <= 1000000),
  unit_id TEXT NOT NULL REFERENCES units(id),
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pantry_location ON pantry_items(location_id);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS login_attempts (
  ip_key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  window_start INTEGER NOT NULL,
  locked_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS change_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic TEXT NOT NULL CHECK (topic IN ('shopping', 'pantry', 'catalog')),
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
