import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [socketError, setSocketError] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    // If not authenticated or no user, disconnect any active socket
    if (!isAuthenticated || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      setSocketError(null);
      return;
    }

    const token = sessionStorage.getItem('convo_token');
    if (!token) {
      setIsConnected(false);
      return;
    }

    const rawUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5002';
    // Strip trailing /api or slash to reach the Socket.IO server root
    const serverUrl = rawUrl.replace(/\/api\/?$/, '');

    // Initialise Socket.IO client
    const socket = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setSocketError(null);
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      // If the server explicitly disconnected us, try reconnecting unless unauthorized
      if (reason === 'io server disconnect') {
        socket.connect();
      }
    });

    socket.on('connect_error', (err) => {
      setIsConnected(false);
      setSocketError(err?.message || 'Socket connection failed');
    });

    socket.io.on('reconnect', () => {
      setIsConnected(true);
      setSocketError(null);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [isAuthenticated, user]);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        socketError,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

export default SocketContext;
