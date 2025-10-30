-- Enable pg_trgm extension for fuzzy text matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create function to find products with similar names
CREATE OR REPLACE FUNCTION find_similar_products(
  p_store_id uuid,
  p_search_name text,
  p_similarity_threshold float DEFAULT 0.3
)
RETURNS TABLE (
  id uuid,
  name text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    similarity(p.name, p_search_name) as similarity
  FROM products p
  WHERE p.store_id = p_store_id
    AND similarity(p.name, p_search_name) >= p_similarity_threshold
  ORDER BY similarity(p.name, p_search_name) DESC
  LIMIT 1;
END;
$$;