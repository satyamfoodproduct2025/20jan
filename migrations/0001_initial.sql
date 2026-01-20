-- Site Settings Table
CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Hero Slides Table
CREATE TABLE IF NOT EXISTS hero_slides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_url TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Gallery Images Table
CREATE TABLE IF NOT EXISTS gallery_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_url TEXT NOT NULL,
  caption TEXT,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Shifts/Timings Table
CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  icon TEXT DEFAULT 'fa-clock',
  time_slot TEXT NOT NULL,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

-- Facilities Table
CREATE TABLE IF NOT EXISTS facilities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  icon TEXT DEFAULT 'fa-check',
  title TEXT NOT NULL,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

-- Contact Form Submissions
CREATE TABLE IF NOT EXISTS contact_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  shift_preference TEXT,
  message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_read INTEGER DEFAULT 0
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_settings_key ON site_settings(key);
CREATE INDEX IF NOT EXISTS idx_slides_active ON hero_slides(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_gallery_active ON gallery_images(is_active, sort_order);
