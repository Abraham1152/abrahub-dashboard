-- Create public storage bucket for ad creative uploads (images + videos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ad-uploads',
  'ad-uploads',
  true,
  524288000, -- 500MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/avi', 'video/mov']
)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload (dashboard is internal, no auth required)
CREATE POLICY "ad_uploads_insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'ad-uploads');

-- Allow anyone to read (public bucket for Meta API to fetch video URL)
CREATE POLICY "ad_uploads_select" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'ad-uploads');

-- Allow deletion (cleanup old uploads)
CREATE POLICY "ad_uploads_delete" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'ad-uploads');
