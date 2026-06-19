import { getCookie } from "./utils.js";
import { mostrarLoading, esconderLoading } from "../ui/loading.js";
import { disconnectSocket } from "./socket.js";

export async function fetchComAuth(url, options = {}) {
  mostrarLoading();

  try {
    const isFormData = options.body instanceof FormData;

    const headers = {
      ...options.headers,
      "x-csrf-token": getCookie("csrf-token"),
    };

    if (!isFormData) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });

    if (response.status === 401) {
      localStorage.clear();
      disconnectSocket();
      window.location.replace("login.html");
      throw new Error("Não autorizado");
    }

    const contentType = response.headers.get("content-type");
    let data = {};

    if (contentType?.includes("application/json")) {
      data = await response.json();
    }

    if (!response.ok) {
      throw new Error(
        data?.mensagem || data?.erro || "Erro ao processar requisição",
      );
    }

    return data;
  } finally {
    esconderLoading();
  }
}
