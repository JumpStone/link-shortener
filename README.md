# Link Shortener

A personal URL shortener built with Cloudflare Workers for fast, reliable link management.

## Features

- **Custom Domain:** `grueneeule.de`
- **Admin Dashboard:** Accessible via `lnk.jumpow.de` or `grueneeule.de/admin`
- **Security:** Protected by Cloudflare Zero Trust (Access)
- **Custom 404:** Personalized error page for a better user experience
- **Pastebin View:** `grueneeule.de/p/<key>` with copy and raw actions
- **Raw Paste Endpoint:** `grueneeule.de/p/raw/<key>` returns plain text only

## Project Structure

- `src/index.js` - Main application logic handling redirects and the admin interface
- `wrangler.toml` - Configuration for KV storage and domain settings

## API Usage

You can manage links directly via URL endpoints when authenticated:

- **Create Link:** `/add?key=name&url=https://destination.com`
- **Delete Link:** `/del?key=name`

Paste endpoints:

- **Paste Page:** `/p/<key>`
- **Raw Paste:** `/p/raw/<key>`

## Getting Started

Deploy this project to Cloudflare Workers using Wrangler:

```bash
npm install -g @cloudflare/wrangler
wrangler deploy
```
