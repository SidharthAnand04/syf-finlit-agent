"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi, FAQ } from "@/lib/api";
import { useAdmin } from "../context";
import { C, FONT } from "../components/tokens";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "@/components/ui/layout";
import { StatusBadge } from "../components/StatusBadge";

const CATEGORIES = ["Credit", "Financing", "Cards", "Payments", "Savings", "General", "Other"];

function FAQRow({ faq, busy, onToggle, onEdit, onDelete }: {
  faq: FAQ;
  busy: boolean;
  onToggle: (id: number) => void;
  onEdit: (faq: FAQ) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <tr style={{ opacity: faq.active ? 1 : 0.55 }}>
      <td><span style={{ display: "inline-block", padding: "1px 8px", borderRadius: 99, fontSize: 10, fontWeight: 800, background: C.goldSubtle, color: C.charcoal, fontFamily: FONT }}>{faq.category}</span></td>
      <td>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.charcoal, fontFamily: FONT }}>{faq.question}</div>
        {faq.answer_note && <div style={{ fontSize: 11, color: C.muted, fontFamily: FONT, marginTop: 3 }}>{faq.answer_note}</div>}
      </td>
      <td><StatusBadge status={faq.active ? "ok" : "disabled"} /></td>
      <td>
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button className="admin-btn-ghost" style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => onToggle(faq.id)} disabled={busy}>{faq.active ? "Deactivate" : "Activate"}</button>
          <button className="admin-btn-ghost" style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => onEdit(faq)} disabled={busy}>Edit</button>
          <button className="admin-btn-danger" style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => onDelete(faq.id)} disabled={busy}>Delete</button>
        </div>
      </td>
    </tr>
  );
}

function FAQForm({ initial, saving, onSave, onCancel }: {
  initial?: FAQ;
  saving: boolean;
  onSave: (data: { category: string; question: string; answer_note: string; active: boolean }) => void;
  onCancel: () => void;
}) {
  const [question, setQuestion] = useState(initial?.question ?? "");
  const [category, setCategory] = useState(initial?.category ?? "General");
  const [answer_note, setAnswerNote] = useState(initial?.answer_note ?? "");
  const [active, setActive] = useState(initial?.active ?? true);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    onSave({ question: question.trim(), category, answer_note: answer_note.trim(), active });
  }

  return (
    <form onSubmit={submit} className="admin-data-group">
      <div className="admin-data-group-header">
        <div>
          <h2 className="admin-data-group-title">{initial ? "Edit FAQ" : "Add FAQ"}</h2>
          <p className="admin-data-group-subtitle">Suggested prompts shown to users when they open a new chat.</p>
        </div>
      </div>
      <div className="admin-data-group-body">
        <div className="admin-field-grid">
          <label>
            <span style={{ display: "block", fontSize: 12, fontWeight: 800, color: C.charcoal, fontFamily: FONT, marginBottom: 6 }}>Question</span>
            <input className="admin-input" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="E.g. How do I check my credit score?" required autoFocus />
          </label>
          <label>
            <span style={{ display: "block", fontSize: 12, fontWeight: 800, color: C.charcoal, fontFamily: FONT, marginBottom: 6 }}>Category</span>
            <select className="admin-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <label style={{ display: "block", marginTop: 14 }}>
          <span style={{ display: "block", fontSize: 12, fontWeight: 800, color: C.charcoal, fontFamily: FONT, marginBottom: 6 }}>Answer Note / Source Reference</span>
          <input className="admin-input" value={answer_note} onChange={(e) => setAnswerNote(e.target.value)} placeholder="Brief note on where the answer comes from, or expected response guidance..." />
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 16, flexWrap: "wrap" }}>
          <label className={`admin-choice-card${active ? " active" : ""}`} style={{ width: "auto", cursor: "pointer" }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span style={{ fontSize: 13, fontWeight: 800 }}>Active in chat widget</span>
          </label>
          <div style={{ flex: 1 }} />
          <button type="button" className="admin-btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
          <button type="submit" className="admin-btn-primary" disabled={saving}>{saving ? "Saving..." : initial ? "Save Changes" : "Add FAQ"}</button>
        </div>
      </div>
    </form>
  );
}

export default function FAQsPage() {
  const { token } = useAdmin();
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [editing, setEditing] = useState<FAQ | null>(null);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setFaqs(await adminApi.listFaqs(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load FAQs");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function toggle(id: number) {
    const faq = faqs.find((f) => f.id === id);
    if (!faq || !token) return;
    setSaving(true);
    setError(null);
    try {
      await adminApi.updateFaq(token, id, { active: !faq.active });
      setFaqs((prev) => prev.map((f) => f.id === id ? { ...f, active: !f.active } : f));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update FAQ");
    } finally {
      setSaving(false);
    }
  }

  async function del(id: number) {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await adminApi.deleteFaq(token, id);
      setFaqs((prev) => prev.filter((f) => f.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete FAQ");
    } finally {
      setSaving(false);
    }
  }

  async function saveNew(data: { category: string; question: string; answer_note: string; active: boolean }) {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const newFaq = await adminApi.addFaq(token, { ...data, sort_order: faqs.length });
      setFaqs((prev) => [...prev, newFaq]);
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add FAQ");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(data: { category: string; question: string; answer_note: string; active: boolean }) {
    if (!token || !editing) return;
    setSaving(true);
    setError(null);
    try {
      await adminApi.updateFaq(token, editing.id, data);
      setFaqs((prev) => prev.map((f) => f.id === editing.id ? { ...f, ...data } : f));
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update FAQ");
    } finally {
      setSaving(false);
    }
  }

  const categories = Array.from(new Set(faqs.map((f) => f.category))).sort();
  const displayed = filter === "all" ? faqs : faqs.filter((f) => f.category === filter);

  if (loading) return <div className="admin-page"><LoadingState message="Loading FAQs..." /></div>;

  return (
    <div className="admin-page">
      <PageHeader
        title="FAQs"
        subtitle="Active FAQs appear as suggested prompts when users open a new chat."
        action={!adding && !editing ? <button className="admin-btn-primary" onClick={() => setAdding(true)}>Add FAQ</button> : null}
      />

      <div className="admin-page-stack">
        {error && (
          <div className="admin-alert admin-alert-error" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 14, padding: "0 4px" }}>x</button>
          </div>
        )}

        {adding && <FAQForm saving={saving} onSave={saveNew} onCancel={() => setAdding(false)} />}
        {editing && <FAQForm initial={editing} saving={saving} onSave={saveEdit} onCancel={() => setEditing(null)} />}

        <section className="admin-data-group">
          <div className="admin-data-group-header">
            <div>
              <h2 className="admin-data-group-title">FAQ Library</h2>
              <p className="admin-data-group-subtitle">{displayed.length} shown · {faqs.filter((f) => f.active).length} active of {faqs.length} total</p>
            </div>
            <button className="admin-btn-ghost" onClick={load} disabled={loading || saving} style={{ fontSize: 12 }}>Refresh</button>
          </div>
          <div className="admin-data-group-body">
            {categories.length > 1 && (
              <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                {["all", ...categories].map((cat) => (
                  <button key={cat} onClick={() => setFilter(cat)} className={filter === cat ? "admin-btn-primary" : "admin-btn-ghost"} style={{ minHeight: 32, fontSize: 12, padding: "5px 13px" }}>
                    {cat === "all" ? "All" : cat}
                  </button>
                ))}
              </div>
            )}

            {displayed.length === 0 ? (
              <EmptyState title="No FAQs yet" description="Add suggested questions to help users discover the chatbot's capabilities." action={<button className="admin-btn-primary" onClick={() => setAdding(true)}>Add FAQ</button>} />
            ) : (
              <div style={{ overflowX: "auto", borderRadius: 18 }}>
                <table className="admin-table" style={{ minWidth: 760 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 110 }}>Category</th>
                      <th>Question</th>
                      <th style={{ width: 110 }}>Status</th>
                      <th style={{ textAlign: "right", width: 240 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((f) => <FAQRow key={f.id} faq={f} busy={saving} onToggle={toggle} onEdit={setEditing} onDelete={del} />)}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
