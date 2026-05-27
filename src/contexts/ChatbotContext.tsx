// src/contexts/ChatbotContext.tsx
import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { useChatbot } from "../hooks/useChatbot";

type ChatbotContextType = ReturnType<typeof useChatbot>;

const ChatbotContext = createContext<ChatbotContextType | null>(null);

export function ChatbotProvider({ children }: { children: ReactNode }) {
  const chatbot = useChatbot();
  return (
    <ChatbotContext.Provider value={chatbot}>
      {children}
    </ChatbotContext.Provider>
  );
}

export function useChatbotContext(): ChatbotContextType {
  const ctx = useContext(ChatbotContext);
  if (!ctx)
    throw new Error("useChatbotContext must be used within ChatbotProvider");
  return ctx;
}
