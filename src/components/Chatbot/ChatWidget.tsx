// src/components/ChatWidget.tsx — AI Mode Design
import { useState, useRef, useEffect } from "react";
import { useChatbotContext } from "../../contexts/ChatbotContext";
import { useAuth } from "../../auth/AuthContext";
import { imgUrl } from "../../config/images";

export default function ChatWidget() {
  const { activeUsername } = useAuth();
  const {
    messages,
    isOpen,
    isLoading,
    error,
    toggleChat,
    sendMessage,
    clearChat,
  } = useChatbotContext();
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    const message = inputValue;
    setInputValue("");
    await sendMessage(message);
  };

  const handleQuickOption = async (option: string) => {
    await sendMessage(option);
  };

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  const renderMessageContent = (content: string) => {
    return content.split("\n").map((line, lineIdx, arr) => {
      const parts = line.split(/(\*\*.*?\*\*)/g).map((part, partIdx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong
              key={`${lineIdx}-${partIdx}`}
              style={{ color: "#c084fc", fontWeight: 700 }}
            >
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={`${lineIdx}-${partIdx}`}>{part}</span>;
      });
      if (lineIdx === arr.length - 1) return <span key={lineIdx}>{parts}</span>;
      return (
        <span key={lineIdx}>
          {parts}
          <br />
        </span>
      );
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const quickOptions = [
    { text: "¿Qué es FOB y en qué se diferencia de CIF?", icon: "" },
    { text: "Dame un resumen de mi cuenta", icon: "" },
  ];

  return (
    <>
      {isOpen && (
        <div
          className="ai-chat-window"
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            width: "420px",
            maxWidth: "calc(100vw - 48px)",
            height: "665px",
            maxHeight: "calc(100vh - 100px)",
            background: "#080c18",
            borderRadius: "16px",
            boxShadow:
              "0 30px 70px rgba(0,0,0,0.65), 0 0 0 1px rgba(162,45,125,0.45), 0 0 60px rgba(28,110,242,0.08)",
            display: "flex",
            flexDirection: "column",
            zIndex: 9999,
            overflow: "hidden",
            fontFamily:
              "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          }}
        >
          {/* HEADER */}
          <div
            style={{
              background: "linear-gradient(135deg, #0d1225 0%, #1a0e38 100%)",
              padding: "15px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid rgba(162,45,125,0.45)",
              position: "relative",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-24px",
                right: "70px",
                width: "90px",
                height: "90px",
                background:
                  "radial-gradient(circle, rgba(28,110,242,0.28) 0%, transparent 70%)",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: "-12px",
                left: "50px",
                width: "70px",
                height: "70px",
                background:
                  "radial-gradient(circle, rgba(231,10,62,0.22) 0%, transparent 70%)",
                pointerEvents: "none",
              }}
            />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg, #1C6EF2, #a21d7d, #E70A3E)",
                  padding: "2px",
                  flexShrink: 0,
                  boxShadow: "0 0 14px rgba(162,45,125,0.5)",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    background: "#0d1225",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={imgUrl("/logo.png")}
                    alt="Seemann Group"
                    style={{
                      width: "24px",
                      height: "auto",
                      objectFit: "contain",
                    }}
                  />
                </div>
              </div>

              <div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "15px",
                      fontWeight: 700,
                      background:
                        "linear-gradient(135deg, #93c5fd 0%, #e879f9 55%, #fb7185 100%)",
                      backgroundClip: "text",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    Seemann Group
                  </h3>
                  <span
                    style={{
                      fontSize: "9px",
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      background:
                        "linear-gradient(135deg, rgba(28,110,242,0.3), rgba(231,10,62,0.3))",
                      border: "1px solid rgba(162,45,125,0.65)",
                      borderRadius: "10px",
                      padding: "2px 7px",
                      color: "#c084fc",
                      textTransform: "uppercase",
                    }}
                  >
                    AI Beta
                  </span>
                </div>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: "11px",
                    color: "rgba(196,181,253,0.65)",
                    fontWeight: 400,
                  }}
                >
                  Asistente de logística
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "6px", position: "relative" }}>
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  title="Limpiar conversación"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(162,45,125,0.3)",
                    borderRadius: "8px",
                    padding: "7px",
                    cursor: "pointer",
                    color: "rgba(196,181,253,0.75)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(231,10,62,0.14)";
                    e.currentTarget.style.borderColor = "rgba(231,10,62,0.5)";
                    e.currentTarget.style.color = "#fb7185";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                    e.currentTarget.style.borderColor = "rgba(162,45,125,0.3)";
                    e.currentTarget.style.color = "rgba(196,181,253,0.75)";
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    fill="currentColor"
                    viewBox="0 0 16 16"
                  >
                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                    <path
                      fillRule="evenodd"
                      d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
                    />
                  </svg>
                </button>
              )}
              <button
                onClick={toggleChat}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(162,45,125,0.3)",
                  borderRadius: "8px",
                  padding: "7px",
                  cursor: "pointer",
                  color: "rgba(196,181,253,0.75)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                  e.currentTarget.style.color = "#e2e8f0";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.color = "rgba(196,181,253,0.75)";
                }}
              >
                <svg
                  width="14"
                  height="14"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z" />
                </svg>
              </button>
            </div>
          </div>

          {/* MESSAGES */}
          <div
            className="ai-chat-messages"
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "20px 16px",
              background: "#070b14",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              backgroundImage:
                "radial-gradient(rgba(162,45,125,0.1) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          >
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                  gap: "4px",
                  animation: "aiSlideIn 0.3s ease-out",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  {msg.role === "assistant" && (
                    <div
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #1C6EF2, #E70A3E)",
                        padding: "1.5px",
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          borderRadius: "50%",
                          background: "#0d1225",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                        }}
                      >
                        <img
                          src={imgUrl("/logo.png")}
                          alt="AI"
                          style={{ width: "12px", objectFit: "contain" }}
                        />
                      </div>
                    </div>
                  )}
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color:
                        msg.role === "user"
                          ? "rgba(147,197,253,0.55)"
                          : "rgba(196,181,253,0.55)",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {msg.role === "user" ? "Tú" : "Seemann AI"}
                  </span>
                </div>

                <div
                  style={{
                    maxWidth: "83%",
                    padding: "11px 15px",
                    borderRadius:
                      msg.role === "user"
                        ? "14px 14px 4px 14px"
                        : "14px 14px 14px 4px",
                    background:
                      msg.role === "user"
                        ? "linear-gradient(135deg, #1C6EF2 0%, #7c3aed 55%, #be185d 100%)"
                        : "rgba(255,255,255,0.05)",
                    border:
                      msg.role === "user"
                        ? "none"
                        : "1px solid rgba(162,45,125,0.22)",
                    color: msg.role === "user" ? "#ffffff" : "#d4c8f8",
                    fontSize: "13.5px",
                    lineHeight: 1.65,
                    wordBreak: "break-word",
                    backdropFilter:
                      msg.role === "assistant" ? "blur(8px)" : "none",
                    boxShadow:
                      msg.role === "user"
                        ? "0 4px 18px rgba(28,110,242,0.35)"
                        : "0 2px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
                  }}
                >
                  {renderMessageContent(msg.content)}
                </div>

                {msg.timestamp > 0 && (
                  <span
                    style={{
                      fontSize: "10px",
                      color: "rgba(148,163,184,0.35)",
                      paddingRight: msg.role === "user" ? "2px" : "0",
                      paddingLeft: msg.role === "assistant" ? "2px" : "0",
                    }}
                  >
                    {formatTime(msg.timestamp)}
                  </span>
                )}
              </div>
            ))}

            {isLoading && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: "4px",
                  animation: "aiFadeIn 0.3s ease-out",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #1C6EF2, #E70A3E)",
                      padding: "1.5px",
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: "50%",
                        background: "#0d1225",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      <img
                        src={imgUrl("/logo.png")}
                        alt="AI"
                        style={{ width: "12px", objectFit: "contain" }}
                      />
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "rgba(196,181,253,0.55)",
                    }}
                  >
                    Seemann AI
                  </span>
                </div>
                <div
                  style={{
                    padding: "13px 18px",
                    borderRadius: "14px 14px 14px 4px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(162,45,125,0.22)",
                    display: "flex",
                    gap: "6px",
                    alignItems: "center",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
                  }}
                >
                  {[0, 0.25, 0.5].map((delay, i) => (
                    <div
                      key={i}
                      style={{
                        width: "7px",
                        height: "7px",
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #1C6EF2, #E70A3E)",
                        animation: `aiDotPulse 1.4s ease-in-out ${delay}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div
                style={{
                  background: "rgba(231,10,62,0.1)",
                  border: "1px solid rgba(231,10,62,0.3)",
                  borderRadius: "10px",
                  padding: "12px 14px",
                  fontSize: "13px",
                  color: "#fb7185",
                  display: "flex",
                  gap: "10px",
                  alignItems: "start",
                }}
              >
                <svg
                  width="15"
                  height="15"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                  style={{ flexShrink: 0, marginTop: "1px" }}
                >
                  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                  <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z" />
                </svg>
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* INPUT */}
          <form
            onSubmit={handleSubmit}
            style={{
              padding: "13px 16px 14px",
              borderTop: "1px solid rgba(162,45,125,0.35)",
              background: "#080c18",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                ref={inputRef}
                className="ai-chat-input"
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Escribe tu mensaje..."
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: "11px 15px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(162,45,125,0.35)",
                  borderRadius: "10px",
                  fontSize: "13.5px",
                  outline: "none",
                  color: "#e2e8f0",
                  fontFamily: "inherit",
                  transition: "all 0.2s",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "rgba(162,45,125,0.85)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                  e.currentTarget.style.boxShadow =
                    "0 0 0 3px rgba(162,45,125,0.12)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(162,45,125,0.35)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                style={{
                  width: "42px",
                  height: "42px",
                  flexShrink: 0,
                  background:
                    isLoading || !inputValue.trim()
                      ? "rgba(255,255,255,0.06)"
                      : "linear-gradient(135deg, #1C6EF2, #7c3aed, #E70A3E)",
                  border:
                    isLoading || !inputValue.trim()
                      ? "1px solid rgba(162,45,125,0.2)"
                      : "none",
                  borderRadius: "10px",
                  cursor:
                    isLoading || !inputValue.trim() ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color:
                    isLoading || !inputValue.trim()
                      ? "rgba(255,255,255,0.22)"
                      : "#ffffff",
                  transition: "all 0.2s",
                  boxShadow:
                    isLoading || !inputValue.trim()
                      ? "none"
                      : "0 4px 14px rgba(124,58,237,0.45)",
                }}
                onMouseEnter={(e) => {
                  if (!isLoading && inputValue.trim()) {
                    e.currentTarget.style.boxShadow =
                      "0 6px 20px rgba(124,58,237,0.6)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    isLoading || !inputValue.trim()
                      ? "none"
                      : "0 4px 14px rgba(124,58,237,0.45)";
                }}
              >
                <svg
                  width="17"
                  height="17"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11ZM6.636 10.07l2.761 4.338L14.13 2.576 6.636 10.07Zm6.787-8.201L1.591 6.602l4.339 2.76 7.494-7.493Z" />
                </svg>
              </button>
            </div>

            <div
              style={{
                marginTop: "9px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <defs>
                  <linearGradient
                    id="poweredGrad"
                    x1="0%"
                    y1="100%"
                    x2="100%"
                    y2="0%"
                  >
                    <stop offset="0%" stopColor="#E70A3E" />
                    <stop offset="100%" stopColor="#1C6EF2" />
                  </linearGradient>
                </defs>
                <path
                  d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z"
                  fill="url(#poweredGrad)"
                />
              </svg>
              <span
                style={{
                  fontSize: "10px",
                  background: "linear-gradient(135deg, #93c5fd, #e879f9)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  fontWeight: 500,
                  letterSpacing: "0.04em",
                }}
              >
                Powered by Seemann AI
              </span>
            </div>
          </form>
        </div>
      )}

      <style>{`
        @keyframes aiDotPulse {
          0%, 100% { opacity: 0.25; transform: scale(0.75); }
          50%       { opacity: 1;    transform: scale(1.2);  }
        }
        @keyframes aiFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes aiSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }

        .ai-chat-messages::-webkit-scrollbar        { width: 4px; }
        .ai-chat-messages::-webkit-scrollbar-track  { background: transparent; }
        .ai-chat-messages::-webkit-scrollbar-thumb  { background: rgba(162,45,125,0.4); border-radius: 10px; }
        .ai-chat-messages::-webkit-scrollbar-thumb:hover { background: rgba(162,45,125,0.7); }

        .ai-chat-input::placeholder { color: rgba(196,181,253,0.32); }

        @media (max-width: 480px) {
          .ai-chat-window {
            width: calc(100vw - 32px) !important;
            right: 16px !important;
            bottom: 16px !important;
          }
        }
      `}</style>
    </>
  );
}
