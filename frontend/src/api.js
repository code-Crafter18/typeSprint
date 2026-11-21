const API_BASE_URL = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");

export function apiUrl(path) {
  return API_BASE_URL + (path.startsWith("/") ? path : "/" + path);
}

export async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(apiUrl(path), { credentials: "include", ...options });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new Error("Unable to connect to the server. " + error.message);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || "Request failed with status " + response.status);
  }
  if (!data) throw new Error("The server returned an invalid response.");
  return data;
}
