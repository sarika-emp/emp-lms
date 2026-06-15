// ============================================================================
// CERTIFICATE DOCUMENT
// Renders a polished, print-ready (landscape A4) HTML certificate. Used by the
// download route so certificates look professional even when an org hasn't
// configured a custom HTML template. All dynamic values are HTML-escaped.
// ============================================================================

export interface CertificateData {
  learnerName: string;
  courseTitle: string;
  issuedDate: string;
  orgName: string;
  certNumber: string;
}

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The variable substitution map covering every placeholder vocabulary used by
 * templates in this codebase, so a custom template renders correctly too.
 */
export function certificateVars(d: CertificateData): Record<string, string> {
  return {
    learner_name: d.learnerName,
    user_name: d.learnerName,
    recipient_name: d.learnerName,
    name: d.learnerName,
    course_title: d.courseTitle,
    course_name: d.courseTitle,
    issued_date: d.issuedDate,
    issued_at: d.issuedDate,
    date: d.issuedDate,
    certificate_number: d.certNumber,
    cert_number: d.certNumber,
    org_name: d.orgName,
    organization_name: d.orgName,
  };
}

/** Substitute {{ token }} placeholders; unknown tokens become "". */
export function applyTemplate(rawHtml: string, d: CertificateData): string {
  const vars = certificateVars(d);
  return rawHtml.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_m: string, key: string) =>
    key in vars ? esc(vars[key]) : "",
  );
}

/** A heuristic: only "real" custom templates (with their own layout/markup)
 *  should override the polished default. The simple seeded one-liners do not. */
export function isRichTemplate(rawHtml: string): boolean {
  if (!rawHtml || rawHtml.trim().length < 200) return false;
  // Must carry meaningful structure of its own.
  return /<(div|table|section|header|img|svg)\b/i.test(rawHtml);
}

/**
 * The polished default certificate document (full standalone HTML page).
 * Decorative double border, corner flourishes, gold seal, signature line.
 */
export function renderCertificateDocument(d: CertificateData): string {
  const learner = esc(d.learnerName);
  const course = esc(d.courseTitle);
  const date = esc(d.issuedDate);
  const org = esc(d.orgName);
  const cert = esc(d.certNumber);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Certificate ${cert}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Montserrat:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: #eef1f6;
    font-family: 'Montserrat', system-ui, sans-serif;
    color: #1f2937;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 32px;
  }
  .page {
    width: 1040px;
    max-width: 100%;
    aspect-ratio: 1.414 / 1;            /* A4 landscape */
    background:
      radial-gradient(circle at 20% 0%, #fffdf7 0%, #ffffff 45%),
      #ffffff;
    position: relative;
    box-shadow: 0 24px 60px rgba(15,23,42,.18);
    overflow: hidden;
  }
  /* Outer + inner decorative frame */
  .frame-outer {
    position: absolute; inset: 22px;
    border: 2px solid #c8a24a;
  }
  .frame-inner {
    position: absolute; inset: 30px;
    border: 1px solid #e2cd92;
  }
  /* Subtle corner flourishes */
  .corner {
    position: absolute; width: 56px; height: 56px;
    border-color: #b8902f; border-style: solid; border-width: 0;
  }
  .corner.tl { top: 38px; left: 38px; border-top-width: 3px; border-left-width: 3px; }
  .corner.tr { top: 38px; right: 38px; border-top-width: 3px; border-right-width: 3px; }
  .corner.bl { bottom: 38px; left: 38px; border-bottom-width: 3px; border-left-width: 3px; }
  .corner.br { bottom: 38px; right: 38px; border-bottom-width: 3px; border-right-width: 3px; }

  .content {
    position: relative; z-index: 2;
    height: 100%;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    text-align: center;
    padding: 70px 90px;
  }
  .eyebrow {
    letter-spacing: .42em; text-transform: uppercase;
    font-size: 13px; font-weight: 600; color: #b8902f; margin: 0 0 6px;
  }
  .title {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 58px; font-weight: 700; line-height: 1.05;
    color: #1e293b; margin: 0 0 4px;
  }
  .rule { width: 96px; height: 3px; background: #c8a24a; border-radius: 2px; margin: 16px 0 26px; }
  .lead { font-size: 15px; color: #6b7280; margin: 0; }
  .recipient {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 46px; font-weight: 600; color: #111827;
    margin: 12px 0; padding-bottom: 8px;
    border-bottom: 1.5px solid #e5e7eb; min-width: 420px;
  }
  .course {
    font-size: 24px; font-weight: 600; color: #1f2937; margin: 14px 0 4px;
    max-width: 640px;
  }
  .meta { font-size: 14px; color: #6b7280; margin-top: 6px; }

  /* Footer: signature + seal + cert no */
  .footer {
    position: absolute; left: 90px; right: 90px; bottom: 88px; z-index: 2;
    display: flex; align-items: flex-end; justify-content: space-between;
  }
  .sig { text-align: center; min-width: 200px; }
  .sig .line { border-top: 1.5px solid #9ca3af; padding-top: 6px; }
  .sig .who { font-size: 13px; font-weight: 600; color: #374151; }
  .sig .role { font-size: 11px; color: #9ca3af; letter-spacing: .08em; text-transform: uppercase; }

  .seal {
    width: 96px; height: 96px; border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #e8c66a, #b8902f 70%);
    box-shadow: 0 6px 16px rgba(184,144,47,.4);
    display: flex; align-items: center; justify-content: center;
    color: #fff; position: relative;
  }
  .seal::before {
    content: ""; position: absolute; inset: 8px;
    border: 2px dashed rgba(255,255,255,.7); border-radius: 50%;
  }
  .seal .star { font-size: 34px; line-height: 1; }

  .certno {
    position: absolute; bottom: 46px; left: 0; right: 0; z-index: 2;
    text-align: center;
    font-size: 11px; letter-spacing: .12em; color: #b8b3a6;
  }

  @media print {
    body { background: #fff; padding: 0; }
    .page { box-shadow: none; width: 100%; height: 100vh; aspect-ratio: auto; }
    @page { size: A4 landscape; margin: 0; }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="frame-outer"></div>
    <div class="frame-inner"></div>
    <span class="corner tl"></span><span class="corner tr"></span>
    <span class="corner bl"></span><span class="corner br"></span>

    <div class="content">
      <p class="eyebrow">${org}</p>
      <h1 class="title">Certificate of Completion</h1>
      <div class="rule"></div>
      <p class="lead">This is proudly presented to</p>
      <div class="recipient">${learner}</div>
      <p class="lead">for successfully completing the course</p>
      <div class="course">${course}</div>
      <p class="meta">Issued on ${date}</p>
    </div>

    <div class="footer">
      <div class="sig">
        <div class="line"><span class="who">${org}</span></div>
        <div class="role">Learning &amp; Development</div>
      </div>
      <div class="seal"><span class="star">&#9733;</span></div>
      <div class="sig">
        <div class="line"><span class="who">${date}</span></div>
        <div class="role">Date of Issue</div>
      </div>
    </div>

    <div class="certno">Certificate No: ${cert}</div>
  </div>
</body>
</html>`;
}
