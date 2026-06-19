import {
  carregarPedidos,
  carregarHistorico,
  carregarPedidosArquivados,
  mostrarBadgePedidos,
  esconderBadgePedidos,
} from "./pedidos.js";
import { carregarProdutos } from "./produtos.js";
import { carregarFaturamentoTela } from "./faturamento.js";
import { exibirFromAjuda } from "./ajuda.js";

let telaAtiva = "pedidos";

export function getTelaAtiva() {
  return telaAtiva;
}

export function toggleSidebar() {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;
  sidebar.classList.toggle("active");
}

export function closeSidebar() {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;
  sidebar.classList.remove("active");
}

export function setActiveMenu(button) {
  if (!button) return;

  document.querySelectorAll(".sidebar-link").forEach((el) => {
    el.classList.remove("active");
  });

  button.classList.add("active");
  const menu = button.dataset.menu;
  const descricao = document.querySelector(".card-head p");
  const titulo = document.getElementById("tituloSecao");

  if (menu === "Pedidos") {
    telaAtiva = "pedidos";
    esconderBadgePedidos();
    if (titulo) titulo.textContent = "Pedidos pendentes";
    carregarPedidos();
  }

  if (menu === "Produtos") {
    telaAtiva = "produtos";
    if (titulo) {
      titulo.textContent = "Produtos";
      if (descricao)
        descricao.textContent = "Gerencie os produtos do seu cardápio";
    }
    carregarProdutos();
  }

  if (menu === "Histórico") {
    telaAtiva = "historico";
    if (titulo) {
      titulo.textContent = "Histórico";
      if (descricao) descricao.textContent = "Gerencie seu histórico";
    }
    carregarHistorico();
  }

  if (menu === "Pedidos Arquivados") {
    telaAtiva = "pedidosArquivados";
    carregarPedidosArquivados();
  }

  if (menu === "Faturamento") {
    telaAtiva = "faturamento";
    if (titulo) {
      titulo.textContent = "Faturamento";
      if (descricao)
        descricao.textContent = "Visualize o desempenho financeiro da sua loja";
    }
    carregarFaturamentoTela();
  }

  if (menu === "Ajuda") {
    telaAtiva = "ajuda";
    if (titulo) {
      titulo.textContent = "Ajuda";
      if (descricao)
        descricao.textContent =
          "Entre em contato com o suporte e nos explique seu problema!";
    }
    exibirFromAjuda();
  }

  closeSidebar();
}
