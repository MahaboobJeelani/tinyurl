-- Create links table
CREATE TABLE IF NOT EXISTS links (
    id SERIAL PRIMARY KEY,
    short_code VARCHAR(10) UNIQUE NOT NULL,
    original_url TEXT NOT NULL,
    clicks INTEGER DEFAULT 0,
    last_clicked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_short_code ON links(short_code);
CREATE INDEX IF NOT EXISTS idx_created_at ON links(created_at);

-- Insert sample data for testing
INSERT INTO links (short_code, original_url) VALUES
('docs', 'https://docs.example.com'),
('google', 'https://google.com'),
('test', 'https://example.com/test')
ON CONFLICT (short_code) DO NOTHING;