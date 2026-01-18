import { AlertCircle, Bot, DollarSign, Send, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import Alert from './Alert';
import LoadingSpinner from './LoadingSpinner';

/**
 * AI Chat Component - Chat interface for querying medical data via MCP
 * Supports both x402 (Sui) and a402 (Beep) payment protocols
 */
export default function AIChatInterface({ 
  patientAddress, 
  onPaymentRequired, 
  accessToken: externalAccessToken, 
  shouldRetryQuery,
  paymentProtocol = 'x402', // 'x402' or 'a402'
  beepSessionId = null,
}) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hello! I can help you query your medical records using natural language. Ask me anything about your health data. ${paymentProtocol === 'a402' ? '(Using A402 protocol via Beep)' : ''}`,
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [lastQuery, setLastQuery] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-retry query when payment is successful
  useEffect(() => {
    if (shouldRetryQuery && externalAccessToken && lastQuery) {
      setAccessToken(externalAccessToken);
      // Retry the last query with new token
      retryLastQuery(externalAccessToken);
    }
  }, [shouldRetryQuery, externalAccessToken]);

  const retryLastQuery = async (token) => {
    if (!lastQuery || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };

      const response = await fetch(`${API_BASE_URL}/mcp/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: lastQuery,
          patientAddress,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const formattedResponse = formatFHIRResponse(data.data);

        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: formattedResponse,
            fhirData: data.data,
            timestamp: new Date(),
          },
        ]);
      } else {
        throw new Error('Failed to get response from AI');
      }
    } catch (err) {
      console.error('Retry query error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    // Validate patient address before sending
    if (!patientAddress) {
      setError('Please connect your wallet first');
      return;
    }

    const currentQuery = inputMessage;
    setLastQuery(currentQuery); // Save query for retry

    const userMessage = {
      role: 'user',
      content: currentQuery,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      
      // Call MCP search endpoint
      const headers = {
        'Content-Type': 'application/json',
      };

      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      if (paymentProtocol === 'a402' && beepSessionId) {
        headers['x-beep-session-id'] = beepSessionId;
      }

      const response = await fetch(`${API_BASE_URL}/mcp/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: currentQuery,
          patientAddress,
          paymentProtocol,
        }),
      });

      if (response.status === 402) {
        // Payment required - initiate payment based on protocol
        const errorData = await response.json();        
        const protocol = errorData.protocol || paymentProtocol;
        
        // Initiate payment based on protocol
        try {
          let paymentResponse;
          
          if (protocol === 'a402') {
            // A402 via Beep
            if (!beepSessionId) {
              throw new Error('Beep session not initialized. Please try again or switch to x402 protocol.');
            }
                        
            paymentResponse = await api.beepInitiatePayment(
              beepSessionId,
              patientAddress,
              'search_patient_record',
              errorData.estimatedCost, // Already in micros
              errorData.currency || 'USDC'
            );
            
          } else {
            // X402 via direct Sui
            paymentResponse = await api.paymentInitiate(
              patientAddress,
              'search_patient_record',
              errorData.estimatedCost || '0.05'
            );
          }
          
          if (paymentResponse.success) {
            const paymentData = { ...paymentResponse.data, protocol };
            setMessages(prev => [
              ...prev,
              {
                role: 'system',
                content: `💳 Payment required to access this data. (${protocol.toUpperCase()})`,
                paymentRequired: true,
                paymentData,
                protocol,
                timestamp: new Date(),
              },
            ]);
            
            if (onPaymentRequired) {
              onPaymentRequired(paymentData, protocol);
            }
          }
        } catch (paymentError) {
          console.error('Payment initiation failed:', paymentError);
          console.error('Error details:', {
            message: paymentError.message,
            stack: paymentError.stack,
            response: paymentError.response
          });
          throw new Error(`Failed to initiate payment: ${paymentError.message || 'Unknown error'}`);
        }
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to get response from AI');
      }

      const data = await response.json();
      
      // Format FHIR response for display
      const formattedResponse = formatFHIRResponse(data.data);

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: formattedResponse,
          fhirData: data.data,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      console.error('Chat error:', err);
      setError(err.message);
      setMessages(prev => [
        ...prev,
        {
          role: 'system',
          content: `❌ Error: ${err.message}`,
          isError: true,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayment = async (paymentData) => {
    try {
      // This will be called after user completes payment
      // The parent component should handle the payment flow
      setMessages(prev => [
        ...prev,
        {
          role: 'system',
          content: '✓ Payment completed. You can now retry your query.',
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      setError('Payment failed: ' + err.message);
    }
  };

  const formatFHIRResponse = (fhirBundle) => {
    if (!fhirBundle || !fhirBundle.entry || fhirBundle.entry.length === 0) {
      return 'No matching records found.';
    }

    const entries = fhirBundle.entry;
    let formatted = `Found ${entries.length} record(s):\n\n`;

    entries.forEach((entry, index) => {
      const resource = entry.resource;
      if (resource.resourceType === 'Observation') {
        formatted += `📊 **${resource.code?.text || 'Observation'}**\n`;
        formatted += `   Date: ${new Date(resource.effectiveDateTime).toLocaleDateString()}\n`;
        if (resource.valueString) {
          formatted += `   Value: ${resource.valueString}\n`;
        }
        if (resource.note && resource.note[0]) {
          formatted += `   Note: ${resource.note[0].text}\n`;
        }
        formatted += '\n';
      }
    });

    return formatted;
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const exampleQueries = [
    'Show me my blood pressure readings',
    'What were my latest test results?',
    'Do I have any records from this year?',
    'Show me my glucose levels',
  ];

  const handleExampleClick = (query) => {
    setInputMessage(query);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
        <Bot className="w-6 h-6 text-blue-600" />
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">AI Medical Assistant</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Ask questions about your medical data</p>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 1 && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Try asking:</p>
            <div className="grid grid-cols-1 gap-2">
              {exampleQueries.map((query, idx) => (
                <button
                  key={idx}
                  onClick={() => handleExampleClick(query)}
                  className="text-left p-2 text-sm bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors"
                >
                  {query}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role !== 'user' && (
              <div className="flex-shrink-0">
                {message.role === 'assistant' ? (
                  <Bot className="w-8 h-8 p-1.5 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full" />
                ) : (
                  <AlertCircle className="w-8 h-8 p-1.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-300 rounded-full" />
                )}
              </div>
            )}

            <div
              className={`max-w-[70%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : message.isError
                  ? 'bg-red-50 dark:bg-red-900 text-red-800 dark:text-red-200'
                  : message.paymentRequired
                  ? 'bg-yellow-50 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              
              {message.paymentRequired && message.paymentData && (
                <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-700">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4" />
                    <span className="font-semibold">Cost: {message.paymentData.estimatedCost}</span>
                  </div>
                  <button
                    onClick={() => onPaymentRequired && onPaymentRequired(message.paymentData)}
                    className="w-full mt-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md transition-colors"
                  >
                    Pay & Continue
                  </button>
                </div>
              )}

              <div className="text-xs mt-1 opacity-70">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>

            {message.role === 'user' && (
              <div className="flex-shrink-0">
                <User className="w-8 h-8 p-1.5 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 justify-start">
            <Bot className="w-8 h-8 p-1.5 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full" />
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
              <LoadingSpinner size="sm" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        {error && (
          <Alert type="error" message={error} onClose={() => setError(null)} className="mb-3" />
        )}
        
        <div className="flex gap-2">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about your medical records..."
            className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            rows="2"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
