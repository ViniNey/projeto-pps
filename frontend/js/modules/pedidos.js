import { API_URL } from "../core/config.js";
import { fetchComAuth } from "../core/api.js";
import { showError, showSuccess } from "../ui/alerts.js";
import { escapeHTML } from "../core/utils.js";

export async function carregarPedidos() {
  const lista = document.getElementById("listarPedidos");
  if (!lista) return;

  lista.innerHTML = '<p class="empty-state">Carregando pedidos...</p>';

  try {
    const pedidos = await fetchComAuth(`${API_URL}/admin/pedidos`);
    lista.innerHTML = "";

    if (!Array.isArray(pedidos) || pedidos.length === 0) {
      lista.innerHTML = '<p class="empty-state">Nenhum pedido pendente.</p>';
      return;
    }

    pedidos.forEach((pedido) => {
      const itens =
        typeof pedido.itens === "string"
          ? JSON.parse(pedido.itens)
          : pedido.itens;
      const itensHtml = itens
        .map((item) => `${Number(item.quantidade)}x ${escapeHTML(item.nome)}`)
        .join(", ");
      const data = new Date(pedido.created_at).toLocaleString("pt-BR");

      lista.innerHTML += `
        <div class="produto-card">
          <div class="produto-meta">
            <strong>Pedido #${pedido.id}</strong>
            <span>R$ ${Number(pedido.total).toFixed(2)}</span>
            <small>${pedido.tipo_entrega}${pedido.mesa ? ` - Mesa ${pedido.mesa}` : ""}</small>
            <small>${pedido.forma_pagamento} - ${data}</small>
              <small>Cliente: ${escapeHTML(pedido.nome_cliente) || "---"}</small>
              ${pedido.endereco ? `<small>Endereço: ${escapeHTML(pedido.endereco)}</small>` : ""}
              <small>Itens: ${itensHtml}</small>
          </div>
          <div class="acoes">
              <button onclick="excluirPedido(${Number(pedido.id)})">Excluir</button>
              <button onclick="finalizarPedido(${Number(pedido.id)})">Finalizar</button>
          </div>
        </div>
      `;
    });
  } catch (err) {
    console.error("Erro ao carregar pedidos:", err);
    lista.innerHTML =
      '<p class="empty-state">Falha ao carregar pedidos. Atualize a página ou tente novamente.</p>';
  }
}

export async function carregarHistorico() {
  const lista = document.getElementById("listarPedidos");
  if (!lista) return;

  lista.innerHTML = '<p class="empty-state">Carregando histórico...</p>';

  try {
    const pedidos = await fetchComAuth(`${API_URL}/admin/historico`);
    lista.innerHTML = "";

    if (!Array.isArray(pedidos) || pedidos.length === 0) {
      lista.innerHTML =
        '<p class="empty-state">Nenhum pedido no histórico.</p>';
      return;
    }

    pedidos.forEach((pedido) => {
      const itens =
        typeof pedido.itens === "string"
          ? JSON.parse(pedido.itens)
          : pedido.itens;
      const itensHtml = itens
        .map((item) => `${Number(item.quantidade)}x ${escapeHTML(item.nome)}`)
        .join(", ");
      const data = new Date(pedido.finalizado_at).toLocaleString("pt-BR");

      lista.innerHTML += `
        <div class="produto-card">
          <div class="produto-meta">
            <strong>Pedido #${pedido.id}</strong>
            <span>R$ ${Number(pedido.total).toFixed(2)}</span>
            <small>${pedido.tipo_entrega}${pedido.mesa ? ` - Mesa ${pedido.mesa}` : ""}</small>
            <small>${pedido.forma_pagamento} - ${data}</small>
              <small>Cliente: ${escapeHTML(pedido.nome_cliente) || "---"}</small>
              ${pedido.endereco ? `<small>Endereço: ${escapeHTML(pedido.endereco)}</small>` : ""}
            <small>Itens: ${itensHtml}</small>
          </div>
        </div>
      `;
    });
  } catch (err) {
    console.error("Erro ao carregar histórico:", err);
    lista.innerHTML =
      '<p class="empty-state">Falha ao carregar histórico. Atualize a página ou tente novamente.</p>';
  }
}

export async function carregarPedidosArquivados() {
  const tituloSecao = document.getElementById("tituloSecao");
  const lista = document.getElementById("listarPedidos");

  if (!lista || !tituloSecao) return;

  try {
    lista.innerHTML =
      '<p class="empty-state">Carregando pedidos arquivados...</p>';
    tituloSecao.innerText = "Pedidos Arquivados";
    document.getElementById("card-head-p").innerText =
      "Pedidos antigos arquivados automaticamente.";

    const pedidos = await fetchComAuth(`${API_URL}/admin/pedidos-arquivados`);

    if (!Array.isArray(pedidos) || pedidos.length === 0) {
      lista.innerHTML =
        '<div class="empty-state">Nenhum pedido arquivado encontrado.</div>';
      return;
    }

    lista.innerHTML = pedidos
      .map(
        (pedido) => `
        <div class="pedido-card arquivado">
          <div class="pedido-topo">
            <h3>Pedido #${pedido.pedido_id}</h3>
            <span class="status-arquivado">Arquivado</span>
          </div>
          <div class="pedido-info">
            <p><strong>Cliente:</strong> ${pedido.nome_cliente || "-"}</p>
            <p><strong>Total:</strong> R$ ${Number(pedido.total).toFixed(2)}</p>
            <p><strong>Pagamento:</strong> ${pedido.forma_pagamento || "-"}</p>
            <p><strong>Entrega:</strong> ${pedido.tipo_entrega || "-"}</p>
            <p><strong>Finalizado em:</strong> ${new Date(pedido.finalizado_at).toLocaleString("pt-BR")}</p>
            <p><strong>Arquivado em:</strong> ${new Date(pedido.arquivado_em).toLocaleString("pt-BR")}</p>
          </div>
        </div>
      `,
      )
      .join("");
  } catch (error) {
    console.error(error);
    lista.innerHTML =
      '<p class="empty-state">Erro ao carregar pedidos arquivados</p>';
  }
}

export function mostrarBadgePedidos() {
  const badge = document.getElementById("badgePedidos");
  if (badge) {
    badge.classList.remove("hidden");
  }
}

export function esconderBadgePedidos() {
  const badge = document.getElementById("badgePedidos");
  if (badge) {
    badge.classList.add("hidden");
  }
}

export function finalizarPedido(id) {
  Swal.fire({
    title: "Finalizar pedido?",
    text: "Esse pedido será movido para o histórico.",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Sim, finalizar!",
    cancelButtonText: "Cancelar",
  }).then((result) => {
    if (!result.isConfirmed) return;

    Swal.fire({
      title: "Finalizando...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    fetchComAuth(`${API_URL}/admin/pedidos/${id}/finalizar`, {
      method: "PUT",
    })
      .then(() => {
        showSuccess("Finalizado!", "Pedido concluído com sucesso.");
        carregarPedidos();
      })
      .catch((err) => {
        console.error(err);
        showError("Erro ao finalizar", err.mensagem || "");
      });
  });
}

export function excluirPedido(id) {
  Swal.fire({
    title: "Tem certeza?",
    text: "Esse pedido será removido!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#3085d6",
    cancelButtonColor: "#d33",
    confirmButtonText: "Sim, excluir!",
    cancelButtonText: "Cancelar",
  }).then((result) => {
    if (!result.isConfirmed) return;

    Swal.fire({
      title: "Excluindo...",
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    fetchComAuth(`${API_URL}/admin/pedidos/${id}`, {
      method: "DELETE",
    })
      .then(() => {
        showSuccess("Excluído!", "O pedido foi removido com sucesso.");
        carregarPedidos();
      })
      .catch(() => {
        showError("Erro!", "Não foi possível excluir o pedido.");
      });
  });
}
