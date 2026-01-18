import { useAuthCallback, useZkLogin } from '@mysten/enoki/react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * AuthCallbackPage - Handles the OAuth callback from Google
 *
 * This page is where Google redirects after authentication.
 * It processes the callback and redirects to the dashboard.
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const { address } = useZkLogin()
  const [error, setError] = useState(null)

  // This hook handles the OAuth callback automatically
  const { handled } = useAuthCallback()

  useEffect(() => {
    // If callback was handled and we have an address, redirect to dashboard
    if (handled && address) {
      navigate('/dashboard')
    }
  }, [handled, address, navigate])

  useEffect(() => {
    // Check for error in URL
    const urlParams = new URLSearchParams(window.location.search)
    const errorParam = urlParams.get('error')
    if (errorParam) {
      setError(errorParam)
    }

    // Fallback redirect after timeout
    const timer = setTimeout(() => {
      if (!address) {
        // If still no address after 5 seconds, redirect to home
        navigate('/')
      }
    }, 5000)

    return () => clearTimeout(timer)
  }, [address, navigate])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="text-center max-w-md px-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-text-light dark:text-text-dark mb-2">
            Authentication Failed
          </h2>
          <p className="text-text-muted mb-4">
            {error === 'access_denied' ? 'You cancelled the sign in process.' : `Error: ${error}`}
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-text-light dark:text-text-dark mb-2">
          Completing sign in...
        </h2>
        <p className="text-text-muted">
          Please wait while we verify your account.
        </p>
      </div>
    </div>
  )
}
