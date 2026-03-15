import { useState, useRef, useCallback } from 'react'

export function useToast() {
  const [toasts, setToasts] = useState([])
  const counter = useRef(0)

  const showToast = useCallback((message, type = 'info', duration = 2800) => {
    const id = ++counter.current
    setToasts(prev => [...prev.slice(-2), { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  return { toasts, showToast }
}
