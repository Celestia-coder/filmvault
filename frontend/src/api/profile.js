const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function request(path, options = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || "Something went wrong.");
    err.status = res.status;
    err.errors = data.errors || {};
    throw err;
  }
  return data;
}

export const fetchProfile = () => request("/profile");

// Sends multipart so the avatar file can ride along with the text fields
export function updateProfile({ form, passwords, avatarFile }) {
  const body = new FormData();
  body.append("firstName", form.firstName);
  body.append("lastName", form.lastName);
  body.append("email", form.email);
  body.append("phone", form.phone);
  body.append("username", form.username);

  if (passwords.next) {
    body.append("currentPassword", passwords.current);
    body.append("newPassword", passwords.next);
  }
  if (avatarFile) body.append("avatar", avatarFile);

  return request("/profile", { method: "PUT", body }); // browser sets the multipart boundary
}