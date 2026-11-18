-- Existing categories remain untouched; new user-defined categories use is_custom=1.
ALTER TABLE categories ADD COLUMN is_custom INTEGER NOT NULL DEFAULT 0 CHECK (is_custom IN (0, 1));
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_de_nocase ON categories(name_de COLLATE NOCASE);
