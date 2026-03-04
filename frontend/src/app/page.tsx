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

  const SUGGESTIONS = [
    "What is the 50/30/20 rule?",
    "How does credit utilization affect my score?",
    "How much should I keep in an emergency fund?",
    "What's the difference between Avalanche and Snowball payoff?",
  ];

  function handleSuggestion(text: string) {
    setInput(text);
    textareaRef.current?.focus();
  }

  return (
    <div className="page">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-logo">
          <div className="header-logo-mark">SYF</div>
          <div className="header-title">
            <span className="header-brand">Synchrony</span>
            <span className="header-sub">Financial Literacy Assistant</span>
          </div>
        </div>
        <span className="header-badge">Beta</span>
      </header>

      {/* ── Transcript ── */}
      <div className="transcript">
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <div className="empty-heading">How can I help you today?</div>
            <p className="empty-sub">
              Ask me anything about budgeting, credit scores, savings, or debt management.
            </p>
            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="suggestion-chip" onClick={() => handleSuggestion(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => {
          if (msg.role === "error") {
            return (
              <div key={msg.id} className="message-row assistant">
                <div className="message-meta">
                  <div className="avatar assistant-avatar">SYF</div>
                  <span className="label">Error</span>
                </div>
                <div className="error-bubble">{msg.text}</div>
              </div>
            );
          }

          if (msg.role === "user") {
            return (
              <div key={msg.id} className="message-row user">
                <span className="label">You</span>
                <div className="bubble">{msg.text}</div>
              </div>
            );
          }

          // assistant
          return (
            <div key={msg.id} className="message-row assistant">
              <div className="message-meta">
                <div className="avatar assistant-avatar">SYF</div>
                <span className="label">Synchrony Assistant</span>
              </div>
              <div className="bubble">{msg.text}</div>
              {msg.citations && msg.citations.length > 0 && (
                <div className="citations">
                  <div className="citations-title">Sources</div>
                  {msg.citations.map((c) => (
                    <div key={`${c.source}-${c.chunk_id}`} className="citation">
                      <div className="citation-source">{c.source}</div>
                      <div className="citation-snippet">{c.snippet}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="message-row assistant">
            <div className="message-meta">
              <div className="avatar assistant-avatar">SYF</div>
              <span className="label">Synchrony Assistant</span>
            </div>
            <div className="thinking">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div className="input-bar">
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder="Ask about budgeting, credit, savings… (Enter to send)"
          value={input}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button onClick={handleSend} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>

      {/* ── Disclaimer ── */}
      <div className="footer-note">
        For general financial education only. Not financial advice. Do not share personal account information.
      </div>
    </div>
  );
}
