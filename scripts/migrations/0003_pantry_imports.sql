CREATE TABLE IF NOT EXISTS pantry_imports (
  id TEXT PRIMARY KEY,
  digest TEXT NOT NULL,
  item_count INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
