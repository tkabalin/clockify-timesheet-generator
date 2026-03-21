// Cloudflare Worker — Timesheet Generator

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="256" height="256">
  <rect width="100" height="100" rx="25" fill="#007074" />
  
  <circle cx="50" cy="50" r="32" fill="#ffffff" />
  
  <path d="M 50 30 L 50 50 L 62 50" stroke="#007074" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
</svg>`;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/favicon.svg") {
      return new Response(FAVICON, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=604800",
        },
      });
    }
    return new Response(HTML, {
      headers: { "Content-Type": "text/html;charset=utf-8" },
    });
  },
};

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Timesheet Generator</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #f1f5f9; color: #0f172a; }
    @media print {
      body { background: #fff; }
      .no-print { display: none !important; }
    }
    @media (max-width: 640px) {
      [data-view="upload"] { padding: 24px 16px !important; }
      [data-upload-inner] { padding: 24px !important; }
      [data-upload-box] { padding: 48px 24px !important; }
      [data-upload-title] { font-size: 24px !important; }
      [data-view="edit"] { padding: 20px 16px !important; }
      [data-section] { padding: 20px !important; }
      [data-grid-2col] { grid-template-columns: 1fr !important; gap: 12px !important; }
      [data-header-row] { flex-direction: column !important; align-items: flex-start !important; gap: 12px !important; }
      [data-btn-row] { width: 100% !important; }
      [data-btn-row] > * { flex: 1 !important; text-align: center !important; display: flex !important; align-items: center !important; justify-content: center !important; }
      [data-entry-row] { flex-wrap: wrap !important; gap: 4px 8px !important; }
      [data-entry-date] { width: auto !important; flex-shrink: 0 !important; }
      [data-entry-tasks] { flex-basis: 100% !important; order: 3 !important; }
      [data-entry-hours] { width: auto !important; }
      [data-entry-amount] { width: auto !important; }
      [data-view="preview"] { padding: 20px 12px !important; }
      [data-preview-btns] { gap: 8px !important; }
      [data-preview-btns] button { padding: 10px 16px !important; font-size: 13px !important; }
    }
  </style>
</head>
<body>
  <div id="root"></div>

  <script crossorigin src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
  <script crossorigin src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
  <script crossorigin src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js"></script>
  <script crossorigin src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.9/babel.min.js"></script>

  <script type="text/babel" data-type="module">
    const { useState, useRef, useCallback, useEffect } = React;

    const TEAL = "#00727d";
    const DARK = "#0f172a";
    const DESIGN_WIDTH = 820;
    const PAGE_PREVIEW_HEIGHT = 1160;
    const SUMMARY_FIRST_PAGE_UNITS = 14;
    const SUMMARY_CONT_PAGE_UNITS = 20;
    const SUMMARY_LAST_PAGE_RESERVE = 2;
    const LOG_FIRST_PAGE_ROWS = 18;
    const LOG_CONT_PAGE_ROWS = 22;
    const LOG_LAST_PAGE_RESERVE = 2;

    const fmt = (n) => {
      const str = n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return "R\\u00A0" + str;
    };

    const parseDate = (s) => {
      if (!s) return null;
      const str = s.toString().trim();
      let m = str.match(/^(\\d{4})[-\\/](\\d{1,2})[-\\/](\\d{1,2})/);
      if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
      m = str.match(/^(\\d{1,2})[-\\/\\.](\\d{1,2})[-\\/\\.](\\d{4})/);
      if (m) {
        const a = +m[1], b = +m[2], y = +m[3];
        if (a > 12) return new Date(y, b - 1, a);
        if (b > 12) return new Date(y, a - 1, b);
        return new Date(y, b - 1, a);
      }
      const d = new Date(str);
      return isNaN(d.getTime()) ? null : d;
    };

    const fmtDate = (d) => {
      if (!d) return "";
      const dt = typeof d === "string" ? parseDate(d) : d;
      if (!dt) return "";
      return dt.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
    };

    const fmtTime = (t) => {
      if (!t) return "";
      const parts = t.toString().trim().split(":");
      if (parts.length >= 2) return parts[0] + ":" + parts[1];
      return t;
    };

    const toTitleCase = (s) => {
      if (!s) return "";
      return s.replace(/\\w\\S*/g, (t) => t.charAt(0).toUpperCase() + t.substring(1).toLowerCase());
    };

    const parseTasks = (s) => (s || "").split(",").map((t) => t.trim()).filter(Boolean);
    const pillStyle = { display: "inline-block", background: "#e6f4f5", color: TEAL, fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 99, marginRight: 5, marginBottom: 3, whiteSpace: "nowrap" };
    const TaskPills = ({ desc }) => (
      React.createElement("span", { style: { display: "flex", flexWrap: "wrap", gap: 0 } },
        parseTasks(desc).map((task, j) =>
          React.createElement("span", { key: j, style: pillStyle }, toTitleCase(task))
        )
      )
    );

    const estimateSummaryRowUnits = (line) => {
      const tasks = parseTasks(line?.description || "");
      if (!tasks.length) return 1;
      const byCount = Math.ceil(tasks.length / 4);
      const byChars = Math.ceil(tasks.join(", ").length / 42);
      return Math.max(1, byCount, byChars);
    };

    const estimateBankUnits = (details) => {
      if (!details) return 0;
      const lines = details.split(/\\r?\\n/).map((l) => l.trim()).filter(Boolean).length;
      return 2 + Math.ceil(lines / 2);
    };

    const chunkRowsByUnits = (rows, firstCapacity, nextCapacity, getUnits) => {
      const out = [];
      let i = 0;
      let capacity = firstCapacity;
      while (i < rows.length) {
        let used = 0;
        const chunk = [];
        while (i < rows.length) {
          const units = Math.max(1, getUnits(rows[i]));
          if (chunk.length && used + units > capacity) break;
          chunk.push(rows[i]);
          used += units;
          i += 1;
          if (used >= capacity) break;
        }
        if (!chunk.length && i < rows.length) {
          chunk.push(rows[i]);
          i += 1;
        }
        out.push(chunk);
        capacity = nextCapacity;
      }
      return out.length ? out : [[]];
    };

    const paginateSummaryRows = (rows, bankDetails) => {
      const chunks = chunkRowsByUnits(rows, SUMMARY_FIRST_PAGE_UNITS, SUMMARY_CONT_PAGE_UNITS, estimateSummaryRowUnits);
      const lastIdx = chunks.length - 1;
      const lastCap = lastIdx === 0 ? SUMMARY_FIRST_PAGE_UNITS : SUMMARY_CONT_PAGE_UNITS;
      const lastUnits = chunks[lastIdx].reduce((sum, row) => sum + estimateSummaryRowUnits(row), 0);
      const reserve = SUMMARY_LAST_PAGE_RESERVE + estimateBankUnits(bankDetails);
      if (lastUnits + reserve > lastCap) chunks.push([]);
      return chunks;
    };

    const paginateLogRows = (rows) => {
      const chunks = chunkRowsByUnits(rows, LOG_FIRST_PAGE_ROWS, LOG_CONT_PAGE_ROWS, () => 1);
      const lastIdx = chunks.length - 1;
      const lastCap = lastIdx === 0 ? LOG_FIRST_PAGE_ROWS : LOG_CONT_PAGE_ROWS;
      if (chunks[lastIdx].length > Math.max(1, lastCap - LOG_LAST_PAGE_RESERVE)) chunks.push([]);
      return chunks;
    };

    const periodFromFilename = (name) => {
      const m = name.match(/(\\d{2})_(\\d{2})_(\\d{4})-(\\d{2})_(\\d{2})_(\\d{4})/);
      if (!m) return "";
      const f = (dd, mm, yyyy) => {
        const d = new Date(+yyyy, +mm - 1, +dd);
        return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
      };
      return f(m[1], m[2], m[3]) + " \\u2013 " + f(m[4], m[5], m[6]);
    };

    function buildData(lines) {
      lines.sort((a, b) => (parseDate(a.date) || 0) - (parseDate(b.date) || 0));
      return { lines, rate: lines[0]?.rate || 0 };
    }

    /* ── Print CSS — explicit page blocks with bottom-anchored footers ── */
    const PRINT_CSS = [
      "*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }",
      "@page { size: A4 portrait; margin: 15mm 18mm; }",
      "html, body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }",
      ".print-sheet { background: #fff; }",
      ".print-page { display: flex; flex-direction: column; min-height: calc(297mm - 30mm) !important; margin-bottom: 0 !important; page-break-after: always; break-after: page; break-inside: avoid; }",
      ".print-page:last-child { page-break-after: auto; break-after: auto; }",
      ".print-page-body { flex: 1; display: flex; flex-direction: column; }",
      "table { width: 100%; border-collapse: collapse; }",
      "thead { display: table-header-group; }",
      "tr { page-break-inside: avoid; }",
      "th { font-size: 8pt; text-transform: uppercase; letter-spacing: 1.2px; color: #94a3b8; font-weight: 700; padding: 10px 12px; text-align: left; border-bottom: 2px solid #e2e8f0; }",
      "th.r { text-align: right; }",
      "td { padding: 10px 12px; font-size: 10pt; color: #334155; border-bottom: 1px solid #f1f5f9; }",
      "td.r { text-align: right; white-space: nowrap; }",
      "tr:last-child td { border-bottom: 2px solid #e2e8f0; }",
      ".pill { display: inline-block; background: #e6f4f5; color: #00727d; font-size: 8pt; font-weight: 500; padding: 2px 8px; border-radius: 99px; margin-right: 4px; margin-bottom: 2px; white-space: nowrap; }",
    ].join("\\n");

    const toFiniteNumber = (value) => {
      const n = Number.parseFloat(value);
      return Number.isFinite(n) ? n : 0;
    };

    const parseMoney = (value) => {
      const clean = (value ?? "0").toString().replace(/[^0-9.]/g, "");
      return toFiniteNumber(clean);
    };

    const savePDF = (ref, setNotice) => {
      const el = ref.current;
      if (!el) return;
      const html = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
        '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">' +
        '<style>' + PRINT_CSS + '</style>' +
        '</head><body>' + el.innerHTML + '</body></html>';
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (win) {
        if (setNotice) setNotice("");
        setTimeout(() => { try { win.print(); } catch(e) {} }, 900);
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = "timesheet.html";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        if (setNotice) {
          setNotice("Pop-up blocked. Downloaded HTML instead — open it and print from your browser.");
        }
      }
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    };

    function parseClockifyCSV(text) {
      const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
      return data.map((r) => ({
        date: r["Start Date"] || "", description: r["Description"] || r["Task"] || "Development work",
        hours: toFiniteNumber(r["Duration (decimal)"] || 0), duration: r["Duration (h)"] || "",
        rate: parseMoney(r["Billable Rate (R)"] || r["Billable Rate"] || "0"),
        amount: parseMoney(r["Billable Amount (R)"] || r["Billable Amount"] || "0"),
        user: r["User"] || "", email: r["Email"] || "", startTime: r["Start Time"] || "", endTime: r["End Time"] || "",
      })).filter((r) => r.hours > 0);
    }

    function TimesheetGenerator() {
      const [data, setData] = useState(null);
      const [name, setName] = useState("");
      const [email, setEmail] = useState("");
      const [company, setCompany] = useState("");
      const [period, setPeriod] = useState("");
      const [bankDetails, setBankDetails] = useState("");
      const [view, setView] = useState("upload");
      const [notice, setNotice] = useState("");
      const [previewScale, setPreviewScale] = useState(1);
      const [contentHeight, setContentHeight] = useState(2244);
      const sheetRef = useRef(null);
      const previewWrapRef = useRef(null);
      const innerRef = useRef(null);

      const handleFile = useCallback((e) => {
        const file = e.target?.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const lines = parseClockifyCSV(ev.target.result);
          if (!lines.length) {
            setNotice("No valid billable entries were found in this CSV. Please export a Clockify Detailed report with billable hours.");
            return;
          }
          setNotice("");
          setData(buildData(lines));
          setName(lines[0].user); setEmail(lines[0].email);
          setPeriod(periodFromFilename(file.name)); setView("edit");
        };
        reader.onerror = () => {
          setNotice("Could not read the selected file. Please try again with a valid CSV export.");
        };
        reader.readAsText(file);
      }, []);

      useEffect(() => {
        if (view !== "preview") return;
        const measure = () => {
          const wrap = previewWrapRef.current;
          const inner = innerRef.current;
          if (!wrap || !inner) return;
          const w = wrap.clientWidth;
          const s = w < DESIGN_WIDTH ? w / DESIGN_WIDTH : 1;
          setPreviewScale(s);
          setContentHeight(inner.scrollHeight * s);
        };
        // Small delay to let render complete
        const t = setTimeout(measure, 50);
        window.addEventListener("resize", measure);
        return () => { clearTimeout(t); window.removeEventListener("resize", measure); };
      }, [view, data, bankDetails, company, period, name, email]);

      const totalHours = data?.lines.reduce((s, l) => s + l.hours, 0) || 0;
      const totalAmount = data?.lines.reduce((s, l) => s + l.amount, 0) || 0;
      const summaryChunks = data ? paginateSummaryRows(data.lines, bankDetails) : [];
      const logChunks = data ? paginateLogRows(data.lines) : [];
      const totalPages = summaryChunks.length + logChunks.length;

      const inputStyle = { width: "100%", padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 16, fontFamily: "'Inter', sans-serif", color: DARK, background: "#fff", outline: "none", boxSizing: "border-box" };
      const labelStyle = { display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, color: "#64748b", marginBottom: 6 };
      const sectionStyle = { background: "#fff", borderRadius: 12, padding: 28, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" };
      const thBase = { fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: "#94a3b8", fontWeight: 700, padding: "12px 16px", textAlign: "left", borderBottom: "2px solid #e2e8f0" };
      const thR = { ...thBase, textAlign: "right" };
      const btnBase = { border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", minHeight: 44 };

      if (view === "upload") {
        return (
          <div data-view="upload" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", background: "#f1f5f9", padding: "32px 24px" }}>
            <div data-upload-inner style={{ textAlign: "center", maxWidth: 520, padding: 48 }}>
              <h1 data-upload-title style={{ fontSize: 30, fontWeight: 700, color: DARK, marginBottom: 8 }}>Timesheet Generator</h1>
              <p style={{ color: "#64748b", fontSize: 15, marginBottom: 40 }}>Import your Clockify CSV export to generate a timesheet</p>
              {notice && (
                <p style={{ color: "#b45309", fontSize: 13, marginBottom: 20, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 12px" }}>
                  {notice}
                </p>
              )}
              <label data-upload-box style={{ display: "block", border: "2px dashed #cbd5e1", borderRadius: 16, padding: "64px 40px", cursor: "pointer", background: "#fff", transition: "all 0.2s" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = TEAL; e.currentTarget.style.background = "#f0fafb"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.background = "#fff"; }}
              >
                <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}>
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                  </svg>
                </div>
                <p style={{ color: DARK, fontSize: 15, fontWeight: 600 }}>Choose a Clockify CSV file</p>
                <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 8 }}>Clockify → Reports → Detailed → Export → CSV</p>
                <input type="file" accept=".csv" onChange={handleFile} style={{ display: "none" }} />
              </label>
            </div>
          </div>
        );
      }

      if (view === "edit") {
        return (
          <div data-view="edit" style={{ minHeight: "100vh", fontFamily: "'Inter', sans-serif", background: "#f1f5f9", padding: "32px 24px" }}>
            <div style={{ maxWidth: 640, margin: "0 auto" }}>
              <div data-header-row style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h1 style={{ fontSize: 26, fontWeight: 700, color: DARK }}>Timesheet</h1>
                  <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>{data.lines.length} entries, {totalHours.toFixed(1)} hours</p>
                </div>
                <div data-btn-row style={{ display: "flex", gap: 8 }}>
                  <label style={{ ...btnBase, background: "#e2e8f0", color: "#334155", padding: "10px 18px", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    Import Clockify CSV
                    <input type="file" accept=".csv" onChange={handleFile} style={{ display: "none" }} />
                  </label>
                  <button onClick={() => setView("preview")} style={{ ...btnBase, background: TEAL, color: "#fff", padding: "10px 24px" }}>
                    Preview →
                  </button>
                </div>
              </div>
              {notice && (
                <p style={{ color: "#b45309", fontSize: 13, marginBottom: 20, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 12px" }}>
                  {notice}
                </p>
              )}

              <div data-section style={sectionStyle}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: DARK, marginBottom: 20 }}>Employee Details</h2>
                <div data-grid-2col style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div><label style={labelStyle}>Full Name</label><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} /></div>
                  <div><label style={labelStyle}>Email</label><input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                </div>
                <div style={{ marginTop: 16 }}><label style={labelStyle}>Banking Details</label><textarea style={{ ...inputStyle, minHeight: 72, resize: "vertical" }} value={bankDetails} onChange={(e) => setBankDetails(e.target.value)} placeholder={"Bank: FNB\\nAccount: 12345678\\nBranch: 250655"} /></div>
              </div>

              <div data-section style={sectionStyle}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: DARK, marginBottom: 20 }}>Company & Period</h2>
                <div data-grid-2col style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div><label style={labelStyle}>Company Name</label><input style={inputStyle} value={company} onChange={(e) => setCompany(e.target.value)} /></div>
                  <div><label style={labelStyle}>Period</label><input style={inputStyle} value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="e.g. 22 Feb – 22 Mar 2026" /></div>
                </div>
              </div>

              <div data-section style={{ ...sectionStyle, background: "#f8fafc" }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: DARK, marginBottom: 16 }}>Time Entries</h2>
                <div style={{ fontSize: 13, color: "#64748b" }}>
                  {data.lines.map((l, i) => (
                    <div data-entry-row key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < data.lines.length - 1 ? "1px solid #e2e8f0" : "none", gap: 12, alignItems: "center" }}>
                      <span data-entry-date style={{ flexShrink: 0, width: 90 }}>{fmtDate(l.date)}</span>
                      <span data-entry-tasks style={{ flex: 1, minWidth: 0 }}><TaskPills desc={l.description} /></span>
                      <span data-entry-hours style={{ flexShrink: 0, width: 50, textAlign: "right" }}>{l.hours.toFixed(2)}h</span>
                      <span data-entry-amount style={{ flexShrink: 0, width: 100, textAlign: "right", color: DARK, fontWeight: 500, whiteSpace: "nowrap" }}>{fmt(l.amount)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, paddingTop: 12, borderTop: "2px solid " + TEAL }}>
                  <span style={{ fontSize: 20, fontWeight: 700, color: DARK, whiteSpace: "nowrap" }}>{fmt(totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        );
      }

      /* ── PREVIEW — explicit page blocks ── */
      const sectionHead = (subtitle) => (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: subtitle ? 32 : 40, paddingBottom: subtitle ? 20 : 24, borderBottom: (subtitle ? "2px" : "3px") + " solid " + TEAL }}>
          <div>
            {subtitle
              ? <><h2 style={{ fontSize: 22, fontWeight: 700, color: DARK, margin: 0 }}>{name || "Employee Name"}</h2><p style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{subtitle}</p></>
              : <><h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5, color: DARK, margin: 0 }}>{name || "Employee Name"}</h1><p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{email}</p></>
            }
          </div>
          <div style={{ background: TEAL, color: "#fff", padding: subtitle ? "8px 20px" : "12px 28px", fontSize: subtitle ? 14 : 20, fontWeight: 700, letterSpacing: 2, flexShrink: 0 }}>TIMESHEET</div>
        </div>
      );

      const pageStyle = {
        minHeight: PAGE_PREVIEW_HEIGHT,
        background: "#fff",
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        fontFamily: "'Inter', sans-serif",
        color: DARK,
        display: "flex",
        flexDirection: "column",
        padding: "40px 48px",
        marginBottom: 24,
      };

      const pageBodyStyle = { flex: 1, display: "flex", flexDirection: "column" };
      const pageFooterStyle = { marginTop: "auto", paddingTop: 20, borderTop: "1px solid #e2e8f0" };

      return (
        <div data-view="preview" style={{ minHeight: "100vh", fontFamily: "'Inter', sans-serif", background: "#f1f5f9", padding: "32px 24px" }}>
          <div style={{ maxWidth: DESIGN_WIDTH, margin: "0 auto" }}>
            <div data-preview-btns className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12 }}>
              <button onClick={() => setView("edit")} style={{ ...btnBase, background: "#e2e8f0", color: "#334155", padding: "10px 24px", fontWeight: 500 }}>← Edit</button>
              <button onClick={() => savePDF(sheetRef, setNotice)} style={{ ...btnBase, background: TEAL, color: "#fff", padding: "10px 28px" }}>Save as PDF ↓</button>
            </div>
            {notice && (
              <p className="no-print" style={{ color: "#b45309", fontSize: 13, marginBottom: 12, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 12px" }}>
                {notice}
              </p>
            )}

            <div ref={previewWrapRef} style={{ overflow: "hidden", borderRadius: 4, height: previewScale < 1 ? contentHeight : "auto" }}>
              <div ref={innerRef} style={{ width: DESIGN_WIDTH, transform: previewScale < 1 ? "scale(" + previewScale + ")" : "none", transformOrigin: "top left" }}>
                <div ref={sheetRef} className="print-sheet" style={{ fontFamily: "'Inter', sans-serif", color: DARK }}>
                  {summaryChunks.map((rows, chunkIndex) => {
                    const isFirst = chunkIndex === 0;
                    const isLast = chunkIndex === summaryChunks.length - 1;
                    const pageNumber = chunkIndex + 1;
                    return (
                      <div key={"summary-" + chunkIndex} className={"print-page" + (chunkIndex > 0 ? " print-section-break" : "")} style={pageStyle}>
                        <div className="print-page-body" style={pageBodyStyle}>
                          {sectionHead(isFirst ? null : "Timesheet (continued)")}

                          {isFirst && (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 36 }}>
                              <div>
                                <h3 style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: "#94a3b8", marginBottom: 8, fontWeight: 700 }}>Company</h3>
                                <p style={{ fontSize: 13, lineHeight: 1.7, color: "#334155" }}><strong style={{ color: DARK, fontWeight: 600 }}>{company || "Company Name"}</strong></p>
                              </div>
                              <div>
                                <h3 style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: "#94a3b8", marginBottom: 8, fontWeight: 700 }}>Details</h3>
                                {[["Period", period || "—"], ["Date Submitted", fmtDate(new Date())], ["Days Worked", "" + data.lines.length], ["Hourly Rate", fmt(data.rate)]].map(([k, v]) => (
                                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 13, color: "#334155" }}>
                                    <span>{k}</span><strong style={{ color: DARK, whiteSpace: "nowrap" }}>{v}</strong>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: isLast ? 24 : 0 }}>
                            <thead><tr><th style={thBase}>Date</th><th style={thBase}>Tasks</th><th style={thR}>Hours</th><th style={thR}>Amount</th></tr></thead>
                            <tbody>
                              {rows.map((l, i) => {
                                const bb = i === rows.length - 1 ? "2px solid #e2e8f0" : "1px solid #f1f5f9";
                                const td = { padding: "14px 16px", fontSize: 13, color: "#334155", borderBottom: bb };
                                const tdR = { ...td, textAlign: "right", whiteSpace: "nowrap" };
                                return (<tr key={i}><td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(l.date)}</td><td style={{ ...td, maxWidth: 320 }}><TaskPills desc={l.description} /></td><td style={tdR}>{l.hours.toFixed(2)}</td><td style={{ ...tdR, fontWeight: 500 }}>{fmt(l.amount)}</td></tr>);
                              })}
                            </tbody>
                          </table>

                          {isLast && (
                            <>
                              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: bankDetails ? 24 : 0 }}>
                                <div style={{ width: 280 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13, color: "#64748b" }}>
                                    <span>Total Hours</span><span style={{ color: "#334155", whiteSpace: "nowrap" }}>{totalHours.toFixed(2)}</span>
                                  </div>
                                  <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 0 8px", fontSize: 20, fontWeight: 700, color: DARK, borderTop: "3px solid " + TEAL, marginTop: 8 }}>
                                    <span>Total Due</span><span style={{ whiteSpace: "nowrap" }}>{fmt(totalAmount)}</span>
                                  </div>
                                </div>
                              </div>

                              {bankDetails && (
                                <div style={{ padding: 20, background: "#f0fafb", borderRadius: 8, borderLeft: "3px solid " + TEAL }}>
                                  <h3 style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: TEAL, marginBottom: 10, fontWeight: 700 }}>Banking Details</h3>
                                  <p style={{ fontSize: 13, color: "#334155", whiteSpace: "pre-line", lineHeight: 1.7 }}>{bankDetails}</p>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        <div style={pageFooterStyle}>
                          <p style={{ fontSize: 11, color: "#94a3b8" }}>{name} · {period || "Timesheet"} · Page {pageNumber} of {totalPages}</p>
                        </div>
                      </div>
                    );
                  })}

                  {logChunks.map((rows, chunkIndex) => {
                    const isFirst = chunkIndex === 0;
                    const isLast = chunkIndex === logChunks.length - 1;
                    const pageNumber = summaryChunks.length + chunkIndex + 1;
                    return (
                      <div key={"log-" + chunkIndex} className={"print-page" + (isFirst ? " print-section-break" : "")} style={pageStyle}>
                        <div className="print-page-body" style={pageBodyStyle}>
                          {sectionHead(isFirst ? "Appendix: Time Log" : "Appendix: Time Log (continued)")}

                          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: isLast ? 24 : 0 }}>
                            <thead><tr><th style={thBase}>Date</th><th style={thBase}>Start Time</th><th style={thBase}>End Time</th><th style={thR}>Duration</th></tr></thead>
                            <tbody>
                              {rows.map((l, i) => {
                                const bb = i === rows.length - 1 ? "2px solid #e2e8f0" : "1px solid #f1f5f9";
                                const td = { padding: "14px 16px", fontSize: 13, color: "#334155", borderBottom: bb };
                                const tdR = { ...td, textAlign: "right", whiteSpace: "nowrap" };
                                return (<tr key={i}><td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(l.date)}</td><td style={td}>{fmtTime(l.startTime)}</td><td style={td}>{fmtTime(l.endTime)}</td><td style={tdR}>{l.hours.toFixed(2)}h</td></tr>);
                              })}
                            </tbody>
                          </table>

                          {isLast && (
                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                              <div style={{ width: 220 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 8px", fontSize: 16, fontWeight: 700, color: DARK, borderTop: "3px solid " + TEAL }}>
                                  <span>Total Hours</span><span>{totalHours.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div style={pageFooterStyle}>
                          <p style={{ fontSize: 11, color: "#94a3b8" }}>{name} · {period || "Timesheet"} · Page {pageNumber} of {totalPages}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(TimesheetGenerator));
  </script>
</body>
</html>`;
