import "server-only";
import { PUBLIC } from "./config";
import { KIND_LABEL } from "./classify";
import { bestPosition, citedAny } from "./scoring";
import type { Job } from "./types";

const C = {
  paper: "#E6EFEB",
  surface: "#F2F7F4",
  ink: "#1A2922",
  muted: "#617A6D",
  sage: "#A6B8AF",
  hair: "#DCE8E2",
  gain: "#2C6E49",
  warn: "#A6572E",
};

const font =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/** Renders the completed scorecard as an inline-styled HTML email. */
export function scorecardEmailHtml(job: Job): string {
  const sc = job.scorecard;
  const geo = job.geo;
  const score = sc?.breakdown.total ?? 0;
  const band = sc?.band.label ?? "";
  const name = job.lead.name ? esc(job.lead.name.split(" ")[0]) : "there";

  const fixes = (sc?.recommendations ?? [])
    .slice(0, 3)
    .map(
      (r, i) => `
      <tr>
        <td valign="top" style="padding:0 12px 14px 0;">
          <span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;border-radius:999px;background:${C.ink};color:${C.paper};font-weight:700;font-size:13px;">${i + 1}</span>
        </td>
        <td valign="top" style="padding:0 0 14px 0;">
          <div style="font-weight:700;color:${C.ink};font-size:15px;">${esc(r.title)}</div>
          <div style="color:${C.muted};font-size:13.5px;line-height:1.45;margin-top:2px;">${esc(r.detail)}</div>
        </td>
      </tr>`,
    )
    .join("");

  const questions = job.questions
    .map((q) => {
      const cited = citedAny(q);
      const pos = bestPosition(q);
      const competitors = Array.from(new Set(q.engines.flatMap((e) => e.competitors))).slice(0, 3);
      const status = cited
        ? `<span style="color:${C.gain};font-weight:700;">Cited${pos ? ` #${pos}` : ""}</span>`
        : `<span style="color:${C.warn};font-weight:700;">Not cited</span>`;
      const instead =
        !cited && competitors.length
          ? `<div style="color:${C.muted};font-size:12.5px;margin-top:2px;">Cited instead: ${esc(competitors.join(", "))}</div>`
          : "";
      return `
        <tr>
          <td style="padding:10px 0;border-top:1px solid ${C.hair};">
            <div style="color:${C.ink};font-size:14px;font-weight:600;">${esc(q.question)}</div>
            ${instead}
          </td>
          <td align="right" style="padding:10px 0;border-top:1px solid ${C.hair};white-space:nowrap;font-size:13px;">${status}</td>
        </tr>`;
    })
    .join("");

  const competitors = (sc?.competitors ?? [])
    .slice(0, 6)
    .map(
      (c) => `
      <tr>
        <td style="padding:6px 0;color:${C.ink};font-size:14px;font-weight:600;">${esc(c.domain)}</td>
        <td align="right" style="padding:6px 0;color:${C.muted};font-size:12.5px;">${esc(KIND_LABEL[c.kind])} &middot; ${c.count}/${sc?.questionCount ?? job.questions.length}</td>
      </tr>`,
    )
    .join("");

  const geoMissing = (geo?.signals ?? [])
    .filter((s) => !s.present)
    .map((s) => `<li style="margin-bottom:4px;">${esc(s.label)}</li>`)
    .join("");

  const section = (title: string, body: string) => `
    <tr><td style="padding:26px 32px 0 32px;">
      <div style="font-size:16px;font-weight:700;color:${C.ink};margin-bottom:12px;">${title}</div>
      ${body}
    </td></tr>`;

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${C.paper};">
  <div style="display:none;max-height:0;overflow:hidden;">Your AI Visibility Score: ${score} / 100</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${C.surface};border:1px solid ${C.sage}66;border-radius:16px;font-family:${font};">
        <tr><td style="padding:28px 32px 0 32px;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:${C.ink};letter-spacing:-0.02em;">huck</div>
        </td></tr>

        <tr><td style="padding:22px 32px 0 32px;text-align:center;">
          <div style="color:${C.muted};font-size:14px;">Hi ${name}, here is your</div>
          <div style="font-family:Georgia,serif;font-size:26px;font-weight:700;color:${C.ink};margin-top:6px;">AI Visibility Score</div>
          <div style="font-family:Georgia,serif;font-size:64px;font-weight:700;color:${C.ink};line-height:1;margin:10px 0 6px;">${score}<span style="font-size:26px;color:${C.muted};"> / 100</span></div>
          <div style="color:${C.ink};font-weight:700;font-size:16px;">${esc(band)}</div>
          <div style="color:${C.muted};font-size:14px;line-height:1.5;margin-top:12px;">We checked ${sc?.questionCount ?? job.questions.length} guest questions across AI search for <strong style="color:${C.ink};">${esc(job.domain)}</strong>. You were cited in ${sc?.citedCount ?? 0} of them.</div>
        </td></tr>

        ${section("Your priority fixes", `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${fixes || `<tr><td style="color:${C.muted};font-size:14px;">You are in good shape. Keep your content fresh.</td></tr>`}</table>`)}

        ${section("Question by question", `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${questions}</table>`)}

        ${section("Who AI recommends instead", `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${competitors || `<tr><td style="color:${C.muted};font-size:14px;">No competing domains dominated these answers.</td></tr>`}</table>`)}

        ${section("On-page GEO readiness", `<div style="color:${C.ink};font-size:15px;font-weight:700;margin-bottom:6px;">${Math.round(geo?.score ?? 0)} / ${geo?.maxScore ?? 20}</div>${geoMissing ? `<div style="color:${C.muted};font-size:13.5px;">Still to add:</div><ul style="color:${C.muted};font-size:13.5px;margin:6px 0 0 18px;padding:0;">${geoMissing}</ul>` : `<div style="color:${C.muted};font-size:13.5px;">Strong. All the signals we check are in place.</div>`}`)}

        <tr><td style="padding:28px 32px 32px 32px;text-align:center;">
          <a href="${PUBLIC.bookingUrl}" style="display:inline-block;background:${C.ink};color:${C.paper};text-decoration:none;font-weight:700;font-size:15px;padding:14px 26px;border-radius:999px;">Book a free 20-minute AI search review with Huck</a>
          <div style="color:${C.muted};font-size:12px;margin-top:22px;line-height:1.5;">Sent by Huck. You received this because you requested your AI Visibility Scorecard.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Email the completed scorecard to the lead. No-op if Resend is not configured. */
export async function sendScorecardEmail(job: Job): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "Huck <onboarding@resend.dev>";
  const replyTo = process.env.RESEND_REPLY_TO;
  if (!apiKey) {
    console.info("[email] no RESEND_API_KEY set — skipping send to", job.lead.email);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [job.lead.email],
        ...(replyTo ? { reply_to: replyTo } : {}),
        subject: `Your AI Visibility Score: ${job.scorecard?.breakdown.total ?? 0} / 100`,
        html: scorecardEmailHtml(job),
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
    return true;
  } catch (err) {
    console.error("[email] send failed:", err);
    return false;
  }
}
