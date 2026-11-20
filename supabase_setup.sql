-- ========================================================
-- Supabase Schema for hama.flow Live Game Platform
-- ڕێکخستنی تەواوی خشتەکان بۆ پلاتفۆرمی hama.flow
-- ========================================================

-- 1. Codes Table (کۆدەکانی ژوور و یاری)
CREATE TABLE IF NOT EXISTS public.codes (
    code TEXT PRIMARY KEY,
    label TEXT DEFAULT 'کۆدی ژوور',
    mode TEXT DEFAULT 'custom',
    active BOOLEAN DEFAULT true,
    used_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Levels Table (ئاست و قۆناغە دروستکراوەکان)
CREATE TABLE IF NOT EXISTS public.levels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    difficulty TEXT DEFAULT 'custom',
    size INTEGER DEFAULT 7,
    dots JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Submissions Table (ئەنجامەکان و کێ یەکەم بوو)
CREATE TABLE IF NOT EXISTS public.submissions (
    id TEXT PRIMARY KEY,
    player_name TEXT NOT NULL,
    code_used TEXT NOT NULL,
    level_id TEXT NOT NULL,
    level_name TEXT,
    grid_size INTEGER DEFAULT 7,
    moves INTEGER DEFAULT 0,
    time_seconds INTEGER DEFAULT 0,
    pipe_coverage INTEGER DEFAULT 100,
    is_first BOOLEAN DEFAULT false,
    rank INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Settings Table (ڕێکخستنەکانی سیستەم و ڕاگەیاندن)
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL
);

-- ڕێگەپێدانی گشتی بۆ ئەوەی یاریزانان و ئەدمین بەبێ کێشە کار بکەن (Row Level Security)
ALTER TABLE public.codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- سیاسەتی کراوە بۆ خوێندنەوە و نووسینی خێرا لە یارییەکەدا
CREATE POLICY "Allow public read/write codes" ON public.codes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write levels" ON public.levels FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write submissions" ON public.submissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);

-- دانانی کۆدە سەرەتاییە هەمیشەییەکان
INSERT INTO public.codes (code, label, mode, active)
VALUES 
    ('FLOW2026', 'کۆدی سەرەکی پلاتفۆرم', 'all', true),
    ('HAMA', 'کۆدی سەرەکی حەمە', 'all', true)
ON CONFLICT (code) DO NOTHING;

-- چالاککردنی پەخشی ڕاستەوخۆ (Realtime) بۆ ئەوەی لە کاتی لایڤدا بە چرکە نوێ بێتەوە
ALTER PUBLICATION supabase_realtime ADD TABLE public.codes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.levels;
