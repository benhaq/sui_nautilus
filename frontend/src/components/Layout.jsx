import Footer from './Footer'
import Header from './Header'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      {/* Account for fixed header height + spacing */}
      <main className="flex-1 pt-24 pb-8 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
      <Footer />
    </div>
  )
}
