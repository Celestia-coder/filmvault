// utils/verifyQr.js
// Reads the QR code on an uploaded e-ticket (FilmVault PDF or a QR image) in the browser
// and turns it into the /verify/:token token. The file never leaves the admin's device.
// pdfjs-dist and jsqr are loaded only when needed, like html2canvas/jspdf in ticket.js.

export class QrError extends Error {}

// "pdf" | "image" | null. Falls back to the extension when the browser leaves file.type empty.
export function fileKind(file) {
	if (file.type === "application/pdf") return "pdf";
	if (file.type === "image/png" || file.type === "image/jpeg") return "image";
	if (file.type) return null;
	if (/\.pdf$/i.test(file.name)) return "pdf";
	if (/\.(png|jpe?g)$/i.test(file.name)) return "image";
	return null;
}

// Same 32-hex token the backend accepts. "/+" tolerates a VITE_PUBLIC_URL with a trailing slash.
const VERIFY_PATH = /^\/+verify\/([0-9a-f]{32})\/?$/i;

// Token from the decoded QR text. `origins` = the origins FilmVault QR codes are issued from.
export function verifyTokenFromUrl(text, origins) {
	let url;
	try {
		url = new URL(text);
	} catch {
		throw new QrError("This QR code isn't a FilmVault ticket.");
	}
	if (!origins.includes(url.origin)) throw new QrError("This QR code isn't a FilmVault ticket.");
	const match = url.pathname.match(VERIFY_PATH);
	if (!match) throw new QrError("This QR code has a malformed verification link.");
	return match[1].toLowerCase();
}

const MAX_SIDE = 2000; // phone photos can be 12MP+; jsQR doesn't need that and gets slow

async function imageCanvas(file) {
	let bitmap;
	try {
		bitmap = await createImageBitmap(file);
	} catch {
		throw new QrError("This image can't be read. Upload a PNG or JPG file.");
	}
	const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
	const canvas = document.createElement("canvas");
	canvas.width = Math.round(bitmap.width * scale);
	canvas.height = Math.round(bitmap.height * scale);
	canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	bitmap.close();
	return canvas;
}

async function pdfCanvas(file) {
	const [pdfjs, { default: workerSrc }] = await Promise.all([
		import("pdfjs-dist"),
		import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
	]);
	pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
	const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
	try {
		const pdf = await task.promise;
		const page = await pdf.getPage(1); // the FilmVault e-ticket is one page
		const viewport = page.getViewport({ scale: 3 }); // ~216 dpi: the QR comes out ~230px
		const canvas = document.createElement("canvas");
		canvas.width = Math.floor(viewport.width);
		canvas.height = Math.floor(viewport.height);
		await page.render({ canvas, viewport }).promise;
		return canvas;
	} catch {
		throw new QrError("This PDF can't be opened. Make sure it's the FilmVault e-ticket PDF.");
	} finally {
		task.destroy(); // frees the worker and the document
	}
}

// Text inside the file's QR code. Throws QrError with a message for the admin.
export async function readTicketQr(file) {
	const canvas = fileKind(file) === "pdf" ? await pdfCanvas(file) : await imageCanvas(file);
	const { default: jsQR } = await import("jsqr");
	const { width, height } = canvas;
	const code = jsQR(canvas.getContext("2d").getImageData(0, 0, width, height).data, width, height);
	if (!code?.data) {
		throw new QrError("No readable QR code was found. Upload a clearer image or the original e-ticket PDF.");
	}
	return code.data;
}
