import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-pages'

type Bindings = {
  DB: D1Database;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic())

// ==================== PUBLIC API ====================

// Get all site settings
app.get('/api/settings', async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT key, value FROM site_settings').all()
    const settings: Record<string, string> = {}
    results?.forEach((row: any) => {
      settings[row.key] = row.value
    })
    return c.json({ success: true, data: settings })
  } catch (error) {
    return c.json({ success: false, error: 'Database error' }, 500)
  }
})

// Get active hero slides
app.get('/api/slides', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT id, image_url, title, subtitle FROM hero_slides WHERE is_active = 1 ORDER BY sort_order'
    ).all()
    return c.json({ success: true, data: results })
  } catch (error) {
    return c.json({ success: false, error: 'Database error' }, 500)
  }
})

// Get active gallery images
app.get('/api/gallery', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT id, image_url, caption FROM gallery_images WHERE is_active = 1 ORDER BY sort_order'
    ).all()
    return c.json({ success: true, data: results })
  } catch (error) {
    return c.json({ success: false, error: 'Database error' }, 500)
  }
})

// Get active shifts
app.get('/api/shifts', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT id, icon, time_slot, description FROM shifts WHERE is_active = 1 ORDER BY sort_order'
    ).all()
    return c.json({ success: true, data: results })
  } catch (error) {
    return c.json({ success: false, error: 'Database error' }, 500)
  }
})

// Get active facilities
app.get('/api/facilities', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT id, icon, title, description FROM facilities WHERE is_active = 1 ORDER BY sort_order'
    ).all()
    return c.json({ success: true, data: results })
  } catch (error) {
    return c.json({ success: false, error: 'Database error' }, 500)
  }
})

// Submit contact form
app.post('/api/contact', async (c) => {
  try {
    const { name, phone, shift_preference, message } = await c.req.json()
    if (!name || !phone) {
      return c.json({ success: false, error: 'Name and phone are required' }, 400)
    }
    await c.env.DB.prepare(
      'INSERT INTO contact_submissions (name, phone, shift_preference, message) VALUES (?, ?, ?, ?)'
    ).bind(name, phone, shift_preference || '', message || '').run()
    return c.json({ success: true, message: 'Form submitted successfully' })
  } catch (error) {
    return c.json({ success: false, error: 'Submission failed' }, 500)
  }
})

// ==================== ADMIN AUTH ====================

// Simple auth check middleware
const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401)
  }
  
  const base64Credentials = authHeader.substring(6)
  const credentials = atob(base64Credentials)
  const [username, password] = credentials.split(':')
  
  if (username !== c.env.ADMIN_USERNAME || password !== c.env.ADMIN_PASSWORD) {
    return c.json({ success: false, error: 'Invalid credentials' }, 401)
  }
  
  await next()
}

// Admin login verification
app.post('/api/admin/login', async (c) => {
  const { username, password } = await c.req.json()
  
  if (username === c.env.ADMIN_USERNAME && password === c.env.ADMIN_PASSWORD) {
    return c.json({ success: true, message: 'Login successful' })
  }
  return c.json({ success: false, error: 'Invalid credentials' }, 401)
})

// ==================== ADMIN API ====================

// Get all settings (admin)
app.get('/api/admin/settings', authMiddleware, async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM site_settings').all()
    return c.json({ success: true, data: results })
  } catch (error) {
    return c.json({ success: false, error: 'Database error' }, 500)
  }
})

// Update setting
app.put('/api/admin/settings/:key', authMiddleware, async (c) => {
  try {
    const key = c.req.param('key')
    const { value } = await c.req.json()
    await c.env.DB.prepare(
      'INSERT OR REPLACE INTO site_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
    ).bind(key, value).run()
    return c.json({ success: true, message: 'Setting updated' })
  } catch (error) {
    return c.json({ success: false, error: 'Update failed' }, 500)
  }
})

// Get all slides (admin)
app.get('/api/admin/slides', authMiddleware, async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM hero_slides ORDER BY sort_order').all()
    return c.json({ success: true, data: results })
  } catch (error) {
    return c.json({ success: false, error: 'Database error' }, 500)
  }
})

// Add slide
app.post('/api/admin/slides', authMiddleware, async (c) => {
  try {
    const { image_url, title, subtitle, sort_order } = await c.req.json()
    await c.env.DB.prepare(
      'INSERT INTO hero_slides (image_url, title, subtitle, sort_order) VALUES (?, ?, ?, ?)'
    ).bind(image_url, title, subtitle || '', sort_order || 0).run()
    return c.json({ success: true, message: 'Slide added' })
  } catch (error) {
    return c.json({ success: false, error: 'Add failed' }, 500)
  }
})

// Update slide
app.put('/api/admin/slides/:id', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    const { image_url, title, subtitle, is_active, sort_order } = await c.req.json()
    await c.env.DB.prepare(
      'UPDATE hero_slides SET image_url = ?, title = ?, subtitle = ?, is_active = ?, sort_order = ? WHERE id = ?'
    ).bind(image_url, title, subtitle, is_active ? 1 : 0, sort_order, id).run()
    return c.json({ success: true, message: 'Slide updated' })
  } catch (error) {
    return c.json({ success: false, error: 'Update failed' }, 500)
  }
})

// Delete slide
app.delete('/api/admin/slides/:id', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    await c.env.DB.prepare('DELETE FROM hero_slides WHERE id = ?').bind(id).run()
    return c.json({ success: true, message: 'Slide deleted' })
  } catch (error) {
    return c.json({ success: false, error: 'Delete failed' }, 500)
  }
})

// Get all gallery images (admin)
app.get('/api/admin/gallery', authMiddleware, async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM gallery_images ORDER BY sort_order').all()
    return c.json({ success: true, data: results })
  } catch (error) {
    return c.json({ success: false, error: 'Database error' }, 500)
  }
})

// Add gallery image
app.post('/api/admin/gallery', authMiddleware, async (c) => {
  try {
    const { image_url, caption, sort_order } = await c.req.json()
    await c.env.DB.prepare(
      'INSERT INTO gallery_images (image_url, caption, sort_order) VALUES (?, ?, ?)'
    ).bind(image_url, caption || '', sort_order || 0).run()
    return c.json({ success: true, message: 'Image added' })
  } catch (error) {
    return c.json({ success: false, error: 'Add failed' }, 500)
  }
})

// Update gallery image
app.put('/api/admin/gallery/:id', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    const { image_url, caption, is_active, sort_order } = await c.req.json()
    await c.env.DB.prepare(
      'UPDATE gallery_images SET image_url = ?, caption = ?, is_active = ?, sort_order = ? WHERE id = ?'
    ).bind(image_url, caption, is_active ? 1 : 0, sort_order, id).run()
    return c.json({ success: true, message: 'Image updated' })
  } catch (error) {
    return c.json({ success: false, error: 'Update failed' }, 500)
  }
})

// Delete gallery image
app.delete('/api/admin/gallery/:id', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    await c.env.DB.prepare('DELETE FROM gallery_images WHERE id = ?').bind(id).run()
    return c.json({ success: true, message: 'Image deleted' })
  } catch (error) {
    return c.json({ success: false, error: 'Delete failed' }, 500)
  }
})

// Get all shifts (admin)
app.get('/api/admin/shifts', authMiddleware, async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM shifts ORDER BY sort_order').all()
    return c.json({ success: true, data: results })
  } catch (error) {
    return c.json({ success: false, error: 'Database error' }, 500)
  }
})

// Add shift
app.post('/api/admin/shifts', authMiddleware, async (c) => {
  try {
    const { icon, time_slot, description, sort_order } = await c.req.json()
    await c.env.DB.prepare(
      'INSERT INTO shifts (icon, time_slot, description, sort_order) VALUES (?, ?, ?, ?)'
    ).bind(icon || 'fa-clock', time_slot, description || '', sort_order || 0).run()
    return c.json({ success: true, message: 'Shift added' })
  } catch (error) {
    return c.json({ success: false, error: 'Add failed' }, 500)
  }
})

// Update shift
app.put('/api/admin/shifts/:id', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    const { icon, time_slot, description, is_active, sort_order } = await c.req.json()
    await c.env.DB.prepare(
      'UPDATE shifts SET icon = ?, time_slot = ?, description = ?, is_active = ?, sort_order = ? WHERE id = ?'
    ).bind(icon, time_slot, description, is_active ? 1 : 0, sort_order, id).run()
    return c.json({ success: true, message: 'Shift updated' })
  } catch (error) {
    return c.json({ success: false, error: 'Update failed' }, 500)
  }
})

// Delete shift
app.delete('/api/admin/shifts/:id', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    await c.env.DB.prepare('DELETE FROM shifts WHERE id = ?').bind(id).run()
    return c.json({ success: true, message: 'Shift deleted' })
  } catch (error) {
    return c.json({ success: false, error: 'Delete failed' }, 500)
  }
})

// Get all facilities (admin)
app.get('/api/admin/facilities', authMiddleware, async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM facilities ORDER BY sort_order').all()
    return c.json({ success: true, data: results })
  } catch (error) {
    return c.json({ success: false, error: 'Database error' }, 500)
  }
})

// Add facility
app.post('/api/admin/facilities', authMiddleware, async (c) => {
  try {
    const { icon, title, description, sort_order } = await c.req.json()
    await c.env.DB.prepare(
      'INSERT INTO facilities (icon, title, description, sort_order) VALUES (?, ?, ?, ?)'
    ).bind(icon || 'fa-check', title, description || '', sort_order || 0).run()
    return c.json({ success: true, message: 'Facility added' })
  } catch (error) {
    return c.json({ success: false, error: 'Add failed' }, 500)
  }
})

// Update facility
app.put('/api/admin/facilities/:id', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    const { icon, title, description, is_active, sort_order } = await c.req.json()
    await c.env.DB.prepare(
      'UPDATE facilities SET icon = ?, title = ?, description = ?, is_active = ?, sort_order = ? WHERE id = ?'
    ).bind(icon, title, description, is_active ? 1 : 0, sort_order, id).run()
    return c.json({ success: true, message: 'Facility updated' })
  } catch (error) {
    return c.json({ success: false, error: 'Update failed' }, 500)
  }
})

// Delete facility
app.delete('/api/admin/facilities/:id', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    await c.env.DB.prepare('DELETE FROM facilities WHERE id = ?').bind(id).run()
    return c.json({ success: true, message: 'Facility deleted' })
  } catch (error) {
    return c.json({ success: false, error: 'Delete failed' }, 500)
  }
})

// Get contact submissions (admin)
app.get('/api/admin/contacts', authMiddleware, async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM contact_submissions ORDER BY created_at DESC'
    ).all()
    return c.json({ success: true, data: results })
  } catch (error) {
    return c.json({ success: false, error: 'Database error' }, 500)
  }
})

// Mark contact as read
app.put('/api/admin/contacts/:id/read', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    await c.env.DB.prepare('UPDATE contact_submissions SET is_read = 1 WHERE id = ?').bind(id).run()
    return c.json({ success: true, message: 'Marked as read' })
  } catch (error) {
    return c.json({ success: false, error: 'Update failed' }, 500)
  }
})

// Delete contact
app.delete('/api/admin/contacts/:id', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    await c.env.DB.prepare('DELETE FROM contact_submissions WHERE id = ?').bind(id).run()
    return c.json({ success: true, message: 'Contact deleted' })
  } catch (error) {
    return c.json({ success: false, error: 'Delete failed' }, 500)
  }
})

// ==================== HTML PAGES ====================

// Main website
app.get('/', async (c) => {
  return c.html(getMainHTML())
})

// Admin panel
app.get('/admin', async (c) => {
  return c.html(getAdminHTML())
})

// Terms and Conditions
app.get('/terms', async (c) => {
  return c.html(getTermsHTML())
})

// Privacy Policy
app.get('/privacy', async (c) => {
  return c.html(getPrivacyHTML())
})

// Refund Policy
app.get('/refund', async (c) => {
  return c.html(getRefundHTML())
})

// About Us
app.get('/about', async (c) => {
  return c.html(getAboutHTML())
})

// Contact Us
app.get('/contact', async (c) => {
  return c.html(getContactHTML())
})

// ==================== HTML TEMPLATES ====================

function getMainHTML() {
  return `<!DOCTYPE html>
<html lang="hi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Drishti Digital Library | Self Study Center Jamshedpur</title>
    <meta name="description" content="Drishti Digital Library - Jamshedpur's premium self-study center with AC, WiFi, and modern facilities. Best library for competitive exam preparation.">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <style>
        :root {
            --primary: #0f172a;
            --primary-light: #1e293b;
            --accent: #f59e0b;
            --accent-dark: #d97706;
            --accent-light: #fbbf24;
            --light: #f8fafc;
            --white: #ffffff;
            --gray: #64748b;
            --gray-light: #e2e8f0;
            --whatsapp: #25d366;
            --instagram: #e1306c;
            --facebook: #1877f2;
            --youtube: #ff0000;
            --gradient: linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%);
            --shadow: 0 10px 40px rgba(0,0,0,0.1);
            --shadow-lg: 0 25px 50px rgba(0,0,0,0.15);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Outfit', sans-serif; 
            background: var(--light); 
            color: var(--primary); 
            overflow-x: hidden;
            line-height: 1.6;
        }

        /* Animations */
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        
        .reveal { opacity: 0; transform: translateY(50px); transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1); }
        .reveal.active { opacity: 1; transform: translateY(0); }

        /* Navigation */
        nav {
            background: rgba(255, 255, 255, 0.98);
            backdrop-filter: blur(20px);
            padding: 15px 5%;
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: fixed;
            width: 100%;
            top: 0;
            z-index: 1000;
            box-shadow: 0 2px 20px rgba(0,0,0,0.08);
            transition: all 0.3s ease;
        }
        nav.scrolled { padding: 10px 5%; box-shadow: 0 4px 30px rgba(0,0,0,0.12); }
        .logo { font-size: 1.8rem; font-weight: 800; letter-spacing: -1px; }
        .logo span { background: var(--gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .nav-links { display: flex; gap: 30px; align-items: center; }
        .nav-links a { 
            text-decoration: none; 
            color: var(--primary); 
            font-weight: 500;
            position: relative;
            transition: color 0.3s;
        }
        .nav-links a:hover { color: var(--accent); }
        .nav-links a::after {
            content: '';
            position: absolute;
            bottom: -5px;
            left: 0;
            width: 0;
            height: 2px;
            background: var(--gradient);
            transition: width 0.3s;
        }
        .nav-links a:hover::after { width: 100%; }
        .nav-call {
            background: var(--gradient);
            color: white;
            padding: 12px 25px;
            border-radius: 50px;
            text-decoration: none;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s;
            box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4);
        }
        .nav-call:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(245, 158, 11, 0.5); }
        .mobile-menu { display: none; font-size: 1.5rem; cursor: pointer; }

        /* Hero Slider */
        .hero { position: relative; width: 100%; height: 100vh; overflow: hidden; margin-top: 70px; }
        .slide {
            position: absolute;
            width: 100%;
            height: 100%;
            opacity: 0;
            transition: opacity 1.5s ease-in-out;
            background-size: cover;
            background-position: center;
        }
        .slide.active { opacity: 1; }
        .slide-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(15, 23, 42, 0.6) 100%);
        }
        .slide-content {
            position: relative;
            z-index: 2;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            color: white;
            padding: 0 20px;
        }
        .slide-content h1 {
            font-size: 4rem;
            font-weight: 800;
            margin-bottom: 20px;
            text-shadow: 2px 2px 10px rgba(0,0,0,0.3);
            animation: fadeInUp 1s ease;
        }
        .slide-content p {
            font-size: 1.4rem;
            opacity: 0.95;
            max-width: 600px;
            animation: fadeInUp 1s ease 0.2s both;
        }
        .slide-indicators {
            position: absolute;
            bottom: 40px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 12px;
            z-index: 10;
        }
        .indicator {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: rgba(255,255,255,0.5);
            cursor: pointer;
            transition: all 0.3s;
        }
        .indicator.active { background: var(--accent); transform: scale(1.3); }
        .hero-cta {
            margin-top: 40px;
            display: flex;
            gap: 20px;
            animation: fadeInUp 1s ease 0.4s both;
        }
        .btn-primary {
            background: var(--gradient);
            color: white;
            padding: 16px 40px;
            border-radius: 50px;
            text-decoration: none;
            font-weight: 600;
            font-size: 1.1rem;
            transition: all 0.3s;
            box-shadow: 0 4px 20px rgba(245, 158, 11, 0.4);
        }
        .btn-primary:hover { transform: translateY(-3px); box-shadow: 0 8px 30px rgba(245, 158, 11, 0.5); }
        .btn-secondary {
            background: transparent;
            color: white;
            padding: 16px 40px;
            border-radius: 50px;
            text-decoration: none;
            font-weight: 600;
            font-size: 1.1rem;
            border: 2px solid white;
            transition: all 0.3s;
        }
        .btn-secondary:hover { background: white; color: var(--primary); }

        /* Section Styles */
        .section { padding: 100px 5%; }
        .section-header {
            text-align: center;
            margin-bottom: 60px;
        }
        .section-header h2 {
            font-size: 2.8rem;
            font-weight: 800;
            margin-bottom: 15px;
            position: relative;
            display: inline-block;
        }
        .section-header h2::after {
            content: '';
            position: absolute;
            bottom: -10px;
            left: 50%;
            transform: translateX(-50%);
            width: 80px;
            height: 4px;
            background: var(--gradient);
            border-radius: 2px;
        }
        .section-header p {
            color: var(--gray);
            font-size: 1.1rem;
            max-width: 600px;
            margin: 20px auto 0;
        }

        /* Shifts Section */
        .shifts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 30px;
        }
        .shift-card {
            background: white;
            padding: 40px 30px;
            border-radius: 20px;
            text-align: center;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: var(--shadow);
            position: relative;
            overflow: hidden;
        }
        .shift-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 4px;
            background: var(--gradient);
        }
        .shift-card:hover {
            transform: translateY(-10px);
            box-shadow: var(--shadow-lg);
        }
        .shift-card i {
            font-size: 3rem;
            background: var(--gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 20px;
        }
        .shift-card h3 {
            font-size: 1.5rem;
            margin-bottom: 10px;
            font-weight: 700;
        }
        .shift-card p { color: var(--gray); }

        /* Facilities Section */
        .facilities { background: var(--primary); }
        .facilities .section-header h2 { color: white; }
        .facilities .section-header p { color: rgba(255,255,255,0.7); }
        .facilities-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 30px;
        }
        .facility-card {
            background: rgba(255,255,255,0.05);
            backdrop-filter: blur(10px);
            padding: 35px 25px;
            border-radius: 20px;
            text-align: center;
            transition: all 0.4s;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .facility-card:hover {
            background: rgba(255,255,255,0.1);
            transform: translateY(-5px);
        }
        .facility-card i {
            font-size: 2.5rem;
            color: var(--accent);
            margin-bottom: 15px;
        }
        .facility-card h3 {
            color: white;
            font-size: 1.2rem;
            margin-bottom: 8px;
        }
        .facility-card p {
            color: rgba(255,255,255,0.6);
            font-size: 0.95rem;
        }

        /* Gallery Section */
        .gallery-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }
        .gallery-item {
            position: relative;
            height: 280px;
            border-radius: 20px;
            overflow: hidden;
            cursor: pointer;
            box-shadow: var(--shadow);
        }
        .gallery-item img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .gallery-item::after {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%);
            opacity: 0;
            transition: opacity 0.3s;
        }
        .gallery-item:hover img { transform: scale(1.1); }
        .gallery-item:hover::after { opacity: 1; }
        .gallery-item span {
            position: absolute;
            bottom: 20px;
            left: 20px;
            color: white;
            font-weight: 600;
            z-index: 2;
            opacity: 0;
            transform: translateY(20px);
            transition: all 0.3s;
        }
        .gallery-item:hover span { opacity: 1; transform: translateY(0); }

        /* Contact Form Section */
        .contact-section { background: linear-gradient(135deg, var(--light) 0%, #e2e8f0 100%); }
        .contact-container {
            display: grid;
            grid-template-columns: 1fr 1.2fr;
            background: white;
            border-radius: 30px;
            overflow: hidden;
            box-shadow: var(--shadow-lg);
        }
        .contact-info {
            background: var(--gradient);
            padding: 50px;
            color: white;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        .contact-info h2 {
            font-size: 2.2rem;
            margin-bottom: 20px;
        }
        .contact-info p {
            opacity: 0.9;
            margin-bottom: 30px;
            line-height: 1.8;
        }
        .contact-features {
            list-style: none;
        }
        .contact-features li {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 15px;
            font-weight: 500;
        }
        .contact-features i {
            width: 30px;
            height: 30px;
            background: rgba(255,255,255,0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .contact-form {
            padding: 50px;
        }
        .contact-form h3 {
            font-size: 1.8rem;
            margin-bottom: 30px;
        }
        .form-group {
            margin-bottom: 25px;
        }
        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: var(--primary);
        }
        .form-group input,
        .form-group select,
        .form-group textarea {
            width: 100%;
            padding: 15px 20px;
            border: 2px solid var(--gray-light);
            border-radius: 12px;
            font-family: inherit;
            font-size: 1rem;
            transition: all 0.3s;
        }
        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: var(--accent);
            box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.1);
        }
        .btn-submit {
            width: 100%;
            padding: 18px;
            background: var(--gradient);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 1.1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4);
        }
        .btn-submit:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(245, 158, 11, 0.5);
        }

        /* Map Section */
        .map-section { padding: 0 5% 0; }
        .map-container {
            border-radius: 30px 30px 0 0;
            overflow: hidden;
            box-shadow: 0 -10px 40px rgba(0,0,0,0.1);
        }
        .map-container iframe {
            width: 100%;
            height: 400px;
            border: none;
        }

        /* WhatsApp Float */
        .whatsapp-float {
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 65px;
            height: 65px;
            background: var(--whatsapp);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 35px;
            box-shadow: 0 4px 20px rgba(37, 211, 102, 0.4);
            z-index: 999;
            animation: pulse 2s infinite;
            text-decoration: none;
            transition: all 0.3s;
        }
        .whatsapp-float:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 30px rgba(37, 211, 102, 0.5);
        }

        /* Footer */
        footer {
            background: var(--primary);
            color: white;
            padding: 80px 5% 30px;
        }
        .footer-grid {
            display: grid;
            grid-template-columns: 2fr 1fr 1fr 1fr;
            gap: 50px;
            margin-bottom: 50px;
        }
        .footer-brand h3 {
            font-size: 2rem;
            margin-bottom: 20px;
        }
        .footer-brand h3 span { color: var(--accent); }
        .footer-brand p {
            color: rgba(255,255,255,0.7);
            line-height: 1.8;
            margin-bottom: 25px;
        }
        .footer-social {
            display: flex;
            gap: 15px;
        }
        .footer-social a {
            width: 45px;
            height: 45px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.3rem;
            transition: all 0.3s;
        }
        .footer-social .wa { background: var(--whatsapp); color: white; }
        .footer-social .ig { background: var(--instagram); color: white; }
        .footer-social .fb { background: var(--facebook); color: white; }
        .footer-social .yt { background: var(--youtube); color: white; }
        .footer-social a:hover { transform: translateY(-5px) scale(1.1); }
        .footer-links h4 {
            font-size: 1.2rem;
            margin-bottom: 25px;
            position: relative;
        }
        .footer-links h4::after {
            content: '';
            position: absolute;
            bottom: -8px;
            left: 0;
            width: 40px;
            height: 3px;
            background: var(--accent);
        }
        .footer-links ul {
            list-style: none;
        }
        .footer-links li {
            margin-bottom: 12px;
        }
        .footer-links a {
            color: rgba(255,255,255,0.7);
            text-decoration: none;
            transition: all 0.3s;
        }
        .footer-links a:hover { color: var(--accent); padding-left: 5px; }
        .footer-contact p {
            display: flex;
            align-items: center;
            gap: 10px;
            color: rgba(255,255,255,0.7);
            margin-bottom: 15px;
        }
        .footer-contact i { color: var(--accent); }
        .footer-bottom {
            border-top: 1px solid rgba(255,255,255,0.1);
            padding-top: 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 20px;
        }
        .footer-bottom p { color: rgba(255,255,255,0.6); }
        .footer-bottom a { color: rgba(255,255,255,0.6); text-decoration: none; margin-left: 20px; }
        .footer-bottom a:hover { color: var(--accent); }

        /* Responsive */
        @media (max-width: 992px) {
            .footer-grid { grid-template-columns: 1fr 1fr; }
            .contact-container { grid-template-columns: 1fr; }
        }
        @media (max-width: 768px) {
            .nav-links { display: none; }
            .mobile-menu { display: block; }
            .hero { height: 80vh; margin-top: 60px; }
            .slide-content h1 { font-size: 2.5rem; }
            .slide-content p { font-size: 1.1rem; }
            .hero-cta { flex-direction: column; gap: 15px; }
            .section { padding: 60px 5%; }
            .section-header h2 { font-size: 2rem; }
            .footer-grid { grid-template-columns: 1fr; }
            .footer-bottom { flex-direction: column; text-align: center; }
        }
    </style>
</head>
<body>
    <!-- WhatsApp Float -->
    <a href="#" class="whatsapp-float" id="whatsappFloat" target="_blank">
        <i class="fab fa-whatsapp"></i>
    </a>

    <!-- Navigation -->
    <nav id="navbar">
        <div class="logo" id="logoText">DRISHTI<span>LIBRARY</span></div>
        <div class="nav-links">
            <a href="#shifts">Shifts</a>
            <a href="#facilities">Facilities</a>
            <a href="#gallery">Gallery</a>
            <a href="#contact">Contact</a>
            <a href="/admin">Admin</a>
        </div>
        <a href="tel:+919876543210" class="nav-call" id="navPhone">
            <i class="fas fa-phone"></i> Call Now
        </a>
        <div class="mobile-menu" onclick="toggleMenu()">
            <i class="fas fa-bars"></i>
        </div>
    </nav>

    <!-- Hero Section -->
    <section class="hero" id="heroSlider">
        <!-- Slides will be loaded dynamically -->
        <div class="slide-indicators" id="slideIndicators"></div>
    </section>

    <!-- Shifts Section -->
    <section class="section" id="shifts">
        <div class="section-header reveal">
            <h2>हमारी शिफ्ट्स</h2>
            <p>अपने समय के अनुसार शिफ्ट चुनें और पढ़ाई में मन लगाएं</p>
        </div>
        <div class="shifts-grid" id="shiftsGrid">
            <!-- Shifts will be loaded dynamically -->
        </div>
    </section>

    <!-- Facilities Section -->
    <section class="section facilities" id="facilities">
        <div class="section-header reveal">
            <h2>प्रीमियम सुविधाएँ</h2>
            <p>आधुनिक सुविधाओं से लैस हमारी लाइब्रेरी</p>
        </div>
        <div class="facilities-grid" id="facilitiesGrid">
            <!-- Facilities will be loaded dynamically -->
        </div>
    </section>

    <!-- Gallery Section -->
    <section class="section" id="gallery">
        <div class="section-header reveal">
            <h2>लाइब्रेरी की झलक</h2>
            <p>हमारी लाइब्रेरी की कुछ तस्वीरें देखें</p>
        </div>
        <div class="gallery-grid" id="galleryGrid">
            <!-- Gallery will be loaded dynamically -->
        </div>
    </section>

    <!-- Contact Section -->
    <section class="section contact-section" id="contact">
        <div class="section-header reveal">
            <h2>आज ही जुड़ें</h2>
            <p>फॉर्म भरें और हम आपसे जल्द संपर्क करेंगे</p>
        </div>
        <div class="contact-container reveal">
            <div class="contact-info">
                <h2>क्यों चुनें Drishti Library?</h2>
                <p>हम आपको बेहतरीन पढ़ाई का माहौल देने के लिए प्रतिबद्ध हैं। यहाँ आपको मिलेगा:</p>
                <ul class="contact-features">
                    <li><i class="fas fa-check"></i> Low Price Guarantee</li>
                    <li><i class="fas fa-check"></i> Permanent Seat Option</li>
                    <li><i class="fas fa-check"></i> 24/7 CCTV Surveillance</li>
                    <li><i class="fas fa-check"></i> Flexible Timings</li>
                    <li><i class="fas fa-check"></i> Clean & Hygienic Environment</li>
                </ul>
            </div>
            <div class="contact-form">
                <h3>Book Your Seat</h3>
                <form id="contactForm">
                    <div class="form-group">
                        <label>आपका नाम *</label>
                        <input type="text" id="formName" placeholder="Enter your full name" required>
                    </div>
                    <div class="form-group">
                        <label>मोबाइल नंबर *</label>
                        <input type="tel" id="formPhone" placeholder="Enter your mobile number" required>
                    </div>
                    <div class="form-group">
                        <label>पसंदीदा शिफ्ट</label>
                        <select id="formShift">
                            <option value="">Select Shift</option>
                            <option value="Morning (06-10 AM)">Morning (06-10 AM)</option>
                            <option value="Noon (10-02 PM)">Noon (10-02 PM)</option>
                            <option value="Evening (02-06 PM)">Evening (02-06 PM)</option>
                            <option value="Night (06-10 PM)">Night (06-10 PM)</option>
                            <option value="Full Day">Full Day Session</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>संदेश (Optional)</label>
                        <textarea id="formMessage" rows="3" placeholder="Any specific requirements..."></textarea>
                    </div>
                    <button type="submit" class="btn-submit">
                        <i class="fas fa-paper-plane"></i> Submit Enquiry
                    </button>
                </form>
            </div>
        </div>
    </section>

    <!-- Map Section -->
    <section class="map-section reveal">
        <div class="map-container" id="mapContainer">
            <!-- Map will be loaded dynamically -->
        </div>
    </section>

    <!-- Footer -->
    <footer>
        <div class="footer-grid">
            <div class="footer-brand">
                <h3 id="footerLogo">DRISHTI<span>LIBRARY</span></h3>
                <p id="footerAbout">Drishti Digital Library - Jamshedpur ki sabse modern self-study library.</p>
                <div class="footer-social" id="socialLinks">
                    <!-- Social links will be loaded dynamically -->
                </div>
            </div>
            <div class="footer-links">
                <h4>Quick Links</h4>
                <ul>
                    <li><a href="#shifts">Shifts</a></li>
                    <li><a href="#facilities">Facilities</a></li>
                    <li><a href="#gallery">Gallery</a></li>
                    <li><a href="#contact">Contact</a></li>
                </ul>
            </div>
            <div class="footer-links">
                <h4>Legal</h4>
                <ul>
                    <li><a href="/terms">Terms & Conditions</a></li>
                    <li><a href="/privacy">Privacy Policy</a></li>
                    <li><a href="/refund">Refund Policy</a></li>
                    <li><a href="/about">About Us</a></li>
                </ul>
            </div>
            <div class="footer-links footer-contact">
                <h4>Contact Us</h4>
                <p><i class="fas fa-map-marker-alt"></i> <span id="footerAddress">Main Road, Jamshedpur</span></p>
                <p><i class="fas fa-phone"></i> <span id="footerPhone">+91 98765 43210</span></p>
                <p><i class="fas fa-envelope"></i> <span id="footerEmail">info@drishtilibrary.com</span></p>
            </div>
        </div>
        <div class="footer-bottom">
            <p id="footerCopyright">© 2026 Drishti Digital Library. All Rights Reserved.</p>
            <div>
                <a href="/terms">Terms</a>
                <a href="/privacy">Privacy</a>
                <a href="/refund">Refund</a>
            </div>
        </div>
    </footer>

    <script>
        // Global data
        let siteSettings = {};
        let slides = [];
        let currentSlide = 0;

        // Initialize app
        document.addEventListener('DOMContentLoaded', async () => {
            await loadAllData();
            initSlider();
            initRevealAnimation();
            initNavScroll();
        });

        // Load all data from API
        async function loadAllData() {
            try {
                const [settingsRes, slidesRes, galleryRes, shiftsRes, facilitiesRes] = await Promise.all([
                    fetch('/api/settings'),
                    fetch('/api/slides'),
                    fetch('/api/gallery'),
                    fetch('/api/shifts'),
                    fetch('/api/facilities')
                ]);

                const settingsData = await settingsRes.json();
                const slidesData = await slidesRes.json();
                const galleryData = await galleryRes.json();
                const shiftsData = await shiftsRes.json();
                const facilitiesData = await facilitiesRes.json();

                if (settingsData.success) {
                    siteSettings = settingsData.data;
                    applySettings();
                }
                if (slidesData.success) {
                    slides = slidesData.data;
                    renderSlides();
                }
                if (galleryData.success) renderGallery(galleryData.data);
                if (shiftsData.success) renderShifts(shiftsData.data);
                if (facilitiesData.success) renderFacilities(facilitiesData.data);
            } catch (error) {
                console.error('Error loading data:', error);
            }
        }

        // Apply settings to page
        function applySettings() {
            document.getElementById('logoText').innerHTML = (siteSettings.logo_text || 'DRISHTI') + '<span>' + (siteSettings.logo_highlight || 'LIBRARY') + '</span>';
            document.getElementById('footerLogo').innerHTML = (siteSettings.logo_text || 'DRISHTI') + '<span>' + (siteSettings.logo_highlight || 'LIBRARY') + '</span>';
            document.getElementById('footerAbout').textContent = siteSettings.about_text || '';
            document.getElementById('footerAddress').textContent = siteSettings.address || '';
            document.getElementById('footerPhone').textContent = siteSettings.phone || '';
            document.getElementById('footerEmail').textContent = siteSettings.email || '';
            document.getElementById('footerCopyright').textContent = siteSettings.footer_text || '';
            
            if (siteSettings.phone) {
                document.getElementById('navPhone').href = 'tel:' + siteSettings.phone.replace(/\\s/g, '');
            }
            if (siteSettings.whatsapp_link) {
                document.getElementById('whatsappFloat').href = siteSettings.whatsapp_link;
            }
            if (siteSettings.google_map_embed) {
                document.getElementById('mapContainer').innerHTML = '<iframe src="' + siteSettings.google_map_embed + '" allowfullscreen="" loading="lazy"></iframe>';
            }

            // Social links
            let socialHTML = '';
            if (siteSettings.whatsapp_link) socialHTML += '<a href="' + siteSettings.whatsapp_link + '" class="wa" target="_blank"><i class="fab fa-whatsapp"></i></a>';
            if (siteSettings.instagram_link) socialHTML += '<a href="' + siteSettings.instagram_link + '" class="ig" target="_blank"><i class="fab fa-instagram"></i></a>';
            if (siteSettings.facebook_link) socialHTML += '<a href="' + siteSettings.facebook_link + '" class="fb" target="_blank"><i class="fab fa-facebook-f"></i></a>';
            if (siteSettings.youtube_link) socialHTML += '<a href="' + siteSettings.youtube_link + '" class="yt" target="_blank"><i class="fab fa-youtube"></i></a>';
            document.getElementById('socialLinks').innerHTML = socialHTML;
        }

        // Render hero slides
        function renderSlides() {
            const slider = document.getElementById('heroSlider');
            const indicators = document.getElementById('slideIndicators');
            
            let slidesHTML = '';
            let indicatorsHTML = '';
            
            slides.forEach((slide, index) => {
                slidesHTML += '<div class="slide ' + (index === 0 ? 'active' : '') + '" style="background-image: url(' + slide.image_url + ')"><div class="slide-overlay"></div><div class="slide-content"><h1>' + slide.title + '</h1><p>' + (slide.subtitle || '') + '</p><div class="hero-cta"><a href="#contact" class="btn-primary">Book Your Seat</a><a href="#facilities" class="btn-secondary">Our Facilities</a></div></div></div>';
                indicatorsHTML += '<div class="indicator ' + (index === 0 ? 'active' : '') + '" onclick="goToSlide(' + index + ')"></div>';
            });
            
            slider.insertAdjacentHTML('afterbegin', slidesHTML);
            indicators.innerHTML = indicatorsHTML;
        }

        // Slider functions
        function initSlider() {
            if (slides.length > 1) {
                setInterval(nextSlide, 5000);
            }
        }

        function nextSlide() {
            const slideElements = document.querySelectorAll('.slide');
            const indicatorElements = document.querySelectorAll('.indicator');
            
            slideElements[currentSlide].classList.remove('active');
            indicatorElements[currentSlide].classList.remove('active');
            
            currentSlide = (currentSlide + 1) % slides.length;
            
            slideElements[currentSlide].classList.add('active');
            indicatorElements[currentSlide].classList.add('active');
        }

        function goToSlide(index) {
            const slideElements = document.querySelectorAll('.slide');
            const indicatorElements = document.querySelectorAll('.indicator');
            
            slideElements[currentSlide].classList.remove('active');
            indicatorElements[currentSlide].classList.remove('active');
            
            currentSlide = index;
            
            slideElements[currentSlide].classList.add('active');
            indicatorElements[currentSlide].classList.add('active');
        }

        // Render sections
        function renderGallery(data) {
            const grid = document.getElementById('galleryGrid');
            grid.innerHTML = data.map(item => '<div class="gallery-item reveal"><img src="' + item.image_url + '" alt="' + (item.caption || '') + '"><span>' + (item.caption || '') + '</span></div>').join('');
        }

        function renderShifts(data) {
            const grid = document.getElementById('shiftsGrid');
            grid.innerHTML = data.map(item => '<div class="shift-card reveal"><i class="fa ' + item.icon + '"></i><h3>' + item.time_slot + '</h3><p>' + (item.description || '') + '</p></div>').join('');
        }

        function renderFacilities(data) {
            const grid = document.getElementById('facilitiesGrid');
            grid.innerHTML = data.map(item => '<div class="facility-card reveal"><i class="fa ' + item.icon + '"></i><h3>' + item.title + '</h3><p>' + (item.description || '') + '</p></div>').join('');
        }

        // Reveal animation
        function initRevealAnimation() {
            const revealElements = document.querySelectorAll('.reveal');
            
            function reveal() {
                revealElements.forEach(el => {
                    const windowHeight = window.innerHeight;
                    const elementTop = el.getBoundingClientRect().top;
                    if (elementTop < windowHeight - 100) {
                        el.classList.add('active');
                    }
                });
            }
            
            window.addEventListener('scroll', reveal);
            reveal();
        }

        // Nav scroll effect
        function initNavScroll() {
            window.addEventListener('scroll', () => {
                const nav = document.getElementById('navbar');
                if (window.scrollY > 50) {
                    nav.classList.add('scrolled');
                } else {
                    nav.classList.remove('scrolled');
                }
            });
        }

        // Contact form
        document.getElementById('contactForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const data = {
                name: document.getElementById('formName').value,
                phone: document.getElementById('formPhone').value,
                shift_preference: document.getElementById('formShift').value,
                message: document.getElementById('formMessage').value
            };
            
            try {
                const res = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const result = await res.json();
                if (result.success) {
                    alert('धन्यवाद! हम आपसे जल्द संपर्क करेंगे।');
                    e.target.reset();
                } else {
                    alert('Error: ' + result.error);
                }
            } catch (error) {
                alert('Something went wrong. Please try again.');
            }
        });

        // Mobile menu toggle
        function toggleMenu() {
            const navLinks = document.querySelector('.nav-links');
            navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
        }
    </script>
</body>
</html>`
}

function getAdminHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Panel - Drishti Digital Library</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <style>
        :root {
            --primary: #0f172a;
            --accent: #f59e0b;
            --light: #f8fafc;
            --white: #ffffff;
            --gray: #64748b;
            --gray-light: #e2e8f0;
            --success: #10b981;
            --danger: #ef4444;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Outfit', sans-serif; }
        body { background: var(--light); min-height: 100vh; }
        
        /* Login Page */
        .login-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, var(--primary) 0%, #1e293b 100%);
        }
        .login-box {
            background: white;
            padding: 50px;
            border-radius: 20px;
            width: 100%;
            max-width: 420px;
            box-shadow: 0 25px 50px rgba(0,0,0,0.2);
        }
        .login-box h1 {
            text-align: center;
            margin-bottom: 10px;
            font-size: 1.8rem;
        }
        .login-box p {
            text-align: center;
            color: var(--gray);
            margin-bottom: 30px;
        }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; margin-bottom: 8px; font-weight: 500; }
        .form-group input {
            width: 100%;
            padding: 15px;
            border: 2px solid var(--gray-light);
            border-radius: 10px;
            font-size: 1rem;
            transition: all 0.3s;
        }
        .form-group input:focus {
            outline: none;
            border-color: var(--accent);
        }
        .btn {
            width: 100%;
            padding: 15px;
            background: var(--accent);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        }
        .btn:hover { background: #d97706; }
        .error-msg { color: var(--danger); text-align: center; margin-top: 15px; display: none; }

        /* Admin Dashboard */
        .admin-container { display: none; }
        .admin-header {
            background: white;
            padding: 20px 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        .admin-header h1 { font-size: 1.5rem; }
        .admin-header h1 span { color: var(--accent); }
        .admin-nav { display: flex; gap: 15px; }
        .admin-nav a {
            padding: 10px 20px;
            background: var(--light);
            border-radius: 8px;
            text-decoration: none;
            color: var(--primary);
            font-weight: 500;
            transition: all 0.3s;
        }
        .admin-nav a:hover, .admin-nav a.active { background: var(--accent); color: white; }
        .logout-btn { background: var(--danger) !important; color: white !important; }

        .admin-content { padding: 30px; }
        .admin-section { display: none; }
        .admin-section.active { display: block; }

        .card {
            background: white;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.05);
            margin-bottom: 30px;
        }
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 25px;
        }
        .card-header h2 { font-size: 1.3rem; }
        .btn-add {
            padding: 10px 20px;
            background: var(--accent);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .btn-add:hover { background: #d97706; }

        /* Settings Grid */
        .settings-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }
        .setting-item { margin-bottom: 20px; }
        .setting-item label { display: block; margin-bottom: 8px; font-weight: 500; color: var(--gray); }
        .setting-item input, .setting-item textarea {
            width: 100%;
            padding: 12px;
            border: 2px solid var(--gray-light);
            border-radius: 8px;
            font-size: 0.95rem;
        }
        .setting-item textarea { resize: vertical; min-height: 80px; }
        .setting-item input:focus, .setting-item textarea:focus {
            outline: none;
            border-color: var(--accent);
        }
        .btn-save {
            padding: 12px 30px;
            background: var(--success);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 500;
        }
        .btn-save:hover { background: #059669; }

        /* Table Styles */
        .data-table {
            width: 100%;
            border-collapse: collapse;
        }
        .data-table th, .data-table td {
            padding: 15px;
            text-align: left;
            border-bottom: 1px solid var(--gray-light);
        }
        .data-table th {
            background: var(--light);
            font-weight: 600;
            color: var(--gray);
        }
        .data-table img {
            width: 80px;
            height: 50px;
            object-fit: cover;
            border-radius: 5px;
        }
        .action-btns { display: flex; gap: 10px; }
        .btn-edit, .btn-delete {
            padding: 8px 15px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 0.85rem;
        }
        .btn-edit { background: var(--accent); color: white; }
        .btn-delete { background: var(--danger); color: white; }
        .status-badge {
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 500;
        }
        .status-active { background: #d1fae5; color: #059669; }
        .status-inactive { background: #fee2e2; color: #dc2626; }

        /* Modal */
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 1000;
            align-items: center;
            justify-content: center;
        }
        .modal.active { display: flex; }
        .modal-content {
            background: white;
            padding: 30px;
            border-radius: 15px;
            width: 100%;
            max-width: 500px;
            max-height: 90vh;
            overflow-y: auto;
        }
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 25px;
        }
        .modal-header h3 { font-size: 1.3rem; }
        .modal-close {
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: var(--gray);
        }
        .modal-footer {
            display: flex;
            gap: 15px;
            margin-top: 25px;
        }
        .modal-footer button { flex: 1; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: 500; }
        .btn-cancel { background: var(--gray-light); border: none; }
        .btn-submit { background: var(--accent); color: white; border: none; }

        /* Toast */
        .toast {
            position: fixed;
            bottom: 30px;
            right: 30px;
            padding: 15px 25px;
            background: var(--success);
            color: white;
            border-radius: 10px;
            display: none;
            z-index: 2000;
        }
        .toast.error { background: var(--danger); }
        .toast.active { display: block; animation: slideIn 0.3s ease; }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }

        @media (max-width: 768px) {
            .admin-nav { flex-wrap: wrap; }
            .admin-header { flex-direction: column; gap: 15px; }
            .data-table { display: block; overflow-x: auto; }
        }
    </style>
</head>
<body>
    <!-- Login Page -->
    <div class="login-container" id="loginPage">
        <div class="login-box">
            <h1>🔐 Admin Login</h1>
            <p>Drishti Digital Library Admin Panel</p>
            <form id="loginForm">
                <div class="form-group">
                    <label>Username</label>
                    <input type="text" id="loginUsername" placeholder="Enter username" required>
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="loginPassword" placeholder="Enter password" required>
                </div>
                <button type="submit" class="btn">Login</button>
                <p class="error-msg" id="loginError">Invalid credentials. Please try again.</p>
            </form>
        </div>
    </div>

    <!-- Admin Dashboard -->
    <div class="admin-container" id="adminDashboard">
        <header class="admin-header">
            <h1>DRISHTI<span>ADMIN</span></h1>
            <nav class="admin-nav">
                <a href="#" class="active" data-section="settings">⚙️ Settings</a>
                <a href="#" data-section="slides">🖼️ Slides</a>
                <a href="#" data-section="gallery">📷 Gallery</a>
                <a href="#" data-section="shifts">⏰ Shifts</a>
                <a href="#" data-section="facilities">✨ Facilities</a>
                <a href="#" data-section="contacts">📩 Contacts</a>
                <a href="/" target="_blank">👁️ View Site</a>
                <a href="#" class="logout-btn" onclick="logout()">🚪 Logout</a>
            </nav>
        </header>

        <div class="admin-content">
            <!-- Settings Section -->
            <div class="admin-section active" id="section-settings">
                <div class="card">
                    <div class="card-header">
                        <h2>Site Settings</h2>
                        <button class="btn-save" onclick="saveAllSettings()">💾 Save All</button>
                    </div>
                    <div class="settings-grid">
                        <div class="setting-item">
                            <label>Site Name</label>
                            <input type="text" id="setting_site_name" data-key="site_name">
                        </div>
                        <div class="setting-item">
                            <label>Tagline</label>
                            <input type="text" id="setting_tagline" data-key="tagline">
                        </div>
                        <div class="setting-item">
                            <label>Logo Text</label>
                            <input type="text" id="setting_logo_text" data-key="logo_text" placeholder="e.g., DRISHTI">
                        </div>
                        <div class="setting-item">
                            <label>Logo Highlight</label>
                            <input type="text" id="setting_logo_highlight" data-key="logo_highlight" placeholder="e.g., LIBRARY">
                        </div>
                        <div class="setting-item">
                            <label>Phone Number</label>
                            <input type="text" id="setting_phone" data-key="phone">
                        </div>
                        <div class="setting-item">
                            <label>Email</label>
                            <input type="email" id="setting_email" data-key="email">
                        </div>
                        <div class="setting-item">
                            <label>Address</label>
                            <input type="text" id="setting_address" data-key="address">
                        </div>
                        <div class="setting-item">
                            <label>WhatsApp Link</label>
                            <input type="text" id="setting_whatsapp_link" data-key="whatsapp_link" placeholder="https://wa.me/91...">
                        </div>
                        <div class="setting-item">
                            <label>Instagram Link</label>
                            <input type="text" id="setting_instagram_link" data-key="instagram_link">
                        </div>
                        <div class="setting-item">
                            <label>Facebook Link</label>
                            <input type="text" id="setting_facebook_link" data-key="facebook_link">
                        </div>
                        <div class="setting-item">
                            <label>YouTube Link</label>
                            <input type="text" id="setting_youtube_link" data-key="youtube_link">
                        </div>
                        <div class="setting-item">
                            <label>Footer Copyright Text</label>
                            <input type="text" id="setting_footer_text" data-key="footer_text">
                        </div>
                    </div>
                    <div class="setting-item" style="margin-top: 20px;">
                        <label>Google Map Embed URL</label>
                        <textarea id="setting_google_map_embed" data-key="google_map_embed" rows="3" placeholder="Paste Google Maps embed URL here"></textarea>
                    </div>
                    <div class="setting-item">
                        <label>About Text</label>
                        <textarea id="setting_about_text" data-key="about_text" rows="4"></textarea>
                    </div>
                </div>
            </div>

            <!-- Slides Section -->
            <div class="admin-section" id="section-slides">
                <div class="card">
                    <div class="card-header">
                        <h2>Hero Slides</h2>
                        <button class="btn-add" onclick="openModal('slide')"><i class="fas fa-plus"></i> Add Slide</button>
                    </div>
                    <table class="data-table">
                        <thead>
                            <tr><th>Image</th><th>Title</th><th>Subtitle</th><th>Status</th><th>Actions</th></tr>
                        </thead>
                        <tbody id="slidesTable"></tbody>
                    </table>
                </div>
            </div>

            <!-- Gallery Section -->
            <div class="admin-section" id="section-gallery">
                <div class="card">
                    <div class="card-header">
                        <h2>Gallery Images</h2>
                        <button class="btn-add" onclick="openModal('gallery')"><i class="fas fa-plus"></i> Add Image</button>
                    </div>
                    <table class="data-table">
                        <thead>
                            <tr><th>Image</th><th>Caption</th><th>Status</th><th>Actions</th></tr>
                        </thead>
                        <tbody id="galleryTable"></tbody>
                    </table>
                </div>
            </div>

            <!-- Shifts Section -->
            <div class="admin-section" id="section-shifts">
                <div class="card">
                    <div class="card-header">
                        <h2>Shifts / Timings</h2>
                        <button class="btn-add" onclick="openModal('shift')"><i class="fas fa-plus"></i> Add Shift</button>
                    </div>
                    <table class="data-table">
                        <thead>
                            <tr><th>Icon</th><th>Time Slot</th><th>Description</th><th>Status</th><th>Actions</th></tr>
                        </thead>
                        <tbody id="shiftsTable"></tbody>
                    </table>
                </div>
            </div>

            <!-- Facilities Section -->
            <div class="admin-section" id="section-facilities">
                <div class="card">
                    <div class="card-header">
                        <h2>Facilities</h2>
                        <button class="btn-add" onclick="openModal('facility')"><i class="fas fa-plus"></i> Add Facility</button>
                    </div>
                    <table class="data-table">
                        <thead>
                            <tr><th>Icon</th><th>Title</th><th>Description</th><th>Status</th><th>Actions</th></tr>
                        </thead>
                        <tbody id="facilitiesTable"></tbody>
                    </table>
                </div>
            </div>

            <!-- Contacts Section -->
            <div class="admin-section" id="section-contacts">
                <div class="card">
                    <div class="card-header">
                        <h2>Contact Submissions</h2>
                    </div>
                    <table class="data-table">
                        <thead>
                            <tr><th>Name</th><th>Phone</th><th>Shift</th><th>Message</th><th>Date</th><th>Status</th><th>Actions</th></tr>
                        </thead>
                        <tbody id="contactsTable"></tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal -->
    <div class="modal" id="itemModal">
        <div class="modal-content">
            <div class="modal-header">
                <h3 id="modalTitle">Add Item</h3>
                <button class="modal-close" onclick="closeModal()">&times;</button>
            </div>
            <form id="modalForm">
                <div id="modalFields"></div>
                <div class="modal-footer">
                    <button type="button" class="btn-cancel" onclick="closeModal()">Cancel</button>
                    <button type="submit" class="btn-submit">Save</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Toast -->
    <div class="toast" id="toast"></div>

    <script>
        let authToken = '';
        let currentEditId = null;
        let currentType = '';

        // Login handling
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;

            try {
                const res = await fetch('/api/admin/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                if (res.ok) {
                    authToken = btoa(username + ':' + password);
                    sessionStorage.setItem('adminAuth', authToken);
                    showDashboard();
                } else {
                    document.getElementById('loginError').style.display = 'block';
                }
            } catch (error) {
                showToast('Connection error', true);
            }
        });

        // Check existing session
        document.addEventListener('DOMContentLoaded', () => {
            const savedAuth = sessionStorage.getItem('adminAuth');
            if (savedAuth) {
                authToken = savedAuth;
                showDashboard();
            }
        });

        function showDashboard() {
            document.getElementById('loginPage').style.display = 'none';
            document.getElementById('adminDashboard').style.display = 'block';
            loadAllData();
        }

        function logout() {
            sessionStorage.removeItem('adminAuth');
            location.reload();
        }

        // API helper
        async function apiCall(endpoint, method = 'GET', data = null) {
            const options = {
                method,
                headers: {
                    'Authorization': 'Basic ' + authToken,
                    'Content-Type': 'application/json'
                }
            };
            if (data) options.body = JSON.stringify(data);
            const res = await fetch(endpoint, options);
            return res.json();
        }

        // Load all data
        async function loadAllData() {
            loadSettings();
            loadSlides();
            loadGallery();
            loadShifts();
            loadFacilities();
            loadContacts();
        }

        // Settings
        async function loadSettings() {
            const res = await apiCall('/api/admin/settings');
            if (res.success) {
                res.data.forEach(setting => {
                    const input = document.getElementById('setting_' + setting.key);
                    if (input) input.value = setting.value;
                });
            }
        }

        async function saveAllSettings() {
            const inputs = document.querySelectorAll('[data-key]');
            for (const input of inputs) {
                await apiCall('/api/admin/settings/' + input.dataset.key, 'PUT', { value: input.value });
            }
            showToast('Settings saved successfully!');
        }

        // Slides
        async function loadSlides() {
            const res = await apiCall('/api/admin/slides');
            if (res.success) {
                document.getElementById('slidesTable').innerHTML = res.data.map(slide => 
                    '<tr><td><img src="' + slide.image_url + '"></td><td>' + slide.title + '</td><td>' + (slide.subtitle || '-') + '</td><td><span class="status-badge ' + (slide.is_active ? 'status-active' : 'status-inactive') + '">' + (slide.is_active ? 'Active' : 'Inactive') + '</span></td><td class="action-btns"><button class="btn-edit" onclick="editSlide(' + slide.id + ')">Edit</button><button class="btn-delete" onclick="deleteItem(\\'slides\\', ' + slide.id + ')">Delete</button></td></tr>'
                ).join('');
            }
        }

        async function editSlide(id) {
            const res = await apiCall('/api/admin/slides');
            const slide = res.data.find(s => s.id === id);
            if (slide) {
                currentEditId = id;
                openModal('slide', slide);
            }
        }

        // Gallery
        async function loadGallery() {
            const res = await apiCall('/api/admin/gallery');
            if (res.success) {
                document.getElementById('galleryTable').innerHTML = res.data.map(img => 
                    '<tr><td><img src="' + img.image_url + '"></td><td>' + (img.caption || '-') + '</td><td><span class="status-badge ' + (img.is_active ? 'status-active' : 'status-inactive') + '">' + (img.is_active ? 'Active' : 'Inactive') + '</span></td><td class="action-btns"><button class="btn-edit" onclick="editGallery(' + img.id + ')">Edit</button><button class="btn-delete" onclick="deleteItem(\\'gallery\\', ' + img.id + ')">Delete</button></td></tr>'
                ).join('');
            }
        }

        async function editGallery(id) {
            const res = await apiCall('/api/admin/gallery');
            const img = res.data.find(g => g.id === id);
            if (img) {
                currentEditId = id;
                openModal('gallery', img);
            }
        }

        // Shifts
        async function loadShifts() {
            const res = await apiCall('/api/admin/shifts');
            if (res.success) {
                document.getElementById('shiftsTable').innerHTML = res.data.map(shift => 
                    '<tr><td><i class="fa ' + shift.icon + '"></i> ' + shift.icon + '</td><td>' + shift.time_slot + '</td><td>' + (shift.description || '-') + '</td><td><span class="status-badge ' + (shift.is_active ? 'status-active' : 'status-inactive') + '">' + (shift.is_active ? 'Active' : 'Inactive') + '</span></td><td class="action-btns"><button class="btn-edit" onclick="editShift(' + shift.id + ')">Edit</button><button class="btn-delete" onclick="deleteItem(\\'shifts\\', ' + shift.id + ')">Delete</button></td></tr>'
                ).join('');
            }
        }

        async function editShift(id) {
            const res = await apiCall('/api/admin/shifts');
            const shift = res.data.find(s => s.id === id);
            if (shift) {
                currentEditId = id;
                openModal('shift', shift);
            }
        }

        // Facilities
        async function loadFacilities() {
            const res = await apiCall('/api/admin/facilities');
            if (res.success) {
                document.getElementById('facilitiesTable').innerHTML = res.data.map(fac => 
                    '<tr><td><i class="fa ' + fac.icon + '"></i> ' + fac.icon + '</td><td>' + fac.title + '</td><td>' + (fac.description || '-') + '</td><td><span class="status-badge ' + (fac.is_active ? 'status-active' : 'status-inactive') + '">' + (fac.is_active ? 'Active' : 'Inactive') + '</span></td><td class="action-btns"><button class="btn-edit" onclick="editFacility(' + fac.id + ')">Edit</button><button class="btn-delete" onclick="deleteItem(\\'facilities\\', ' + fac.id + ')">Delete</button></td></tr>'
                ).join('');
            }
        }

        async function editFacility(id) {
            const res = await apiCall('/api/admin/facilities');
            const fac = res.data.find(f => f.id === id);
            if (fac) {
                currentEditId = id;
                openModal('facility', fac);
            }
        }

        // Contacts
        async function loadContacts() {
            const res = await apiCall('/api/admin/contacts');
            if (res.success) {
                document.getElementById('contactsTable').innerHTML = res.data.map(c => 
                    '<tr><td>' + c.name + '</td><td>' + c.phone + '</td><td>' + (c.shift_preference || '-') + '</td><td>' + (c.message || '-') + '</td><td>' + new Date(c.created_at).toLocaleDateString() + '</td><td><span class="status-badge ' + (c.is_read ? 'status-inactive' : 'status-active') + '">' + (c.is_read ? 'Read' : 'New') + '</span></td><td class="action-btns">' + (!c.is_read ? '<button class="btn-edit" onclick="markRead(' + c.id + ')">Mark Read</button>' : '') + '<button class="btn-delete" onclick="deleteItem(\\'contacts\\', ' + c.id + ')">Delete</button></td></tr>'
                ).join('');
            }
        }

        async function markRead(id) {
            await apiCall('/api/admin/contacts/' + id + '/read', 'PUT');
            loadContacts();
            showToast('Marked as read');
        }

        // Delete item
        async function deleteItem(type, id) {
            if (!confirm('Are you sure you want to delete this item?')) return;
            await apiCall('/api/admin/' + type + '/' + id, 'DELETE');
            loadAllData();
            showToast('Item deleted');
        }

        // Modal handling
        function openModal(type, data = null) {
            currentType = type;
            currentEditId = data ? data.id : null;
            
            const modal = document.getElementById('itemModal');
            const title = document.getElementById('modalTitle');
            const fields = document.getElementById('modalFields');
            
            let html = '';
            
            if (type === 'slide') {
                title.textContent = data ? 'Edit Slide' : 'Add Slide';
                html = '<div class="form-group"><label>Image URL</label><input type="text" name="image_url" value="' + (data?.image_url || '') + '" required></div><div class="form-group"><label>Title</label><input type="text" name="title" value="' + (data?.title || '') + '" required></div><div class="form-group"><label>Subtitle</label><input type="text" name="subtitle" value="' + (data?.subtitle || '') + '"></div><div class="form-group"><label>Sort Order</label><input type="number" name="sort_order" value="' + (data?.sort_order || 0) + '"></div>' + (data ? '<div class="form-group"><label><input type="checkbox" name="is_active" ' + (data?.is_active ? 'checked' : '') + '> Active</label></div>' : '');
            } else if (type === 'gallery') {
                title.textContent = data ? 'Edit Image' : 'Add Image';
                html = '<div class="form-group"><label>Image URL</label><input type="text" name="image_url" value="' + (data?.image_url || '') + '" required></div><div class="form-group"><label>Caption</label><input type="text" name="caption" value="' + (data?.caption || '') + '"></div><div class="form-group"><label>Sort Order</label><input type="number" name="sort_order" value="' + (data?.sort_order || 0) + '"></div>' + (data ? '<div class="form-group"><label><input type="checkbox" name="is_active" ' + (data?.is_active ? 'checked' : '') + '> Active</label></div>' : '');
            } else if (type === 'shift') {
                title.textContent = data ? 'Edit Shift' : 'Add Shift';
                html = '<div class="form-group"><label>Icon (FontAwesome class)</label><input type="text" name="icon" value="' + (data?.icon || 'fa-clock') + '" placeholder="e.g., fa-sun, fa-moon"></div><div class="form-group"><label>Time Slot</label><input type="text" name="time_slot" value="' + (data?.time_slot || '') + '" required placeholder="e.g., 06:00 - 10:00 AM"></div><div class="form-group"><label>Description</label><input type="text" name="description" value="' + (data?.description || '') + '"></div><div class="form-group"><label>Sort Order</label><input type="number" name="sort_order" value="' + (data?.sort_order || 0) + '"></div>' + (data ? '<div class="form-group"><label><input type="checkbox" name="is_active" ' + (data?.is_active ? 'checked' : '') + '> Active</label></div>' : '');
            } else if (type === 'facility') {
                title.textContent = data ? 'Edit Facility' : 'Add Facility';
                html = '<div class="form-group"><label>Icon (FontAwesome class)</label><input type="text" name="icon" value="' + (data?.icon || 'fa-check') + '" placeholder="e.g., fa-wifi, fa-snowflake"></div><div class="form-group"><label>Title</label><input type="text" name="title" value="' + (data?.title || '') + '" required></div><div class="form-group"><label>Description</label><input type="text" name="description" value="' + (data?.description || '') + '"></div><div class="form-group"><label>Sort Order</label><input type="number" name="sort_order" value="' + (data?.sort_order || 0) + '"></div>' + (data ? '<div class="form-group"><label><input type="checkbox" name="is_active" ' + (data?.is_active ? 'checked' : '') + '> Active</label></div>' : '');
            }
            
            fields.innerHTML = html;
            modal.classList.add('active');
        }

        function closeModal() {
            document.getElementById('itemModal').classList.remove('active');
            currentEditId = null;
            currentType = '';
        }

        // Modal form submit
        document.getElementById('modalForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = {};
            
            formData.forEach((value, key) => {
                if (key === 'is_active') {
                    data[key] = true;
                } else if (key === 'sort_order') {
                    data[key] = parseInt(value) || 0;
                } else {
                    data[key] = value;
                }
            });
            
            if (currentEditId && !data.hasOwnProperty('is_active')) {
                data.is_active = false;
            }
            
            const endpoint = '/api/admin/' + currentType + 's' + (currentEditId ? '/' + currentEditId : '');
            const method = currentEditId ? 'PUT' : 'POST';
            
            await apiCall(endpoint, method, data);
            closeModal();
            loadAllData();
            showToast(currentEditId ? 'Updated successfully!' : 'Added successfully!');
        });

        // Navigation
        document.querySelectorAll('.admin-nav a[data-section]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.target.dataset.section;
                
                document.querySelectorAll('.admin-nav a').forEach(a => a.classList.remove('active'));
                e.target.classList.add('active');
                
                document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
                document.getElementById('section-' + section).classList.add('active');
            });
        });

        // Toast notification
        function showToast(message, isError = false) {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.className = 'toast active' + (isError ? ' error' : '');
            setTimeout(() => toast.classList.remove('active'), 3000);
        }
    </script>
</body>
</html>`
}

function getTermsHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Terms & Conditions - Drishti Digital Library</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Outfit', sans-serif; }
        body { background: #f8fafc; color: #0f172a; line-height: 1.8; }
        .container { max-width: 900px; margin: 0 auto; padding: 60px 20px; }
        h1 { font-size: 2.5rem; margin-bottom: 10px; }
        .update-date { color: #64748b; margin-bottom: 40px; }
        h2 { font-size: 1.5rem; margin: 30px 0 15px; color: #f59e0b; }
        p, li { margin-bottom: 15px; color: #334155; }
        ul { margin-left: 25px; }
        .back-btn { display: inline-block; margin-bottom: 30px; color: #f59e0b; text-decoration: none; font-weight: 500; }
        .back-btn:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <a href="/" class="back-btn">← Back to Home</a>
        <h1>Terms & Conditions</h1>
        <p class="update-date">Last Updated: January 2026</p>
        
        <h2>1. Introduction</h2>
        <p>Welcome to Drishti Digital Library ("we," "our," or "us"). By accessing or using our services, you agree to be bound by these Terms and Conditions. Please read them carefully before using our library services.</p>
        
        <h2>2. Services Offered</h2>
        <p>Drishti Digital Library provides self-study space with the following amenities:</p>
        <ul>
            <li>Air-conditioned study rooms</li>
            <li>High-speed WiFi connectivity</li>
            <li>Daily newspapers and magazines</li>
            <li>Comfortable seating arrangements</li>
            <li>CCTV surveillance for security</li>
            <li>Power backup facilities</li>
            <li>RO purified drinking water</li>
        </ul>
        
        <h2>3. Membership & Registration</h2>
        <p>To use our services, you must:</p>
        <ul>
            <li>Be at least 16 years of age</li>
            <li>Provide accurate personal information during registration</li>
            <li>Pay the applicable membership fee</li>
            <li>Follow all library rules and regulations</li>
        </ul>
        
        <h2>4. Payment Terms</h2>
        <p>All payments are processed securely through Cashfree Payment Gateway. By making a payment, you agree to:</p>
        <ul>
            <li>Pay the full amount for the selected membership plan</li>
            <li>Provide accurate payment information</li>
            <li>Understand that all fees are in Indian Rupees (INR)</li>
            <li>Accept our refund policy as stated in the Refund Policy page</li>
        </ul>
        
        <h2>5. User Conduct</h2>
        <p>While using our facilities, you agree to:</p>
        <ul>
            <li>Maintain silence and respect other users</li>
            <li>Keep the premises clean and tidy</li>
            <li>Not damage any property or equipment</li>
            <li>Not engage in any illegal activities</li>
            <li>Follow the designated shift timings</li>
            <li>Not share your membership with others</li>
        </ul>
        
        <h2>6. Limitation of Liability</h2>
        <p>Drishti Digital Library shall not be liable for:</p>
        <ul>
            <li>Loss or theft of personal belongings</li>
            <li>Damage to personal property</li>
            <li>Internet service interruptions</li>
            <li>Power outages beyond our control</li>
        </ul>
        
        <h2>7. Termination</h2>
        <p>We reserve the right to terminate or suspend membership without notice if:</p>
        <ul>
            <li>User violates these terms and conditions</li>
            <li>User engages in misconduct</li>
            <li>User damages library property</li>
            <li>Payment issues arise</li>
        </ul>
        
        <h2>8. Changes to Terms</h2>
        <p>We may update these terms from time to time. Continued use of our services after changes constitutes acceptance of the new terms.</p>
        
        <h2>9. Contact Information</h2>
        <p>For any questions about these Terms & Conditions, please contact us at:</p>
        <p>Email: info@drishtilibrary.com<br>Phone: +91 98765 43210</p>
    </div>
</body>
</html>`
}

function getPrivacyHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Privacy Policy - Drishti Digital Library</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Outfit', sans-serif; }
        body { background: #f8fafc; color: #0f172a; line-height: 1.8; }
        .container { max-width: 900px; margin: 0 auto; padding: 60px 20px; }
        h1 { font-size: 2.5rem; margin-bottom: 10px; }
        .update-date { color: #64748b; margin-bottom: 40px; }
        h2 { font-size: 1.5rem; margin: 30px 0 15px; color: #f59e0b; }
        p, li { margin-bottom: 15px; color: #334155; }
        ul { margin-left: 25px; }
        .back-btn { display: inline-block; margin-bottom: 30px; color: #f59e0b; text-decoration: none; font-weight: 500; }
        .back-btn:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <a href="/" class="back-btn">← Back to Home</a>
        <h1>Privacy Policy</h1>
        <p class="update-date">Last Updated: January 2026</p>
        
        <h2>1. Introduction</h2>
        <p>Drishti Digital Library ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our services.</p>
        
        <h2>2. Information We Collect</h2>
        <p>We collect the following types of information:</p>
        <ul>
            <li><strong>Personal Information:</strong> Name, email address, phone number, and address when you register or make inquiries</li>
            <li><strong>Payment Information:</strong> Payment details processed securely through Cashfree Payment Gateway</li>
            <li><strong>Usage Data:</strong> Information about how you use our facilities and services</li>
            <li><strong>Communication Data:</strong> Records of your communications with us</li>
        </ul>
        
        <h2>3. How We Use Your Information</h2>
        <p>We use your information to:</p>
        <ul>
            <li>Process membership registrations and payments</li>
            <li>Provide and maintain our services</li>
            <li>Send you updates about our services and offers</li>
            <li>Respond to your inquiries and support requests</li>
            <li>Improve our services and user experience</li>
            <li>Ensure security of our premises and users</li>
        </ul>
        
        <h2>4. Information Sharing</h2>
        <p>We do not sell, trade, or rent your personal information. We may share your information with:</p>
        <ul>
            <li>Payment processors (Cashfree) to process transactions</li>
            <li>Service providers who assist in our operations</li>
            <li>Law enforcement when required by law</li>
        </ul>
        
        <h2>5. Data Security</h2>
        <p>We implement appropriate security measures to protect your information:</p>
        <ul>
            <li>Secure SSL encryption for data transmission</li>
            <li>Secure storage of personal information</li>
            <li>Regular security assessments</li>
            <li>Limited access to personal data by authorized personnel only</li>
        </ul>
        
        <h2>6. Cookies and Tracking</h2>
        <p>Our website may use cookies to enhance your experience. You can control cookie settings through your browser preferences.</p>
        
        <h2>7. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
            <li>Access your personal information</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Opt-out of marketing communications</li>
        </ul>
        
        <h2>8. Children's Privacy</h2>
        <p>Our services are not intended for children under 16. We do not knowingly collect information from children under 16 without parental consent.</p>
        
        <h2>9. Changes to This Policy</h2>
        <p>We may update this Privacy Policy periodically. We will notify you of any material changes by posting the new policy on our website.</p>
        
        <h2>10. Contact Us</h2>
        <p>If you have questions about this Privacy Policy, please contact us:</p>
        <p>Email: info@drishtilibrary.com<br>Phone: +91 98765 43210<br>Address: Main Road, Jamshedpur, Jharkhand - 831001</p>
    </div>
</body>
</html>`
}

function getRefundHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Refund & Cancellation Policy - Drishti Digital Library</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Outfit', sans-serif; }
        body { background: #f8fafc; color: #0f172a; line-height: 1.8; }
        .container { max-width: 900px; margin: 0 auto; padding: 60px 20px; }
        h1 { font-size: 2.5rem; margin-bottom: 10px; }
        .update-date { color: #64748b; margin-bottom: 40px; }
        h2 { font-size: 1.5rem; margin: 30px 0 15px; color: #f59e0b; }
        p, li { margin-bottom: 15px; color: #334155; }
        ul { margin-left: 25px; }
        .back-btn { display: inline-block; margin-bottom: 30px; color: #f59e0b; text-decoration: none; font-weight: 500; }
        .back-btn:hover { text-decoration: underline; }
        .highlight-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <a href="/" class="back-btn">← Back to Home</a>
        <h1>Refund & Cancellation Policy</h1>
        <p class="update-date">Last Updated: January 2026</p>
        
        <div class="highlight-box">
            <p><strong>Important:</strong> Please read this policy carefully before making any payment. By making a payment, you agree to these terms.</p>
        </div>
        
        <h2>1. General Refund Policy</h2>
        <p>At Drishti Digital Library, we strive to provide the best services. However, we understand that circumstances may require cancellation or refund. This policy outlines the conditions under which refunds will be processed.</p>
        
        <h2>2. Eligibility for Refund</h2>
        <p>Refunds may be considered in the following cases:</p>
        <ul>
            <li><strong>Within 24 hours of payment:</strong> Full refund if you have not used our services</li>
            <li><strong>Within 7 days of payment:</strong> 75% refund if used for less than 3 days</li>
            <li><strong>Service unavailability:</strong> Full refund if we are unable to provide the promised services</li>
            <li><strong>Technical issues:</strong> Full refund for payment errors or duplicate charges</li>
        </ul>
        
        <h2>3. Non-Refundable Cases</h2>
        <p>Refunds will NOT be provided in the following situations:</p>
        <ul>
            <li>After using services for more than 7 days</li>
            <li>Membership terminated due to violation of terms</li>
            <li>Change of mind after 24 hours without valid reason</li>
            <li>Promotional or discounted memberships</li>
            <li>Partial month usage (no pro-rata refunds)</li>
        </ul>
        
        <h2>4. How to Request a Refund</h2>
        <p>To request a refund:</p>
        <ul>
            <li>Contact us via email at info@drishtilibrary.com</li>
            <li>Include your name, phone number, and payment reference</li>
            <li>Clearly state the reason for refund request</li>
            <li>Submit any supporting documents if applicable</li>
        </ul>
        
        <h2>5. Refund Processing Time</h2>
        <p>Once a refund is approved:</p>
        <ul>
            <li>Refund will be processed within 5-7 business days</li>
            <li>Amount will be credited to the original payment method</li>
            <li>Bank processing time may vary (additional 3-5 days)</li>
            <li>You will receive email confirmation once processed</li>
        </ul>
        
        <h2>6. Cancellation Policy</h2>
        <p>You may cancel your membership at any time by:</p>
        <ul>
            <li>Contacting us via phone or email</li>
            <li>Visiting our library in person</li>
            <li>Providing written notice of cancellation</li>
        </ul>
        <p>Note: Cancellation does not automatically qualify for refund. Please refer to the refund eligibility section above.</p>
        
        <h2>7. Modification of Services</h2>
        <p>We reserve the right to modify, suspend, or discontinue services. In such cases:</p>
        <ul>
            <li>Members will be notified in advance</li>
            <li>Pro-rata refunds may be considered for unused periods</li>
            <li>Alternative arrangements may be offered</li>
        </ul>
        
        <h2>8. Dispute Resolution</h2>
        <p>If you have a dispute regarding refunds:</p>
        <ul>
            <li>First, contact our customer support</li>
            <li>If unresolved, escalate to management</li>
            <li>All disputes are subject to Jamshedpur jurisdiction</li>
        </ul>
        
        <h2>9. Contact for Refunds</h2>
        <p>For refund-related queries, contact us at:</p>
        <p>Email: info@drishtilibrary.com<br>Phone: +91 98765 43210<br>Working Hours: 10 AM - 8 PM (Mon-Sat)</p>
    </div>
</body>
</html>`
}

function getAboutHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>About Us - Drishti Digital Library</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Outfit', sans-serif; }
        body { background: #f8fafc; color: #0f172a; line-height: 1.8; }
        .container { max-width: 900px; margin: 0 auto; padding: 60px 20px; }
        h1 { font-size: 2.5rem; margin-bottom: 30px; }
        h2 { font-size: 1.5rem; margin: 30px 0 15px; color: #f59e0b; }
        p, li { margin-bottom: 15px; color: #334155; }
        ul { margin-left: 25px; }
        .back-btn { display: inline-block; margin-bottom: 30px; color: #f59e0b; text-decoration: none; font-weight: 500; }
        .back-btn:hover { text-decoration: underline; }
        .mission-box { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; border-radius: 15px; margin: 30px 0; }
        .mission-box h3 { font-size: 1.3rem; margin-bottom: 15px; }
    </style>
</head>
<body>
    <div class="container">
        <a href="/" class="back-btn">← Back to Home</a>
        <h1>About Drishti Digital Library</h1>
        
        <p>Welcome to Drishti Digital Library – Jamshedpur's premier self-study center dedicated to providing students and professionals with the perfect environment for focused learning and career preparation.</p>
        
        <div class="mission-box">
            <h3>Our Mission</h3>
            <p>To create a peaceful, well-equipped study environment that empowers students to achieve their academic and career goals.</p>
        </div>
        
        <h2>Who We Are</h2>
        <p>Drishti Digital Library was established with a vision to provide a dedicated space for serious learners. We understand the challenges students face in finding a quiet, comfortable place to study, especially those preparing for competitive examinations.</p>
        
        <h2>Our Facilities</h2>
        <ul>
            <li><strong>Fully Air-Conditioned:</strong> Comfortable temperature maintained year-round</li>
            <li><strong>High-Speed WiFi:</strong> Uninterrupted internet access for research and online learning</li>
            <li><strong>CCTV Surveillance:</strong> 24/7 security for your peace of mind</li>
            <li><strong>Comfortable Seating:</strong> Ergonomic chairs and spacious desks</li>
            <li><strong>Power Backup:</strong> Uninterrupted power supply during outages</li>
            <li><strong>Daily Newspapers:</strong> Stay updated with current affairs</li>
            <li><strong>RO Purified Water:</strong> Clean drinking water available</li>
            <li><strong>Clean Washrooms:</strong> Well-maintained facilities</li>
        </ul>
        
        <h2>Our Values</h2>
        <ul>
            <li><strong>Excellence:</strong> We maintain high standards in all our services</li>
            <li><strong>Discipline:</strong> We promote a disciplined study environment</li>
            <li><strong>Support:</strong> We're always here to help our members succeed</li>
            <li><strong>Affordability:</strong> Quality services at reasonable prices</li>
        </ul>
        
        <h2>Location & Contact</h2>
        <p><strong>Address:</strong> Main Road, Jamshedpur, Jharkhand - 831001</p>
        <p><strong>Phone:</strong> +91 98765 43210</p>
        <p><strong>Email:</strong> info@drishtilibrary.com</p>
        <p><strong>Operating Hours:</strong> 6:00 AM - 10:00 PM (All Days)</p>
        
        <h2>Join Us Today!</h2>
        <p>Whether you're preparing for UPSC, SSC, Banking, or any other competitive exam, or simply need a quiet place to focus on your studies, Drishti Digital Library is your ideal destination. Visit us today or contact us to learn more about our membership plans.</p>
    </div>
</body>
</html>`
}

function getContactHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contact Us - Drishti Digital Library</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Outfit', sans-serif; }
        body { background: #f8fafc; color: #0f172a; line-height: 1.8; }
        .container { max-width: 900px; margin: 0 auto; padding: 60px 20px; }
        h1 { font-size: 2.5rem; margin-bottom: 30px; }
        h2 { font-size: 1.5rem; margin: 30px 0 15px; color: #f59e0b; }
        p { margin-bottom: 15px; color: #334155; }
        .back-btn { display: inline-block; margin-bottom: 30px; color: #f59e0b; text-decoration: none; font-weight: 500; }
        .back-btn:hover { text-decoration: underline; }
        .contact-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 30px 0; }
        .contact-card { background: white; padding: 25px; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); text-align: center; }
        .contact-card i { font-size: 2rem; color: #f59e0b; margin-bottom: 15px; }
        .contact-card h3 { font-size: 1.1rem; margin-bottom: 10px; }
        .contact-card p { color: #64748b; margin: 0; }
        .contact-card a { color: #f59e0b; text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <a href="/" class="back-btn">← Back to Home</a>
        <h1>Contact Us</h1>
        
        <p>We'd love to hear from you! Whether you have questions about our services, need assistance, or want to provide feedback, our team is here to help.</p>
        
        <div class="contact-grid">
            <div class="contact-card">
                <i class="fas fa-map-marker-alt"></i>
                <h3>Visit Us</h3>
                <p>Main Road, Jamshedpur<br>Jharkhand - 831001</p>
            </div>
            <div class="contact-card">
                <i class="fas fa-phone"></i>
                <h3>Call Us</h3>
                <p><a href="tel:+919876543210">+91 98765 43210</a></p>
            </div>
            <div class="contact-card">
                <i class="fas fa-envelope"></i>
                <h3>Email Us</h3>
                <p><a href="mailto:info@drishtilibrary.com">info@drishtilibrary.com</a></p>
            </div>
            <div class="contact-card">
                <i class="fab fa-whatsapp"></i>
                <h3>WhatsApp</h3>
                <p><a href="https://wa.me/919876543210" target="_blank">Chat with us</a></p>
            </div>
        </div>
        
        <h2>Operating Hours</h2>
        <p><strong>Monday - Sunday:</strong> 6:00 AM - 10:00 PM</p>
        <p>We are open all 7 days of the week!</p>
        
        <h2>For Business Inquiries</h2>
        <p>For partnership opportunities, bulk bookings, or corporate memberships, please email us at <a href="mailto:business@drishtilibrary.com" style="color: #f59e0b;">business@drishtilibrary.com</a></p>
    </div>
</body>
</html>`
}

export default app
