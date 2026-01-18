import { DollarSign, Info, Settings, TrendingUp, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import Alert from './Alert';
import LoadingSpinner from './LoadingSpinner';

/**
 * Data Monetization Control Component
 * Allow users to enable/disable data monetization and set pricing
 */
export default function DataMonetizationControl({ patientAddress }) {
  const [isMonetizationEnabled, setIsMonetizationEnabled] = useState(false);
  const [pricing, setPricing] = useState({
    searchQuery: '0.05',
    clinicalSummary: '0.10',
    fhirResource: '0.03',
    bulkExport: '0.50',
  });
  const [accessScopes, setAccessScopes] = useState({
    readObservations: true,
    readRecords: true,
    readPatient: false,
    readDiagnostics: false,
    exportData: false,
  });
  const [earnings, setEarnings] = useState({
    total: '0.00',
    thisMonth: '0.00',
    lastMonth: '0.00',
    accessCount: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (patientAddress) {
      loadMonetizationSettings();
      loadEarningsData();
    }
  }, [patientAddress]);

  const loadMonetizationSettings = async () => {
    setIsLoading(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      
      // Load settings from backend (implement this endpoint)
      // For now, use local state
      
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading monetization settings:', err);
      setError('Failed to load settings');
      setIsLoading(false);
    }
  };

  const loadEarningsData = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      
      // Load earnings from payment history
      const response = await fetch(
        `${API_BASE_URL}/api/payment/history?patientAddress=${patientAddress}`
      );
      
      if (response.ok) {
        const data = await response.json();
        
        // Calculate earnings (simplified)
        const verifiedPayments = data.data.filter(p => p.action === 'payment_verified');
        const total = verifiedPayments.length * 0.1; // Simplified calculation
        
        setEarnings({
          total: total.toFixed(2),
          thisMonth: (total * 0.6).toFixed(2), // Example
          lastMonth: (total * 0.4).toFixed(2), // Example
          accessCount: verifiedPayments.length,
        });
      }
    } catch (err) {
      console.error('Error loading earnings:', err);
    }
  };

  const handleToggleMonetization = async () => {
    setIsSaving(true);
    setError(null);
    
    try {
      // In production, save to backend
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      setIsMonetizationEnabled(!isMonetizationEnabled);
      setSuccess(
        !isMonetizationEnabled
          ? 'Data monetization enabled successfully'
          : 'Data monetization disabled successfully'
      );
    } catch (err) {
      setError('Failed to update monetization settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePricingChange = (key, value) => {
    setPricing(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleScopesChange = (key, value) => {
    setAccessScopes(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setError(null);
    
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      
      // Save settings to backend (implement this endpoint)
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      setSuccess('Settings saved successfully');
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Data Monetization
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Control how your medical data can be accessed and monetized
        </p>
      </div>

      {success && (
        <Alert type="success" message={success} onClose={() => setSuccess(null)} className="mb-4" />
      )}
      
      {error && (
        <Alert type="error" message={error} onClose={() => setError(null)} className="mb-4" />
      )}

      {/* Master Toggle */}
      <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 mb-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8" />
            <div>
              <h3 className="text-lg font-semibold">Data Monetization</h3>
              <p className="text-sm opacity-90">
                {isMonetizationEnabled ? 'Currently enabled' : 'Currently disabled'}
              </p>
            </div>
          </div>
          
          <button
            onClick={handleToggleMonetization}
            disabled={isSaving}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              isMonetizationEnabled ? 'bg-white' : 'bg-green-800'
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-green-600 transition-transform ${
                isMonetizationEnabled ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Earnings Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-300" />
            <span className="text-sm text-blue-800 dark:text-blue-200">Total Earnings</span>
          </div>
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
            {earnings.total} SUI
          </div>
        </div>
        
        <div className="bg-green-50 dark:bg-green-900 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-green-600 dark:text-green-300" />
            <span className="text-sm text-green-800 dark:text-green-200">This Month</span>
          </div>
          <div className="text-2xl font-bold text-green-900 dark:text-green-100">
            {earnings.thisMonth} SUI
          </div>
        </div>
        
        <div className="bg-purple-50 dark:bg-purple-900 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-purple-600 dark:text-purple-300" />
            <span className="text-sm text-purple-800 dark:text-purple-200">Access Count</span>
          </div>
          <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
            {earnings.accessCount}
          </div>
        </div>
      </div>

      {/* Pricing Settings */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Pricing Configuration
        </h3>
        
        <div className="space-y-4">
          {Object.entries(pricing).map(([key, value]) => {
            const labels = {
              searchQuery: 'Search Query',
              clinicalSummary: 'Clinical Summary',
              fhirResource: 'FHIR Resource Query',
              bulkExport: 'Bulk Data Export',
            };
            
            return (
              <div key={key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <label className="font-medium text-gray-900 dark:text-white">
                    {labels[key]}
                  </label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Cost per request
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={value}
                    onChange={(e) => handlePricingChange(key, e.target.value)}
                    className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    disabled={!isMonetizationEnabled}
                  />
                  <span className="text-gray-600 dark:text-gray-400">SUI</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Access Scopes */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Data Access Permissions
        </h3>
        
        <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-300 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Control which types of data AI agents can access when they pay for queries.
              Unchecked scopes will never be shared, even if payment is received.
            </p>
          </div>
        </div>
        
        <div className="space-y-3">
          {Object.entries(accessScopes).map(([key, value]) => {
            const labels = {
              readObservations: 'Read Observations',
              readRecords: 'Read Medical Records',
              readPatient: 'Read Patient Information',
              readDiagnostics: 'Read Diagnostic Reports',
              exportData: 'Allow Bulk Data Export',
            };
            
            const descriptions = {
              readObservations: 'Lab results, vital signs, and other observations',
              readRecords: 'Complete medical record history',
              readPatient: 'Personal and demographic information',
              readDiagnostics: 'X-rays, MRIs, and diagnostic reports',
              exportData: 'Allow bulk download of all accessible data',
            };
            
            return (
              <div key={key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex-1">
                  <label className="font-medium text-gray-900 dark:text-white cursor-pointer">
                    {labels[key]}
                  </label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {descriptions[key]}
                  </p>
                </div>
                
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => handleScopesChange(key, e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  disabled={!isMonetizationEnabled}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <button
          onClick={loadMonetizationSettings}
          className="px-6 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
        >
          Reset
        </button>
        
        <button
          onClick={handleSaveSettings}
          disabled={isSaving || !isMonetizationEnabled}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <LoadingSpinner size="sm" />
              Saving...
            </>
          ) : (
            'Save Settings'
          )}
        </button>
      </div>
    </div>
  );
}
