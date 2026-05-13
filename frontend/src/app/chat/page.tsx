"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { sendMessage, getActiveFaqs, type Citation } from "@/lib/api";

interface Message {
  id: number;
  role: "user" | "assistant" | "error";
  text: string;
  citations?: Citation[];
  sourcesOpen?: boolean;
  followups?: string[];
}

let nextId = 1;

const DEFAULT_QUICK_ACTIONS = [
  "Get a new credit card",
  "Learn about your products",
  "Help with financing options",
  "Health & wellness financing",
];

/**
 * - At most one blank line anywhere (no "\n\n\n+").
 * - Each markdown list row on its own line; blank lines between consecutive list items collapsed.
 * - Unicode bullets (•) → "-" so lists render as separate lines in markdown.
 */
function normalizeSpacing(text: string): string {
  let out = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  out = out.replace(/^[ \t]*[•·▪‣▸]\s*/gm, "- ");
  out = out.replace(/\n{3,}/g, "\n\n");
  const listStart = String.raw`[ \t]*(?:[-*+]\s+|\d+\.\s+)`;
  const betweenListItems = new RegExp(String.raw`(^|\n)(${listStart}[^\n]*)\n\n(${listStart})`, "gm");
  let prev = "";
  while (prev !== out) {
    prev = out;
    out = out.replace(betweenListItems, "$1$2\n$3");
  }
  
  // Clean up citations but PRESERVE structure
  out = out.replace(
    /\s*\n\s*(\[(?:Source\s*|Citation\s*)?\s*\d+\s*\])\s*\n(?=[^-*+\d])/gi,
    " $1 "
  );
  out = out.replace(/(\[(?:Source\s*|Citation\s*)?\s*\d+\s*\])\s*\n(?=\s*[.?!,;:])/gi, "$1");
  // Only remove newline after citation if the next line does NOT look like a new list item, a paragraph, or a new sentence
  out = out.replace(/(\[(?:Source\s*|Citation\s*)?\s*\d+\s*\])\s*\n\s*(?![-*+]\s|\d+\.\s|\n|[A-Z])/gi, "$1 ");
  
  return out.trim();
}

/**
 * Replace [N] citation markers with superscript links. Does not touch markdown links:
 * [anything](url) must not match — use (?!\s*\() after the closing bracket.
 */
function injectCitationLinks(text: string): string {
  return text.replace(/\[(?:Source\s*|Citation\s*)?\s*(\d+)\s*\](?!\()/gi, "[$1](#citation-$1)");
}

function renderAssistantMarkdown(text: string, citations: Citation[]) {
  const citationMap = new Map<number, Citation>();
  citations.forEach((citation, index) => {
    citationMap.set(index + 1, citation);
  });

  const markdownComponents: Partial<Components> = {
    a: ({ href, children, className, ...props }) => {
      const external =
        typeof href === "string" &&
        (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//"));

      if (typeof href === "string" && href.startsWith("#citation-")) {
        const citationNumber = Number(href.slice("#citation-".length));
        const citation = citationMap.get(citationNumber);

        if (!citation?.display_url) {
          return <sup className="cite-link">[{citationNumber}]</sup>;
        }

        return (
          <sup>
            <a href={citation.display_url} target="_blank" rel="noopener noreferrer" className="cite-link" {...props}>
              [{children}]
            </a>
          </sup>
        );
      }

      return (
        <a
          href={href}
          className={className}
          {...props}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {children}
        </a>
      );
    },
  };

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {injectCitationLinks(text)}
    </ReactMarkdown>
  );
}

export default function ChatPage() {
  const [messages,     setMessages]     = useState<Message[]>([]);
  const [input,        setInput]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [dismissed,    setDismissed]    = useState(false);
  const [quickActions, setQuickActions] = useState<string[]>(DEFAULT_QUICK_ACTIONS);

  const bottomRef    = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const sessionIdRef = useRef<string>("");

  useEffect(() => {
    if (!sessionIdRef.current) sessionIdRef.current = crypto.randomUUID();
    getActiveFaqs().then((faqs) => {
      if (faqs.length > 0) setQuickActions(faqs.slice(0, 4).map((f) => f.question));
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend(text?: string) {
    const trimmed = (text ?? input).trim();
    if (!trimmed || loading) return;

    setMessages(prev => [...prev, { id: nextId++, role: "user", text: trimmed }]);
    setInput("");
    setLoading(true);

    try {
      const res = await sendMessage(trimmed, sessionIdRef.current, true);
      setMessages(prev => [...prev, {
        id: nextId++, role: "assistant",
        text: res.answer, citations: res.citations,
        sourcesOpen: false, followups: res.followups ?? [],
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: nextId++, role: "error",
        text: err instanceof Error ? err.message : "An unexpected error occurred.",
      }]);
    } finally {
      setLoading(false);
    }
  }

  function toggleSources(id: number) {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, sourcesOpen: !m.sourcesOpen } : m));
  }

  return (
    <div className="page-bg">

      <iframe
        src="https://www.synchrony.com/"
        className="site-iframe"
        title="Synchrony Financial"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation allow-modals allow-popups-to-escape-sandbox"
      />

      {dismissed && (
        <button className="widget-reopen" onClick={() => setDismissed(false)} aria-label="Open Synchrony Assistant">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {!dismissed && (
        <div className="widget">

          {/* ── Header ── */}
          <header className="widget-header">
            <div className="widget-header-left">
              <div className="widget-avatar">S</div>
              <div className="widget-title-block">
                <span className="widget-title">Synchrony Assistant</span>
                <span className="widget-badge">Beta</span>
              </div>
            </div>
            <button className="widget-close" onClick={() => setDismissed(true)} aria-label="Close assistant">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </header>

          {/* ── Conversation ── */}
          <div className="transcript">
            <div className="welcome-card">
              <div className="welcome-text">Hi! I&rsquo;m your Synchrony assistant. How can I help you today?</div>
              <div className="welcome-meta">Synchrony Assistant · Just now</div>
            </div>

            {messages.length === 0 && (
              <div className="quick-actions">
                {quickActions.map(action => (
                  <button key={action} className="quick-action-btn" onClick={() => handleSend(action)} disabled={loading}>
                    {action}
                  </button>
                ))}
              </div>
            )}

            {messages.map(msg => {
              if (msg.role === "error") return (
                <div key={msg.id} className="msg-row assistant">
                  <div className="error-bubble">{msg.text}</div>
                </div>
              );

              if (msg.role === "user") return (
                <div key={msg.id} className="msg-row user">
                  <div className="msg-bubble user-bubble">{msg.text}</div>
                </div>
              );

              const hasCitations = !!msg.citations?.length;
              const normalizedText = normalizeSpacing(msg.text);

              return (
                <div key={msg.id} className="msg-row assistant">
                  <div className="msg-meta">
                    <div className="msg-avatar">S</div>
                    <span className="msg-label">Synchrony Assistant</span>
                  </div>
                  <div className="msg-bubble assistant-bubble">
                    {renderAssistantMarkdown(normalizedText, msg.citations ?? [])}
                  </div>

                  {hasCitations && (
                    <div className="sources-block">
                      <button
                        className={`sources-toggle${msg.sourcesOpen ? " open" : ""}`}
                        onClick={() => toggleSources(msg.id)}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                        {msg.sourcesOpen ? "Hide sources" : `View sources (${msg.citations!.length})`}
                      </button>
                      {msg.sourcesOpen && (
                        <div className="sources-list">
                          {msg.citations!.map((c, idx) => (
                            <div key={`${c.source}-${c.chunk_id}`} className="source-item">
                              <div className="source-name">
                                <span className="source-number">{idx + 1}</span>
                                {c.display_url
                                  ? <a href={c.display_url} target="_blank" rel="noopener noreferrer" className="source-link">{c.display_title || c.source}</a>
                                  : <span>{c.display_title || c.source}</span>
                                }
                                {c.source_type === "website" && <span className="source-type-badge">Web</span>}
                                {c.source_type === "pdf"     && <span className="source-type-badge">PDF</span>}
                              </div>
                              {c.section_heading && <div className="source-section">{c.section_heading}</div>}
                              {c.page_number != null && <div className="source-page">Page {c.page_number}</div>}
                              <div className="source-snippet">{c.snippet}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {msg.followups && msg.followups.length > 0 && (
                    <div className="followups-block">
                      <span className="followups-label">Suggested follow-ups</span>
                      <div className="followups-list">
                        {msg.followups.map(q => (
                          <button key={q} className="followup-chip" onClick={() => handleSend(q)} disabled={loading}>{q}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="msg-row assistant">
                <div className="msg-meta">
                  <div className="msg-avatar">S</div>
                  <span className="msg-label">Synchrony Assistant</span>
                </div>
                <div className="thinking"><span /><span /><span /></div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* ── Composer ── */}
          <div className="composer">
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask a question…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSend(); } }}
              disabled={loading}
              className="composer-input"
            />
            <button className="composer-send" onClick={() => handleSend()} disabled={loading || !input.trim()} aria-label="Send message">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>

          <div className="widget-disclaimer">For general financial education only. Not financial advice.</div>
        </div>
      )}
    </div>
  );
}
