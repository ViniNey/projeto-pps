import { SOCKET_URL } from "./config.js";

export let socket = null;

export function initSocket() {
  socket = io(SOCKET_URL, {
    withCredentials: true,
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
