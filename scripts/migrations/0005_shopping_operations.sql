CREATE TABLE IF NOT EXISTS shopping_operations (
  id TEXT PRIMARY KEY,
  digest TEXT NOT NULL,
  added INTEGER NOT NULL,
  merged INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shopping_operations_created_at ON shopping_operations(created_at);
