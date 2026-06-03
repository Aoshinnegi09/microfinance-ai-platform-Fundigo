import { useMemo, useState } from "react"
import "./App.css"
import VoiceAssistant from "./VoiceAssistant"

const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"
const PAYMENT_BASE = import.meta.env.VITE_PAYMENT_URL || "http://localhost:5002"
const initialLoanForm = { loan_amount:"", purpose:"", monthly_income:"", monthly_expense:"", existing_debt:"", repayment_history:"0.7", requested_amount:"" }
const NAV_ITEMS = [
  { id:"dashboard", label:"Dashboard", icon:"⬡" },
  { id:"voice", label:"Voice Loan", icon:"◉" },
  { id:"loan", label:"Apply Loan", icon:"◈" },
  { id:"kyc", label:"KYC & Docs", icon:"◎" },
  { id:"emi", label:"EMI Planner", icon:"⊞" },
]

const LOGO_URL = "https://i.imgur.com/placeholder.png"

function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "")
  const [authMode, setAuthMode] = useState("login")
  const [authForm, setAuthForm] = useState({ email:"", phone:"", password:"", name:"" })
  const [loanForm, setLoanForm] = useState(initialLoanForm)
  const [loanStatus, setLoanStatus] = useState(null)
  const [kyc, setKyc] = useState({ gov_id:"", address:"" })
  const [doc, setDoc] = useState(null)
  const [emiInput, setEmiInput] = useState({ principal:50000, annual_interest_rate:14, tenure_months:12 })
  const [emiData, setEmiData] = useState(null)
  const [message, setMessage] = useState("")
  const [msgType, setMsgType] = useState("info")
  const [activeTab, setActiveTab] = useState("dashboard")
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const headers = useMemo(() => ({ Authorization:"Bearer " + token }), [token])

  const notify = (msg, type="info") => { setMessage(msg); setMsgType(type); setTimeout(() => setMessage(""), 4000) }

  const onAuth = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      const endpoint = authMode === "register" ? "/api/v1/auth/register" : "/api/v1/auth/login"
      const body = authMode === "register" ? authForm : { email:authForm.email, password:authForm.password }
      const res = await fetch(API_BASE + endpoint, { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) return notify(data.error || "Authentication failed", "error")
      setToken(data.token); localStorage.setItem("token", data.token); notify("Welcome to Fundigo!", "success")
    } finally { setLoading(false) }
  }

  const onApplyLoan = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      const features = { monthly_income:Number(loanForm.monthly_income), monthly_expense:Number(loanForm.monthly_expense), existing_debt:Number(loanForm.existing_debt), repayment_history:Number(loanForm.repayment_history), requested_amount:Number(loanForm.requested_amount || loanForm.loan_amount) }
      const res = await fetch(API_BASE + "/api/v1/loans/apply", { method:"POST", headers:{ ...headers, "Content-Type":"application/json" }, body:JSON.stringify({ loan_amount:Number(loanForm.loan_amount), purpose:loanForm.purpose, features }) })
      const data = await res.json()
      if (!res.ok) return notify(data.error || "Loan application failed", "error")
      const loanResp = await fetch(API_BASE + "/api/v1/loans/" + data.loan_id, { headers })
      const loanDetail = await loanResp.json()
      setLoanStatus({ ...data, ...loanDetail }); notify("Application submitted!", "success")
    } finally { setLoading(false) }
  }

  const onSubmitKyc = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      const res = await fetch(API_BASE + "/api/v1/kyc/submit", { method:"POST", headers:{ ...headers, "Content-Type":"application/json" }, body:JSON.stringify(kyc) })
      const data = await res.json()
      res.ok ? notify("KYC: " + data.status, "success") : notify(data.error, "error")
    } finally { setLoading(false) }
  }

  const onUploadDoc = async (e) => {
    e.preventDefault()
    if (!doc) return notify("Select a document first", "error")
    setLoading(true)
    try {
      const formData = new FormData(); formData.append("doc_type", "identity"); formData.append("file", doc)
      const res = await fetch(API_BASE + "/api/v1/documents/upload", { method:"POST", headers, body:formData })
      const data = await res.json()
      res.ok ? notify("Document #" + data.document_id + " uploaded", "success") : notify(data.error, "error")
    } finally { setLoading(false) }
  }

  const onCalculateEmi = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      const res = await fetch(PAYMENT_BASE + "/api/v1/emi/schedule", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(emiInput) })
      const data = await res.json()
      if (!res.ok) return notify(data.error, "error")
      setEmiData(data)
    } finally { setLoading(false) }
  }

  const onLogout = () => { setToken(""); localStorage.removeItem("token"); setLoanStatus(null); setEmiData(null) }

  const handleVoiceLoan = (suggestion) => {
    setLoanForm(f => ({ ...f, loan_amount:suggestion.loan_amount, purpose:suggestion.purpose, monthly_income:suggestion.monthly_income, requested_amount:suggestion.loan_amount }))
    setActiveTab("loan"); notify("Loan details pre-filled from your voice request!", "success")
  }

  if (!token) return (
    <div className="auth-root">
      <div className="auth-left">
        <div className="auth-brand">
          <div style={{width:52,height:52,borderRadius:'50%',background:'rgba(196,120,138,0.15)',border:'1px solid rgba(196,120,138,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>F</div>
          <span className="brand-name">Fundigo</span>
        </div>
        <div className="auth-hero">
          <p className="auth-hero-tag">Microfinance for everyone</p>
          <h1>Banking that speaks <em>your language</em></h1>
          <p>Fundigo brings AI-powered microloans to villages and cities alike. Apply by voice in Hindi, Telugu, Tamil or English — get a decision in seconds.</p>
          <div className="auth-features">
            <div className="af-item"><span className="af-dot"/><span className="af-text"><strong>Voice-to-Loan</strong> — speak your need, get instant approval</span></div>
            <div className="af-item"><span className="af-dot"/><span className="af-text"><strong>4 languages</strong> — Hindi, Telugu, Tamil, English</span></div>
            <div className="af-item"><span className="af-dot"/><span className="af-text"><strong>For everyone</strong> — farmers, shopkeepers, city workers</span></div>
            <div className="af-item"><span className="af-dot"/><span className="af-text"><strong>2-second decision</strong> — AI credit scoring, no paperwork</span></div>
          </div>
        </div>
        <div className="auth-stats">
          <div className="stat"><span className="stat-num">2.4s</span><span className="stat-label">Avg. decision</span></div>
          <div className="stat"><span className="stat-num">4</span><span className="stat-label">Languages</span></div>
          <div className="stat"><span className="stat-num">98%</span><span className="stat-label">Accuracy</span></div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-card">
          <div className="auth-card-header">
            <h2>{authMode === "login" ? "Welcome back" : "Join Fundigo"}</h2>
            <p>{authMode === "login" ? "Sign in to your account to continue" : "Create your free account today"}</p>
          </div>
          <div className="auth-tabs">
            <button className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>Sign In</button>
            <button className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>Register</button>
          </div>
          {message && <div className={"toast toast-" + msgType}>{message}</div>}
          <form onSubmit={onAuth} className="auth-form">
            {authMode === "register" && <div className="field"><label>Full Name</label><input placeholder="Rahul Sharma" required value={authForm.name} onChange={e => setAuthForm({ ...authForm, name:e.target.value })}/></div>}
            <div className="field"><label>Email</label><input type="email" placeholder="you@example.com" required value={authForm.email} onChange={e => setAuthForm({ ...authForm, email:e.target.value })}/></div>
            {authMode === "register" && <div className="field"><label>Phone</label><input placeholder="+91 98765 43210" required value={authForm.phone} onChange={e => setAuthForm({ ...authForm, phone:e.target.value })}/></div>}
            <div className="field"><label>Password</label><input type="password" placeholder="••••••••" required value={authForm.password} onChange={e => setAuthForm({ ...authForm, password:e.target.value })}/></div>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? <span className="spinner"/> : authMode === "login" ? "Sign In to Fundigo" : "Create Account"}</button>
          </form>
          {authMode === "login" && <p className="auth-divider" style={{marginTop:16}}>New here? <span style={{color:'#c4788a',cursor:'pointer',fontWeight:600}} onClick={() => setAuthMode("register")}>Create an account</span></p>}
        </div>
      </div>
    </div>
  )

  return (
    <div className="app-root">
      <aside className={"sidebar" + (sidebarOpen ? " open" : "")}>
        <div className="sidebar-brand">
          <div style={{width:38,height:38,borderRadius:'50%',background:'rgba(196,120,138,0.15)',border:'1px solid rgba(196,120,138,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,color:'#e8a0b0'}}>F</div>
          <span className="sidebar-name">Fundigo</span>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button key={item.id} className={"nav-item" + (activeTab === item.id ? " active" : "")} onClick={() => { setActiveTab(item.id); setSidebarOpen(false) }}>
              <span className="nav-icon">{item.icon}</span><span>{item.label}</span>
              {item.id === "voice" && <span className="nav-badge">NEW</span>}
            </button>
          ))}
        </nav>
        <button className="nav-item logout" onClick={onLogout}><span className="nav-icon">⊗</span><span>Sign Out</span></button>
      </aside>

      <main className="main-content">
        <div className="topbar"><button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button><span className="topbar-title">{NAV_ITEMS.find(n => n.id === activeTab)?.label}</span></div>
        {message && <div className={"toast toast-" + msgType + " toast-float"}>{message}</div>}

        {activeTab === "dashboard" && (
          <div className="page">
            <div className="page-header"><h1>Good morning</h1><p>Here is your financial overview for today.</p></div>
            <div className="kpi-grid">
              <div className="kpi-card"><span className="kpi-label">Active Loans</span><span className="kpi-value">{loanStatus ? "1" : "0"}</span><span className="kpi-sub">applications</span></div>
              <div className="kpi-card"><span className="kpi-label">Loan Status</span><span className="kpi-value kpi-status">{loanStatus?.status || "—"}</span><span className="kpi-sub">{loanStatus ? "ID #" + (loanStatus.id || loanStatus.loan_id) : "No active loan"}</span></div>
              <div className="kpi-card"><span className="kpi-label">Credit Score</span><span className="kpi-value">{loanStatus?.credit_score || "—"}</span><span className="kpi-sub">AI-assessed</span></div>
              <div className="kpi-card"><span className="kpi-label">Interest Rate</span><span className="kpi-value">{loanStatus?.interest_rate ? loanStatus.interest_rate + "%" : "—"}</span><span className="kpi-sub">per annum</span></div>
            </div>
            <div className="voice-cta" onClick={() => setActiveTab("voice")}>
              <div className="vcta-left"><span className="vcta-icon">🎙</span><div><p className="vcta-title">Try Voice Loan</p><p className="vcta-desc">Speak your need in Hindi, Telugu, Tamil or English — get an instant loan plan</p></div></div>
              <span className="vcta-arrow">→</span>
            </div>
            <div className="quick-actions"><h2>Quick Actions</h2>
              <div className="qa-grid">
                <button className="qa-card" onClick={() => setActiveTab("voice")}><span className="qa-icon">◉</span><span className="qa-title">Voice Loan</span><span className="qa-desc">Speak your business need in your language</span></button>
                <button className="qa-card" onClick={() => setActiveTab("loan")}><span className="qa-icon">◈</span><span className="qa-title">Apply Loan</span><span className="qa-desc">Fill the loan application form</span></button>
                <button className="qa-card" onClick={() => setActiveTab("kyc")}><span className="qa-icon">◎</span><span className="qa-title">Complete KYC</span><span className="qa-desc">Verify identity to unlock higher limits</span></button>
                <button className="qa-card" onClick={() => setActiveTab("emi")}><span className="qa-icon">⊞</span><span className="qa-title">EMI Planner</span><span className="qa-desc">Plan and calculate repayments</span></button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "voice" && (
          <div className="page">
            <div className="page-header"><h1>Voice Loan</h1><p>Describe your need in your language. Our AI handles everything else.</p></div>
            <VoiceAssistant token={token} onLoanSuggestion={handleVoiceLoan}/>
          </div>
        )}

        {activeTab === "loan" && (
          <div className="page">
            <div className="page-header"><h1>Loan Application</h1><p>AI-powered credit decision in seconds.</p></div>
            <div className="form-card">
              <form onSubmit={onApplyLoan}>
                <div className="form-section-title">Loan Details</div>
                <div className="form-grid">
                  <div className="field"><label>Loan Amount (Rs.)</label><input type="number" placeholder="50000" required value={loanForm.loan_amount} onChange={e => setLoanForm({ ...loanForm, loan_amount:e.target.value, requested_amount:e.target.value })}/></div>
                  <div className="field"><label>Purpose</label><input placeholder="Business, medical, education..." required value={loanForm.purpose} onChange={e => setLoanForm({ ...loanForm, purpose:e.target.value })}/></div>
                </div>
                <div className="form-section-title">Financial Profile</div>
                <div className="form-grid">
                  <div className="field"><label>Monthly Income (Rs.)</label><input type="number" placeholder="30000" required value={loanForm.monthly_income} onChange={e => setLoanForm({ ...loanForm, monthly_income:e.target.value })}/></div>
                  <div className="field"><label>Monthly Expenses (Rs.)</label><input type="number" placeholder="15000" required value={loanForm.monthly_expense} onChange={e => setLoanForm({ ...loanForm, monthly_expense:e.target.value })}/></div>
                  <div className="field"><label>Existing Debt (Rs.)</label><input type="number" placeholder="0" required value={loanForm.existing_debt} onChange={e => setLoanForm({ ...loanForm, existing_debt:e.target.value })}/></div>
                  <div className="field"><label>Repayment History (0-1)</label><input type="number" step="0.01" min="0" max="1" required value={loanForm.repayment_history} onChange={e => setLoanForm({ ...loanForm, repayment_history:e.target.value })}/></div>
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>{loading ? <span className="spinner"/> : "Submit Application"}</button>
              </form>
            </div>
            {loanStatus && (
              <div className="result-card">
                <div className="result-header"><span className="result-title">Application Result</span><span className={"badge badge-" + loanStatus.status?.toLowerCase()}>{loanStatus.status}</span></div>
                <div className="result-grid">
                  <div><span className="result-label">Loan ID</span><span className="result-val">#{loanStatus.id || loanStatus.loan_id}</span></div>
                  <div><span className="result-label">Credit Score</span><span className="result-val">{loanStatus.credit_score}</span></div>
                  <div><span className="result-label">Interest Rate</span><span className="result-val">{loanStatus.interest_rate}%</span></div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "kyc" && (
          <div className="page">
            <div className="page-header"><h1>KYC & Documents</h1><p>Verify your identity to unlock higher loan limits.</p></div>
            <div className="two-col-layout">
              <div className="form-card">
                <div className="form-section-title">Identity Verification</div>
                <form onSubmit={onSubmitKyc}>
                  <div className="field" style={{marginBottom:14}}><label>Government ID</label><input placeholder="Aadhaar / PAN / Passport" value={kyc.gov_id} onChange={e => setKyc({ ...kyc, gov_id:e.target.value })} required/></div>
                  <div className="field" style={{marginBottom:20}}><label>Address</label><input placeholder="123, MG Road, Bengaluru" value={kyc.address} onChange={e => setKyc({ ...kyc, address:e.target.value })} required/></div>
                  <button type="submit" className="btn-primary" disabled={loading}>{loading ? <span className="spinner"/> : "Submit KYC"}</button>
                </form>
              </div>
              <div className="form-card">
                <div className="form-section-title">Upload Document</div>
                <form onSubmit={onUploadDoc}>
                  <div className="upload-zone" onClick={() => document.getElementById("file-input").click()}>
                    <span className="upload-icon">⬆</span>
                    <span className="upload-text">{doc ? doc.name : "Click to choose a file"}</span>
                    <span className="upload-hint">PDF, JPG, PNG up to 10MB</span>
                    <input id="file-input" type="file" style={{ display:"none" }} onChange={e => setDoc(e.target.files?.[0] || null)}/>
                  </div>
                  <button type="submit" className="btn-primary" disabled={loading}>{loading ? <span className="spinner"/> : "Upload Document"}</button>
                </form>
              </div>
            </div>
          </div>
        )}

        {activeTab === "emi" && (
          <div className="page">
            <div className="page-header"><h1>EMI Planner</h1><p>Plan your repayments before you apply.</p></div>
            <div className="form-card">
              <form onSubmit={onCalculateEmi}>
                <div className="form-grid">
                  <div className="field"><label>Principal (Rs.)</label><input type="number" value={emiInput.principal} onChange={e => setEmiInput({ ...emiInput, principal:Number(e.target.value) })}/></div>
                  <div className="field"><label>Annual Interest (%)</label><input type="number" value={emiInput.annual_interest_rate} onChange={e => setEmiInput({ ...emiInput, annual_interest_rate:Number(e.target.value) })}/></div>
                  <div className="field"><label>Tenure (Months)</label><input type="number" value={emiInput.tenure_months} onChange={e => setEmiInput({ ...emiInput, tenure_months:Number(e.target.value) })}/></div>
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>{loading ? <span className="spinner"/> : "Calculate EMI"}</button>
              </form>
            </div>
            {emiData && (
              <div className="result-card">
                <div className="emi-summary"><span className="result-label">Monthly EMI</span><div className="emi-big">Rs.{Number(emiData.emi).toLocaleString("en-IN")}</div></div>
                <div className="table-wrap">
                  <table className="emi-table">
                    <thead><tr><th>#</th><th>Due Date</th><th>EMI (Rs.)</th><th>Principal</th><th>Interest</th></tr></thead>
                    <tbody>
                      {emiData.schedule.slice(0,12).map(item => (
                        <tr key={item.installment}>
                          <td>{item.installment}</td><td>{item.due_date}</td>
                          <td>{Number(item.emi).toLocaleString("en-IN")}</td>
                          <td>{Number(item.principal_component).toLocaleString("en-IN")}</td>
                          <td>{Number(item.interest_component).toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
