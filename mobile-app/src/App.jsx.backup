import { useMemo, useState } from 'react'
import './App.css'

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'
const PAYMENT_BASE = import.meta.env.VITE_PAYMENT_URL || 'http://localhost:5002'

const initialLoanForm = {
  loan_amount: '',
  purpose: '',
  monthly_income: '',
  monthly_expense: '',
  existing_debt: '',
  repayment_history: '0.7',
  requested_amount: '',
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '')
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ email: '', phone: '', password: '', name: '' })
  const [loanForm, setLoanForm] = useState(initialLoanForm)
  const [loanStatus, setLoanStatus] = useState(null)
  const [kyc, setKyc] = useState({ gov_id: '', address: '' })
  const [doc, setDoc] = useState(null)
  const [emiInput, setEmiInput] = useState({ principal: 50000, annual_interest_rate: 14, tenure_months: 12 })
  const [emiData, setEmiData] = useState(null)
  const [message, setMessage] = useState('')

  const headers = useMemo(() => ({ Authorization: 'Bearer ' + token }), [token])

  const onAuth = async (e) => {
    e.preventDefault()
    const endpoint = authMode === 'register' ? '/api/v1/auth/register' : '/api/v1/auth/login'
    const body = authMode === 'register' ? authForm : { email: authForm.email, password: authForm.password }
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) return setMessage(data.error || 'Auth failed')
    const nextToken = data.token
    setToken(nextToken)
    localStorage.setItem('token', nextToken)
    setMessage('Authentication successful')
  }

  const onApplyLoan = async (e) => {
    e.preventDefault()
    const features = {
      monthly_income: Number(loanForm.monthly_income),
      monthly_expense: Number(loanForm.monthly_expense),
      existing_debt: Number(loanForm.existing_debt),
      repayment_history: Number(loanForm.repayment_history),
      requested_amount: Number(loanForm.requested_amount || loanForm.loan_amount),
    }
    const res = await fetch(`${API_BASE}/api/v1/loans/apply`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ loan_amount: Number(loanForm.loan_amount), purpose: loanForm.purpose, features }),
    })
    const data = await res.json()
    if (!res.ok) return setMessage(data.error || 'Loan application failed')
    const loanResp = await fetch(`${API_BASE}/api/v1/loans/${data.loan_id}`, { headers })
    const loanDetail = await loanResp.json()
    setLoanStatus({ ...data, ...loanDetail })
    setMessage('Loan application submitted')
  }

  const onSubmitKyc = async (e) => {
    e.preventDefault()
    const res = await fetch(`${API_BASE}/api/v1/kyc/submit`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(kyc),
    })
    const data = await res.json()
    setMessage(res.ok ? `KYC status: ${data.status}` : data.error)
  }

  const onUploadDoc = async (e) => {
    e.preventDefault()
    if (!doc) return setMessage('Select a document first')
    const formData = new FormData()
    formData.append('doc_type', 'identity')
    formData.append('file', doc)
    const res = await fetch(`${API_BASE}/api/v1/documents/upload`, {
      method: 'POST',
      headers,
      body: formData,
    })
    const data = await res.json()
    setMessage(res.ok ? `Uploaded document #${data.document_id}` : data.error)
  }

  const onCalculateEmi = async (e) => {
    e.preventDefault()
    const res = await fetch(`${PAYMENT_BASE}/api/v1/emi/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emiInput),
    })
    const data = await res.json()
    if (!res.ok) return setMessage(data.error)
    setEmiData(data)
  }

  const onLogout = () => {
    setToken('')
    localStorage.removeItem('token')
    setLoanStatus(null)
  }

  return (
    <main className="container">
      <h1>AI Microfinance Platform</h1>
      <p className="hint">Instant micro-loans with AI-powered underwriting.</p>
      {message ? <div className="message">{message}</div> : null}

      <section className="card">
        <h2>{authMode === 'register' ? 'Register' : 'Login'}</h2>
        <form onSubmit={onAuth} className="grid">
          <input placeholder="Email" required value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} />
          {authMode === 'register' ? (
            <>
              <input placeholder="Phone" required value={authForm.phone} onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })} />
              <input placeholder="Name" required value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} />
            </>
          ) : null}
          <input placeholder="Password" type="password" required value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} />
          <button type="submit">{authMode === 'register' ? 'Create Account' : 'Sign In'}</button>
        </form>
        <button className="text" onClick={() => setAuthMode(authMode === 'register' ? 'login' : 'register')}>
          Switch to {authMode === 'register' ? 'login' : 'register'}
        </button>
        {token ? <button onClick={onLogout}>Logout</button> : null}
      </section>

      <section className="card">
        <h2>Loan Application</h2>
        <form onSubmit={onApplyLoan} className="grid two-col">
          <input placeholder="Loan Amount" type="number" required value={loanForm.loan_amount} onChange={(e) => setLoanForm({ ...loanForm, loan_amount: e.target.value, requested_amount: e.target.value })} />
          <input placeholder="Purpose" required value={loanForm.purpose} onChange={(e) => setLoanForm({ ...loanForm, purpose: e.target.value })} />
          <input placeholder="Monthly Income" type="number" required value={loanForm.monthly_income} onChange={(e) => setLoanForm({ ...loanForm, monthly_income: e.target.value })} />
          <input placeholder="Monthly Expense" type="number" required value={loanForm.monthly_expense} onChange={(e) => setLoanForm({ ...loanForm, monthly_expense: e.target.value })} />
          <input placeholder="Existing Debt" type="number" required value={loanForm.existing_debt} onChange={(e) => setLoanForm({ ...loanForm, existing_debt: e.target.value })} />
          <input placeholder="Repayment History (0-1)" type="number" step="0.01" min="0" max="1" required value={loanForm.repayment_history} onChange={(e) => setLoanForm({ ...loanForm, repayment_history: e.target.value })} />
          <button type="submit">Apply</button>
        </form>
        {loanStatus ? (
          <div className="status">
            <h3>Approval Status Tracker</h3>
            <p>Loan #{loanStatus.id || loanStatus.loan_id} · {loanStatus.status}</p>
            <p>Credit Score: {loanStatus.credit_score}</p>
            <p>Interest Rate: {loanStatus.interest_rate}%</p>
          </div>
        ) : null}
      </section>

      <section className="card split">
        <div>
          <h2>KYC</h2>
          <form onSubmit={onSubmitKyc} className="grid">
            <input placeholder="Government ID" value={kyc.gov_id} onChange={(e) => setKyc({ ...kyc, gov_id: e.target.value })} required />
            <input placeholder="Address" value={kyc.address} onChange={(e) => setKyc({ ...kyc, address: e.target.value })} required />
            <button type="submit">Submit KYC</button>
          </form>
        </div>
        <div>
          <h2>Document Upload</h2>
          <form onSubmit={onUploadDoc} className="grid">
            <input type="file" onChange={(e) => setDoc(e.target.files?.[0] || null)} required />
            <button type="submit">Upload Document</button>
          </form>
        </div>
      </section>

      <section className="card">
        <h2>EMI Calculator & Repayment Schedule</h2>
        <form onSubmit={onCalculateEmi} className="grid three-col">
          <input type="number" placeholder="Principal" value={emiInput.principal} onChange={(e) => setEmiInput({ ...emiInput, principal: Number(e.target.value) })} />
          <input type="number" placeholder="Annual Interest %" value={emiInput.annual_interest_rate} onChange={(e) => setEmiInput({ ...emiInput, annual_interest_rate: Number(e.target.value) })} />
          <input type="number" placeholder="Tenure (Months)" value={emiInput.tenure_months} onChange={(e) => setEmiInput({ ...emiInput, tenure_months: Number(e.target.value) })} />
          <button type="submit">Calculate EMI</button>
        </form>
        {emiData ? (
          <>
            <p>Monthly EMI: ₹{emiData.emi}</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Due Date</th>
                    <th>EMI</th>
                    <th>Principal</th>
                    <th>Interest</th>
                  </tr>
                </thead>
                <tbody>
                  {emiData.schedule.slice(0, 6).map((item) => (
                    <tr key={item.installment}>
                      <td>{item.installment}</td>
                      <td>{item.due_date}</td>
                      <td>{item.emi}</td>
                      <td>{item.principal_component}</td>
                      <td>{item.interest_component}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>
    </main>
  )
}

export default App
