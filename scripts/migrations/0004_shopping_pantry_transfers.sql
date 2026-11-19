-- Keep a record of each active purchase transfer, even if the pantry row is later consumed.
CREATE TABLE IF NOT EXISTS shopping_pantry_transfers (
  shopping_item_id TEXT PRIMARY KEY REFERENCES shopping_items(id) ON DELETE CASCADE,
  pantry_item_id TEXT NOT NULL,
  quantity REAL NOT NULL CHECK (quantity > 0 AND quantity <= 1000000)
);
