import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rescheduleNotificationFeedback } from "../src/utils/rescheduleNotificationFeedback.js";

test("reschedule feedback separates schedule success from reported mail success", () => {
	const sent = rescheduleNotificationFeedback({ notification: { status: "sent", sent: 2, failed: 0, skipped: 0 } });
	assert.match(sent, /Showtime rescheduled/);
	assert.match(sent, /sent: 2/);
	assert.match(sent, /Inbox delivery is not confirmed/);
	assert.doesNotMatch(sent, /delivered to.*inbox/i);

	const unchanged = rescheduleNotificationFeedback({ notification: { status: "unchanged", sent: 0 } });
	assert.match(unchanged, /Showtime unchanged/);
});

test("reschedule feedback reports skips and uncertainty without inventing counts", () => {
	const skipped = rescheduleNotificationFeedback({ notification: { status: "partial_failure", sent: 0, failed: 0, skipped: 2 } });
	assert.match(skipped, /delivery was incomplete/);
	assert.match(skipped, /skipped: 2/);
	assert.doesNotMatch(skipped, /Failed sends/);

	const failed = rescheduleNotificationFeedback({ notification: { status: "partial_failure", sent: 1, failed: 1, skipped: 0 } });
	assert.match(failed, /Failed sends may have uncertain delivery/);

	const unavailable = rescheduleNotificationFeedback({ notification: { status: "partial_failure" } });
	assert.doesNotMatch(unavailable, /sent:|failed:|skipped:/);
	assert.match(rescheduleNotificationFeedback({ notification: { status: "disabled" } }), /disabled; no send was attempted/);
	assert.match(rescheduleNotificationFeedback({ notification: { status: "no_recipients" } }), /No eligible bookings/);
	assert.match(rescheduleNotificationFeedback({ notification: { status: "failed" } }), /provider accepted an email is unknown/);
	assert.match(rescheduleNotificationFeedback({}), /outcome is unavailable/);
});

test("schedule save displays the returned notification result", () => {
	const page = readFileSync(new URL("../src/pages/admin/ScheduleManagement.jsx", import.meta.url), "utf8");
	assert.match(page, /const result = await apiRequest\(`\/admin\/showtimes\/\$\{editingId\}`/);
	assert.match(page, /setRescheduleFeedback\(rescheduleNotificationFeedback\(result\)\)/);
	assert.match(page, /role="status">\{rescheduleFeedback\}/);
});
