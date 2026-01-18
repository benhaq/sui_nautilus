import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit'
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { EnokiFlowProvider } from "@mysten/enoki/react"
import CustomWalletProvider from './providers/CustomWalletProvider'
import AccessControlPage from './pages/AccessControlPage'
import AIMonetizationPage from './pages/AIMonetizationPage'
import DashboardPage from './pages/DashboardPage'
import HomePage from './pages/HomePage'
import RecordsPage from './pages/RecordsPage'
import AuthCallbackPage from './pages/AuthCallbackPage'
import IntroPage from './pages/IntroPage'
import InsuranceClaimsPage from './pages/InsuranceClaimsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
})

const networks = {
  testnet: { url: getFullnodeUrl('testnet') },
  mainnet: { url: getFullnodeUrl('mainnet') },
}

const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') })

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networks} defaultNetwork="testnet">

        {/* <EnokiFlowProvider
          apiKey={import.meta.env.VITE_ENOKI_API_KEY}
        > */}
          <Router>

            <WalletProvider autoConnect>
              {/* <CustomWalletProvider> */}
                <Routes>
                  <Route path="/" element={<IntroPage />} />
                  <Route path="/home" element={<Layout><HomePage /></Layout>} />
                  <Route path="/dashboard" element={<Layout><DashboardPage /></Layout>} />
                  <Route path="/records" element={<Layout><RecordsPage /></Layout>} />
                  <Route path="/access" element={<Layout><AccessControlPage /></Layout>} />
                  <Route path="/ai-monetization" element={<Layout><AIMonetizationPage /></Layout>} />
                  <Route path="/insurance-claims" element={<Layout><InsuranceClaimsPage /></Layout>} />
                  <Route path="/auth" element={<Layout><AuthCallbackPage /></Layout>} />
                </Routes>
              {/* </CustomWalletProvider> */}
            </WalletProvider>
          </Router>
        {/* </EnokiFlowProvider> */}

      </SuiClientProvider>
    </QueryClientProvider >
  )
}

export default App
