"use client";

import { useState } from "react";
import { C, FONT, GLASS_CARD_STYLE } from "./tokens";
import { useAdmin } from "../context";

export function LoginGate() {
  const { signIn, authError, isVerifying } = useAdmin();
  const [val, setVal] = useState("");
  const [localErr, setLocalErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = val.trim();
    if (!trimmed) { setLocalErr("Token is required."); return; }
    setLocalErr("");
    setSubmitting(true);
    try {
      await signIn(trimmed);
    } catch {
      // authError is set in context; clear input for retry
    } finally {
      setSubmitting(false);
    }
  }

  const busy = submitting || isVerifying;
  const displayErr = localErr || authError;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: C.pageBg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: FONT,
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute",
        width: 440,
        height: 440,
        borderRadius: "50%",
        background: "rgba(251,198,0,0.20)",
        filter: "blur(88px)",
        top: -160,
        left: "18%",
      }} />
      <div style={{
        width: 420,
        ...GLASS_CARD_STYLE,
        borderRadius: 24,
        overflow: "hidden",
        animation: "glass-fade-up 0.32s cubic-bezier(0.16,1,0.3,1) both",
        position: "relative",
        zIndex: 1,
      }}>
        {/* Branding strip */}
        <div style={{
          background: "linear-gradient(135deg, rgba(251,198,0,0.92), rgba(251,198,0,0.68))",
          padding: "18px 22px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <div style={{
            width: 34,
            height: 34,
            background: C.charcoal,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 13,
            color: C.gold,
            flexShrink: 0,
            boxShadow: "0 10px 24px rgba(0,0,0,0.22)",
          }}>S</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.charcoal }}>Synchrony Assistant</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: C.charcoal, opacity: 0.70, textTransform: "uppercase", letterSpacing: "0.10em" }}>Admin Console</div>
          </div>
        </div>

        {/* Form */}
        <div style={{ padding: "28px 26px 30px" }}>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 22, lineHeight: 1.6 }}>
            Enter your admin token to access the knowledge base management, personality configuration, and analytics.
          </p>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.charcoal, marginBottom: 6 }}>
                Admin Token
              </label>
              <input
                type="password"
                placeholder="Paste token…"
                value={val}
                onChange={(e) => { setVal(e.target.value); setLocalErr(""); }}
                className="admin-input"
                style={{ width: "100%", boxSizing: "border-box" }}
                autoFocus
                disabled={busy}
              />
            </div>

            {displayErr && (
              <div style={{
                fontSize: 12,
                color: C.red,
                background: C.redBg,
                border: `1px solid ${C.redBorder}`,
                borderRadius: 12,
                padding: "9px 12px",
                marginBottom: 12,
              }}>
                {displayErr}
              </div>
            )}

            <button
              type="submit"
              className="admin-btn-primary"
              disabled={busy}
              style={{ width: "100%", padding: "12px 0", fontSize: 14, textAlign: "center" }}
            >
              {busy ? "Verifying…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
