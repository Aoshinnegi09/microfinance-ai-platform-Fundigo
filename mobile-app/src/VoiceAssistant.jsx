import { useState, useRef, useEffect } from "react"
import "./VoiceAssistant.css"

const LANGUAGES = [
  { code: "en-IN", label: "English", native: "English" },
  { code: "hi-IN", label: "Hindi", native: "Hindi" },
  { code: "te-IN", label: "Telugu", native: "Telugu" },
  { code: "ta-IN", label: "Tamil", native: "Tamil" },
]

const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"

export default function VoiceAssistant({ token, onLoanSuggestion }) {
  const [phase, setPhase] = useState("idle")
  const [transcript, setTranscript] = useState("")
  const [result, setResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState("")
  const [lang, setLang] = useState("en-IN")
  const [isSpeaking, setIsSpeaking] = useState(false)
  const recognitionRef = useRef(null)
  const finalRef = useRef("")

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      window.speechSynthesis?.cancel()
    }
  }, [])

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setErrorMsg("Your browser does not support voice input. Please use Chrome."); setPhase("error"); return }
    const recognition = new SR()
    recognition.lang = lang
    recognition.continuous = false
    recognition.interimResults = true
    finalRef.current = ""
    recognition.onstart = () => { setPhase("listening"); setTranscript("") }
    recognition.onresult = (e) => {
      const t = Array.from(e.results).map(r => r[0].transcript).join("")
      setTranscript(t)
      if (e.results[e.results.length - 1].isFinal) finalRef.current = t
    }
    recognition.onend = () => {
      const text = finalRef.current || transcript
      if (text.trim()) processWithAI(text)
      else setPhase("idle")
    }
    recognition.onerror = (e) => { setErrorMsg("Voice error: " + e.error + ". Please try again."); setPhase("error") }
    recognitionRef.current = recognition
    recognition.start()
  }

  const stopListening = () => recognitionRef.current?.stop()

  const processWithAI = async (text) => {
    setPhase("processing")
    try {
      const response = await fetch(API_BASE + "/api/v1/voice/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token,
        },
        body: JSON.stringify({ text }),
      })
      const parsed = await response.json()
      if (!response.ok) throw new Error(parsed.error || "Backend error")
      setResult(parsed)
      setPhase("result")
      speakResult(parsed)
    } catch (err) {
      setErrorMsg("AI analysis failed: " + err.message)
      setPhase("error")
    }
  }

  const speakResult = (data) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(data.response_message)
    const langMap = { English: "en-IN", Hindi: "hi-IN", Telugu: "te-IN", Tamil: "ta-IN" }
    utterance.lang = langMap[data.language_detected] || "en-IN"
    utterance.rate = 0.9
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }

  const applyLoan = () => {
    if (onLoanSuggestion && result) {
      onLoanSuggestion({ loan_amount: result.suggested_loan_amount, purpose: result.business_type, monthly_income: result.estimated_monthly_income })
    }
  }

  const tryExample = (text) => processWithAI(text)

  const reset = () => { window.speechSynthesis?.cancel(); setPhase("idle"); setTranscript(""); setResult(null); setErrorMsg(""); setIsSpeaking(false) }

  const riskColor = { low: "#22c55e", medium: "#f59e0b", high: "#ef4444" }

  return (
    <div className="va-root">
      <div className="va-header">
        <div className="va-title-row">
          <span className="va-icon-glyph">?</span>
          <div><h2 className="va-title">Voice Banking</h2><p className="va-subtitle">Speak your need — we handle the rest</p></div>
        </div>
        <div className="va-lang-pills">
          {LANGUAGES.map(l => (
            <button key={l.code} className={"lang-pill" + (lang === l.code ? " active" : "")} onClick={() => setLang(l.code)}>{l.native}</button>
          ))}
        </div>
      </div>

      {phase === "idle" && (
        <div className="va-idle">
          <div className="va-orb-wrap" onClick={startListening}>
            <div className="va-orb"><span className="va-mic-icon">??</span></div>
            <span className="va-tap-label">Tap to speak</span>
          </div>
          <div className="va-examples">
            <p className="va-examples-title">Try an example:</p>
            <div className="va-example-chips">
              <span onClick={() => tryExample("I run a vegetable shop and need 15000 rupees to buy inventory before the festival season.")}>"I run a vegetable shop and need ?15,000 for festival stock"</span>
              <span onClick={() => tryExample("???? ?? ???? ????? ?? ????? ?? ?? ???? ???? ?????? ?? ??? 20000 ????? ?????")}>"???? ????? ????? ?? ??? ?20,000 ?????"</span>
              <span onClick={() => tryExample("???? ????? ?? ?????? ????, ????? ???????? ????????? 10000 ??????? ?????")}>"?? ?? ???? ???? ?10,000 ??????"</span>
            </div>
          </div>
        </div>
      )}

      {phase === "listening" && (
        <div className="va-listening">
          <div className="va-wave-container">
            <div className="va-wave-rings"><div className="ring ring1"/><div className="ring ring2"/><div className="ring ring3"/></div>
            <div className="va-orb listening" onClick={stopListening}><span className="va-mic-icon">??</span></div>
          </div>
          <p className="va-listening-label">Listening… tap to stop</p>
          {transcript && <div className="va-live-transcript">{transcript}</div>}
        </div>
      )}

      {phase === "processing" && (
        <div className="va-processing">
          <div className="va-process-orb"><div className="process-spin"/><span style={{fontSize:"28px"}}>?</span></div>
          {transcript && <div className="va-live-transcript">"{transcript}"</div>}
          <div className="va-steps">
            {["Converting speech to text","Analyzing business need","Assessing risk profile","Generating loan plan"].map((s,i) => (
              <div key={i} className="va-step" style={{animationDelay: i*0.4+"s"}}>
                <span className="step-dot"/><span>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === "result" && result && (
        <div className="va-result">
          <div className="va-result-header">
            <div className="va-result-icon">?</div>
            <div><p className="va-result-title">Loan Plan Ready</p><p className="va-result-lang">Detected: {result.language_detected}</p></div>
            {isSpeaking && <div className="va-speaking-badge">Speaking…</div>}
          </div>
          <div className="va-transcript-box">
            <p className="vt-label">You said</p>
            <p className="vt-text">"{transcript}"</p>
          </div>
          <div className="va-ai-message">{result.response_message}</div>
          <div className="va-loan-grid">
            <div className="va-loan-card accent"><span className="vlc-label">Suggested Loan</span><span className="vlc-value">Rs.{result.suggested_loan_amount?.toLocaleString("en-IN")}</span></div>
            <div className="va-loan-card"><span className="vlc-label">Monthly EMI</span><span className="vlc-value">Rs.{result.monthly_emi?.toLocaleString("en-IN")}</span></div>
            <div className="va-loan-card"><span className="vlc-label">Tenure</span><span className="vlc-value">{result.tenure_months} months</span></div>
            <div className="va-loan-card"><span className="vlc-label">Est. Income</span><span className="vlc-value">Rs.{result.estimated_monthly_income?.toLocaleString("en-IN")}/mo</span></div>
            <div className="va-loan-card"><span className="vlc-label">Risk Level</span><span className="vlc-value" style={{color:riskColor[result.risk_level]}}>{result.risk_level?.toUpperCase()}</span><span className="vlc-sub">{result.risk_reason}</span></div>
            <div className="va-loan-card"><span className="vlc-label">Total Payable</span><span className="vlc-value">Rs.{result.total_payable?.toLocaleString("en-IN")}</span></div>
          </div>
          <div className="va-actions">
            <button className="btn-primary-va" onClick={applyLoan}>Apply for This Loan ?</button>
            <button className="btn-ghost-va" onClick={() => speakResult(result)}>Replay</button>
            <button className="btn-ghost-va" onClick={reset}>Try Again</button>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div className="va-error">
          <span className="va-error-icon">?</span>
          <p>{errorMsg}</p>
          <button className="btn-primary-va" onClick={reset}>Try Again</button>
        </div>
      )}
    </div>
  )
}





