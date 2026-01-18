import { Key, Menu, Shield, X } from 'lucide-react'
import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import DarkModeToggle from './DarkModeToggle'
import GoogleLoginButton from './GoogleLoginButton'
import SetupKeyModal from './SetupKeyModal'
import WalletButton from './WalletButton'
import { useDarkMode } from '../hooks'
import IconMain from "../../public/images/Logos/Icon-main.png";
import IconDark from "../../public/images/Logos/Icon-white.png";


export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const [showSetupKey, setShowSetupKey] = React.useState(false);
  const [isDarkMode] = useDarkMode();
  const location = useLocation()

  const navigation = [
    { name: 'Home', href: '/home' },
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Records', href: '/records' },
    { name: 'Insurance Claims', href: '/insurance-claims' },
    { name: 'AI & Monetization', href: '/ai-monetization' },
    // { name: 'Access Control', href: '/access' },
  ]

  const isActive = (path) => location.pathname === path

  return (
    <header className="fixed top-4 left-4 right-4 z-50">
      <nav className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border border-border-light dark:border-border-dark rounded-2xl shadow-lg">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2 group cursor-pointer">
              <div className="p-2 bg-primary-500 rounded-lg transition-colors duration-200 group-hover:bg-primary-600">
                {/* <Shield className="w-6 h-6 text-white" /> */}
                <img 
                  key={isDarkMode ? 'dark' : 'light'} 
                  className='w-5' 
                  src={isDarkMode ? IconDark : IconMain} 
                  alt="MedNG Logo" 
                />
              </div>
              <span className="text-xl font-heading font-semibold text-text-light dark:text-text-dark">
                MedNG
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex md:items-center md:space-x-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer ${isActive(item.href)
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                    : 'text-text-muted hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-text-light dark:hover:text-text-dark'
                    }`}
                >
                  {item.name}
                </Link>
              ))}
            </div>

            {/* Wallet Button + Dark Mode + Mobile Menu */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowSetupKey(true)}
                className="hidden sm:inline-flex items-center px-3 py-2 text-sm font-medium text-text-muted hover:text-text-light dark:hover:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200"
                title="Setup Private Key (Dev Only)"
              >
                <Key className="w-4 h-4" />
              </button>
              <DarkModeToggle />
              {/* <GoogleLoginButton /> */}
              <WalletButton />
              <button
                type="button"
                className="md:hidden p-2 rounded-lg text-text-muted hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 cursor-pointer"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border-light dark:border-border-dark">
            <div className="space-y-1 px-4 py-3">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer ${isActive(item.href)
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                    : 'text-text-muted hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Setup Key Modal */}
      {showSetupKey && (
        <SetupKeyModal
          onClose={() => setShowSetupKey(false)}
          onSuccess={() => {
            console.log('Private key saved successfully')
          }}
        />
      )}
    </header>
  )
}
