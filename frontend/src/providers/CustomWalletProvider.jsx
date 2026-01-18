import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { Transaction } from "@mysten/sui/transactions"
import {
  useCurrentAccount,
  useCurrentWallet,
  useDisconnectWallet,
  useSignTransaction,
  useSuiClient,
} from "@mysten/dapp-kit"
import { useEnokiFlow, useZkLogin, useZkLoginSession } from "@mysten/enoki/react"
import { useNavigate } from "react-router-dom"

// Config
const SUI_NETWORK = import.meta.env.VITE_SUI_NETWORK || "testnet"
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

const CustomWalletContext = createContext({
  isConnected: false,
  isUsingEnoki: false,
  address: undefined,
  jwt: undefined,
  emailAddress: null,
  sponsorAndExecuteTransactionBlock: async () => {
    throw new Error("Not implemented")
  },
  logout: () => {},
  redirectToAuthUrl: () => {},
})

export const useCustomWallet = () => {
  return useContext(CustomWalletContext)
}

export default function CustomWalletProvider({ children }) {
  const suiClient = useSuiClient()
  const navigate = useNavigate()

  // Enoki hooks
  const { address: enokiAddress } = useZkLogin()
  const zkLoginSession = useZkLoginSession()
  const enokiFlow = useEnokiFlow()

  // dApp Kit hooks
  const currentAccount = useCurrentAccount()
  const { isConnected: isWalletConnected } = useCurrentWallet()
  const { mutateAsync: signTransactionBlock } = useSignTransaction()
  const { mutate: disconnect } = useDisconnectWallet()

  const [emailAddress, setEmailAddress] = useState(null)

  const { isConnected, isUsingEnoki, address, logout } = useMemo(() => {
    const usingEnoki = !!enokiAddress
    return {
      isConnected: !!enokiAddress || isWalletConnected,
      isUsingEnoki: usingEnoki,
      address: enokiAddress || currentAccount?.address,
      logout: () => {
        if (usingEnoki) {
          enokiFlow.logout()
        } else {
          disconnect()
        }
        sessionStorage.clear()
      },
    }
  }, [enokiAddress, currentAccount?.address, enokiFlow, isWalletConnected, disconnect])

  // Decode JWT to get email when connected
  useEffect(() => {
    if (isConnected && zkLoginSession?.jwt) {
      try {
        // Decode JWT payload (base64)
        const payload = zkLoginSession.jwt.split('.')[1]
        const decoded = JSON.parse(atob(payload))
        setEmailAddress(decoded.email || null)
      } catch (error) {
        console.error('Failed to decode JWT:', error)
      }
    }
  }, [isConnected, zkLoginSession])

  // Redirect to Google OAuth
  const redirectToAuthUrl = () => {
    const protocol = window.location.protocol
    const host = window.location.host
    const customRedirectUri = `${protocol}//${host}/auth`

    enokiFlow
      .createAuthorizationURL({
        provider: "google",
        network: SUI_NETWORK,
        clientId: GOOGLE_CLIENT_ID,
        redirectUrl: customRedirectUri,
        extraParams: {
          scope: ["openid", "email", "profile"],
        },
      })
      .then((url) => {
        window.location.href = url
      })
      .catch((err) => {
        console.error("Failed to create auth URL:", err)
      })
  }

  // Sign transaction
  const signTransaction = async (bytes) => {
    if (isUsingEnoki) {
      const signer = await enokiFlow.getKeypair({
        network: SUI_NETWORK,
      })
      const signature = await signer.signTransaction(bytes)
      return signature.signature
    }

    const txBlock = Transaction.from(bytes)
    const resp = await signTransactionBlock({
      transaction: txBlock,
      chain: `sui:${SUI_NETWORK}`,
    })
    return resp.signature
  }

  // zklogin and execute transaction using Enoki
  const zkloginAndExecuteTransactionBlock = async ({ tx, options = {} }) => {
    if (!isConnected) {
      throw new Error("Wallet is not connected")
    }

    try {
      if (isUsingEnoki) {
        // Use Enoki sponsorship
        const response = await enokiFlow.zkloginAndExecuteTransactionBlock({
          network: SUI_NETWORK,
          transaction: tx,
          client: suiClient,
        })

        await suiClient.waitForTransaction({ digest: response.digest, timeout: 5000 })

        return suiClient.getTransactionBlock({
          digest: response.digest,
          options,
        })
      } else {
        // Regular wallet execution (no sponsorship)
        tx.setSender(address)
        const txBytes = await tx.build({ client: suiClient })
        const signature = await signTransaction(txBytes)

        const result = await suiClient.executeTransactionBlock({
          transactionBlock: txBytes,
          signature,
          requestType: "WaitForLocalExecution",
          options,
        })

        return result
      }
    } catch (err) {
      console.error("Transaction failed:", err)
      throw err
    }
  }

  return (
    <CustomWalletContext.Provider
      value={{
        isConnected,
        isUsingEnoki,
        address,
        jwt: zkLoginSession?.jwt,
        emailAddress,
        zkloginAndExecuteTransactionBlock,
        logout,
        redirectToAuthUrl,
      }}
    >
      {children}
    </CustomWalletContext.Provider>
  )
}
