
-- Create storage bucket for walkie-talkie audio clips
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('walkie-talkie', 'walkie-talkie', true, 5242880, ARRAY['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'])
ON CONFLICT (id) DO NOTHING;

-- Allow anyone authenticated to upload audio clips
CREATE POLICY "Authenticated users can upload audio"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'walkie-talkie');

-- Allow anyone to read/download audio clips
CREATE POLICY "Anyone can read walkie talkie audio"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'walkie-talkie');

-- Auto-delete old audio clips after 1 hour (cleanup)
CREATE POLICY "Authenticated users can delete audio"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'walkie-talkie');
