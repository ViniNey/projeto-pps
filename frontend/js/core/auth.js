import { API_URL } from "./config.js";
import { fetchComAuth } from "./api.js";
import { initSocket } from "./socket.js";

export async function verificarLogin({ onReady, onNewOrder }) {
  try {
    await fetchComAuth(`${API_URL}/admin/check-token`);

    const socket = initSocket();
    socket.off("novoPedido");

    if (typeof onNewOrder === "function") {
      socket.on("novoPedido", onNewOrder);
    }

    if (typeof onReady === "function") {
      onReady();
    }
  } catch {
    localStorage.clear();
    window.location.href = "login.html";
  }
}

export function checkRoleRedirect() {
  const role = localStorage.getItem("role");
  if (role === "superadmin") {
    window.location.href = "superadmin.html";
  }
}
