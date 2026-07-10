-- Migration v15: Add embeddings to notebook for RAG retrieval
-- Allows notebook entries to be retrieved semantically alongside summaries

ALTER TABLE notebook ADD COLUMN embedding BLOB;
ALTER TABLE notebook ADD COLUMN embedding_model TEXT;
