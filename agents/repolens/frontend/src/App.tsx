import { useState, useEffect, useCallback, type ReactNode } from 'react'
import {
  getAudits, getAudit, getHealth, startScan, getReportDownloadUrl,
  type AuditSummary, type AuditDetail, type HealthResponse, type Finding
} from './api'

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO', 'UNKNOWN'] as const
const SEV_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4, UNKNOWN: 5 }

function SeverityTag({ sev }: { sev: string }) {
  return <span className={`finding-severity-tag ${sev}`}>{sev}</span>
}

function ScannerStatusRow({ status }: { status: Record<string, { available: boolean; finding_count: number; error_message: string | null }> }) {
  return (
    <div className="scanner-status-row" aria-label="Scanner status">
      {Object.entries(status).map(([name, scanner]) => (
        <span key={name} className={`scanner-pill ${scanner.available ? 'ok' : 'err'}`}>
          <span className="status-dot" />
          <strong>{name}</strong>
          <span>{scanner.available ? `${scanner.finding_count} findings` : 'unavailable'}</span>
        </span>
      ))}
    </div>
  )
}

function FindingCard({ finding }: { finding: Finding }) {
  const [open, setOpen] = useState(false)
  return (
    <article className={`finding-card${open ? ' open' : ''}`}>
      <button
        id={`finding-${finding.finding_id}`}
        className="finding-header"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
      >
        <SeverityTag sev={finding.severity} />
        <span className="finding-title">{finding.title}</span>
        <span className="finding-scanner">{finding.scanner}</span>
        <span className={`chevron${open ? ' open' : ''}`} aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="finding-body">
          <div className="finding-meta">
            {finding.rule_id && <MetaRow label="Rule / CVE"><code>{finding.rule_id}</code></MetaRow>}
            {finding.category && <MetaRow label="Category">{finding.category}</MetaRow>}
            {finding.file_path && (
              <MetaRow label="Location"><code>{finding.file_path}{finding.line_start ? `:${finding.line_start}` : ''}</code></MetaRow>
            )}
            {finding.evidence && <MetaRow label="Evidence"><pre className="finding-evidence">{finding.evidence}</pre></MetaRow>}
            {finding.remediation && <MetaRow label="Suggested fix">{finding.remediation}</MetaRow>}
            {finding.source_url && (
              <MetaRow label="Reference">
                <a href={finding.source_url} target="_blank" rel="noopener noreferrer">Open advisory ↗</a>
              </MetaRow>
            )}
          </div>
          {finding.provenance === 'ai_suggestion' && (
            <p className="finding-ai-note">AI suggestion · not confirmed by a scanner</p>
          )}
        </div>
      )}
    </article>
  )
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="finding-meta-row"><span className="finding-meta-label">{label}</span><div className="finding-meta-value">{children}</div></div>
}

function StatCard({ label, value, tone, footnote }: { label: string; value: string | number; tone?: string; footnote: string }) {
  return (
    <div className={`stat-card${tone ? ` ${tone}` : ''}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      <span className="stat-footnote">{footnote}</span>
    </div>
  )
}

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [audits, setAudits] = useState<AuditSummary[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<AuditDetail | null>(null)
  const [repoUrl, setRepoUrl] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [sevFilter, setSevFilter] = useState('ALL')

  const loadAudits = useCallback(async () => {
    try {
      const data = await getAudits()
      setAudits(data)
      setSelectedId(current => current ?? data.find(audit => audit.is_demo)?.id ?? data[0]?.id ?? null)
    } catch { /* The dashboard can still show a useful disconnected state. */ }
  }, [])

  useEffect(() => {
    getHealth().then(setHealth).catch(() => {})
    void loadAudits()
  }, [loadAudits])

  useEffect(() => {
    if (!selectedId) { setDetail(null); return }
    let active = true
    setLoadingDetail(true)
    getAudit(selectedId)
      .then(value => { if (active) setDetail(value) })
      .catch(() => { if (active) setDetail(null) })
      .finally(() => { if (active) setLoadingDetail(false) })
    return () => { active = false }
  }, [selectedId])

  const handleScan = async () => {
    setScanError('')
    if (!repoUrl.trim()) { setScanError('Enter a GitHub repository URL to start.'); return }
    setScanning(true)
    try {
      const result = await startScan(repoUrl.trim())
      setSelectedId(result.audit_id)
      await loadAudits()
      setRepoUrl('')
    } catch (error: unknown) {
      setScanError(error instanceof Error ? error.message : 'Scan failed. Check the URL and try again.')
    } finally {
      setScanning(false)
    }
  }

  const report = detail?.report_json
  const findings = report?.findings ?? []
  const filteredFindings = (sevFilter === 'ALL' ? findings : findings.filter(finding => finding.severity === sevFilter))
    .slice()
    .sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9))
  const criticalCount = findings.filter(finding => finding.severity === 'CRITICAL').length
  const highCount = findings.filter(finding => finding.severity === 'HIGH').length
  const completedScans = audits.filter(audit => !audit.is_demo).length
  const dbStatus = health?.database ?? 'unknown'
  const dbLabel = dbStatus === 'ok' ? 'Database connected' : dbStatus === 'unknown' ? 'Checking connection' : 'Database offline'

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="RepoLens home">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span className="brand-name">repo<span>lens</span></span>
        </a>
        <div className="topbar-right">
          <span className="topbar-caption">REPOSITORY SECURITY WORKSPACE</span>
          <span className={`connection-badge ${dbStatus === 'ok' ? 'connected' : dbStatus === 'unknown' ? 'checking' : 'disconnected'}`}>
            <span className="status-dot" />{dbLabel}
          </span>
          <span className={`ai-badge ${health?.gemini_configured ? 'enabled' : ''}`}>
            <span aria-hidden="true">✦</span> Gemini {health?.gemini_configured ? 'enabled' : 'optional'}
          </span>
        </div>
      </header>

      <main id="top" className="main-content">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-line" /> SECURITY POSTURE, MADE CLEAR</p>
            <h1>See what’s hiding<br /><span>in your code.</span></h1>
            <p className="hero-description">Scan a public GitHub repository. Get evidence-backed findings, clear severity, and AI-assisted remediation in one focused report.</p>
          </div>
          <div className="hero-orbit" aria-hidden="true">
            <div className="orbit orbit-outer" /><div className="orbit orbit-inner" />
            <div className="orbit-core"><span className="brand-mark large"><span /></span></div>
            <span className="orbit-node node-one" /><span className="orbit-node node-two" /><span className="orbit-node node-three" />
          </div>
        </section>

        <section className="scan-panel" aria-labelledby="scan-heading">
          <div className="scan-panel-head">
            <div className="scan-icon" aria-hidden="true">⌕</div>
            <div><h2 id="scan-heading">Start a repository scan</h2><p>Public GitHub repositories · No code is executed</p></div>
          </div>
          <div className="scan-input-row">
            <label className="sr-only" htmlFor="repo-url-input">GitHub repository URL</label>
            <span className="input-prefix" aria-hidden="true">↗</span>
            <input
              id="repo-url-input" className="scan-input" type="url"
              placeholder="https://github.com/owner/repository"
              value={repoUrl} onChange={event => setRepoUrl(event.target.value)}
              onKeyDown={event => event.key === 'Enter' && !scanning && void handleScan()}
              disabled={scanning} aria-describedby={scanError ? 'scan-error' : 'scan-hint'}
            />
            <button id="scan-btn" className="scan-button" onClick={() => void handleScan()} disabled={scanning}>
              {scanning ? <><span className="spinner" /> Scanning</> : <>Run security scan <span aria-hidden="true">→</span></>}
            </button>
          </div>
          {scanError && <p id="scan-error" className="error-msg" role="alert">{scanError}</p>}
          {scanning
            ? <p className="scan-feedback"><span className="pulse-dot" />Cloning and scanning. This can take a few minutes.</p>
            : <p id="scan-hint" className="scan-hint"><span aria-hidden="true">⌁</span> Trivy + Semgrep analysis <span className="hint-divider">·</span> AI insights are clearly labeled</p>}
        </section>

        <section className="overview-section" aria-label="Selected audit overview">
          <div className="section-topline">
            <div><p className="eyebrow small">YOUR WORKSPACE</p><h2 className="section-title">Security overview</h2></div>
            {report && <span className="selected-repo"><span className="status-dot" />{detail?.repository_name}</span>}
          </div>
          <div className="stats-grid">
            <StatCard label="Repositories scanned" value={completedScans} footnote="Completed live audits" />
            <StatCard label="Findings in this audit" value={findings.length} footnote={report ? 'Across all severities' : 'Select an audit to view'} />
            <StatCard label="Critical findings" value={criticalCount} tone="critical" footnote={criticalCount ? 'Address immediately' : 'No critical issues found'} />
            <StatCard label="High severity" value={highCount} tone="high" footnote={highCount ? 'Prioritize remediation' : 'No high severity issues'} />
          </div>
        </section>

        <div className="workspace-grid">
          <section className="history-panel" aria-labelledby="history-heading">
            <div className="panel-heading">
              <div><p className="eyebrow small">HISTORY</p><h2 id="history-heading" className="section-title">Recent audits</h2></div>
              <span className="count-badge">{audits.length}</span>
            </div>
            {audits.length === 0 ? (
              <div className="empty-state"><span className="empty-icon">⌕</span><strong>No audits yet</strong><span>Run your first scan to see results here.</span></div>
            ) : (
              <div className="audit-list">
                {audits.map(audit => (
                  <button key={audit.id} id={`audit-row-${audit.id}`} className={`audit-row${selectedId === audit.id ? ' selected' : ''}`} onClick={() => setSelectedId(audit.id)}>
                    <span className="audit-avatar" aria-hidden="true">{audit.repository_name.slice(0, 1).toUpperCase()}</span>
                    <span className="audit-main"><span className="audit-row-name">{audit.repository_name}</span><span className="audit-row-date">{new Date(audit.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span></span>
                    <span className="audit-indicators">
                      {audit.critical_count > 0 && <span className="mini-count critical">{audit.critical_count} crit</span>}
                      {audit.high_count > 0 && <span className="mini-count high">{audit.high_count} high</span>}
                      {audit.total_findings === 0 && <span className="mini-count clean">0 findings</span>}
                      {audit.is_demo && <span className="demo-badge">DEMO</span>}
                    </span>
                    <span className="row-arrow" aria-hidden="true">→</span>
                  </button>
                ))}
              </div>
            )}
            <div className="history-footnote"><span className="status-dot" /> Latest scans appear at the top</div>
          </section>

          <section className="report-panel" aria-labelledby="report-heading">
            {loadingDetail ? (
              <div className="report-placeholder"><span className="spinner large-spinner" /><strong>Loading audit</strong><span>Preparing the findings and report.</span></div>
            ) : detail && report ? (
              <>
                <div className="report-heading-row">
                  <div><p className="eyebrow small">AUDIT REPORT</p><h2 id="report-heading" className="section-title">{detail.repository_name}</h2></div>
                  <div className="download-actions">
                    <a className="download-button" href={getReportDownloadUrl(detail.id, 'json')} download>↓ <span>JSON</span></a>
                    <a className="download-button" href={getReportDownloadUrl(detail.id, 'markdown')} download>↓ <span>Markdown</span></a>
                  </div>
                </div>
                <div className="report-meta-line">
                  <span className="commit-chip">⌘ {detail.commit_sha ? detail.commit_sha.slice(0, 7) : 'commit unavailable'}</span>
                  <span>{report.tech_stack.join(' · ') || 'Stack not detected'}</span>
                  {report.scan_duration_seconds != null && <span>{report.scan_duration_seconds}s scan</span>}
                </div>

                {report.is_demo && <div className="demo-warning"><strong>Illustrative demo report</strong><span>These findings are examples, not results from a live scanner run.</span></div>}
                {Object.keys(report.scanner_status).length > 0 && <ScannerStatusRow status={report.scanner_status} />}

                {report.ai_available && report.ai_summary && (
                  <div className="ai-block">
                    <div className="ai-block-title"><span className="ai-sparkle">✦</span><div><strong>AI-assisted triage</strong><span>Gemini summary · Suggestions are unverified</span></div></div>
                    <p>{report.ai_summary}</p>
                    {report.ai_prioritized_actions.length > 0 && <ol className="ai-actions-list">{report.ai_prioritized_actions.map((action, index) => <li key={index}><span>{String(index + 1).padStart(2, '0')}</span>{action}</li>)}</ol>}
                  </div>
                )}

                <div className="findings-heading-row">
                  <div><p className="eyebrow small">SCANNER EVIDENCE</p><h3 className="section-title">Findings <span className="count-badge">{findings.length}</span></h3></div>
                  <span className="sort-label">Sorted by severity</span>
                </div>
                {findings.length > 0 && (
                  <div className="findings-filter" role="group" aria-label="Filter findings by severity">
                    {['ALL', ...SEVERITIES].map(severity => {
                      const count = severity === 'ALL' ? findings.length : findings.filter(finding => finding.severity === severity).length
                      return <button key={severity} id={`filter-${severity.toLowerCase()}`} className={`filter-btn${sevFilter === severity ? ' active' : ''}`} onClick={() => setSevFilter(severity)} aria-pressed={sevFilter === severity}>{severity}<span>{count}</span></button>
                    })}
                  </div>
                )}
                {findings.length === 0 ? (
                  <div className="empty-report"><span className="clean-check">✓</span><strong>No findings returned</strong><span>Check scanner status above. If scanners were unavailable, this is not a clean scan.</span></div>
                ) : filteredFindings.length === 0 ? (
                  <div className="empty-report compact">No {sevFilter.toLowerCase()} findings in this audit.</div>
                ) : (
                  <div className="findings-list">{filteredFindings.map(finding => <FindingCard key={finding.finding_id} finding={finding} />)}</div>
                )}
              </>
            ) : (
              <div className="report-placeholder"><span className="report-placeholder-icon">⌁</span><strong id="report-heading">Your audit report</strong><span>Select a recent audit to inspect scanner evidence, severity, and remediation guidance.</span></div>
            )}
          </section>
        </div>

        <footer className="footer"><span>RepoLens <span className="footer-dot">·</span> Evidence first. AI clearly labeled.</span><span>Trivy <i /> Semgrep <i /> Google ADK</span></footer>
      </main>
    </div>
  )
}

export default App
