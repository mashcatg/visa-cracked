
-- Add new scoring columns to interview_reports
ALTER TABLE public.interview_reports 
  ADD COLUMN IF NOT EXISTS pronunciation_score integer,
  ADD COLUMN IF NOT EXISTS vocabulary_score integer,
  ADD COLUMN IF NOT EXISTS response_relevance_score integer,
  ADD COLUMN IF NOT EXISTS detailed_feedback jsonb;

-- Add is_public to interviews for sharing
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- Allow anonymous SELECT on public interviews
CREATE POLICY "Anyone can view public interviews"
ON public.interviews
FOR SELECT
USING (is_public = true);

-- Allow anonymous SELECT on reports for public interviews
CREATE POLICY "Anyone can view public interview reports"
ON public.interview_reports
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM interviews
  WHERE interviews.id = interview_reports.interview_id
  AND interviews.is_public = true
));

-- Allow users to delete own interviews
CREATE POLICY "Users can delete own interviews"
ON public.interviews
FOR DELETE
USING (auth.uid() = user_id);
