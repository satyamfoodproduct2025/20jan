-- Insert default site settings
INSERT OR REPLACE INTO site_settings (key, value) VALUES 
  ('site_name', 'Drishti Digital Library'),
  ('tagline', 'Your Gateway to Knowledge'),
  ('phone', '+91 98765 43210'),
  ('email', 'info@drishtilibrary.com'),
  ('address', 'Main Road, Jamshedpur, Jharkhand - 831001'),
  ('whatsapp_link', 'https://wa.me/919876543210'),
  ('instagram_link', 'https://instagram.com/drishtilibrary'),
  ('facebook_link', 'https://facebook.com/drishtilibrary'),
  ('youtube_link', ''),
  ('google_map_embed', 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m13!1d58842.16434850721!2d86.1558223405761!3d22.815918731175654!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39f5e31989f0e2b3%3A0x4560124953c80051!2sSakchi%2C%20Jamshedpur%2C%20Jharkhand!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin'),
  ('logo_text', 'DRISHTI'),
  ('logo_highlight', 'LIBRARY'),
  ('footer_text', '© 2026 Drishti Digital Library. All Rights Reserved.'),
  ('about_text', 'Drishti Digital Library - Jamshedpur ki sabse modern self-study library. Yahan aapko milega shant vatavaran, AC facility, high-speed WiFi aur bahut kuch.');

-- Insert default hero slides
INSERT INTO hero_slides (image_url, title, subtitle, sort_order) VALUES 
  ('https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1350&q=80', 'शान्त वातावरण, बेहतर पढ़ाई', 'Jamshedpur की No.1 Digital Library में आपका स्वागत है।', 1),
  ('https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1350&q=80', 'Focus on Your Success', 'आधुनिक सुविधाओं के साथ अपनी मंज़िल को पाएं।', 2),
  ('https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1350&q=80', 'Knowledge is Power', 'Premium facilities at affordable prices.', 3);

-- Insert default gallery images
INSERT INTO gallery_images (image_url, caption, sort_order) VALUES 
  ('https://images.unsplash.com/photo-1491841573634-28140fc7ced7?auto=format&fit=crop&w=600&q=80', 'Reading Area', 1),
  ('https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80', 'Study Desks', 2),
  ('https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=600&q=80', 'Book Collection', 3),
  ('https://images.unsplash.com/photo-1568667256549-094345857637?auto=format&fit=crop&w=600&q=80', 'Computer Section', 4);

-- Insert default shifts
INSERT INTO shifts (icon, time_slot, description, sort_order) VALUES 
  ('fa-coffee', '06:00 - 10:00 AM', 'सुबह की ताज़गी', 1),
  ('fa-sun', '10:00 AM - 02:00 PM', 'दिन का जोश', 2),
  ('fa-cloud-sun', '02:00 - 06:00 PM', 'शाम की एकाग्रता', 3),
  ('fa-moon', '06:00 - 10:00 PM', 'रात का सुकून', 4);

-- Insert default facilities
INSERT INTO facilities (icon, title, description, sort_order) VALUES 
  ('fa-snowflake', 'Fully AC', 'पूरी तरह वातानुकूलित', 1),
  ('fa-wifi', 'High Speed WiFi', 'तेज़ इंटरनेट कनेक्शन', 2),
  ('fa-video', 'CCTV Surveillance', '24/7 सुरक्षा निगरानी', 3),
  ('fa-newspaper', 'Daily Newspapers', 'रोज़ाना अखबार', 4),
  ('fa-plug', 'Power Backup', 'बिजली बैकअप', 5),
  ('fa-water', 'RO Water', 'शुद्ध पानी', 6);
