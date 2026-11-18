const { createMailer, isValidRecipient } = require("../utils/mailer");
const { readFile } = require("node:fs/promises");
const path = require("node:path");

const LOGO_CID = "filmvault-logo@filmvault.invalid";
const LOGO_PATH = path.resolve(__dirname, "../../frontend/src/assets/images/logo.png");

// frontend/package.json marks this existing, browser-independent module as ESM.
// Node's dynamic import lets CommonJS reuse precisely the preview's templates.
const loadTemplates = () => import("../../frontend/src/email/emailTemplates.js");

function createEmailService({ mailer, env, transport, templateLoader = loadTemplates,
  logoReader = () => readFile(LOGO_PATH) } = {}) {
  const delivery = mailer ?? createMailer({ env, transport });

  async function sendTemplate(templateName, { to, data, attachments } = {}, allowAttachments = false) {
    if (!isValidRecipient(to)) return { status: "invalid_recipient" };
    if (!delivery.enabled) return { status: "disabled" };
    let templates;
    try {
      templates = await templateLoader();
    } catch {
      return { status: "template_unavailable" };
    }
    let email;
    let messageData = data;
    let messageAttachments = attachments ?? [];
    if (allowAttachments) {
      try {
        const logo = await logoReader();
        if (Buffer.isBuffer(logo) && logo.length > 0) {
          messageData = { ...data, logoImageCid: LOGO_CID };
          messageAttachments = [...messageAttachments, {
            filename: "filmvault-logo.png", content: logo, contentType: "image/png",
            contentDisposition: "inline", cid: LOGO_CID,
          }];
        }
      } catch {
        // The confirmation still renders with its text logo.
      }
    }
    try {
      email = templates[templateName](messageData);
    } catch {
      return { status: "invalid_data" };
    }
    return delivery.send({ to, ...email,
      ...(allowAttachments && messageAttachments.length ? { attachments: messageAttachments } : {}) });
  }

  return {
    enabled: delivery.enabled,
    sendBookingConfirmation: (request) => sendTemplate("buildBookingConfirmationEmail", request, true),
    sendCancellationNotice: (request) => sendTemplate("buildBookingCancellationEmail", request),
    sendRescheduleNotice: (request) => sendTemplate("buildShowtimeRescheduleEmail", request),
  };
}

let defaultService;
function service() {
  defaultService ??= createEmailService();
  return defaultService;
}

module.exports = {
  createEmailService,
  sendBookingConfirmation: (request) => service().sendBookingConfirmation(request),
  sendCancellationNotice: (request) => service().sendCancellationNotice(request),
  sendRescheduleNotice: (request) => service().sendRescheduleNotice(request),
};
