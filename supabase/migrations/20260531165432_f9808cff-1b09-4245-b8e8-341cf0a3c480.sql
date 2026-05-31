INSERT INTO storage.buckets (id, name, public) VALUES ('restaurant-assets', 'restaurant-assets', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read restaurant-assets" ON storage.objects FOR SELECT USING (bucket_id = 'restaurant-assets');
CREATE POLICY "Anyone can upload restaurant-assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'restaurant-assets');
CREATE POLICY "Anyone can update restaurant-assets" ON storage.objects FOR UPDATE USING (bucket_id = 'restaurant-assets');
CREATE POLICY "Anyone can delete restaurant-assets" ON storage.objects FOR DELETE USING (bucket_id = 'restaurant-assets');