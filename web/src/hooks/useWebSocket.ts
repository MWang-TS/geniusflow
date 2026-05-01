import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

export function useWebSocket(token: string | null) {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!token) return

    const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:4000'
    const socket = io(wsUrl, {
      path: '/ws/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    })

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))

    socketRef.current = socket

    return () => {
      socket.disconnect()
      socketRef.current = null
      setConnected(false)
    }
  }, [token])

  return { socket: socketRef, connected }
}
