// src/hooks/useChatbot.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface UseChatbotReturn {
  messages: Message[];
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  toggleChat: () => void;
  sendMessage: (message: string) => Promise<void>;
  clearChat: () => void;
}

const STORAGE_KEY = 'chatbot_history';

const INITIAL_MESSAGES: Message[] = [
  {
    role: 'assistant',
    content: 'Hola, soy **SeemannAI** — el asistente inteligente de Seemann Group.\n\nPuedo consultarte tarifas en tiempo real, rastrear tus envíos, calcular pesos y costos de aduana, explicar incoterms y mucho más.\n\n¿En qué puedo ayudarte hoy?',
    timestamp: 0,
  },
];

export function useChatbot(): UseChatbotReturn {
  const { token, activeUsername, user } = useAuth();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cargar historial desde localStorage al montar
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch (err) {
      console.error('Error loading chat history:', err);
    }
  }, []);

  // Guardar historial en localStorage cuando cambie
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      } catch (err) {
        console.error('Error saving chat history:', err);
      }
    }
  }, [messages]);

  // Limpiar interval al desmontar
  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    };
  }, []);

  const toggleChat = useCallback(() => {
    setIsOpen(prev => !prev);
    setError(null);
  }, []);

  const clearChat = useCallback(() => {
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    setMessages(INITIAL_MESSAGES);
    localStorage.removeItem(STORAGE_KEY);
    setError(null);
    setIsLoading(false);
  }, []);

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || !token) return;

    const userMessage: Message = {
      role: 'user',
      content: message.trim(),
      timestamp: Date.now(),
    };

    // Agregar mensaje del usuario
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory: messages,
          activeUsername: activeUsername || '',
          ejecutivo: user?.ejecutivo || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error: ${response.status}`);
      }

      const data = await response.json();
      const fullMessage = data.message;

      // Crear mensaje vacío del asistente
      const assistantMessage: Message = {
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };

      // Agregar mensaje vacío primero
      setMessages(prev => [...prev, assistantMessage]);

      // Simular escritura carácter por carácter
      let currentIndex = 0;
      const typingSpeed = 15; // ms entre caracteres

      if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);

      typingIntervalRef.current = setInterval(() => {
        currentIndex++;
        
        if (currentIndex <= fullMessage.length) {
          setMessages(prev => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = {
              ...newMessages[newMessages.length - 1],
              content: fullMessage.substring(0, currentIndex),
            };
            return newMessages;
          });
        } else {
          if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
          setIsLoading(false);
        }
      }, typingSpeed);

      return;

    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(err.message || 'Error al enviar el mensaje');
      setIsLoading(false);
      
      // Remover el último mensaje del usuario en caso de error
      setMessages(prev => prev.slice(0, -1));
    }
  }, [token, messages, activeUsername]);

  return {
    messages,
    isOpen,
    isLoading,
    error,
    toggleChat,
    sendMessage,
    clearChat,
  };
}