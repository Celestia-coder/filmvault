export function rescheduleNotificationFeedback(response) {
	const notification = response?.notification;
	const status = notification?.status;
	const counts = ["sent", "failed", "skipped"]
		.filter((key) => Number.isSafeInteger(notification?.[key]) && notification[key] >= 0)
		.map((key) => `${key}: ${notification[key]}`);
	const detail = counts.length ? ` (${counts.join(", ")})` : "";

	switch (status) {
		case "unchanged":
			return "Showtime unchanged. No notification was sent.";
		case "sent":
			return `Showtime rescheduled. The email service reported notifications sent${detail}. Inbox delivery is not confirmed.`;
		case "partial_failure":
			return `Showtime rescheduled. Notification delivery was incomplete${detail}.${notification.failed > 0 ? " Failed sends may have uncertain delivery; do not retry automatically." : ""}`;
		case "disabled":
			return "Showtime rescheduled. Email notifications were disabled; no send was attempted.";
		case "no_recipients":
			return "Showtime rescheduled. No eligible bookings were found; no email was attempted.";
		case "ineligible_screening":
			return "Showtime rescheduled. The screening was not eligible for email notification.";
		case "seat_revalidation_required":
			return "Showtime rescheduled. Email notification was skipped because the cinema changed and seats require review.";
		case "unauthorized":
		case "invalid_event":
		case "preparation_failed":
			return "Showtime rescheduled. Notification preparation was skipped or failed; no email was attempted. Check backend logs.";
		case "failed":
			return "Showtime rescheduled. Notification delivery failed; whether the provider accepted an email is unknown. Do not retry automatically.";
		case "duplicate":
			return "Showtime rescheduled. This notification event was already handled; no additional send was attempted.";
		default:
			return "Showtime rescheduled. Notification outcome is unavailable; check backend logs before retrying.";
	}
}
