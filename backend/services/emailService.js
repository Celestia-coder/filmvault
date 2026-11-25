const { createMailer, isValidRecipient } = require("../utils/mailer");
const { buildOtpEmail } = require("../utils/otpEmail");

// frontend/package.json marks this existing, browser-independent module as ESM.
// Node's dynamic import lets CommonJS reuse precisely the preview's templates.
const loadTemplates = () =>
	import("../../frontend/src/email/emailTemplates.js");

function createEmailService({
	mailer,
	env,
	transport,
	templateLoader = loadTemplates,
} = {}) {
	const delivery = mailer ?? createMailer({ env, transport });

	async function sendTemplate(
		templateName,
		{ to, data, attachments } = {},
		allowAttachments = false,
	) {
		if (!isValidRecipient(to)) return { status: "invalid_recipient" };
		if (!delivery.enabled) return { status: "disabled" };
		let templates;
		try {
			templates = await templateLoader();
		} catch {
			return { status: "template_unavailable" };
		}
		let email;
		try {
			email = templates[templateName](data);
		} catch {
			return { status: "invalid_data" };
		}
		return delivery.send({
			to,
			...email,
			...(allowAttachments && attachments?.length ? { attachments } : {}),
		});
	}

	// Sign-up verification code. The template lives in the backend, so it does
	// not go through the frontend template loader.
	async function sendOtpCode({ to, data } = {}) {
		if (!isValidRecipient(to)) return { status: "invalid_recipient" };
		if (!delivery.enabled) return { status: "disabled" };
		let email;
		try {
			email = buildOtpEmail(data);
		} catch {
			return { status: "invalid_data" };
		}
		return delivery.send({ to, ...email });
	}

	return {
		enabled: delivery.enabled,
		sendOtpCode,
		sendBookingConfirmation: (request) =>
			sendTemplate("buildBookingConfirmationEmail", request, true),
		sendCancellationNotice: (request) =>
			sendTemplate("buildBookingCancellationEmail", request),
		sendRescheduleNotice: (request) =>
			sendTemplate("buildShowtimeRescheduleEmail", request, true),
	};
}

let defaultService;
function service() {
	defaultService ??= createEmailService();
	return defaultService;
}

module.exports = {
	createEmailService,
	sendBookingConfirmation: (request) =>
		service().sendBookingConfirmation(request),
	sendCancellationNotice: (request) =>
		service().sendCancellationNotice(request),
	sendRescheduleNotice: (request) => service().sendRescheduleNotice(request),
	sendOtpCode: (request) => service().sendOtpCode(request),
};
