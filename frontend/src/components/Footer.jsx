import { Github, Shield, Twitter } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-white dark:bg-gray-900 border-t border-border-light dark:border-border-dark mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="p-2 bg-primary-500 rounded-lg">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-heading font-semibold">Medical Vault</span>
            </div>
            <p className="text-sm text-text-muted max-w-sm">
              A privacy-first, patient-owned medical record system built on Sui Blockchain with end-to-end encryption and decentralized storage.
            </p>
            <div className="flex items-center space-x-4 mt-4">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-muted hover:text-primary-500 transition-colors duration-200 cursor-pointer"
                aria-label="GitHub"
              >
                <Github className="w-5 h-5" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-muted hover:text-primary-500 transition-colors duration-200 cursor-pointer"
                aria-label="Twitter"
              >
                <Twitter className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className="font-heading font-semibold mb-4">Product</h3>
            <ul className="space-y-2 text-sm text-text-muted">
              <li><a href="#" className="hover:text-primary-500 transition-colors duration-200 cursor-pointer">Features</a></li>
              <li><a href="#" className="hover:text-primary-500 transition-colors duration-200 cursor-pointer">Security</a></li>
              <li><a href="#" className="hover:text-primary-500 transition-colors duration-200 cursor-pointer">Pricing</a></li>
              <li><a href="#" className="hover:text-primary-500 transition-colors duration-200 cursor-pointer">Roadmap</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-heading font-semibold mb-4">Resources</h3>
            <ul className="space-y-2 text-sm text-text-muted">
              <li><a href="#" className="hover:text-primary-500 transition-colors duration-200 cursor-pointer">Documentation</a></li>
              <li><a href="#" className="hover:text-primary-500 transition-colors duration-200 cursor-pointer">API Reference</a></li>
              <li><a href="#" className="hover:text-primary-500 transition-colors duration-200 cursor-pointer">Support</a></li>
              <li><a href="#" className="hover:text-primary-500 transition-colors duration-200 cursor-pointer">Privacy Policy</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border-light dark:border-border-dark">
          <p className="text-center text-sm text-text-muted">
            © {new Date().getFullYear()} Medical Vault. Built on Sui Blockchain. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
