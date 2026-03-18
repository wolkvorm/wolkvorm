// Centralized API configuration.
// In development: REACT_APP_API_URL=http://localhost:8080
// In production: empty (relative URLs, nginx proxies /api to backend)
const API = process.env.REACT_APP_API_URL || "";
const WS_API = API ? API.replace("http", "ws") : `ws://${window.location.host}`;

// Get the stored auth token.
function getToken() {
  return localStorage.getItem("tf_token");
}

// Set the auth token in localStorage.
function setToken(token) {
  if (token) {
    localStorage.setItem("tf_token", token);
  } else {
    localStorage.removeItem("tf_token");
  }
}

// Authenticated fetch wrapper.
// Automatically adds Authorization header and handles 401 responses.
async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (!headers["Content-Type"] && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    // Token expired or invalid — redirect to login
    localStorage.removeItem("tf_token");
    localStorage.removeItem("tf_user");
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  }

  return res;
}

export { API, WS_API, getToken, setToken, authFetch };
