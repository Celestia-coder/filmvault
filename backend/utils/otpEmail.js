// utils/otpEmail.js
// Verification-code emails. Returns { subject, html, text } for mailer.send().
// data.purpose: "signup" (default) or "reset".

const COPY = {
	signup: {
		subject: (code) => `${code} is your FilmVault verification code`,
		heading: "FilmVault email verification",
		intro: "Use this code to verify your email and finish signing up:",
		ignore: "If you didn't try to sign up for FilmVault, you can ignore this email.",
	},
	reset: {
		subject: (code) => `${code} is your FilmVault password reset code`,
		heading: "FilmVault password reset",
		intro: "Use this code to reset your FilmVault password:",
		ignore: "If you didn't ask to reset your password, you can ignore this email. Your password won't change.",
	},
};

function buildOtpEmail({
	code,
	expiresInMinutes = 10,
	purpose = "signup",
} = {}) {
	const digits = String(code ?? "");
	if (!/^\d{6}$/.test(digits)) throw new TypeError("code must be 6 digits.");
	const copy = COPY[purpose];
	if (!copy) throw new TypeError("unknown purpose.");
	const minutes =
		Number.isInteger(expiresInMinutes) && expiresInMinutes > 0
			? expiresInMinutes
			: 10;

	const subject = copy.subject(digits);

	const text = [
		copy.heading,
		"",
		`Your code is: ${digits}`,
		"",
		`It expires in ${minutes} minutes. ${copy.ignore}`,
	].join("\n");

	const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#0b0b0f;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr><td align="center">
        <table role="presentation" width="480" cellspacing="0" cellpadding="0"
               style="max-width:480px;background:#16161d;border-radius:12px;padding:32px;color:#ffffff;">
          <tr><td style="font-size:20px;font-weight:bold;letter-spacing:2px;color:#e50914;">FILMVAULT</td></tr>
          <tr><td style="padding-top:20px;font-size:16px;">${copy.intro}</td></tr>
          <tr><td align="center" style="padding:24px 0;">
            <span style="display:inline-block;font-size:34px;font-weight:bold;letter-spacing:10px;
                         background:#0b0b0f;border-radius:8px;padding:14px 22px;">${digits}</span>
          </td></tr>
          <tr><td style="font-size:13px;color:#a0a0ab;">
            This code expires in ${minutes} minutes. ${copy.ignore}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

	return { subject, html, text };
}

module.exports = { buildOtpEmail };
