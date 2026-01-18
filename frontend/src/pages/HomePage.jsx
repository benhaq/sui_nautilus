import { ArrowRight, CheckCircle, Database, FileText, Lock, Shield, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function HomePage() {
  const features = [
    {
      icon: Lock,
      title: 'End-to-End Encryption',
      description: 'Your medical data is encrypted using Seal Network before storage',
    },
    {
      icon: Database,
      title: 'Decentralized Storage',
      description: 'Files stored on Walrus for maximum privacy and availability',
    },
    {
      icon: Shield,
      title: 'Blockchain Security',
      description: 'Access control enforced on Sui blockchain',
    },
    {
      icon: Users,
      title: 'Permission Management',
      description: 'Grant doctors and members access to specific records',
    },
    {
      icon: FileText,
      title: 'Immutable Log Trail',
      description: 'Every access is logged permanently on-chain',
    },
    {
      icon: CheckCircle,
      title: 'Patient Ownership',
      description: 'You own and control all your medical data',
    },
  ]

  const benefits = [
    'No centralized database vulnerabilities',
    'Transparent access control',
    'Privacy-preserving architecture',
    'Compatible with Sui Wallet & Suiet',
    'HIPAA-compliant encryption',
    'Portable medical history',
  ]

  return (
    <div className="mx-auto max-w-7xl">
      {/* Hero Section */}
      <section className="text-center py-16 sm:py-20">
        <div className="inline-flex items-center px-4 py-2 bg-primary-50 dark:bg-primary-900/20 rounded-full mb-6">
          <Shield className="w-4 h-4 text-primary-600 dark:text-primary-400 mr-2" />
          <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
            Built on Sui Blockchain
          </span>
        </div>
        
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold text-text-light dark:text-text-dark mb-6">
          Your Medical Records,
          <br />
          <span className="text-primary-500">Truly Private & Secure</span>
        </h1>
        
        <p className="text-lg sm:text-xl text-text-muted max-w-3xl mx-auto mb-8">
          A decentralized medical record system where patients own their data. 
          Built with blockchain, end-to-end encryption, and decentralized storage.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/dashboard"
            className="inline-flex items-center px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors duration-200 cursor-pointer shadow-lg font-medium"
          >
            Get Started
            <ArrowRight className="w-5 h-5 ml-2" />
          </Link>
          <a
            href="#features"
            className="inline-flex items-center px-6 py-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-text-light dark:text-text-dark rounded-lg transition-colors duration-200 cursor-pointer border border-border-light dark:border-border-dark font-medium"
          >
            Learn More
          </a>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-heading font-bold text-text-light dark:text-text-dark mb-4">
            Why Medical Vault?
          </h2>
          <p className="text-lg text-text-muted max-w-2xl mx-auto">
            Combining blockchain technology with encryption to create a truly secure medical record system
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <div
                key={index}
                className="group p-6 bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-border-dark hover:border-primary-500 dark:hover:border-primary-500 transition-all duration-200 cursor-pointer hover:shadow-lg"
              >
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 transition-colors duration-200">
                    <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                  </div>
                </div>
                <h3 className="text-lg font-heading font-semibold text-text-light dark:text-text-dark mb-2">
                  {feature.title}
                </h3>
                <p className="text-text-muted">
                  {feature.description}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16">
        <div className="bg-gradient-to-br from-primary-50 to-success-50 dark:from-primary-900/20 dark:to-success-900/20 rounded-2xl p-8 sm:p-12 border border-border-light dark:border-border-dark">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-heading font-bold text-text-light dark:text-text-dark mb-6">
                Built for Privacy & Trust
              </h2>
              <ul className="space-y-3">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-success-600 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-text-light dark:text-text-dark">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-border-light dark:border-border-dark">
              <h3 className="text-xl font-heading font-semibold text-text-light dark:text-text-dark mb-4">
                How It Works
              </h3>
              <ol className="space-y-4">
                <li className="flex items-start">
                  <span className="flex items-center justify-center w-8 h-8 bg-primary-500 text-white rounded-full font-semibold text-sm mr-3 flex-shrink-0">
                    1
                  </span>
                  <div>
                    <p className="font-medium text-text-light dark:text-text-dark">Connect Your Wallet</p>
                    <p className="text-sm text-text-muted">Use Sui Wallet or Suiet</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="flex items-center justify-center w-8 h-8 bg-primary-500 text-white rounded-full font-semibold text-sm mr-3 flex-shrink-0">
                    2
                  </span>
                  <div>
                    <p className="font-medium text-text-light dark:text-text-dark">Upload Medical Records</p>
                    <p className="text-sm text-text-muted">Files are encrypted automatically</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="flex items-center justify-center w-8 h-8 bg-primary-500 text-white rounded-full font-semibold text-sm mr-3 flex-shrink-0">
                    3
                  </span>
                  <div>
                    <p className="font-medium text-text-light dark:text-text-dark">Manage Access</p>
                    <p className="text-sm text-text-muted">Grant permissions on-chain</p>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 text-center">
        <div className="bg-primary-500 rounded-2xl p-8 sm:p-12 text-white">
          <h2 className="text-3xl sm:text-4xl font-heading font-bold mb-4">
            Ready to Take Control?
          </h2>
          <p className="text-lg text-primary-50 mb-8 max-w-2xl mx-auto">
            Join the decentralized healthcare revolution. Your data, your control, your privacy.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center px-8 py-4 bg-white hover:bg-gray-100 text-primary-600 rounded-lg transition-colors duration-200 cursor-pointer shadow-lg font-medium text-lg"
          >
            Start Using Medical Vault
            <ArrowRight className="w-5 h-5 ml-2" />
          </Link>
        </div>
      </section>
    </div>
  )
}
