import { useEffect, useRef, useState } from 'react'

const GIS_SRC = 'https://accounts.google.com/gsi/client'
let scriptPromise = null

function loadGoogleIdentityServices() {
  if (window.google?.accounts?.id) return Promise.resolve()
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.onload = resolve
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('Could not load Google sign-in.'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

// Renders Google's official "Sign in with Google" button into the returned ref.
// `onCredential` receives the ID token, which the backend verifies.
export function useGoogleButton(clientId, onCredential) {
  const containerRef = useRef(null)
  const callbackRef = useRef(onCredential)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    callbackRef.current = onCredential
  }, [onCredential])

  useEffect(() => {
    if (!clientId) return undefined
    let cancelled = false
    loadGoogleIdentityServices()
      .then(() => {
        if (cancelled || !containerRef.current) return
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => callbackRef.current(response.credential),
          ux_mode: 'popup',
          use_fedcm_for_button: true,
        })
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          // Google renders a fixed-width iframe, so size it to the space available (200–320px).
          width: Math.max(200, Math.min(320, containerRef.current.clientWidth || 280)),
        })
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [clientId])

  return { containerRef, failed }
}
