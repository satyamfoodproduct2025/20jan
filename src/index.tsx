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

app.post('/api/admin/login', async (c) => {
  const { username, password } = await c.req.json()
  
  if (username === c.env.ADMIN_USERNAME && password === c.env.ADMIN_PASSWORD) {
    return c.json({ success: true, message: 'Login successful' })
  }
  return c.json({ success: false, error: 'Invalid credentials' }, 401)
})

// ==================== ADMIN API ====================

app.get('/api/admin/settings', authMiddleware, async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM site_settings').all()
    return c.json({ success: true, data: results })
  } catch (error) {
    return c.json({ success: false, error: 'Database error' }, 500)
  }
})

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

app.get('/api/admin/slides', authMiddleware, async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM hero_slides ORDER BY sort_order').all()
    return c.json({ success: true, data: results })
  } catch (error) {
    return c.json({ success: false, error: 'Database error' }, 500)
  }
})

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

app.delete('/api/admin/slides/:id', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    await c.env.DB.prepare('DELETE FROM hero_slides WHERE id = ?').bind(id).run()
    return c.json({ success: true, message: 'Slide deleted' })
  } catch (error) {
    return c.json({ success: false, error: 'Delete failed' }, 500)
  }
})

app.get('/api/admin/gallery', authMiddleware, async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM gallery_images ORDER BY sort_order').all()
    return c.json({ success: true, data: results })
  } catch (error) {
    return c.json({ success: false, error: 'Database error' }, 500)
  }
})

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

app.delete('/api/admin/gallery/:id', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    await c.env.DB.prepare('DELETE FROM gallery_images WHERE id = ?').bind(id).run()
    return c.json({ success: true, message: 'Image deleted' })
  } catch (error) {
    return c.json({ success: false, error: 'Delete failed' }, 500)
  }
})

app.get('/api/admin/shifts', authMiddleware, async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM shifts ORDER BY sort_order').all()
    return c.json({ success: true, data: results })
  } catch (error) {
    return c.json({ success: false, error: 'Database error' }, 500)
  }
})

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

app.delete('/api/admin/shifts/:id', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    await c.env.DB.prepare('DELETE FROM shifts WHERE id = ?').bind(id).run()
    return c.json({ success: true, message: 'Shift deleted' })
  } catch (error) {
    return c.json({ success: false, error: 'Delete failed' }, 500)
  }
})

app.get('/api/admin/facilities', authMiddleware, async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM facilities ORDER BY sort_order').all()
    return c.json({ success: true, data: results })
  } catch (error) {
    return c.json({ success: false, error: 'Database error' }, 500)
  }
})

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

app.delete('/api/admin/facilities/:id', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    await c.env.DB.prepare('DELETE FROM facilities WHERE id = ?').bind(id).run()
    return c.json({ success: true, message: 'Facility deleted' })
  } catch (error) {
    return c.json({ success: false, error: 'Delete failed' }, 500)
  }
})

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

app.put('/api/admin/contacts/:id/read', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    await c.env.DB.prepare('UPDATE contact_submissions SET is_read = 1 WHERE id = ?').bind(id).run()
    return c.json({ success: true, message: 'Marked as read' })
  } catch (error) {
    return c.json({ success: false, error: 'Update failed' }, 500)
  }
})

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

app.get('/', async (c) => {
  return c.html(getMainHTML())
})

app.get('/admin', async (c) => {
  return c.html(getAdminHTML())
})

app.get('/terms', async (c) => {
  return c.html(getTermsHTML())
})

app.get('/privacy', async (c) => {
  return c.html(getPrivacyHTML())
})

app.get('/refund', async (c) => {
  return c.html(getRefundHTML())
})

app.get('/about', async (c) => {
  return c.html(getAboutHTML())
})

app.get('/contact', async (c) => {
  return c.html(getContactHTML())
})

// ==================== HTML TEMPLATES ====================

function getMainHTML() {
  return `<!DOCTYPE html>
<html lang="hi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Drishti Digital Library | Self Study Center Jamshedpur</title>
    <meta name="description" content="Drishti Digital Library - Jamshedpur's premium self-study center with AC, WiFi, and modern facilities.">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <style>
        :root {
            --primary: #0f172a;
            --accent: #f59e0b;
            --accent-dark: #d97706;
            --light: #f8fafc;
            --white: #ffffff;
            --gray: #64748b;
            --gray-light: #e2e8f0;
            --whatsapp: #25d366;
            --instagram: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);
            --facebook: #1877f2;
            --gradient: linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { font-size: 16px; }
        body { 
            font-family: 'Outfit', sans-serif; 
            background: var(--light); 
            color: var(--primary); 
            overflow-x: hidden;
            line-height: 1.6;
            -webkit-text-size-adjust: 100%;
        }

        /* Animations */
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
        
        .reveal { opacity: 0; transform: translateY(40px); transition: all 0.6s ease; }
        .reveal.active { opacity: 1; transform: translateY(0); }

        /* Navigation */
        nav {
            background: rgba(255, 255, 255, 0.98);
            backdrop-filter: blur(10px);
            padding: 12px 4%;
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: fixed;
            width: 100%;
            top: 0;
            z-index: 1000;
            box-shadow: 0 2px 15px rgba(0,0,0,0.08);
        }
        .logo-container { display: flex; align-items: center; gap: 10px; }
        .logo-img { height: 45px; width: auto; object-fit: contain; display: none; }
        .logo-img.visible { display: block; }
        .logo-text { font-size: 1.3rem; font-weight: 800; }
        .logo-text .drishti { color: var(--primary); }
        .logo-text .digital { color: var(--accent); }
        .logo-text .library { color: var(--accent-dark); }
        
        .nav-links { display: flex; gap: 20px; align-items: center; }
        .nav-links a { 
            text-decoration: none; 
            color: var(--primary); 
            font-weight: 500;
            font-size: 0.9rem;
            transition: color 0.3s;
        }
        .nav-links a:hover { color: var(--accent); }
        
        .nav-call {
            background: var(--gradient);
            color: white;
            padding: 10px 20px;
            border-radius: 50px;
            text-decoration: none;
            font-weight: 600;
            font-size: 0.9rem;
            display: flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;
        }
        
        .mobile-menu { display: none; font-size: 1.5rem; cursor: pointer; color: var(--primary); }

        /* Hero Slider */
        .hero { 
            position: relative; 
            width: 100%; 
            height: 100vh;
            min-height: 500px;
            max-height: 800px;
            overflow: hidden; 
            margin-top: 70px; 
        }
        .slide {
            position: absolute;
            width: 100%;
            height: 100%;
            opacity: 0;
            transition: opacity 1s ease;
            background-size: cover;
            background-position: center;
        }
        .slide.active { opacity: 1; }
        .slide-overlay {
            position: absolute;
            inset: 0;
            background: linear-gradient(135deg, rgba(15,23,42,0.8) 0%, rgba(15,23,42,0.5) 100%);
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
            padding: 20px;
        }
        .slide-content h1 {
            font-size: clamp(1.8rem, 5vw, 3.5rem);
            font-weight: 800;
            margin-bottom: 15px;
            line-height: 1.2;
        }
        .slide-content p {
            font-size: clamp(1rem, 2.5vw, 1.3rem);
            opacity: 0.9;
            max-width: 600px;
            margin-bottom: 25px;
        }
        .slide-indicators {
            position: absolute;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 10px;
            z-index: 10;
        }
        .indicator {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: rgba(255,255,255,0.5);
            cursor: pointer;
            transition: all 0.3s;
        }
        .indicator.active { background: var(--accent); transform: scale(1.3); }
        
        .hero-cta {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
            justify-content: center;
        }
        .btn-primary {
            background: var(--gradient);
            color: white;
            padding: 14px 30px;
            border-radius: 50px;
            text-decoration: none;
            font-weight: 600;
            font-size: 1rem;
            transition: transform 0.3s;
        }
        .btn-primary:hover { transform: translateY(-2px); }
        .btn-secondary {
            background: transparent;
            color: white;
            padding: 14px 30px;
            border-radius: 50px;
            text-decoration: none;
            font-weight: 600;
            font-size: 1rem;
            border: 2px solid white;
            transition: all 0.3s;
        }
        .btn-secondary:hover { background: white; color: var(--primary); }

        /* Section Styles */
        .section { padding: 60px 4%; }
        .section-header {
            text-align: center;
            margin-bottom: 40px;
        }
        .section-header h2 {
            font-size: clamp(1.6rem, 4vw, 2.2rem);
            font-weight: 700;
            margin-bottom: 10px;
            position: relative;
            display: inline-block;
        }
        .section-header h2::after {
            content: '';
            position: absolute;
            bottom: -8px;
            left: 50%;
            transform: translateX(-50%);
            width: 60px;
            height: 3px;
            background: var(--gradient);
            border-radius: 2px;
        }
        .section-header p {
            color: var(--gray);
            font-size: 1rem;
            max-width: 500px;
            margin: 15px auto 0;
        }

        /* Shifts Grid */
        .shifts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 15px;
        }
        .shift-card {
            background: white;
            padding: 25px 15px;
            border-radius: 15px;
            text-align: center;
            box-shadow: 0 5px 20px rgba(0,0,0,0.08);
            border-top: 3px solid var(--accent);
            transition: transform 0.3s;
        }
        .shift-card:hover { transform: translateY(-5px); }
        .shift-card i {
            font-size: 2rem;
            color: var(--accent);
            margin-bottom: 12px;
        }
        .shift-card h3 {
            font-size: 1.1rem;
            margin-bottom: 5px;
            font-weight: 700;
        }
        .shift-card p { color: var(--gray); font-size: 0.9rem; }

        /* Facilities Section */
        .facilities { background: var(--primary); }
        .facilities .section-header h2 { color: white; }
        .facilities .section-header p { color: rgba(255,255,255,0.7); }
        .facilities-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 15px;
        }
        .facility-card {
            background: rgba(255,255,255,0.08);
            padding: 25px 15px;
            border-radius: 15px;
            text-align: center;
            transition: background 0.3s;
        }
        .facility-card:hover { background: rgba(255,255,255,0.12); }
        .facility-card i {
            font-size: 1.8rem;
            color: var(--accent);
            margin-bottom: 10px;
        }
        .facility-card h3 {
            color: white;
            font-size: 0.95rem;
            margin-bottom: 5px;
        }
        .facility-card p {
            color: rgba(255,255,255,0.6);
            font-size: 0.85rem;
        }

        /* Gallery Section */
        .gallery-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
        }
        .gallery-item {
            position: relative;
            aspect-ratio: 4/3;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        .gallery-item img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.4s;
        }
        .gallery-item:hover img { transform: scale(1.05); }

        /* Contact Section */
        .contact-section { background: linear-gradient(135deg, var(--light) 0%, #e2e8f0 100%); }
        .contact-container {
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        .contact-info {
            background: var(--gradient);
            padding: 30px;
            color: white;
        }
        .contact-info h2 {
            font-size: 1.5rem;
            margin-bottom: 15px;
        }
        .contact-info p {
            opacity: 0.9;
            margin-bottom: 20px;
            line-height: 1.7;
        }
        .contact-features {
            list-style: none;
        }
        .contact-features li {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
            font-size: 0.95rem;
        }
        .contact-features i {
            width: 24px;
            height: 24px;
            background: rgba(255,255,255,0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.7rem;
        }
        .contact-form { padding: 30px; }
        .contact-form h3 {
            font-size: 1.3rem;
            margin-bottom: 20px;
        }
        .form-group { margin-bottom: 18px; }
        .form-group label {
            display: block;
            margin-bottom: 6px;
            font-weight: 500;
            font-size: 0.9rem;
        }
        .form-group input,
        .form-group select,
        .form-group textarea {
            width: 100%;
            padding: 12px 15px;
            border: 2px solid var(--gray-light);
            border-radius: 10px;
            font-family: inherit;
            font-size: 1rem;
            transition: border-color 0.3s;
        }
        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: var(--accent);
        }
        .btn-submit {
            width: 100%;
            padding: 14px;
            background: var(--gradient);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.3s;
        }
        .btn-submit:hover { transform: translateY(-2px); }

        /* Map Section */
        .map-section { padding: 0 4%; }
        .map-container {
            border-radius: 20px 20px 0 0;
            overflow: hidden;
            box-shadow: 0 -5px 20px rgba(0,0,0,0.08);
        }
        .map-container iframe {
            width: 100%;
            height: 300px;
            border: none;
        }

        /* WhatsApp Float */
        .whatsapp-float {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 55px;
            height: 55px;
            background: var(--whatsapp);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 28px;
            box-shadow: 0 4px 15px rgba(37,211,102,0.4);
            z-index: 999;
            animation: pulse 2s infinite;
            text-decoration: none;
        }

        /* Footer */
        footer {
            background: var(--primary);
            color: white;
            padding: 50px 4% 25px;
        }
        .footer-content {
            display: grid;
            grid-template-columns: 1fr;
            gap: 30px;
            margin-bottom: 30px;
        }
        .footer-brand h3 {
            font-size: 1.4rem;
            margin-bottom: 15px;
        }
        .footer-brand h3 .highlight { color: var(--accent); }
        .footer-brand p {
            color: rgba(255,255,255,0.7);
            line-height: 1.7;
            margin-bottom: 20px;
            font-size: 0.95rem;
        }
        
        /* Social Icons - Fixed */
        .footer-social {
            display: flex;
            gap: 12px;
        }
        .footer-social a {
            width: 42px;
            height: 42px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2rem;
            color: white;
            text-decoration: none;
            transition: transform 0.3s;
        }
        .footer-social a:hover { transform: translateY(-3px) scale(1.1); }
        .footer-social .wa { background: #25d366; }
        .footer-social .ig { background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888); }
        .footer-social .fb { background: #1877f2; }
        .footer-social .yt { background: #ff0000; }
        
        .footer-links h4 {
            font-size: 1.1rem;
            margin-bottom: 15px;
            position: relative;
            padding-bottom: 8px;
        }
        .footer-links h4::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            width: 35px;
            height: 2px;
            background: var(--accent);
        }
        .footer-links ul { list-style: none; }
        .footer-links li { margin-bottom: 8px; }
        .footer-links a {
            color: rgba(255,255,255,0.7);
            text-decoration: none;
            font-size: 0.9rem;
            transition: color 0.3s;
        }
        .footer-links a:hover { color: var(--accent); }
        
        .footer-contact p {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            color: rgba(255,255,255,0.7);
            margin-bottom: 12px;
            font-size: 0.9rem;
        }
        .footer-contact i { color: var(--accent); margin-top: 3px; }
        
        .footer-bottom {
            border-top: 1px solid rgba(255,255,255,0.1);
            padding-top: 20px;
            text-align: center;
        }
        .footer-bottom p { 
            color: rgba(255,255,255,0.6); 
            font-size: 0.85rem;
            margin-bottom: 10px;
        }
        .footer-bottom-links a { 
            color: rgba(255,255,255,0.6); 
            text-decoration: none; 
            margin: 0 10px;
            font-size: 0.85rem;
        }
        .footer-bottom-links a:hover { color: var(--accent); }

        /* Desktop Styles */
        @media (min-width: 768px) {
            nav { padding: 15px 5%; }
            .logo-text { font-size: 1.5rem; }
            .logo-img { height: 50px; }
            .nav-links { display: flex !important; }
            .mobile-menu { display: none; }
            
            .hero { height: 85vh; margin-top: 75px; }
            
            .section { padding: 80px 5%; }
            .shifts-grid { grid-template-columns: repeat(4, 1fr); gap: 20px; }
            .shift-card { padding: 35px 20px; }
            .shift-card i { font-size: 2.5rem; }
            
            .facilities-grid { grid-template-columns: repeat(3, 1fr); gap: 20px; }
            .facility-card { padding: 30px 20px; }
            
            .gallery-grid { grid-template-columns: repeat(4, 1fr); gap: 20px; }
            .gallery-item { aspect-ratio: 1; }
            
            .contact-container { display: grid; grid-template-columns: 1fr 1.2fr; }
            .contact-info { padding: 50px; }
            .contact-form { padding: 50px; }
            
            .map-container iframe { height: 400px; }
            
            .footer-content { grid-template-columns: 2fr 1fr 1fr 1.5fr; }
        }

        /* Mobile Styles */
        @media (max-width: 767px) {
            .nav-links { 
                display: none;
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: white;
                flex-direction: column;
                padding: 20px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                gap: 15px;
            }
            .nav-links.active { display: flex; }
            .mobile-menu { display: block; }
            
            .hero { height: 70vh; margin-top: 65px; }
            
            .facilities-grid { grid-template-columns: repeat(2, 1fr); }
            
            .footer-content { grid-template-columns: 1fr; text-align: center; }
            .footer-links h4::after { left: 50%; transform: translateX(-50%); }
            .footer-social { justify-content: center; }
            .footer-contact p { justify-content: center; }
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
        <div class="logo-container">
            <img src="" alt="Logo" class="logo-img" id="logoImg">
            <div class="logo-text" id="logoText">
                <span class="drishti">DRISHTI</span> <span class="digital">DIGITAL</span> <span class="library">LIBRARY</span>
            </div>
        </div>
        <div class="nav-links" id="navLinks">
            <a href="#shifts">Shifts</a>
            <a href="#facilities">Facilities</a>
            <a href="#gallery">Gallery</a>
            <a href="#contact">Contact</a>
            <a href="/admin">Admin</a>
        </div>
        <a href="tel:+919876543210" class="nav-call" id="navPhone">
            <i class="fas fa-phone"></i> Call Now
        </a>
        <div class="mobile-menu" id="mobileMenu">
            <i class="fas fa-bars"></i>
        </div>
    </nav>

    <!-- Hero Section -->
    <section class="hero" id="heroSlider">
        <div class="slide-indicators" id="slideIndicators"></div>
    </section>

    <!-- Shifts Section -->
    <section class="section" id="shifts">
        <div class="section-header reveal">
            <h2>हमारी शिफ्ट्स</h2>
            <p>अपने समय के अनुसार शिफ्ट चुनें और पढ़ाई में मन लगाएं</p>
        </div>
        <div class="shifts-grid" id="shiftsGrid"></div>
    </section>

    <!-- Facilities Section -->
    <section class="section facilities" id="facilities">
        <div class="section-header reveal">
            <h2>प्रीमियम सुविधाएँ</h2>
            <p>आधुनिक सुविधाओं से लैस हमारी लाइब्रेरी</p>
        </div>
        <div class="facilities-grid" id="facilitiesGrid"></div>
    </section>

    <!-- Gallery Section -->
    <section class="section" id="gallery">
        <div class="section-header reveal">
            <h2>लाइब्रेरी की झलक</h2>
            <p>हमारी लाइब्रेरी की कुछ तस्वीरें देखें</p>
        </div>
        <div class="gallery-grid" id="galleryGrid"></div>
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
                <p>हम आपको बेहतरीन पढ़ाई का माहौल देने के लिए प्रतिबद्ध हैं।</p>
                <ul class="contact-features">
                    <li><i class="fas fa-check"></i> Low Price Guarantee</li>
                    <li><i class="fas fa-check"></i> Permanent Seat Option</li>
                    <li><i class="fas fa-check"></i> 24/7 CCTV Surveillance</li>
                    <li><i class="fas fa-check"></i> Flexible Timings</li>
                    <li><i class="fas fa-check"></i> Clean Environment</li>
                </ul>
            </div>
            <div class="contact-form">
                <h3>Book Your Seat</h3>
                <form id="contactForm">
                    <div class="form-group">
                        <label>आपका नाम *</label>
                        <input type="text" id="formName" placeholder="Enter your name" required>
                    </div>
                    <div class="form-group">
                        <label>मोबाइल नंबर *</label>
                        <input type="tel" id="formPhone" placeholder="Enter mobile number" required>
                    </div>
                    <div class="form-group">
                        <label>पसंदीदा शिफ्ट</label>
                        <select id="formShift">
                            <option value="">Select Shift</option>
                            <option value="Morning">Morning (06-10 AM)</option>
                            <option value="Noon">Noon (10-02 PM)</option>
                            <option value="Evening">Evening (02-06 PM)</option>
                            <option value="Night">Night (06-10 PM)</option>
                            <option value="Full Day">Full Day</option>
                        </select>
                    </div>
                    <button type="submit" class="btn-submit">
                        <i class="fas fa-paper-plane"></i> Submit
                    </button>
                </form>
            </div>
        </div>
    </section>

    <!-- Map Section -->
    <section class="map-section reveal">
        <div class="map-container" id="mapContainer"></div>
    </section>

    <!-- Footer -->
    <footer>
        <div class="footer-content">
            <div class="footer-brand">
                <h3 id="footerLogo">DRISHTI <span class="highlight">DIGITAL LIBRARY</span></h3>
                <p id="footerAbout">Drishti Digital Library - Jamshedpur ki sabse modern self-study library.</p>
                <div class="footer-social" id="socialLinks"></div>
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
            <p id="footerCopyright">&copy; 2026 Drishti Digital Library. All Rights Reserved.</p>
            <div class="footer-bottom-links">
                <a href="/terms">Terms</a>
                <a href="/privacy">Privacy</a>
                <a href="/refund">Refund</a>
            </div>
        </div>
    </footer>

    <script>
        let siteSettings = {};
        let slides = [];
        let currentSlide = 0;
        let slideInterval;

        document.addEventListener('DOMContentLoaded', async () => {
            await loadAllData();
            initSlider();
            initRevealAnimation();
            initMobileMenu();
        });

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

        function applySettings() {
            // Logo handling
            const logoImg = document.getElementById('logoImg');
            const logoText = document.getElementById('logoText');
            
            if (siteSettings.logo_url && siteSettings.logo_url.trim() !== '') {
                logoImg.src = siteSettings.logo_url;
                logoImg.classList.add('visible');
                logoText.style.display = 'none';
            } else {
                logoImg.classList.remove('visible');
                logoText.style.display = 'block';
                const logoTextVal = siteSettings.logo_text || 'DRISHTI';
                const logoHighlight = siteSettings.logo_highlight || 'DIGITAL LIBRARY';
                logoText.innerHTML = '<span class="drishti">' + logoTextVal + '</span> <span class="digital">' + logoHighlight + '</span>';
            }
            
            // Footer logo
            document.getElementById('footerLogo').innerHTML = (siteSettings.logo_text || 'DRISHTI') + ' <span class="highlight">' + (siteSettings.logo_highlight || 'DIGITAL LIBRARY') + '</span>';
            
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

            // Social links with proper icons
            let socialHTML = '';
            if (siteSettings.whatsapp_link) {
                socialHTML += '<a href="' + siteSettings.whatsapp_link + '" class="wa" target="_blank" title="WhatsApp"><i class="fab fa-whatsapp"></i></a>';
            }
            if (siteSettings.instagram_link) {
                socialHTML += '<a href="' + siteSettings.instagram_link + '" class="ig" target="_blank" title="Instagram"><i class="fab fa-instagram"></i></a>';
            }
            if (siteSettings.facebook_link) {
                socialHTML += '<a href="' + siteSettings.facebook_link + '" class="fb" target="_blank" title="Facebook"><i class="fab fa-facebook-f"></i></a>';
            }
            if (siteSettings.youtube_link) {
                socialHTML += '<a href="' + siteSettings.youtube_link + '" class="yt" target="_blank" title="YouTube"><i class="fab fa-youtube"></i></a>';
            }
            document.getElementById('socialLinks').innerHTML = socialHTML;
        }

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

        function initSlider() {
            if (slides.length > 1) {
                slideInterval = setInterval(nextSlide, 5000);
            }
        }

        function nextSlide() {
            const slideElements = document.querySelectorAll('.slide');
            const indicatorElements = document.querySelectorAll('.indicator');
            if (slideElements.length === 0) return;
            
            slideElements[currentSlide].classList.remove('active');
            indicatorElements[currentSlide].classList.remove('active');
            
            currentSlide = (currentSlide + 1) % slides.length;
            
            slideElements[currentSlide].classList.add('active');
            indicatorElements[currentSlide].classList.add('active');
        }

        function goToSlide(index) {
            const slideElements = document.querySelectorAll('.slide');
            const indicatorElements = document.querySelectorAll('.indicator');
            if (slideElements.length === 0) return;
            
            slideElements[currentSlide].classList.remove('active');
            indicatorElements[currentSlide].classList.remove('active');
            
            currentSlide = index;
            
            slideElements[currentSlide].classList.add('active');
            indicatorElements[currentSlide].classList.add('active');
            
            clearInterval(slideInterval);
            slideInterval = setInterval(nextSlide, 5000);
        }

        function renderGallery(data) {
            const grid = document.getElementById('galleryGrid');
            grid.innerHTML = data.map(item => '<div class="gallery-item reveal"><img src="' + item.image_url + '" alt="' + (item.caption || 'Gallery') + '" loading="lazy"></div>').join('');
        }

        function renderShifts(data) {
            const grid = document.getElementById('shiftsGrid');
            grid.innerHTML = data.map(item => '<div class="shift-card reveal"><i class="fa ' + item.icon + '"></i><h3>' + item.time_slot + '</h3><p>' + (item.description || '') + '</p></div>').join('');
        }

        function renderFacilities(data) {
            const grid = document.getElementById('facilitiesGrid');
            grid.innerHTML = data.map(item => '<div class="facility-card reveal"><i class="fa ' + item.icon + '"></i><h3>' + item.title + '</h3><p>' + (item.description || '') + '</p></div>').join('');
        }

        function initRevealAnimation() {
            function reveal() {
                document.querySelectorAll('.reveal').forEach(el => {
                    const elementTop = el.getBoundingClientRect().top;
                    if (elementTop < window.innerHeight - 50) {
                        el.classList.add('active');
                    }
                });
            }
            window.addEventListener('scroll', reveal);
            reveal();
        }

        function initMobileMenu() {
            document.getElementById('mobileMenu').addEventListener('click', () => {
                document.getElementById('navLinks').classList.toggle('active');
            });
        }

        document.getElementById('contactForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const data = {
                name: document.getElementById('formName').value,
                phone: document.getElementById('formPhone').value,
                shift_preference: document.getElementById('formShift').value
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
        
        .login-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, var(--primary) 0%, #1e293b 100%);
            padding: 20px;
        }
        .login-box {
            background: white;
            padding: 40px;
            border-radius: 20px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.2);
        }
        .login-box h1 { text-align: center; margin-bottom: 10px; font-size: 1.6rem; }
        .login-box p { text-align: center; color: var(--gray); margin-bottom: 25px; }
        .form-group { margin-bottom: 18px; }
        .form-group label { display: block; margin-bottom: 6px; font-weight: 500; }
        .form-group input {
            width: 100%;
            padding: 12px;
            border: 2px solid var(--gray-light);
            border-radius: 8px;
            font-size: 1rem;
        }
        .form-group input:focus { outline: none; border-color: var(--accent); }
        .btn {
            width: 100%;
            padding: 14px;
            background: var(--accent);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
        }
        .btn:hover { background: #d97706; }
        .error-msg { color: var(--danger); text-align: center; margin-top: 12px; display: none; }

        .admin-container { display: none; }
        .admin-header {
            background: white;
            padding: 15px 20px;
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            align-items: center;
            gap: 15px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        .admin-header h1 { font-size: 1.3rem; }
        .admin-header h1 span { color: var(--accent); }
        .admin-nav { display: flex; flex-wrap: wrap; gap: 8px; }
        .admin-nav a {
            padding: 8px 14px;
            background: var(--light);
            border-radius: 6px;
            text-decoration: none;
            color: var(--primary);
            font-weight: 500;
            font-size: 0.85rem;
        }
        .admin-nav a:hover, .admin-nav a.active { background: var(--accent); color: white; }
        .logout-btn { background: var(--danger) !important; color: white !important; }

        .admin-content { padding: 20px; }
        .admin-section { display: none; }
        .admin-section.active { display: block; }

        .card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
            margin-bottom: 20px;
        }
        .card-header {
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            margin-bottom: 20px;
        }
        .card-header h2 { font-size: 1.2rem; }
        .btn-add {
            padding: 10px 16px;
            background: var(--accent);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            font-size: 0.9rem;
        }

        .settings-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 15px;
        }
        .setting-item { margin-bottom: 15px; }
        .setting-item label { display: block; margin-bottom: 6px; font-weight: 500; color: var(--gray); font-size: 0.9rem; }
        .setting-item input, .setting-item textarea {
            width: 100%;
            padding: 10px;
            border: 2px solid var(--gray-light);
            border-radius: 6px;
            font-size: 0.95rem;
        }
        .setting-item textarea { resize: vertical; min-height: 70px; }
        .setting-item input:focus, .setting-item textarea:focus { outline: none; border-color: var(--accent); }
        .btn-save {
            padding: 10px 24px;
            background: var(--success);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
        }

        .data-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
        .data-table th, .data-table td { padding: 12px; text-align: left; border-bottom: 1px solid var(--gray-light); }
        .data-table th { background: var(--light); font-weight: 600; color: var(--gray); }
        .data-table img { width: 60px; height: 40px; object-fit: cover; border-radius: 4px; }
        .action-btns { display: flex; gap: 8px; }
        .btn-edit, .btn-delete {
            padding: 6px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.8rem;
        }
        .btn-edit { background: var(--accent); color: white; }
        .btn-delete { background: var(--danger); color: white; }
        .status-badge { padding: 4px 10px; border-radius: 15px; font-size: 0.75rem; font-weight: 500; }
        .status-active { background: #d1fae5; color: #059669; }
        .status-inactive { background: #fee2e2; color: #dc2626; }

        .modal {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.5);
            z-index: 1000;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .modal.active { display: flex; }
        .modal-content {
            background: white;
            padding: 25px;
            border-radius: 12px;
            width: 100%;
            max-width: 450px;
            max-height: 85vh;
            overflow-y: auto;
        }
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .modal-header h3 { font-size: 1.2rem; }
        .modal-close { background: none; border: none; font-size: 1.3rem; cursor: pointer; color: var(--gray); }
        .modal-footer { display: flex; gap: 12px; margin-top: 20px; }
        .modal-footer button { flex: 1; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: 500; }
        .btn-cancel { background: var(--gray-light); border: none; }
        .btn-submit { background: var(--accent); color: white; border: none; }

        .toast {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 20px;
            background: var(--success);
            color: white;
            border-radius: 8px;
            display: none;
            z-index: 2000;
            font-size: 0.9rem;
        }
        .toast.error { background: var(--danger); }
        .toast.active { display: block; }

        @media (max-width: 768px) {
            .admin-header { flex-direction: column; align-items: flex-start; }
            .data-table { display: block; overflow-x: auto; }
        }
    </style>
</head>
<body>
    <div class="login-container" id="loginPage">
        <div class="login-box">
            <h1>🔐 Admin Login</h1>
            <p>Drishti Digital Library</p>
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
                <p class="error-msg" id="loginError">Invalid credentials</p>
            </form>
        </div>
    </div>

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
                <a href="/" target="_blank">👁️ View</a>
                <a href="#" class="logout-btn" onclick="logout()">🚪 Logout</a>
            </nav>
        </header>

        <div class="admin-content">
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
                            <label>Logo Text (e.g., DRISHTI)</label>
                            <input type="text" id="setting_logo_text" data-key="logo_text" placeholder="DRISHTI">
                        </div>
                        <div class="setting-item">
                            <label>Logo Highlight (e.g., DIGITAL LIBRARY)</label>
                            <input type="text" id="setting_logo_highlight" data-key="logo_highlight" placeholder="DIGITAL LIBRARY">
                        </div>
                        <div class="setting-item">
                            <label>Logo Image URL (optional - leave empty for text logo)</label>
                            <input type="text" id="setting_logo_url" data-key="logo_url" placeholder="https://example.com/logo.png">
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
                            <label>Footer Copyright</label>
                            <input type="text" id="setting_footer_text" data-key="footer_text">
                        </div>
                    </div>
                    <div class="setting-item" style="margin-top: 15px;">
                        <label>Google Map Embed URL</label>
                        <textarea id="setting_google_map_embed" data-key="google_map_embed" rows="2"></textarea>
                    </div>
                    <div class="setting-item">
                        <label>About Text</label>
                        <textarea id="setting_about_text" data-key="about_text" rows="3"></textarea>
                    </div>
                </div>
            </div>

            <div class="admin-section" id="section-slides">
                <div class="card">
                    <div class="card-header">
                        <h2>Hero Slides</h2>
                        <button class="btn-add" onclick="openModal('slide')"><i class="fas fa-plus"></i> Add</button>
                    </div>
                    <table class="data-table">
                        <thead><tr><th>Image</th><th>Title</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody id="slidesTable"></tbody>
                    </table>
                </div>
            </div>

            <div class="admin-section" id="section-gallery">
                <div class="card">
                    <div class="card-header">
                        <h2>Gallery</h2>
                        <button class="btn-add" onclick="openModal('gallery')"><i class="fas fa-plus"></i> Add</button>
                    </div>
                    <table class="data-table">
                        <thead><tr><th>Image</th><th>Caption</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody id="galleryTable"></tbody>
                    </table>
                </div>
            </div>

            <div class="admin-section" id="section-shifts">
                <div class="card">
                    <div class="card-header">
                        <h2>Shifts</h2>
                        <button class="btn-add" onclick="openModal('shift')"><i class="fas fa-plus"></i> Add</button>
                    </div>
                    <table class="data-table">
                        <thead><tr><th>Icon</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody id="shiftsTable"></tbody>
                    </table>
                </div>
            </div>

            <div class="admin-section" id="section-facilities">
                <div class="card">
                    <div class="card-header">
                        <h2>Facilities</h2>
                        <button class="btn-add" onclick="openModal('facility')"><i class="fas fa-plus"></i> Add</button>
                    </div>
                    <table class="data-table">
                        <thead><tr><th>Icon</th><th>Title</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody id="facilitiesTable"></tbody>
                    </table>
                </div>
            </div>

            <div class="admin-section" id="section-contacts">
                <div class="card">
                    <div class="card-header"><h2>Contacts</h2></div>
                    <table class="data-table">
                        <thead><tr><th>Name</th><th>Phone</th><th>Shift</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody id="contactsTable"></tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

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

    <div class="toast" id="toast"></div>

    <script>
        let authToken = '';
        let currentEditId = null;
        let currentType = '';

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

        async function apiCall(endpoint, method = 'GET', data = null) {
            const options = {
                method,
                headers: { 'Authorization': 'Basic ' + authToken, 'Content-Type': 'application/json' }
            };
            if (data) options.body = JSON.stringify(data);
            const res = await fetch(endpoint, options);
            return res.json();
        }

        async function loadAllData() {
            loadSettings();
            loadSlides();
            loadGallery();
            loadShifts();
            loadFacilities();
            loadContacts();
        }

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
            showToast('Settings saved!');
        }

        async function loadSlides() {
            const res = await apiCall('/api/admin/slides');
            if (res.success) {
                document.getElementById('slidesTable').innerHTML = res.data.map(s => 
                    '<tr><td><img src="'+s.image_url+'"></td><td>'+s.title+'</td><td><span class="status-badge '+(s.is_active?'status-active':'status-inactive')+'">'+(s.is_active?'Active':'Inactive')+'</span></td><td class="action-btns"><button class="btn-edit" onclick="editItem(\\'slides\\','+s.id+')">Edit</button><button class="btn-delete" onclick="deleteItem(\\'slides\\','+s.id+')">Del</button></td></tr>'
                ).join('');
            }
        }

        async function loadGallery() {
            const res = await apiCall('/api/admin/gallery');
            if (res.success) {
                document.getElementById('galleryTable').innerHTML = res.data.map(g => 
                    '<tr><td><img src="'+g.image_url+'"></td><td>'+(g.caption||'-')+'</td><td><span class="status-badge '+(g.is_active?'status-active':'status-inactive')+'">'+(g.is_active?'Active':'Inactive')+'</span></td><td class="action-btns"><button class="btn-edit" onclick="editItem(\\'gallery\\','+g.id+')">Edit</button><button class="btn-delete" onclick="deleteItem(\\'gallery\\','+g.id+')">Del</button></td></tr>'
                ).join('');
            }
        }

        async function loadShifts() {
            const res = await apiCall('/api/admin/shifts');
            if (res.success) {
                document.getElementById('shiftsTable').innerHTML = res.data.map(s => 
                    '<tr><td><i class="fa '+s.icon+'"></i></td><td>'+s.time_slot+'</td><td><span class="status-badge '+(s.is_active?'status-active':'status-inactive')+'">'+(s.is_active?'Active':'Inactive')+'</span></td><td class="action-btns"><button class="btn-edit" onclick="editItem(\\'shifts\\','+s.id+')">Edit</button><button class="btn-delete" onclick="deleteItem(\\'shifts\\','+s.id+')">Del</button></td></tr>'
                ).join('');
            }
        }

        async function loadFacilities() {
            const res = await apiCall('/api/admin/facilities');
            if (res.success) {
                document.getElementById('facilitiesTable').innerHTML = res.data.map(f => 
                    '<tr><td><i class="fa '+f.icon+'"></i></td><td>'+f.title+'</td><td><span class="status-badge '+(f.is_active?'status-active':'status-inactive')+'">'+(f.is_active?'Active':'Inactive')+'</span></td><td class="action-btns"><button class="btn-edit" onclick="editItem(\\'facilities\\','+f.id+')">Edit</button><button class="btn-delete" onclick="deleteItem(\\'facilities\\','+f.id+')">Del</button></td></tr>'
                ).join('');
            }
        }

        async function loadContacts() {
            const res = await apiCall('/api/admin/contacts');
            if (res.success) {
                document.getElementById('contactsTable').innerHTML = res.data.map(c => 
                    '<tr><td>'+c.name+'</td><td>'+c.phone+'</td><td>'+(c.shift_preference||'-')+'</td><td>'+new Date(c.created_at).toLocaleDateString()+'</td><td><span class="status-badge '+(c.is_read?'status-inactive':'status-active')+'">'+(c.is_read?'Read':'New')+'</span></td><td class="action-btns">'+(!c.is_read?'<button class="btn-edit" onclick="markRead('+c.id+')">✓</button>':'')+'<button class="btn-delete" onclick="deleteItem(\\'contacts\\','+c.id+')">Del</button></td></tr>'
                ).join('');
            }
        }

        async function markRead(id) {
            await apiCall('/api/admin/contacts/' + id + '/read', 'PUT');
            loadContacts();
        }

        async function deleteItem(type, id) {
            if (!confirm('Delete this item?')) return;
            await apiCall('/api/admin/' + type + '/' + id, 'DELETE');
            loadAllData();
            showToast('Deleted');
        }

        async function editItem(type, id) {
            const res = await apiCall('/api/admin/' + type);
            const item = res.data.find(i => i.id === id);
            if (item) {
                currentEditId = id;
                openModal(type.replace(/s$/, ''), item);
            }
        }

        function openModal(type, data = null) {
            currentType = type;
            currentEditId = data ? data.id : null;
            
            const title = document.getElementById('modalTitle');
            const fields = document.getElementById('modalFields');
            
            let html = '';
            
            if (type === 'slide') {
                title.textContent = data ? 'Edit Slide' : 'Add Slide';
                html = '<div class="form-group"><label>Image URL</label><input type="text" name="image_url" value="'+(data?.image_url||'')+'" required></div><div class="form-group"><label>Title</label><input type="text" name="title" value="'+(data?.title||'')+'" required></div><div class="form-group"><label>Subtitle</label><input type="text" name="subtitle" value="'+(data?.subtitle||'')+'"></div><div class="form-group"><label>Sort Order</label><input type="number" name="sort_order" value="'+(data?.sort_order||0)+'"></div>'+(data?'<div class="form-group"><label><input type="checkbox" name="is_active" '+(data?.is_active?'checked':'')+'> Active</label></div>':'');
            } else if (type === 'gallery') {
                title.textContent = data ? 'Edit Image' : 'Add Image';
                html = '<div class="form-group"><label>Image URL</label><input type="text" name="image_url" value="'+(data?.image_url||'')+'" required></div><div class="form-group"><label>Caption</label><input type="text" name="caption" value="'+(data?.caption||'')+'"></div><div class="form-group"><label>Sort Order</label><input type="number" name="sort_order" value="'+(data?.sort_order||0)+'"></div>'+(data?'<div class="form-group"><label><input type="checkbox" name="is_active" '+(data?.is_active?'checked':'')+'> Active</label></div>':'');
            } else if (type === 'shift') {
                title.textContent = data ? 'Edit Shift' : 'Add Shift';
                html = '<div class="form-group"><label>Icon (e.g., fa-sun)</label><input type="text" name="icon" value="'+(data?.icon||'fa-clock')+'"></div><div class="form-group"><label>Time Slot</label><input type="text" name="time_slot" value="'+(data?.time_slot||'')+'" required></div><div class="form-group"><label>Description</label><input type="text" name="description" value="'+(data?.description||'')+'"></div><div class="form-group"><label>Sort Order</label><input type="number" name="sort_order" value="'+(data?.sort_order||0)+'"></div>'+(data?'<div class="form-group"><label><input type="checkbox" name="is_active" '+(data?.is_active?'checked':'')+'> Active</label></div>':'');
            } else if (type === 'facility') {
                title.textContent = data ? 'Edit Facility' : 'Add Facility';
                html = '<div class="form-group"><label>Icon (e.g., fa-wifi)</label><input type="text" name="icon" value="'+(data?.icon||'fa-check')+'"></div><div class="form-group"><label>Title</label><input type="text" name="title" value="'+(data?.title||'')+'" required></div><div class="form-group"><label>Description</label><input type="text" name="description" value="'+(data?.description||'')+'"></div><div class="form-group"><label>Sort Order</label><input type="number" name="sort_order" value="'+(data?.sort_order||0)+'"></div>'+(data?'<div class="form-group"><label><input type="checkbox" name="is_active" '+(data?.is_active?'checked':'')+'> Active</label></div>':'');
            }
            
            fields.innerHTML = html;
            document.getElementById('itemModal').classList.add('active');
        }

        function closeModal() {
            document.getElementById('itemModal').classList.remove('active');
            currentEditId = null;
            currentType = '';
        }

        document.getElementById('modalForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = {};
            
            formData.forEach((value, key) => {
                if (key === 'is_active') data[key] = true;
                else if (key === 'sort_order') data[key] = parseInt(value) || 0;
                else data[key] = value;
            });
            
            if (currentEditId && !data.hasOwnProperty('is_active')) data.is_active = false;
            
            const endpoint = '/api/admin/' + currentType + 's' + (currentEditId ? '/' + currentEditId : '');
            await apiCall(endpoint, currentEditId ? 'PUT' : 'POST', data);
            closeModal();
            loadAllData();
            showToast(currentEditId ? 'Updated!' : 'Added!');
        });

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
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Outfit', sans-serif; }
        body { background: #f8fafc; color: #0f172a; line-height: 1.8; }
        .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
        h1 { font-size: 2rem; margin-bottom: 8px; }
        .date { color: #64748b; margin-bottom: 30px; font-size: 0.9rem; }
        h2 { font-size: 1.3rem; margin: 25px 0 12px; color: #f59e0b; }
        p, li { margin-bottom: 12px; color: #334155; font-size: 0.95rem; }
        ul { margin-left: 20px; }
        .back { display: inline-block; margin-bottom: 20px; color: #f59e0b; text-decoration: none; font-weight: 500; }
    </style>
</head>
<body>
    <div class="container">
        <a href="/" class="back">← Back to Home</a>
        <h1>Terms & Conditions</h1>
        <p class="date">Last Updated: January 2026</p>
        
        <h2>1. Introduction</h2>
        <p>Welcome to Drishti Digital Library. By using our services, you agree to these terms.</p>
        
        <h2>2. Services</h2>
        <p>We provide self-study space with AC, WiFi, newspapers, CCTV surveillance, and power backup.</p>
        
        <h2>3. Membership</h2>
        <ul>
            <li>Must be 16+ years old</li>
            <li>Provide accurate information</li>
            <li>Pay applicable fees</li>
            <li>Follow library rules</li>
        </ul>
        
        <h2>4. Payment</h2>
        <p>Payments via Cashfree. All fees in INR. See Refund Policy for returns.</p>
        
        <h2>5. User Conduct</h2>
        <ul>
            <li>Maintain silence</li>
            <li>Keep premises clean</li>
            <li>No property damage</li>
            <li>Follow shift timings</li>
        </ul>
        
        <h2>6. Liability</h2>
        <p>Not liable for personal belongings loss, property damage, or service interruptions.</p>
        
        <h2>7. Contact</h2>
        <p>Email: info@drishtilibrary.com | Phone: +91 98765 43210</p>
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
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Outfit', sans-serif; }
        body { background: #f8fafc; color: #0f172a; line-height: 1.8; }
        .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
        h1 { font-size: 2rem; margin-bottom: 8px; }
        .date { color: #64748b; margin-bottom: 30px; font-size: 0.9rem; }
        h2 { font-size: 1.3rem; margin: 25px 0 12px; color: #f59e0b; }
        p, li { margin-bottom: 12px; color: #334155; font-size: 0.95rem; }
        ul { margin-left: 20px; }
        .back { display: inline-block; margin-bottom: 20px; color: #f59e0b; text-decoration: none; font-weight: 500; }
    </style>
</head>
<body>
    <div class="container">
        <a href="/" class="back">← Back to Home</a>
        <h1>Privacy Policy</h1>
        <p class="date">Last Updated: January 2026</p>
        
        <h2>1. Information We Collect</h2>
        <ul>
            <li>Personal: Name, email, phone, address</li>
            <li>Payment: Processed via Cashfree</li>
            <li>Usage: How you use our services</li>
        </ul>
        
        <h2>2. How We Use Information</h2>
        <ul>
            <li>Process registrations and payments</li>
            <li>Provide services</li>
            <li>Send updates</li>
            <li>Improve services</li>
        </ul>
        
        <h2>3. Information Sharing</h2>
        <p>We don't sell your data. Shared only with payment processors and when required by law.</p>
        
        <h2>4. Security</h2>
        <p>SSL encryption, secure storage, regular assessments, limited access.</p>
        
        <h2>5. Your Rights</h2>
        <p>Access, correct, delete your data, opt-out of marketing.</p>
        
        <h2>6. Contact</h2>
        <p>Email: info@drishtilibrary.com | Phone: +91 98765 43210</p>
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
    <title>Refund Policy - Drishti Digital Library</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Outfit', sans-serif; }
        body { background: #f8fafc; color: #0f172a; line-height: 1.8; }
        .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
        h1 { font-size: 2rem; margin-bottom: 8px; }
        .date { color: #64748b; margin-bottom: 30px; font-size: 0.9rem; }
        h2 { font-size: 1.3rem; margin: 25px 0 12px; color: #f59e0b; }
        p, li { margin-bottom: 12px; color: #334155; font-size: 0.95rem; }
        ul { margin-left: 20px; }
        .back { display: inline-block; margin-bottom: 20px; color: #f59e0b; text-decoration: none; font-weight: 500; }
        .highlight { background: #fef3c7; border-left: 3px solid #f59e0b; padding: 15px; margin: 15px 0; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <a href="/" class="back">← Back to Home</a>
        <h1>Refund & Cancellation Policy</h1>
        <p class="date">Last Updated: January 2026</p>
        
        <div class="highlight">
            <p><strong>Important:</strong> Read before payment. By paying, you accept these terms.</p>
        </div>
        
        <h2>1. Eligible for Refund</h2>
        <ul>
            <li>Within 24 hours: Full refund (unused)</li>
            <li>Within 7 days: 75% refund (used &lt;3 days)</li>
            <li>Service unavailable: Full refund</li>
            <li>Payment errors: Full refund</li>
        </ul>
        
        <h2>2. Non-Refundable</h2>
        <ul>
            <li>After 7 days of use</li>
            <li>Terminated for violations</li>
            <li>Promotional memberships</li>
            <li>Partial month usage</li>
        </ul>
        
        <h2>3. How to Request</h2>
        <p>Email info@drishtilibrary.com with name, phone, payment reference, and reason.</p>
        
        <h2>4. Processing Time</h2>
        <p>5-7 business days after approval. Bank may take 3-5 additional days.</p>
        
        <h2>5. Contact</h2>
        <p>Email: info@drishtilibrary.com | Phone: +91 98765 43210 (10AM-8PM, Mon-Sat)</p>
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
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Outfit', sans-serif; }
        body { background: #f8fafc; color: #0f172a; line-height: 1.8; }
        .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
        h1 { font-size: 2rem; margin-bottom: 20px; }
        h2 { font-size: 1.3rem; margin: 25px 0 12px; color: #f59e0b; }
        p, li { margin-bottom: 12px; color: #334155; font-size: 0.95rem; }
        ul { margin-left: 20px; }
        .back { display: inline-block; margin-bottom: 20px; color: #f59e0b; text-decoration: none; font-weight: 500; }
        .mission { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 20px; border-radius: 12px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <a href="/" class="back">← Back to Home</a>
        <h1>About Drishti Digital Library</h1>
        
        <p>Jamshedpur's premier self-study center for focused learning and career preparation.</p>
        
        <div class="mission">
            <h3>Our Mission</h3>
            <p>Create a peaceful, well-equipped study environment for students to achieve their goals.</p>
        </div>
        
        <h2>Our Facilities</h2>
        <ul>
            <li>Fully Air-Conditioned</li>
            <li>High-Speed WiFi</li>
            <li>24/7 CCTV Surveillance</li>
            <li>Comfortable Seating</li>
            <li>Power Backup</li>
            <li>Daily Newspapers</li>
            <li>RO Purified Water</li>
        </ul>
        
        <h2>Contact</h2>
        <p><strong>Address:</strong> Main Road, Jamshedpur, Jharkhand - 831001</p>
        <p><strong>Phone:</strong> +91 98765 43210</p>
        <p><strong>Email:</strong> info@drishtilibrary.com</p>
        <p><strong>Hours:</strong> 6:00 AM - 10:00 PM (All Days)</p>
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
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Outfit', sans-serif; }
        body { background: #f8fafc; color: #0f172a; line-height: 1.8; }
        .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
        h1 { font-size: 2rem; margin-bottom: 20px; }
        h2 { font-size: 1.3rem; margin: 25px 0 12px; color: #f59e0b; }
        p { margin-bottom: 12px; color: #334155; font-size: 0.95rem; }
        .back { display: inline-block; margin-bottom: 20px; color: #f59e0b; text-decoration: none; font-weight: 500; }
        .contact-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 25px 0; }
        .contact-card { background: white; padding: 20px; border-radius: 12px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .contact-card i { font-size: 1.8rem; color: #f59e0b; margin-bottom: 10px; }
        .contact-card h3 { font-size: 1rem; margin-bottom: 8px; }
        .contact-card p { color: #64748b; margin: 0; font-size: 0.9rem; }
        .contact-card a { color: #f59e0b; text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <a href="/" class="back">← Back to Home</a>
        <h1>Contact Us</h1>
        <p>Questions? We're here to help!</p>
        
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
                <p><a href="https://wa.me/919876543210">Chat with us</a></p>
            </div>
        </div>
        
        <h2>Hours</h2>
        <p><strong>Monday - Sunday:</strong> 6:00 AM - 10:00 PM</p>
    </div>
</body>
</html>`
}

export default app
