"use client";

import { useEffect, useRef, useState } from "react";
import { sendMessage, type Citation } from "@/lib/api";

interface Message {
  id: number;
  role: "user" | "assistant" | "error";
  text: string;
  citations?: Citation[];
}

let nextId = 1;

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to the latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { id: nextId++, role: "user", text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const res = await sendMessage(trimmed);
      const assistantMsg: Message = {
        id: nextId++,
        role: "assistant",
        text: res.answer,
        citations: res.citations,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errMsg: Message = {
        id: nextId++,
        role: "error",
        text: err instanceof Error ? err.message : "An unexpected error occurred.",
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    // Auto-grow
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  return (
    <div className="page">
      <header className="header">SYF Financial Literacy Assistant</header>

      <div className="transcript">
        {messages.length === 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", textAlign: "center", marginTop: "40px" }}>
            Ask a financial literacy question to get started.
          </p>
        )}

        {messages.map((msg) => {
          if (msg.role === "error") {
            return (
              <div key={msg.id} className="message-row assistant">
                <div className="label">Error</div>
                <div className="error-bubble">{msg.text}</div>
              </div>
            );
          }

          if (msg.role === "user") {
            return (
              <div key={msg.id} className="message-row user">
                <div className="label">You</div>
                <div className="bubble">{msg.text}</div>
              </div>
            );
          }

          // assistant
          return (
            <div key={msg.id} className="message-row assistant">
              <div className="label">Assistant</div>
              <div className="bubble">{msg.text}</div>
              {msg.citations && msg.citations.length > 0 && (
                <div className="citations">
                  <div className="citations-title">Sources</div>
                  {msg.citations.map((c) => (
                    <div key={`${c.source}-${c.chunk_id}`} className="citation">
                      <div className="citation-source">
                        {c.source} · chunk {c.chunk_id}
                      </div>
                      <div className="citation-snippet">"{c.snippet}"</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="message-row assistant">
            <div className="label">Assistant</div>
            <div className="thinking">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="input-bar">
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder="Ask about budgeting, credit, savings…  (Enter to send, Shift+Enter for new line)"
          value={input}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button onClick={handleSend} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
