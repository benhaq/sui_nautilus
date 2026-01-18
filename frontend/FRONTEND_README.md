# Medical Vault Frontend - Setup Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ or Bun
- npm or bun package manager
- Sui Wallet extension installed in browser

### Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your configuration:
   - Backend API URL
   - Sui network (testnet/mainnet)
   - Walrus endpoints
   - Contract package ID

3. **Start Development Server**
   ```bash
   npm run dev
   ```
   
   Open [http://localhost:3000](http://localhost:3000)

## 🏗️ Project Structure

```
frontend/
├── src/
│   ├── components/         # React components
│   │   ├── Header.jsx      # Navigation header with wallet
│   │   ├── Footer.jsx      # Site footer
│   │   ├── Layout.jsx      # Main layout wrapper
│   │   └── WalletButton.jsx # Wallet connection button
│   ├── pages/              # Page components
│   │   ├── HomePage.jsx    # Landing page
│   │   ├── DashboardPage.jsx   # User dashboard
│   │   ├── RecordsPage.jsx     # Medical records management
│   │   └── AccessControlPage.jsx # Permission management
│   ├── services/           # API & blockchain services
│   │   ├── api.js          # Backend API client
│   │   ├── sui.js          # Sui blockchain service
│   │   └── walrus.js       # Walrus storage service
│   ├── hooks/              # Custom React hooks
│   │   └── index.js        # useDarkMode, useDebounce, etc.
│   └── utils/              # Utility functions
│       ├── helpers.js      # Helper functions
│       └── constants.js    # App constants
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## 🎨 Design System

### Color Palette
Based on healthcare UI/UX research:

- **Primary**: Healthcare Blue (#0891B2)
- **Secondary**: Cyan (#22D3EE)
- **Success**: Green (#059669)
- **Background Light**: #F8FAFC
- **Background Dark**: #0F172A
- **Text**: #1E293B / #F1F5F9

### Typography
- **Headings**: Lexend (accessible, readable)
- **Body**: Source Sans 3 (professional)

### Design Principles
- Trust & Authority styling
- Minimalism & Swiss modernism
- WCAG AAA accessibility
- Reduced motion support
- Professional medical aesthetic

## 🔌 Key Features

### Wallet Integration
- Connect with Sui Wallet or Suiet
- Auto-connect on return
- Sign transactions & messages
- Display wallet address

### Medical Records
- Create & organize folders
- Upload encrypted files
- View record history
- Search & filter records

### Access Control
- Grant permissions to doctors
- Set expiration dates
- View active permissions
- Revoke access on-chain

### Security
- End-to-end encryption (Seal Network)
- Decentralized storage (Walrus)
- On-chain access control
- Immutable audit trail

## 🛠️ Technologies

- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router 6
- **Blockchain**: Sui + dapp-kit
- **State**: React Query (TanStack)
- **Icons**: Lucide React
- **Storage**: Walrus Protocol

## 📝 Available Scripts

```bash
# Development
npm run dev          # Start dev server (port 3000)

# Production
npm run build        # Build for production
npm run preview      # Preview production build

# Code Quality
npm run lint         # Run ESLint
```

## 🔐 Environment Variables

```env
# Backend API
VITE_API_BASE_URL=http://localhost:3001

# Sui Network
VITE_SUI_NETWORK=testnet
VITE_SUI_RPC_URL=https://fullnode.testnet.sui.io

# Walrus Storage
VITE_WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
VITE_WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space

# Smart Contract
VITE_MEDICAL_VAULT_PACKAGE_ID=0x...
```

## 🌐 API Integration

### Backend Endpoints
- `GET /records/:address` - Get medical records
- `POST /records` - Create new record
- `GET /folders/:address` - Get medical folders
- `POST /access/grant` - Grant access permission
- `DELETE /access/revoke/:id` - Revoke access

See [src/services/api.js](src/services/api.js) for full API client.

## 🧪 Testing

Connect wallet and test core flows:
1. **Wallet Connection** - Connect Sui wallet
2. **Dashboard** - View stats and recent records
3. **Records** - Create folders and manage records
4. **Access Control** - Grant/revoke permissions

## 📱 Responsive Design

Tested breakpoints:
- Mobile: 320px - 767px
- Tablet: 768px - 1023px
- Desktop: 1024px+

## ♿ Accessibility

- Semantic HTML
- ARIA labels on interactive elements
- Keyboard navigation support
- Focus visible states
- Reduced motion support
- WCAG AAA contrast ratios

## 🎯 Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

Requires browser with Web3 wallet extension support.

## 📄 License

MIT License

## 🤝 Contributing

See main project README for contribution guidelines.

## 🐛 Known Issues

- Wallet connection requires browser extension
- Some transactions may require gas fees
- Testnet data may be reset periodically

## 📞 Support

For issues or questions:
- Check documentation
- Review backend API status
- Verify wallet connection
- Check browser console for errors

---

Built with ❤️ for Sui Hackathon
