function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function scoreRow(label, value) {
  const color = value >= 70 ? '#5C7A3D' : value >= 45 ? '#C9932E' : '#C4553B';
  return `
    <tr>
      <td style="padding:6px 0;font-size:13px;color:#1E2A16;font-family:Arial,sans-serif;">${esc(label)}</td>
      <td style="padding:6px 0;text-align:right;font-size:13px;font-weight:bold;color:${color};font-family:Arial,sans-serif;">${value}</td>
    </tr>`;
}

function listBlock(title, items, color) {
  if (!items || !items.length) return '';
  const rows = items.map(i => `<li style="margin-bottom:8px;font-size:13.5px;color:#1E2A16;font-family:Arial,sans-serif;">${esc(i)}</li>`).join('');
  return `
    <tr><td style="padding-top:22px;">
      <div style="font-size:14.5px;font-weight:bold;color:${color};font-family:Arial,sans-serif;margin-bottom:10px;">${esc(title)}</div>
      <ul style="margin:0;padding-left:18px;">${rows}</ul>
    </td></tr>`;
}

export function buildReportEmailHtml(result, meta = {}) {
  const scoreLabels = {
    impact: 'Impact', ats: 'Can a computer read it?', tone: 'Tone',
    regionFit: 'Fits your country', achievementRatio: 'Real results shown', structure: 'Easy to scan'
  };
  const scoreRows = Object.entries(result.scores || {}).map(([k, v]) => scoreRow(scoreLabels[k] || k, v)).join('');

  const rewriteRows = (result.rewrittenExamples || []).map(ex => `
    <tr><td style="padding:10px 0;">
      <div style="background:#F7E8E2;border-radius:8px;padding:10px 14px;margin-bottom:6px;font-size:13px;font-family:Arial,sans-serif;color:#7A3C28;"><b>Before:</b> ${esc(ex.before)}</div>
      <div style="background:#EAF1DE;border-radius:8px;padding:10px 14px;font-size:13px;font-family:Arial,sans-serif;color:#3F5A2C;"><b>After:</b> ${esc(ex.after)}</div>
    </td></tr>`).join('');

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F3F7EC;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F7EC;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;font-family:Arial,sans-serif;">
        <tr><td style="background:#3F5A2C;padding:22px 32px;">
          <span style="color:#FFFFFF;font-size:18px;font-weight:bold;">ZAYT.</span>
          <span style="color:#EAF1DE;font-size:13px;"> — Your ATS Report</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <div style="font-size:20px;font-weight:bold;color:#1E2A16;margin-bottom:4px;">Overall score: ${result.overall} / 100</div>
          <div style="font-size:13.5px;color:#6B7660;margin-bottom:20px;">${esc(result.verdictText || '')}</div>

          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #DCE6CC;border-bottom:1px solid #DCE6CC;padding:6px 0;">
            ${scoreRows}
          </table>

          <table width="100%" cellpadding="0" cellspacing="0">
            ${listBlock("What's working", result.wins, '#5C7A3D')}
            ${listBlock('Weaknesses', result.weaknesses, '#C9932E')}
            ${listBlock('Fixes to make', result.fixes, '#C4553B')}
            ${listBlock('Technical ATS flags', result.atsIssues, '#1E2A16')}
            ${listBlock('Your action plan', result.quickWins, '#3F5A2C')}
          </table>

          ${rewriteRows ? `<div style="font-size:14.5px;font-weight:bold;color:#3F5A2C;font-family:Arial,sans-serif;margin:22px 0 10px;">Rewritten examples</div><table width="100%" cellpadding="0" cellspacing="0">${rewriteRows}</table>` : ''}

          <div style="margin-top:28px;padding-top:20px;border-top:1px solid #DCE6CC;font-size:12.5px;color:#6B7660;">
            Want a full professional rewrite? Reply to this email or WhatsApp us at
            <a href="https://wa.me/966580437821" style="color:#5C7A3D;">+966 58 043 7821</a>.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
