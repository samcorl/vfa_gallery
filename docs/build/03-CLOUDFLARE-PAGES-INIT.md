# 03-CLOUDFLARE-PAGES-INIT.md
## Set Up CloudFlare Pages Project with Wrangler CLI

**Goal:** Install and configure Wrangler CLI, create a `wrangler.toml` configuration file for CloudFlare Pages deployment, and verify local development works with `wrangler pages dev`.

---

## Spec Extract

From **01-TECHNICAL-SPEC.md**:
- **Hosting:** CloudFlare Pages (static/serverless)
- **Build Tool:** Vite

---

## Prerequisites

**Must Complete First:**
- 01-PROJECT-SCAFFOLD.md ✓
- 02-TAILWIND-SETUP.md ✓

---

## Steps

### Step 1: Install Wrangler CLI

From the project root (`/site`), run:

```bash
npm install -D wrangler
```

This installs the Wrangler CLI as a development dependency.

### Step 2: Verify Wrangler Installation

```bash
npx wrangler --version
```

Should output a version number (e.g., `wrangler 3.x.x`).

### Step 3: Create wrangler.toml Configuration File

Create a new file `/site/wrangler.toml` with the following contents:

```toml
name = "site"
type = "javascript"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[build]
command = "npm run build"
cwd = "."
watch_paths = ["src/**/*.ts", "src/**/*.tsx"]

[build.upload]
format = "service-worker"

[env.production]
name = "site"

[env.preview]
name = "site-preview"

[[env.production.vars]]

[[env.preview.vars]]

[[triggers.crons]]
crons = []
```

**Key Configuration Details:**
- `name`: Project name (used in CloudFlare dashboard)
- `type`: Set to "javascript" for frontend projects
- `compatibility_date`: Date for CloudFlare runtime compatibility (use current year)
- `compatibility_flags`: Enables Node.js compatibility for Workers
- `[build]`: Specifies build command (`npm run build`) and watch paths
- `[env.production]` and `[env.preview]`: Environment-specific configs (can add vars later)

### Step 4: Verify Vite Build Configuration

Ensure `/site/vite.config.ts` is properly configured to output to the `dist/` directory.

Edit `/site/vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 5173,
  },
})
```

**Key settings:**
- `outDir: 'dist'` - CloudFlare Pages serves from this directory
- `sourcemap: true` - Useful for debugging in production

### Step 5: Create Build Script in package.json

Verify `/site/package.json` has a `build` script. Edit `package.json` to ensure `"scripts"` section includes:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

The `build` script should:
1. Run TypeScript compiler (`tsc`) to check types
2. Run Vite build to create production bundle

### Step 6: Test Build Command

From the project root, run:

```bash
npm run build
```

This should:
1. Compile TypeScript with no errors
2. Create a `/site/dist/` directory with `index.html` and bundled assets
3. Show build summary (e.g., "4 modules transformed")

Check the output:

```bash
ls -la dist/
```

You should see:
- `index.html` (main entry point)
- `assets/` folder with `.js` and `.css` files

### Step 7: Test Wrangler Local Development

Start the CloudFlare Pages local development server:

```bash
npx wrangler pages dev dist/
```

This should:
1. Start a local server (typically at `http://localhost:8788`)
2. Serve the built assets from `dist/`
3. Show output like: "Listening on http://0.0.0.0:8788"

Open the browser and navigate to the printed URL. Verify:
- Page loads without errors
- Tailwind styles render correctly
- Network requests in DevTools show successful responses

### Step 8: Configure CloudFlare Account (Optional - for Later Deployment)

To prepare for actual deployment to CloudFlare Pages:

1. Ensure you have a CloudFlare account (sign up at https://dash.cloudflare.com)
2. Connect Git repository to CloudFlare (this is done in the dashboard, not needed now)
3. CloudFlare will automatically build and deploy on git push

For now, just having `wrangler.toml` configured is sufficient.

### Step 9: Verify Local Development Workflow

You should now be able to use two separate development flows:

**Option A: Vite Dev Server (Fast, Hot Reload)**
```bash
npm run dev
```
- Use this during active development (faster hot module reload)
- Runs on `http://localhost:5173`

**Option B: CloudFlare Pages Local Dev**
```bash
npm run build && npx wrangler pages dev dist/
```
- Use this to test production build locally
- Matches CloudFlare Pages production environment
- Runs on `http://localhost:8788`

---

## Files to Create/Modify

**Created:**
- `/site/wrangler.toml` - CloudFlare Pages configuration

**Modified:**
- `/site/vite.config.ts` - Ensure `outDir: 'dist'` and sourcemap enabled
- `/site/package.json` - Verify `build` script includes `tsc && vite build`

---

## Verification Checklist

- [ ] `npx wrangler --version` outputs a version number
- [ ] `wrangler.toml` exists in project root with all required sections
- [ ] `npm run build` completes successfully (0 TypeScript errors)
- [ ] `dist/` directory created with `index.html` and `assets/` folder
- [ ] `dist/index.html` contains a `<div id="root">` element
- [ ] `npx wrangler pages dev dist/` starts local server without errors
- [ ] Browser loads styled page from `wrangler pages dev` (test URL provided)
- [ ] No console errors in either dev mode (`npm run dev` or `wrangler pages dev`)

Once all items checked, proceed to **04-D1-DATABASE-INIT.md**.
