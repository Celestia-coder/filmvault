import {
  buildBookingConfirmationEmail,
  buildBookingCancellationEmail,
  buildShowtimeRescheduleEmail,
} from "./emailTemplates.js";

// Vite serves /dev/email-preview.html during development. It is not an App
// route or an entry in the production Vite build.
if (import.meta.env.DEV) {
  const previewToken = "0123456789abcdef0123456789abcdef";
  const previewQrCid = "filmvault-ticket-qr@filmvault.invalid";
  const previewQrImage = "/dev/fictional-ticket-qr.png";
  const previewTicketUrl = `https://tickets.example.com/verify/${previewToken}`;
  // Public HTTPS copy of the Home page's tracked logo, used only by this
  // fictional preview. Real delivery should use a controlled asset URL or CID.
  const logoUrl = "https://raw.githubusercontent.com/Celestia-coder/filmvault/4d36ca48e8fcbae493294673633ad0c561502185/frontend/src/assets/images/logo.png";
  const common = {
    customerName: "Alex Sample",
    referenceCode: "FV-ABCD2345",
    movieTitle: "The Extraordinary Lighthouse Adventure Across the Islands and Far Beyond the Evening Horizon",
    branchName: "Sample City Branch",
    logoUrl,
  };
  const examples = [
    ["Booking confirmation", buildBookingConfirmationEmail({
      ...common,
      cinemaNumber: 2,
      showDate: "2026-12-05",
      showTime: "18:30:00",
      seats: ["C5", "C6"],
      ticketTypes: ["Regular", "Senior"],
      movieRating: "PG",
      runtimeMinutes: 125,
      ticketItems: [
        { seat: "C5", type: "Regular", price: 280 },
        { seat: "C6", type: "Senior", price: 240 },
      ],
      snackItems: [{ name: "Sample popcorn", quantity: 1, subtotal: 70 }],
      bookingFee: 30,
      amountPaid: 620,
      paymentMethod: "GCash",
      bookedAt: "2026-11-15 14:20:00",
      ticketUrl: previewTicketUrl,
      qrImageCid: previewQrCid,
    })],
    ["Booking cancellation", buildBookingCancellationEmail({
      ...common,
      showDate: "2026-12-05",
      showTime: "18:30:00",
      seats: ["C5", "C6"],
    })],
    ["Showtime reschedule", buildShowtimeRescheduleEmail({
      ...common,
      previous: { date: "2026-12-05", time: "18:30", branchName: "Sample City Branch", cinemaNumber: 2 },
      updated: { date: "2026-12-06", time: "19:00", branchName: "Sample City Branch", cinemaNumber: 2 },
    })],
  ];

  const container = document.getElementById("previews");
  const layoutToggle = document.getElementById("layout-toggle");
  const mobileToggle = document.getElementById("mobile-toggle");
  const frames = [];
  function sizeFrame(frame) {
    const document = frame.contentDocument;
    if (!document?.body) return;
    frame.style.height = "1px";
    frame.style.height = `${Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) + 2}px`;
  }
  function sizeAllFrames() {
    requestAnimationFrame(() => frames.forEach(sizeFrame));
  }
  layoutToggle.addEventListener("click", () => {
    const fullWidth = container.classList.toggle("full-width");
    layoutToggle.setAttribute("aria-pressed", String(fullWidth));
    layoutToggle.textContent = fullWidth ? "Show side-by-side previews" : "Show full-width previews";
    sizeAllFrames();
  });
  mobileToggle.addEventListener("click", () => {
    const mobile = container.classList.toggle("mobile");
    mobileToggle.setAttribute("aria-pressed", String(mobile));
    mobileToggle.textContent = mobile ? "Show natural email width" : "Show mobile width";
    sizeAllFrames();
  });
  window.addEventListener("resize", sizeAllFrames);
  for (const [label, email] of examples) {
    const card = document.createElement("article");
    const title = document.createElement("h2");
    title.textContent = label;
    const subject = document.createElement("p");
    subject.className = "subject";
    subject.textContent = `Subject: ${email.subject}`;
    const frame = document.createElement("iframe");
    frame.title = `${label} HTML email`;
    // Same-origin access is needed solely to size srcdoc to its full height.
    // Scripts remain disabled in the sandbox, so there is no nested scrolling.
    frame.setAttribute("sandbox", "allow-same-origin");
    frame.setAttribute("scrolling", "no");
    frame.addEventListener("load", () => {
      sizeFrame(frame);
      for (const image of frame.contentDocument?.images ?? []) {
        if (!image.complete) image.addEventListener("load", () => sizeFrame(frame), { once: true });
      }
    });
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Plain-text alternative";
    const plainText = document.createElement("pre");
    plainText.textContent = email.text;
    details.append(summary, plainText);
    card.append(title, subject, frame, details);
    container.append(card);
    frames.push(frame);
    // Browsers cannot resolve Nodemailer's CID attachments. Only the fictional
    // confirmation preview swaps that image source for a local development asset.
    frame.srcdoc = label === "Booking confirmation"
      ? email.html.replace(`src="cid:${previewQrCid}"`, `src="${previewQrImage}"`)
      : email.html;
  }
}
