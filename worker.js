// Cloudflare Worker — timesheet.thomaskabalin.com
// Deploy via: Cloudflare Dashboard → Workers & Pages → Create → "Create Worker"
// Or via Wrangler CLI: npx wrangler deploy

export default {
  async fetch(request) {
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
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #f1f5f9; color: #0f172a; }
    @media print {
      body { background: #fff; }
      .no-print { display: none !important; }
      .print-page { page-break-after: always; }
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
    const { useState, useRef, useCallback } = React;

    /* ── brand colours ─────────────────────────────────────── */
    const TEAL = "#00727d";
    const DARK = "#0f172a";

    /* ── helpers ────────────────────────────────────────────── */
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
      lines.sort((a, b) => {
        const da = parseDate(a.date), db = parseDate(b.date);
        return (da || 0) - (db || 0);
      });
      return { lines, rate: lines[0]?.rate || 0 };
    }

    /* ── PDF ────────────────────────────────────────────────── */
    const savePDF = (ref) => {
      const el = ref.current;
      if (!el) return;
      const html = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
        '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">' +
        '<style>*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}' +
        '@page{size:A4;margin:0}' +
        "body{margin:0;padding:0;font-family:'Inter',sans-serif;color:" + DARK + ";-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
        '.print-page{page-break-after:always;min-height:297mm}' +
        '</style>' +
        '<script>window.onafterprint=function(){window.close();};<\\/script>' +
        '</head><body>' + el.innerHTML + '</body></html>';
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (win) {
        setTimeout(() => { try { win.print(); } catch(e) {} }, 800);
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = "timesheet.html";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    };

    /* ── CSV parser ────────────────────────────────────────── */
    function parseClockifyCSV(text) {
      const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
      return data.map((r) => ({
        date: r["Start Date"] || "",
        description: r["Description"] || r["Task"] || "Development work",
        hours: parseFloat(r["Duration (decimal)"] || 0),
        duration: r["Duration (h)"] || "",
        rate: parseFloat((r["Billable Rate (R)"] || r["Billable Rate"] || "0").toString().replace(/[^0-9.]/g, "")),
        amount: parseFloat((r["Billable Amount (R)"] || r["Billable Amount"] || "0").toString().replace(/[^0-9.]/g, "")),
        user: r["User"] || "",
        email: r["Email"] || "",
        startTime: r["Start Time"] || "",
        endTime: r["End Time"] || "",
      })).filter((r) => r.hours > 0);
    }

    /* ══════════════════════════════════════════════════════════ */
    function TimesheetGenerator() {
      const [data, setData] = useState(null);
      const [name, setName] = useState("");
      const [email, setEmail] = useState("");
      const [company, setCompany] = useState("");
      const [period, setPeriod] = useState("");
      const [bankDetails, setBankDetails] = useState("");
      const [view, setView] = useState("upload");
      const sheetRef = useRef(null);

      const handleFile = useCallback((e) => {
        const file = e.target?.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const lines = parseClockifyCSV(ev.target.result);
          if (!lines.length) return;
          setData(buildData(lines));
          setName(lines[0].user);
          setEmail(lines[0].email);
          setPeriod(periodFromFilename(file.name));
          setView("edit");
        };
        reader.readAsText(file);
      }, []);

      const totalHours = data?.lines.reduce((s, l) => s + l.hours, 0) || 0;
      const totalAmount = data?.lines.reduce((s, l) => s + l.amount, 0) || 0;

      /* shared styles */
      const inputStyle = { width: "100%", padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontFamily: "'Inter', sans-serif", color: DARK, background: "#fff", outline: "none" };
      const labelStyle = { display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, color: "#64748b", marginBottom: 6 };
      const sectionStyle = { background: "#fff", borderRadius: 12, padding: 28, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" };
      const thBase = { fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: "#94a3b8", fontWeight: 700, padding: "12px 16px", textAlign: "left", borderBottom: "2px solid #e2e8f0" };
      const thR = { ...thBase, textAlign: "right" };

      /* ── UPLOAD ───────────────────────────────────────────── */
      if (view === "upload") {
        return (
          <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", background: "#f1f5f9" }}>
            <div style={{ textAlign: "center", maxWidth: 520, padding: 48 }}>
              <h1 style={{ fontSize: 30, fontWeight: 700, color: DARK, marginBottom: 8 }}>Timesheet Generator</h1>
              <p style={{ color: "#64748b", fontSize: 15, marginBottom: 40 }}>Import your Clockify CSV export to generate a timesheet</p>
              <label
                style={{ display: "block", border: "2px dashed #cbd5e1", borderRadius: 16, padding: "64px 40px", cursor: "pointer", background: "#fff", transition: "all 0.2s" }}
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

      /* ── EDIT ─────────────────────────────────────────────── */
      if (view === "edit") {
        return (
          <div style={{ minHeight: "100vh", fontFamily: "'Inter', sans-serif", background: "#f1f5f9", padding: "32px 24px" }}>
            <div style={{ maxWidth: 640, margin: "0 auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h1 style={{ fontSize: 26, fontWeight: 700, color: DARK }}>Timesheet</h1>
                  <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>{data.lines.length} entries, {totalHours.toFixed(1)} hours</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <label style={{ background: "#e2e8f0", color: "#334155", border: "none", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
                    Import Clockify CSV
                    <input type="file" accept=".csv" onChange={handleFile} style={{ display: "none" }} />
                  </label>
                  <button onClick={() => setView("preview")} style={{ background: TEAL, color: "#fff", border: "none", padding: "10px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
                    Preview →
                  </button>
                </div>
              </div>

              <div style={sectionStyle}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: DARK, marginBottom: 20 }}>Employee Details</h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div><label style={labelStyle}>Full Name</label><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} /></div>
                  <div><label style={labelStyle}>Email</label><input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                </div>
                <div style={{ marginTop: 16 }}><label style={labelStyle}>Banking Details</label><textarea style={{ ...inputStyle, minHeight: 72, resize: "vertical" }} value={bankDetails} onChange={(e) => setBankDetails(e.target.value)} placeholder={"Bank: FNB\\nAccount: 12345678\\nBranch: 250655"} /></div>
              </div>

              <div style={sectionStyle}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: DARK, marginBottom: 20 }}>Company & Period</h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div><label style={labelStyle}>Company Name</label><input style={inputStyle} value={company} onChange={(e) => setCompany(e.target.value)} /></div>
                  <div><label style={labelStyle}>Period</label><input style={inputStyle} value={period} onChange={(e) => setPeriod(e.target.value)} /></div>
                </div>
              </div>

              <div style={{ ...sectionStyle, background: "#f8fafc" }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: DARK, marginBottom: 16 }}>Time Entries</h2>
                <div style={{ fontSize: 13, color: "#64748b" }}>
                  {data.lines.map((l, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < data.lines.length - 1 ? "1px solid #e2e8f0" : "none", gap: 12, alignItems: "center" }}>
                      <span style={{ flexShrink: 0, width: 90 }}>{fmtDate(l.date)}</span>
                      <span style={{ flex: 1, minWidth: 0 }}><TaskPills desc={l.description} /></span>
                      <span style={{ flexShrink: 0, width: 50, textAlign: "right" }}>{l.hours.toFixed(2)}h</span>
                      <span style={{ flexShrink: 0, width: 100, textAlign: "right", color: DARK, fontWeight: 500, whiteSpace: "nowrap" }}>{fmt(l.amount)}</span>
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

      /* ── PREVIEW ─────────────────────────────────────────── */
      return (
        <div style={{ minHeight: "100vh", fontFamily: "'Inter', sans-serif", background: "#f1f5f9", padding: "32px 24px" }}>
          <div style={{ maxWidth: 820, margin: "0 auto" }}>
            <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <button onClick={() => setView("edit")} style={{ background: "#e2e8f0", color: "#334155", border: "none", padding: "10px 24px", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
                ← Edit
              </button>
              <button onClick={() => savePDF(sheetRef)} style={{ background: TEAL, color: "#fff", border: "none", padding: "10px 28px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
                Save as PDF ↓
              </button>
            </div>

            <div ref={sheetRef} style={{ background: "#fff", borderRadius: 4, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
              {/* PAGE 1 */}
              <div className="print-page" style={{ width: "100%", minHeight: 1122, padding: "40px 48px", position: "relative", fontFamily: "'Inter', sans-serif", color: DARK }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40, paddingBottom: 24, borderBottom: "3px solid " + TEAL }}>
                  <div>
                    <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5, color: DARK, margin: 0 }}>{name || "Employee Name"}</h1>
                    <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{email}</p>
                  </div>
                  <div style={{ background: TEAL, color: "#fff", padding: "12px 28px", fontSize: 20, fontWeight: 700, letterSpacing: 2 }}>TIMESHEET</div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 36 }}>
                  <div>
                    <h3 style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: "#94a3b8", marginBottom: 8, fontWeight: 700 }}>Company</h3>
                    <p style={{ fontSize: 13, lineHeight: 1.7, color: "#334155" }}>
                      <strong style={{ color: DARK, fontWeight: 600 }}>{company || "Company Name"}</strong>
                    </p>
                  </div>
                  <div>
                    <h3 style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: "#94a3b8", marginBottom: 8, fontWeight: 700 }}>Details</h3>
                    {[
                      ["Period", period || "—"],
                      ["Date Submitted", fmtDate(new Date())],
                      ["Days Worked", "" + data.lines.length],
                      ["Hourly Rate", fmt(data.rate)],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 13, color: "#334155" }}>
                        <span>{k}</span><strong style={{ color: DARK, whiteSpace: "nowrap" }}>{v}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
                  <thead>
                    <tr>
                      <th style={thBase}>Date</th>
                      <th style={thBase}>Tasks</th>
                      <th style={thR}>Hours</th>
                      <th style={thR}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lines.map((l, i) => {
                      const bb = i === data.lines.length - 1 ? "2px solid #e2e8f0" : "1px solid #f1f5f9";
                      const td = { padding: "14px 16px", fontSize: 13, color: "#334155", borderBottom: bb };
                      const tdR = { ...td, textAlign: "right", whiteSpace: "nowrap" };
                      return (
                        <tr key={i}>
                          <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(l.date)}</td>
                          <td style={{ ...td, maxWidth: 320 }}><TaskPills desc={l.description} /></td>
                          <td style={tdR}>{l.hours.toFixed(2)}</td>
                          <td style={{ ...tdR, fontWeight: 500 }}>{fmt(l.amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 48 }}>
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
                  <div style={{ marginBottom: 32, padding: 20, background: "#f0fafb", borderRadius: 8, borderLeft: "3px solid " + TEAL }}>
                    <h3 style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: TEAL, marginBottom: 10, fontWeight: 700 }}>Banking Details</h3>
                    <p style={{ fontSize: 13, color: "#334155", whiteSpace: "pre-line", lineHeight: 1.7 }}>{bankDetails}</p>
                  </div>
                )}

                <div style={{ position: "absolute", bottom: 40, left: 48, right: 48, display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingTop: 20, borderTop: "1px solid #e2e8f0" }}>
                  <p style={{ fontSize: 11, color: "#94a3b8" }}>{name} · {period || "Timesheet"}</p>
                  <p style={{ fontSize: 11, color: "#94a3b8" }}>Page 1 of 2</p>
                </div>
              </div>

              {/* PAGE 2: TIME LOG */}
              <div className="print-page" style={{ width: "100%", minHeight: 1122, padding: "40px 48px", position: "relative", fontFamily: "'Inter', sans-serif", color: DARK, borderTop: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, paddingBottom: 20, borderBottom: "2px solid " + TEAL }}>
                  <div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: DARK, margin: 0 }}>{name || "Employee Name"}</h2>
                    <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Appendix: Time Log</p>
                  </div>
                  <div style={{ background: TEAL, color: "#fff", padding: "8px 20px", fontSize: 14, fontWeight: 700, letterSpacing: 2 }}>TIMESHEET</div>
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
                  <thead>
                    <tr>
                      <th style={thBase}>Date</th>
                      <th style={thBase}>Start Time</th>
                      <th style={thBase}>End Time</th>
                      <th style={thR}>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lines.map((l, i) => {
                      const bb = i === data.lines.length - 1 ? "2px solid #e2e8f0" : "1px solid #f1f5f9";
                      const td = { padding: "14px 16px", fontSize: 13, color: "#334155", borderBottom: bb };
                      const tdR = { ...td, textAlign: "right", whiteSpace: "nowrap" };
                      return (
                        <tr key={i}>
                          <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(l.date)}</td>
                          <td style={td}>{fmtTime(l.startTime)}</td>
                          <td style={td}>{fmtTime(l.endTime)}</td>
                          <td style={tdR}>{l.hours.toFixed(2)}h</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ width: 220 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 8px", fontSize: 16, fontWeight: 700, color: DARK, borderTop: "3px solid " + TEAL }}>
                      <span>Total Hours</span><span>{totalHours.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div style={{ position: "absolute", bottom: 40, left: 48, right: 48, display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingTop: 20, borderTop: "1px solid #e2e8f0" }}>
                  <p style={{ fontSize: 11, color: "#94a3b8" }}>{name} · {period || "Timesheet"}</p>
                  <p style={{ fontSize: 11, color: "#94a3b8" }}>Page 2 of 2</p>
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
