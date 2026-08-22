import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Plus, Trash2, Printer, Save, FolderOpen, X, Copy, FilePlus2, ChevronDown, Check } from "lucide-react";

// ---------- helpers ----------
const uid = () => Math.random().toString(36).slice(2, 10);

const CURRENCIES = {
  USD: { symbol: "$", label: "USD" },
  EUR: { symbol: "€", label: "EUR" },
  GBP: { symbol: "£", label: "GBP" },
  INR: { symbol: "₹", label: "INR" },
  JPY: { symbol: "¥", label: "JPY" },
};

const emptyItem = () => ({ id: uid(), desc: "", qty: 1, price: 0 });

const blankQuote = () => ({
  id: uid(),
  quoteNo: "Q-" + String(Math.floor(1000 + Math.random() * 9000)),
  date: new Date().toISOString().slice(0, 10),
  validUntil: "",
  status: "DRAFT",
  currency: "USD",
  from: { name: "", address: "", email: "", phone: "" },
  to: { name: "", address: "", email: "" },
  items: [emptyItem()],
  taxRate: 0,
  discount: 0,
  notes: "",
  terms: "Payment due within 14 days of acceptance.",
});

function fmt(n, symbol) {
  const v = Number.isFinite(n) ? n : 0;
  return symbol + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcTotals(q) {
  const subtotal = q.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
  const discountAmt = subtotal * ((Number(q.discount) || 0) / 100);
  const taxable = subtotal - discountAmt;
  const taxAmt = taxable * ((Number(q.taxRate) || 0) / 100);
  const total = taxable + taxAmt;
  return { subtotal, discountAmt, taxAmt, total };
}

// ---------- small UI atoms ----------
function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-[0.08em] text-stone-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full bg-transparent border-b border-stone-300 focus:border-emerald-800 outline-none py-1.5 text-[14px] text-stone-800 placeholder:text-stone-400 transition-colors";

function Section({ eyebrow, title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-stone-200 bg-white/60 rounded-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <div className="text-[10px] tracking-[0.14em] uppercase text-emerald-800/70 font-medium">{eyebrow}</div>
          <div className="text-[15px] font-medium text-stone-800" style={{ fontFamily: "'Fraunces', serif" }}>
            {title}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

// ---------- main app ----------
export default function QuotationApp() {
  const [quote, setQuote] = useState(blankQuote());
  const [saved, setSaved] = useState([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [toast, setToast] = useState("");
  const printRef = useRef(null);

  const totals = useMemo(() => calcTotals(quote), [quote]);
  const cur = CURRENCIES[quote.currency]?.symbol || "$";

  const flash = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 1800);
  }, []);

  // load library index on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("quotes:index");
        if (res && res.value) setSaved(JSON.parse(res.value));
      } catch (e) {
        // no index yet
      }
    })();
  }, []);

  const updateFrom = (k, v) => setQuote((q) => ({ ...q, from: { ...q.from, [k]: v } }));
  const updateTo = (k, v) => setQuote((q) => ({ ...q, to: { ...q.to, [k]: v } }));
  const updateItem = (id, k, v) =>
    setQuote((q) => ({ ...q, items: q.items.map((it) => (it.id === id ? { ...it, [k]: v } : it)) }));
  const addItem = () => setQuote((q) => ({ ...q, items: [...q.items, emptyItem()] }));
  const removeItem = (id) =>
    setQuote((q) => ({ ...q, items: q.items.length > 1 ? q.items.filter((it) => it.id !== id) : q.items }));

  const saveQuote = async () => {
    try {
      const key = "quote:" + quote.id;
      await window.storage.set(key, JSON.stringify(quote));
      const idx = saved.some((s) => s.id === quote.id)
        ? saved.map((s) => (s.id === quote.id ? { id: quote.id, quoteNo: quote.quoteNo, to: quote.to.name, total: totals.total, currency: quote.currency } : s))
        : [...saved, { id: quote.id, quoteNo: quote.quoteNo, to: quote.to.name, total: totals.total, currency: quote.currency }];
      await window.storage.set("quotes:index", JSON.stringify(idx));
      setSaved(idx);
      flash("Quote saved");
    } catch (e) {
      flash("Couldn't save — try again");
    }
  };

  const loadQuote = async (id) => {
    try {
      const res = await window.storage.get("quote:" + id);
      if (res && res.value) {
        setQuote(JSON.parse(res.value));
        setShowLibrary(false);
      }
    } catch (e) {
      flash("Couldn't load that quote");
    }
  };

  const deleteQuote = async (id) => {
    try {
      await window.storage.delete("quote:" + id);
      const idx = saved.filter((s) => s.id !== id);
      await window.storage.set("quotes:index", JSON.stringify(idx));
      setSaved(idx);
    } catch (e) {
      flash("Couldn't delete");
    }
  };

  const newQuote = () => setQuote(blankQuote());

  const duplicateQuote = () => setQuote((q) => ({ ...q, id: uid(), quoteNo: q.quoteNo + "-copy" }));

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen w-full bg-[#F6F2E9] text-stone-800" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .mono { font-family: 'IBM Plex Mono', monospace; }
        .perforation {
          background-image: radial-gradient(circle, #F6F2E9 3px, transparent 3.5px);
          background-size: 14px 14px;
          background-position: -3px center;
          height: 8px;
        }
        input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0.5; }
        @media print {
          .no-print { display: none !important; }
          .print-area { box-shadow: none !important; margin: 0 !important; width: 100% !important; }
          body { background: white !important; }
        }
      `}</style>

      {/* Top bar */}
      <div className="no-print sticky top-0 z-20 border-b border-stone-300/70 bg-[#F6F2E9]/95 backdrop-blur px-4 sm:px-6 py-3 flex items-center justify-between">
        <div>
          <div className="text-[10px] tracking-[0.18em] uppercase text-emerald-800/70 font-medium">Estimate Builder</div>
          <div className="text-lg font-medium -mt-0.5" style={{ fontFamily: "'Fraunces', serif" }}>Quotations</div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={newQuote} title="New quote" className="p-2 rounded-sm hover:bg-stone-200/60 transition-colors">
            <FilePlus2 className="w-4 h-4 text-stone-600" />
          </button>
          <button onClick={duplicateQuote} title="Duplicate" className="p-2 rounded-sm hover:bg-stone-200/60 transition-colors">
            <Copy className="w-4 h-4 text-stone-600" />
          </button>
          <button onClick={() => setShowLibrary(true)} title="Saved quotes" className="p-2 rounded-sm hover:bg-stone-200/60 transition-colors relative">
            <FolderOpen className="w-4 h-4 text-stone-600" />
            {saved.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-emerald-800 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">
                {saved.length}
              </span>
            )}
          </button>
          <button onClick={saveQuote} title="Save" className="p-2 rounded-sm hover:bg-stone-200/60 transition-colors">
            <Save className="w-4 h-4 text-stone-600" />
          </button>
          <button
            onClick={handlePrint}
            className="ml-1 flex items-center gap-1.5 bg-emerald-900 text-white text-[13px] font-medium px-3.5 py-2 rounded-sm hover:bg-emerald-800 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" /> Print / PDF
          </button>
        </div>
      </div>

      {toast && (
        <div className="no-print fixed top-16 right-6 z-30 bg-stone-900 text-white text-[13px] px-3.5 py-2 rounded-sm shadow-lg flex items-center gap-2">
          <Check className="w-3.5 h-3.5 text-emerald-400" /> {toast}
        </div>
      )}

      {/* Library drawer */}
      {showLibrary && (
        <div className="no-print fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-stone-900/30" onClick={() => setShowLibrary(false)} />
          <div className="relative w-full max-w-sm bg-[#FAF7F0] h-full shadow-2xl p-5 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[15px] font-medium" style={{ fontFamily: "'Fraunces', serif" }}>Saved quotes</div>
              <button onClick={() => setShowLibrary(false)}><X className="w-4 h-4 text-stone-500" /></button>
            </div>
            {saved.length === 0 && (
              <p className="text-[13px] text-stone-500">Nothing saved yet. Build a quote and hit save to keep it here.</p>
            )}
            <div className="space-y-2">
              {saved.map((s) => (
                <div key={s.id} className="border border-stone-200 rounded-sm p-3 flex items-center justify-between bg-white/70">
                  <button onClick={() => loadQuote(s.id)} className="text-left flex-1">
                    <div className="text-[13px] font-medium mono">{s.quoteNo}</div>
                    <div className="text-[12px] text-stone-500">{s.to || "Untitled client"} · {fmt(s.total, CURRENCIES[s.currency]?.symbol || "$")}</div>
                  </button>
                  <button onClick={() => deleteQuote(s.id)} className="p-1.5 hover:bg-red-50 rounded-sm text-stone-400 hover:text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-stone-400 mt-4">Saved on this device only.</p>
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8">
        {/* LEFT: editor */}
        <div className="no-print space-y-4">
          <Section eyebrow="01" title="From">
            <Field label="Business name">
              <input className={inputCls} value={quote.from.name} onChange={(e) => updateFrom("name", e.target.value)} placeholder="Northwind Studio" />
            </Field>
            <Field label="Address">
              <input className={inputCls} value={quote.from.address} onChange={(e) => updateFrom("address", e.target.value)} placeholder="14 Harbor St, Portland" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email">
                <input className={inputCls} value={quote.from.email} onChange={(e) => updateFrom("email", e.target.value)} placeholder="hello@studio.co" />
              </Field>
              <Field label="Phone">
                <input className={inputCls} value={quote.from.phone} onChange={(e) => updateFrom("phone", e.target.value)} placeholder="(555) 010-2200" />
              </Field>
            </div>
          </Section>

          <Section eyebrow="02" title="Bill to">
            <Field label="Client name">
              <input className={inputCls} value={quote.to.name} onChange={(e) => updateTo("name", e.target.value)} placeholder="Acme Corp" />
            </Field>
            <Field label="Address">
              <input className={inputCls} value={quote.to.address} onChange={(e) => updateTo("address", e.target.value)} placeholder="200 Market Ave, Denver" />
            </Field>
            <Field label="Email">
              <input className={inputCls} value={quote.to.email} onChange={(e) => updateTo("email", e.target.value)} placeholder="ap@acme.com" />
            </Field>
          </Section>

          <Section eyebrow="03" title="Details">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quote #">
                <input className={inputCls + " mono"} value={quote.quoteNo} onChange={(e) => setQuote((q) => ({ ...q, quoteNo: e.target.value }))} />
              </Field>
              <Field label="Currency">
                <select
                  className={inputCls}
                  value={quote.currency}
                  onChange={(e) => setQuote((q) => ({ ...q, currency: e.target.value }))}
                >
                  {Object.entries(CURRENCIES).map(([k, v]) => (
                    <option key={k} value={k}>{k} ({v.symbol})</option>
                  ))}
                </select>
              </Field>
              <Field label="Date">
                <input type="date" className={inputCls} value={quote.date} onChange={(e) => setQuote((q) => ({ ...q, date: e.target.value }))} />
              </Field>
              <Field label="Valid until">
                <input type="date" className={inputCls} value={quote.validUntil} onChange={(e) => setQuote((q) => ({ ...q, validUntil: e.target.value }))} />
              </Field>
            </div>
            <Field label="Status">
              <div className="flex gap-2 pt-1">
                {["DRAFT", "SENT", "ACCEPTED"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setQuote((q) => ({ ...q, status: s }))}
                    className={`text-[11px] tracking-wide uppercase px-2.5 py-1 rounded-sm border transition-colors ${
                      quote.status === s ? "bg-emerald-900 text-white border-emerald-900" : "border-stone-300 text-stone-500 hover:border-stone-400"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Field>
          </Section>

          <Section eyebrow="04" title="Line items">
            <div className="space-y-2">
              {quote.items.map((it, i) => (
                <div key={it.id} className="grid grid-cols-[1fr_50px_70px_28px] gap-2 items-end">
                  <Field label={i === 0 ? "Description" : ""}>
                    <input className={inputCls} value={it.desc} onChange={(e) => updateItem(it.id, "desc", e.target.value)} placeholder="Website design" />
                  </Field>
                  <Field label={i === 0 ? "Qty" : ""}>
                    <input type="number" className={inputCls + " mono"} value={it.qty} onChange={(e) => updateItem(it.id, "qty", e.target.value)} />
                  </Field>
                  <Field label={i === 0 ? "Price" : ""}>
                    <input type="number" className={inputCls + " mono"} value={it.price} onChange={(e) => updateItem(it.id, "price", e.target.value)} />
                  </Field>
                  <button onClick={() => removeItem(it.id)} className="mb-1.5 p-1.5 text-stone-300 hover:text-red-600 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addItem} className="flex items-center gap-1.5 text-[12px] text-emerald-800 hover:text-emerald-900 font-medium pt-1">
              <Plus className="w-3.5 h-3.5" /> Add line item
            </button>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-stone-200">
              <Field label="Discount %">
                <input type="number" className={inputCls + " mono"} value={quote.discount} onChange={(e) => setQuote((q) => ({ ...q, discount: e.target.value }))} />
              </Field>
              <Field label="Tax %">
                <input type="number" className={inputCls + " mono"} value={quote.taxRate} onChange={(e) => setQuote((q) => ({ ...q, taxRate: e.target.value }))} />
              </Field>
            </div>
          </Section>

          <Section eyebrow="05" title="Notes & terms" defaultOpen={false}>
            <Field label="Notes">
              <textarea className={inputCls + " resize-none"} rows={2} value={quote.notes} onChange={(e) => setQuote((q) => ({ ...q, notes: e.target.value }))} placeholder="Thanks for the opportunity to quote this." />
            </Field>
            <Field label="Terms">
              <textarea className={inputCls + " resize-none"} rows={2} value={quote.terms} onChange={(e) => setQuote((q) => ({ ...q, terms: e.target.value }))} />
            </Field>
          </Section>
        </div>

        {/* RIGHT: paper preview */}
        <div className="lg:sticky lg:top-20 self-start">
          <div className="print-area bg-[#FFFEFB] shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_28px_-8px_rgba(40,30,20,0.18)] max-w-[560px] mx-auto">
            <div className="perforation" />
            <div className="p-8 sm:p-10 relative overflow-hidden">
              {/* stamp */}
              <div
                className="absolute top-8 right-8 border-2 rounded-sm px-3 py-1 text-[11px] font-semibold tracking-[0.14em] uppercase rotate-[8deg] select-none"
                style={{
                  color: quote.status === "ACCEPTED" ? "#1F4B43" : "#B4432F",
                  borderColor: quote.status === "ACCEPTED" ? "#1F4B43" : "#B4432F",
                }}
              >
                {quote.status}
              </div>

              <div className="text-[10px] tracking-[0.18em] uppercase text-stone-400 mb-1">Estimate</div>
              <h1 className="text-[30px] leading-tight mb-6 pr-20" style={{ fontFamily: "'Fraunces', serif" }}>
                {quote.from.name || "Your Business"}
              </h1>

              <div className="grid grid-cols-2 gap-6 mb-6 text-[13px]">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-stone-400 mb-1">From</div>
                  <div className="text-stone-700">{quote.from.address || "—"}</div>
                  <div className="text-stone-500">{quote.from.email}</div>
                  <div className="text-stone-500">{quote.from.phone}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-stone-400 mb-1">To</div>
                  <div className="text-stone-700 font-medium">{quote.to.name || "Client name"}</div>
                  <div className="text-stone-500">{quote.to.address}</div>
                  <div className="text-stone-500">{quote.to.email}</div>
                </div>
              </div>

              <div className="flex justify-between text-[12px] mono text-stone-500 border-y border-stone-200 py-2 mb-6">
                <span>№ {quote.quoteNo}</span>
                <span>{quote.date}</span>
                <span>Valid until {quote.validUntil || "—"}</span>
              </div>

              <table className="w-full text-[13px] mb-2">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-stone-400 border-b border-stone-200">
                    <th className="text-left font-medium py-1.5">Description</th>
                    <th className="text-right font-medium py-1.5 w-12">Qty</th>
                    <th className="text-right font-medium py-1.5 w-20">Price</th>
                    <th className="text-right font-medium py-1.5 w-24">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items.map((it) => (
                    <tr key={it.id} className="border-b border-stone-100">
                      <td className="py-1.5 text-stone-700 pr-2">{it.desc || "—"}</td>
                      <td className="py-1.5 text-right mono text-stone-500">{it.qty}</td>
                      <td className="py-1.5 text-right mono text-stone-500">{fmt(Number(it.price) || 0, cur)}</td>
                      <td className="py-1.5 text-right mono text-stone-700">{fmt((Number(it.qty) || 0) * (Number(it.price) || 0), cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end mb-6">
                <div className="w-48 text-[13px] space-y-1.5">
                  <div className="flex justify-between text-stone-500">
                    <span>Subtotal</span><span className="mono">{fmt(totals.subtotal, cur)}</span>
                  </div>
                  {Number(quote.discount) > 0 && (
                    <div className="flex justify-between text-stone-500">
                      <span>Discount ({quote.discount}%)</span><span className="mono">−{fmt(totals.discountAmt, cur)}</span>
                    </div>
                  )}
                  {Number(quote.taxRate) > 0 && (
                    <div className="flex justify-between text-stone-500">
                      <span>Tax ({quote.taxRate}%)</span><span className="mono">{fmt(totals.taxAmt, cur)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[16px] font-semibold text-stone-900 pt-1.5 border-t border-stone-300" style={{ fontFamily: "'Fraunces', serif" }}>
                    <span>Total</span><span className="mono">{fmt(totals.total, cur)}</span>
                  </div>
                </div>
              </div>

              {quote.notes && (
                <p className="text-[12px] text-stone-500 mb-3 leading-relaxed">{quote.notes}</p>
              )}
              {quote.terms && (
                <p className="text-[11px] text-stone-400 leading-relaxed border-t border-stone-100 pt-3">{quote.terms}</p>
              )}
            </div>
            <div className="perforation" />
          </div>
        </div>
      </div>
    </div>
  );
}
