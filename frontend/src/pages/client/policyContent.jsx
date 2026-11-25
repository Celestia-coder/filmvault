// policyContent.jsx
// Text for the Terms & Conditions, Privacy Policy, and Cookie Policy pages.

export const LAST_UPDATED = "November 25, 2026";

export const POLICIES = {
	terms: {
		path: "/terms",
		tab: "Terms & Conditions",
		title: "Terms and Conditions",
		intro: "These Terms and Conditions govern your use of FilmVault, an online movie ticketing platform for FilmVault cinema branches in Taguig City. By creating an account or reserving tickets, you agree to the terms below.",
		sections: [
			{
				id: "accounts",
				title: "Accounts",
				body: [
					"You need a FilmVault account to reserve tickets. Please provide accurate details, including your name, email address, and contact number, and keep your login credentials private.",
				],
				list: [
					"You are responsible for all reservations made using your account.",
					"For your security, your session automatically ends after 15 minutes of inactivity.",
				],
			},
			{
				id: "reservations",
				title: "Ticket Reservations",
				body: [
					"You may browse movies, choose a cinema branch and showtime, and select your seats through the interactive seat map.",
				],
				list: [
					"Each transaction must have a minimum of 1 and a maximum of 8 tickets.",
					"Once a seat is reserved for a showtime, it cannot be selected by another customer.",
					"Food and beverage items may be added to your reservation.",
				],
			},
			{
				id: "seat-holding",
				title: "Seat Holding",
				body: [
					"When you proceed to checkout, your selected seats are held for up to 10 minutes so no one else can book them. If payment is not completed within this time, the seats are released and become available to other customers.",
				],
			},
			{
				id: "pricing",
				title: "Pricing and Booking Fee",
				body: [
					"Ticket prices are shown before you pay. A booking fee of ₱30 is charged per ticket and is added to your total transaction amount. The booking fee is not discounted.",
				],
			},
			{
				id: "discounts",
				title: "Senior Citizen and PWD Discounts",
				body: [
					"Senior Citizens and Persons with Disabilities (PWDs) are entitled to the discount mandated by law and local ordinances of the city where the cinema is located.",
				],
				list: [
					"Select the correct ticket type (Regular, Senior Citizen, or PWD) for each seat.",
					"Upload a valid government-issued or institution-issued ID for every discounted ticket.",
					"If the ID is invalid or missing, the discount will not be applied. You may submit a valid ID or continue at the regular price.",
				],
			},
			{
				id: "free-senior-screenings",
				title: "Free Screenings for Taguig Senior Citizens",
				body: [
					"Senior Citizens who reside in Taguig City can watch for free at all FilmVault branches during the following screenings. Only the first screening of the day is free.",
				],
				list: [
					"Every Monday and Tuesday, first screening only.",
					"Cinema 1: 1:00 PM",
					"Cinema 2: 1:00 PM",
				],
			},
			{
				id: "senior-fees-outside-taguig",
				title: "Booking Fee and Seniors Outside Taguig",
				body: [
					"The booking fee is waived for Taguig Senior Citizens who book a free screening. Please upload a valid Senior Citizen ID showing your Taguig residency, which will be checked at the cinema.",
					"Senior Citizens who live outside Taguig City are not eligible for free screenings. They receive a 20% Senior Citizen discount on their tickets, and the booking fee is not discounted.",
				],
			},
			{
				id: "payment",
				title: "Payment",
				body: [
					"Payments are processed securely through Xendit. Accepted methods include GCash, Maya, credit and debit cards (Visa and Mastercard), and online banking.",
				],
				list: [
					"Your reservation is only confirmed after the payment is successfully completed.",
					"If a payment fails, no seats are reserved and you may try the payment again.",
				],
			},
			{
				id: "confirmation",
				title: "Booking Confirmation",
				body: [
					"After a successful payment, you will receive a confirmation email with your unique booking reference number, QR code, showtime details, and seat assignments. This email serves as your official digital ticket, so no printed ticket is needed.",
				],
			},
			{
				id: "cancellations",
				title: "Cancellations and Rebooking",
				body: [
					"All reservations are final. Customers cannot cancel or rebook tickets once payment is complete.",
					"FilmVault administrators may cancel reservations individually or in bulk during emergencies, such as mall closures, extreme weather (typhoons), or unexpected holidays.",
				],
			},
			{
				id: "movie-information",
				title: "Movie Information",
				body: [
					"Movie details such as the synopsis, genre, duration, cast, and MTRCB age rating are provided for your reference. Showtimes and availability may change without prior notice.",
				],
			},
			{
				id: "proper-use",
				title: "Proper Use",
				body: [
					"You agree not to misuse FilmVault, including entering false information, using another person's ID to claim a discount, or trying to access accounts and features that are not yours. FilmVault may restrict accounts that violate these terms.",
				],
			},
			{
				id: "changes",
				title: "Changes to These Terms",
				body: [
					"FilmVault may update these terms from time to time. Continued use of the platform after an update means you accept the revised terms.",
				],
			},
		],
	},

	privacy: {
		path: "/privacy",
		tab: "Privacy Policy",
		title: "Privacy Policy",
		intro: "This Privacy Policy explains what information FilmVault collects, how it is used, and how it is protected when you use our platform.",
		sections: [
			{
				id: "information-we-collect",
				title: "Information We Collect",
				list: [
					"Account details: name, username, email address, contact number, and password.",
					"Reservation details: booking reference number, movie, cinema branch, showtime, seats, ticket type, payment method, and transaction status.",
					"Discount verification: the ID image you upload for Senior Citizen or PWD tickets.",
				],
			},
			{
				id: "how-we-use",
				title: "How We Use Your Information",
				list: [
					"To manage your account and keep you logged in.",
					"To process and track your reservations.",
					"To verify eligibility for Senior Citizen and PWD discounts.",
					"To send your booking confirmation and digital ticket by email.",
				],
			},
			{
				id: "payments",
				title: "Payment Information",
				body: [
					"Payments are handled by Xendit over a secure connection. FilmVault receives the payment result needed to confirm your reservation.",
				],
			},
			{
				id: "security",
				title: "How We Protect Your Data",
				list: [
					"All pages are served over HTTPS for secure data transmission.",
					"Only authorized users can access reservation and payment features, and administrators have controlled access to management tools.",
					"Inputs are validated to protect the integrity of your data.",
					"Sessions expire after 15 minutes of inactivity.",
				],
			},
			{
				id: "retention",
				title: "Data Backup and Retention",
				body: [
					"FilmVault backs up its database daily, and backups are kept for at least 30 days so data can be recovered in case of loss or errors.",
				],
			},
			{
				id: "sharing",
				title: "Sharing of Information",
				body: [
					"Your information is only used to provide FilmVault services. It is shared with our payment processor only as needed to complete your transaction.",
				],
			},
		],
	},

	cookies: {
		path: "/cookies",
		tab: "Cookie Policy",
		title: "Cookie Policy",
		intro: "FilmVault uses a small amount of browser storage to keep the platform working properly.",
		sections: [
			{
				id: "what-we-store",
				title: "What We Store",
				body: [
					"When you log in, FilmVault saves your session in your browser so you stay signed in as you move between pages, from choosing a movie to completing checkout.",
				],
			},
			{
				id: "why",
				title: "Why We Use It",
				body: [
					"It lets FilmVault recognize your account on each page, so you can view your tickets and profile and complete reservations without logging in again. FilmVault does not use advertising or tracking cookies.",
				],
			},
			{
				id: "managing",
				title: "Managing Your Data",
				body: [
					"Logging out removes your session from the browser. You can also clear your browser data at any time, but you will need to log in again afterward.",
				],
			},
		],
	},
};
