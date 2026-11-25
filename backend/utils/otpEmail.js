// utils/otpEmail.js
// Sign-up verification email. Returns { subject, html, text } for mailer.send().

function buildOtpEmail({ code, expiresInMinutes = 10 } = {}) {
	const digits = String(code ?? "");
	if (!/^\d{6}$/.test(digits)) throw new TypeError("code must be 6 digits.");
	const minutes =
		Number.isInteger(expiresInMinutes) && expiresInMinutes > 0
			? expiresInMinutes
			: 10;

	const subject = `${digits} is your FilmVault verification code`;

	const text = [
		"FilmVault email verification",
		"",
		`Your verification code is: ${digits}`,
		"",
		`It expires in ${minutes} minutes. If you didn't try to sign up, ignore this email.`,
	].join("\n");

	const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#0b0b0f;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr><td align="center">
        <table role="presentation" width="480" cellspacing="0" cellpadding="0"
               style="max-width:480px;background:#16161d;border-radius:12px;padding:32px;color:#ffffff;">
          <tr><td style="font-size:20px;font-weight:bold;letter-spacing:2px;color:#e50914;">FILMVAULT</td></tr>
          <tr><td style="padding-top:20px;font-size:16px;">Use this code to verify your email and finish signing up:</td></tr>
          <tr><td align="center" style="padding:24px 0;">
            <span style="display:inline-block;font-size:34px;font-weight:bold;letter-spacing:10px;
                         background:#0b0b0f;border-radius:8px;padding:14px 22px;">${digits}</span>
          </td></tr>
          <tr><td style="font-size:13px;color:#a0a0ab;">
            This code expires in ${minutes} minutes. If you didn't try to sign up for FilmVault, you can ignore this email.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

	return { subject, html, text };
}

module.exports = { buildOtpEmail };
