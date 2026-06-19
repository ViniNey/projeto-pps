import { API_URL } from "./core/config.js";
import { verificarLogin, checkRoleRedirect } from "./core/auth.js";
import { fetchComAuth } from "./core/api.js";
import { abrirModal, fecharModal, registerModalHooks } from "./ui/modais.js";
import { setFaturamentoTab } from "./ui/tabs.js";
import { showToast } from "./ui/alerts.js";
import {
  carregarProdutos,
  salvarProdutoModal,
  editarProduto,
  alterarEstoque,
  deletarProduto,
  limparProdutoForm,
  atualizarEstadoEstoque,
  isEditingProduto,
} from "./modules/produtos.js";
import {
  carregarPedidos,
  carregarHistorico,
  carregarPedidosArquivados,
  finalizarPedido,
  excluirPedido,
  mostrarBadgePedidos,
  esconderBadgePedidos,
} from "./modules/pedidos.js";
import { enviarBanner } from "./modules/banner.js";
import {
  carregarEstabelecimento,
  carregarURLLoja,
  carregarDadosEstabelecimento,
  salvarDados,
  copiarURL,
} from "./modules/estabelecimento.js";
import {
  aplicarHorarios,
  marcarFechado,
  salvarHorarios,
  carregarHorarios,
} from "./modules/horarios.js";
import {
  carregarFaturamento,
  carregarFaturamentoTela,
  filtrarFaturamento,
} from "./modules/faturamento.js";
import { exibirFromAjuda } from "./modules/ajuda.js";
import {
  setActiveMenu,
  toggleSidebar,
  closeSidebar,
} from "./modules/sidebar.js";
import { disconnectSocket } from "./core/socket.js";

const somNotificacao = new Audio("../assets/sounds/notificacao.mp3");
let audioLiberado = false;

function habilitarAudio() {
  if (audioLiberado) return;
  audioLiberado = true;
  somNotificacao.load();
}

document.addEventListener("pointerdown", habilitarAudio, { once: true });

document.addEventListener("keydown", habilitarAudio, { once: true });

registerModalHooks({
  beforeOpenProduto: () => {
    if (!isEditingProduto()) {
      limparProdutoForm();
      atualizarEstadoEstoque();
      const title = document.getElementById("produtoModalTitle");
      if (title) title.textContent = "Cadastrar Produto";
    }
  },
});

function handleNovoPedido(pedido) {
  const activeMenu = document.querySelector(".sidebar-link.active")?.dataset
    .menu;

  if (activeMenu === "Pedidos") {
    esconderBadgePedidos();
    carregarPedidos();
    return;
  }

  mostrarBadgePedidos();

  if (audioLiberado) {
    somNotificacao.currentTime = 0;
    somNotificacao.play().catch((err) => {
      console.log("Erro ao tocar som:", err);
    });
  }

  Swal.fire({
    toast: true,
    position: "top-end",
    icon: "info",
    title: "Novo pedido recebido!",
    showConfirmButton: false,
    timer: 3000,
  });
}

function startApp() {
  const activeButton = document.querySelector(".sidebar-link.active");
  if (activeButton) {
    setActiveMenu(activeButton);
  } else {
    carregarPedidos();
  }

  carregarFaturamento();
  carregarURLLoja();
  carregarEstabelecimento();
  carregarDadosEstabelecimento();
}

verificarLogin({
  onReady: startApp,
  onNewOrder: handleNovoPedido,
});

window.onload = () => {
  checkRoleRedirect();
};

window.toggleSidebar = toggleSidebar;
window.setActiveMenu = setActiveMenu;
window.abrirModal = abrirModal;
window.fecharModal = fecharModal;
window.salvarProdutoModal = salvarProdutoModal;
window.alterarEstoque = alterarEstoque;
window.editarProduto = editarProduto;
window.deletarProduto = deletarProduto;
window.finalizarPedido = finalizarPedido;
window.excluirPedido = excluirPedido;
window.enviarBanner = enviarBanner;
window.salvarDados = salvarDados;
window.aplicarHorarios = aplicarHorarios;
window.marcarFechado = marcarFechado;
window.salvarHorarios = salvarHorarios;
window.carregarHorarios = carregarHorarios;
window.copiarURL = copiarURL;
window.logout = logout;
window.setFaturamentoTab = setFaturamentoTab;
window.filtrarFaturamento = filtrarFaturamento;
window.exibirFromAjuda = exibirFromAjuda;
window.closeSidebar = closeSidebar;
window.carregarPedidosArquivados = carregarPedidosArquivados;
window.mostrarBadgePedidos = mostrarBadgePedidos;
window.esconderBadgePedidos = esconderBadgePedidos;

function logout() {
  Swal.fire({
    title: "Sair do sistema?",
    text: "Você precisará fazer login novamente.",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Sim, sair",
    cancelButtonText: "Cancelar",
  }).then(async (result) => {
    if (!result.isConfirmed) return;

    Swal.fire({
      title: "Saindo...",
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      await fetchComAuth(`${API_URL}/admin/logout`, {
        method: "POST",
      });
    } catch (err) {
      console.error("Erro ao fazer logout:", err);
    }

    disconnectSocket();
    localStorage.clear();
    window.location.replace("login.html");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const checkbox = document.getElementById("controlaEstoque");
  const estoqueInput = document.getElementById("estoque");

  if (!checkbox) return;

  checkbox.addEventListener("change", () => {
    atualizarEstadoEstoque();

    if (!estoqueInput) return;

    if (checkbox.checked) {
      estoqueInput.disabled = false;
      estoqueInput.style.opacity = "1";
    } else {
      estoqueInput.disabled = true;
      estoqueInput.style.opacity = "0.5";
      estoqueInput.value = "";
    }
  });
});
