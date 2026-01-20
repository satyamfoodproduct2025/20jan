# Drishti Digital Library

A modern, attractive self-study library website with Admin Panel built using Hono + Cloudflare Pages + D1 Database.

## Live Preview

🌐 **Preview URL**: [Click to view](https://3000-ila6ggmxjtz8xh8swjdeh-5c13a017.sandbox.novita.ai)

## Features

### Public Website
- ✨ Modern, responsive design with beautiful animations
- 🖼️ Hero slider with dynamic slides
- ⏰ Shifts/Timings section
- 🎯 Facilities showcase
- 📷 Gallery section
- 📝 Contact form with database storage
- 🗺️ Google Maps integration
- 📱 WhatsApp floating button
- 👣 Footer with social links

### Admin Panel (`/admin`)
- 🔐 Secure login with credentials
- ⚙️ Site settings management (logo, phone, address, social links)
- 🖼️ Hero slides management (add, edit, delete)
- 📷 Gallery images management
- ⏰ Shifts/Timings management
- ✨ Facilities management
- 📩 Contact form submissions viewer

### Legal Pages (for Cashfree Payment Gateway)
- 📄 Terms & Conditions (`/terms`)
- 🔒 Privacy Policy (`/privacy`)
- 💰 Refund & Cancellation Policy (`/refund`)
- ℹ️ About Us (`/about`)
- 📞 Contact Us (`/contact`)

## Technology Stack

- **Framework**: Hono (TypeScript)
- **Deployment**: Cloudflare Pages
- **Database**: Cloudflare D1 (SQLite)
- **Styling**: Vanilla CSS with modern design
- **Icons**: Font Awesome 6
- **Fonts**: Google Fonts (Outfit)

## Default Admin Credentials

```
Username: admin
Password: drishti@2026
```

⚠️ **Change these credentials in Cloudflare Dashboard after deployment!**

## API Endpoints

### Public APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get all site settings |
| GET | `/api/slides` | Get active hero slides |
| GET | `/api/gallery` | Get active gallery images |
| GET | `/api/shifts` | Get active shifts |
| GET | `/api/facilities` | Get active facilities |
| POST | `/api/contact` | Submit contact form |

### Admin APIs (requires Basic Auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/login` | Verify admin credentials |
| GET | `/api/admin/settings` | Get all settings |
| PUT | `/api/admin/settings/:key` | Update a setting |
| GET/POST/PUT/DELETE | `/api/admin/slides` | Manage slides |
| GET/POST/PUT/DELETE | `/api/admin/gallery` | Manage gallery |
| GET/POST/PUT/DELETE | `/api/admin/shifts` | Manage shifts |
| GET/POST/PUT/DELETE | `/api/admin/facilities` | Manage facilities |
| GET/PUT/DELETE | `/api/admin/contacts` | Manage contacts |

## Local Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Apply database migrations
npm run db:migrate:local

# Seed database with default data
npm run db:seed

# Start development server
npm run dev:sandbox
```

## Cloudflare Deployment

### Step 1: Create D1 Database
```bash
npx wrangler d1 create drishti-db
```

Copy the database_id and update `wrangler.jsonc`.

### Step 2: Apply Migrations
```bash
npx wrangler d1 migrations apply drishti-db
```

### Step 3: Seed Database (Optional)
```bash
npx wrangler d1 execute drishti-db --file=./seed.sql
```

### Step 4: Deploy
```bash
npm run deploy:prod
```

### Step 5: Set Environment Variables
In Cloudflare Dashboard → Pages → Settings → Environment variables:

| Variable | Value |
|----------|-------|
| `ADMIN_USERNAME` | your_username |
| `ADMIN_PASSWORD` | your_secure_password |

## Changing Admin Credentials (Cloudflare Dashboard)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your Pages project
3. Go to **Settings** → **Environment variables**
4. Add/Edit:
   - `ADMIN_USERNAME`: Your new username
   - `ADMIN_PASSWORD`: Your new secure password
5. Click **Save and Deploy**

## Project Structure

```
webapp/
├── src/
│   └── index.tsx          # Main Hono application
├── migrations/
│   └── 0001_initial.sql   # Database schema
├── seed.sql               # Default data
├── wrangler.jsonc         # Cloudflare configuration
├── package.json           # Dependencies
├── vite.config.ts         # Vite configuration
└── ecosystem.config.cjs   # PM2 configuration
```

## Database Tables

- `site_settings` - Key-value store for site configuration
- `hero_slides` - Hero slider images and content
- `gallery_images` - Gallery photos
- `shifts` - Library shift timings
- `facilities` - Available facilities
- `contact_submissions` - Contact form entries

## Cashfree Payment Gateway Integration

This website includes all required legal pages for Cashfree payment gateway approval:

1. **Terms & Conditions** - Clear service terms
2. **Privacy Policy** - Data handling practices
3. **Refund Policy** - Cancellation and refund rules
4. **About Us** - Business information
5. **Contact Us** - Contact details

Make sure to update these pages with your actual business information before applying for payment gateway.

## Support

For any issues or questions, contact:
- Email: info@drishtilibrary.com
- Phone: +91 98765 43210

---

Made with ❤️ for Drishti Digital Library
