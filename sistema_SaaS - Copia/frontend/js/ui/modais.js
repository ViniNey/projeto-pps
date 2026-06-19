let modalHooks = {};

export function registerModalHooks(hooks) {
  modalHooks = hooks || {};
}

export function abrirModal(modalName) {
  if (modalName === "produto" && typeof modalHooks.beforeOpenProduto === "function") {
    modalHooks.beforeOpenProduto();
  }

  const modal = document.getElementById(
    `modal${modalName.charAt(0).toUpperCase() + modalName.slice(1)}`,
  );
  if (modal) {
    modal.classList.add("active");
  }
}

export function fecharModal(event, modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  if (event && event.target !== modal) return;
  modal.classList.remove("active");

  if (modalId === "modalProduto" && typeof modalHooks.afterCloseProduto === "function") {
    modalHooks.afterCloseProduto();
  }
}
