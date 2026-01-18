# 🚀 Medical Vault Frontend - Quick Reference

## 📋 Essential Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev                    # → http://localhost:3000

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## 🔑 Key Files to Configure

1. **`.env`** (copy from `.env.example`)
   - Backend API URL
   - Sui network settings
   - Contract addresses

2. **`src/utils/constants.js`**
   - App-wide constants
   - API endpoints
   - Configuration values

3. **`tailwind.config.js`**
   - Theme customization
   - Color palette
   - Breakpoints

## 📦 Package Structure

```
25 files total:
├── 6 config files (package.json, vite.config.js, etc.)
├── 3 entry files (index.html, main.jsx, App.jsx)
├── 6 components
├── 4 pages
├── 3 services
├── 3 utilities
└── 3 docs
```

## 🎨 Color Reference

```javascript
// Healthcare Blue Theme
Primary:   #0891B2  // Trust, professional
Secondary: #22D3EE  // Modern, tech
Success:   #059669  // Health, wellness
```

## 🔗 Important Links

- Dev Server: http://localhost:3000
- [Setup Guide](./FRONTEND_README.md)
- [Design Docs](./DESIGN_DOCS.md)
- [Build Summary](./BUILD_SUMMARY.md)

## ⚡ Hot Tips

- Use `@/` for absolute imports (configured in vite.config.js)
- Dark mode auto-detects system preference
- Wallet connects to Sui testnet by default
- All API calls go through `src/services/api.js`

## 🐛 Troubleshooting

**Port already in use?**
```bash
# Change port in vite.config.js or:
npm run dev -- --port 3001
```

**Wallet not connecting?**
- Install Sui Wallet extension
- Check network (testnet/mainnet)
- Clear browser cache

**Build errors?**
```bash
rm -rf node_modules dist
npm install
npm run build
```

## 📞 Need Help?

1. Check [FRONTEND_README.md](./FRONTEND_README.md) for detailed setup
2. Review [DESIGN_DOCS.md](./DESIGN_DOCS.md) for design system
3. See [BUILD_SUMMARY.md](./BUILD_SUMMARY.md) for complete overview

---

**Status**: ✅ Ready to run  
**Next**: Configure `.env` and connect backend
