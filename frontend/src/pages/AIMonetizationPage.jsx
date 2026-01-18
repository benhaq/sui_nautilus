import { useCurrentAccount } from '@mysten/dapp-kit';
import { Activity, DollarSign, MessageSquare, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import AIChatInterface from '../components/AIChatInterface';
import BeepPaymentModal from '../components/BeepPaymentModal';
import DataMonetizationControl from '../components/DataMonetizationControl';
import PaymentModal from '../components/PaymentModal';
import TransactionHistory from '../components/TransactionHistory';
import api from '../services/api';

/**
 * AI & Monetization Page - New page for MCP features
 * Supports both x402 (Sui) and a402 (Beep) payment protocols
 */
export default function AIMonetizationPage() {
  const [activeTab, setActiveTab] = useState('chat'); // chat, history, monetization
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [currentPaymentData, setCurrentPaymentData] = useState(null);
  const [currentPaymentProtocol, setCurrentPaymentProtocol] = useState('x402');
  const [accessToken, setAccessToken] = useState(null);
  const [shouldRetryQuery, setShouldRetryQuery] = useState(false);
  const [paymentProtocol, setPaymentProtocol] = useState('x402'); // User-selected protocol
  const [beepSessionId, setBeepSessionId] = useState(null);
  
  // Get patient address from connected wallet
  const currentAccount = useCurrentAccount();
  const patientAddress = currentAccount?.address || '';

  // Initialize Beep session when protocol is a402
  useEffect(() => {
    if (paymentProtocol === 'a402' && patientAddress && !beepSessionId) {
      initializeBeepSession();
    }
  }, [paymentProtocol, patientAddress]);

  const initializeBeepSession = async () => {
    try {
      console.log('Initializing Beep session...');
      const response = await api.beepInitSession();
      if (response.success) {
        setBeepSessionId(response.data.sessionId);
        console.log('Beep session initialized:', response.data.sessionId);
      }
    } catch (error) {
      console.error('Failed to initialize Beep session:', error);
      
      // Show user-friendly error
      alert(`Beep A402 is not available: ${error.message}\n\nPlease use x402 protocol instead or contact administrator to configure BEEP_API_KEY.`);
      
      // Fallback to x402
      setPaymentProtocol('x402');
    }
  };

  const handlePaymentRequired = (paymentData, protocol = 'x402') => {
    setCurrentPaymentData(paymentData);
    setCurrentPaymentProtocol(protocol);
    setPaymentModalOpen(true);
  };

  const handlePaymentSuccess = (data) => {
    setAccessToken(data.accessToken);
    setPaymentModalOpen(false);
    
    // Store access token for subsequent requests
    localStorage.setItem('mcp_access_token', data.accessToken);
    
    // Trigger retry in AIChatInterface
    setShouldRetryQuery(true);
    setTimeout(() => setShouldRetryQuery(false), 100);
  };

  const tabs = [
    { id: 'chat', label: 'AI Chat', icon: MessageSquare },
    { id: 'history', label: 'Transaction History', icon: Activity },
    { id: 'monetization', label: 'Data Monetization', icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                AI Assistant & Data Monetization
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Query your medical data with AI and control monetization settings
              </p>
            </div>
            
            {/* Payment Protocol Selector */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
                <label className="text-sm text-gray-600 dark:text-gray-400">Protocol:</label>
                <select
                  value={paymentProtocol}
                  onChange={(e) => setPaymentProtocol(e.target.value)}
                  className="bg-transparent text-gray-900 dark:text-white font-medium text-sm focus:outline-none"
                >
                  <option value="x402">x402 (Sui Direct)</option>
                  <option value="a402">a402 (Beep)</option>
                </select>
              </div>
              {paymentProtocol === 'a402' && !beepSessionId && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                  ⚠️ Initializing Beep session...
                </p>
              )}
              {paymentProtocol === 'a402' && beepSessionId && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  ✓ Beep session active
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                      ${
                        activeTab === tab.id
                          ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          {!patientAddress ? (
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-900 mb-4">
                <DollarSign className="w-8 h-8 text-yellow-600 dark:text-yellow-300" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Wallet Not Connected
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Please connect your Sui wallet to use AI features and micropayments
              </p>
            </div>
          ) : (
            <>
              {activeTab === 'chat' && (
                <div className="h-[600px]">
                  <AIChatInterface
                    patientAddress={patientAddress}
                    onPaymentRequired={handlePaymentRequired}
                    accessToken={accessToken}
                    shouldRetryQuery={shouldRetryQuery}
                    paymentProtocol={paymentProtocol}
                    beepSessionId={beepSessionId}
                  />
                </div>
              )}

              {activeTab === 'history' && (
                <div className="p-6">
                  <TransactionHistory patientAddress={patientAddress} />
                </div>
              )}

              {activeTab === 'monetization' && (
                <div className="p-6">
                  <DataMonetizationControl patientAddress={patientAddress} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
            <MessageSquare className="w-8 h-8 mb-3" />
            <h3 className="font-semibold mb-2">AI Medical Assistant</h3>
            <p className="text-sm opacity-90">
              Query your medical records using natural language. Pay only for what you access.
            </p>
          </div>

          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
            <DollarSign className="w-8 h-8 mb-3" />
            <h3 className="font-semibold mb-2">Micropayments</h3>
            <p className="text-sm opacity-90">
              x402 (Sui) and a402 (Beep) protocols enable secure pay-per-query access with instant settlement.
            </p>
          </div>

          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
            <TrendingUp className="w-8 h-8 mb-3" />
            <h3 className="font-semibold mb-2">Data Monetization</h3>
            <p className="text-sm opacity-90">
              Control who can access your data and earn from your medical records.
            </p>
          </div>
        </div>
      </div>

      {/* Payment Modals */}
      {paymentModalOpen && currentPaymentData && (
        <>
          {currentPaymentProtocol === 'a402' ? (
            <BeepPaymentModal
              isOpen={paymentModalOpen}
              onClose={() => setPaymentModalOpen(false)}
              paymentData={currentPaymentData}
              beepSessionId={beepSessionId}
              patientAddress={patientAddress}
              onSuccess={handlePaymentSuccess}
            />
          ) : (
            <PaymentModal
              isOpen={paymentModalOpen}
              onClose={() => setPaymentModalOpen(false)}
              paymentData={currentPaymentData}
              patientAddress={patientAddress}
              onSuccess={handlePaymentSuccess}
            />
          )}
        </>
      )}
    </div>
  );
}
