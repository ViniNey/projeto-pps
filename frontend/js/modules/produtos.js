import { API_URL } from "../core/config.js";
import { fetchComAuth } from "../core/api.js";
import { showError, showSuccess } from "../ui/alerts.js";
import { abrirModal, fecharModal } from "../ui/modais.js";
import { escapeHTML } from "../core/utils.js";

let produtoEditando = null;

export function isEditingProduto() {
  return produtoEditando !== null;
}

export function limparProdutoForm() {
  const fields = [
    "nome",
    "descricao",
    "categoria",
    "preco",
    "imagem",
    "editImagemAtual",
  ];
  fields.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  produtoEditando = null;
  const title = document.getElementById("produtoModalTitle");
  if (title) title.textContent = "Cadastrar Produto";
}

export function atualizarEstadoEstoque() {
  const checkbox = document.getElementById("controlaEstoque");
  const estoqueInput = document.getElementById("estoque");

  if (!checkbox || !estoqueInput) return;

  if (checkbox.checked) {
    estoqueInput.disabled = false;
    estoqueInput.style.opacity = "1";
  } else {
    estoqueInput.disabled = true;
    estoqueInput.style.opacity = "0.5";
    estoqueInput.value = "";
  }
}

export function salvarProdutoModal() {
  if (produtoEditando) {
    salvarEdicao();
  } else {
    adicionarProduto();
  }
}

export async function adicionarProduto() {
  const nome = document.getElementById("nome")?.value;
  const descricao = document.getElementById("descricao")?.value;
  const categoria = document.getElementById("categoria")?.value;
  const precoInput = document.getElementById("preco")?.value;
  const preco = Number(precoInput.replace(",", "."));
  const imagem = document.getElementById("imagem")?.files?.[0];
  const controlaEstoque = document.getElementById("controlaEstoque")?.checked;
  const estoqueInput = document.getElementById("estoque");
  const estoque = Number(estoqueInput?.value || 0);

  if (!nome || !descricao || !categoria || !imagem) {
    return showError("Preencha tudo", "Todos os campos são obrigatórios.");
  }

  if (isNaN(preco)) {
    return showError("Preço inválido", "Use ponto para decimais. Ex: 10.50");
  }

  if (controlaEstoque && (isNaN(estoque) || estoque < 0)) {
    return showError("Estoque inválido", "Informe um estoque válido.");
  }

  try {
    // 1. Converte a imagem para Base64
    const imagemBase64 = await converterParaBase64(imagem);

    // 2. Monta o objeto JSON
    const produtoData = {
      nome: nome,
      descricao: descricao,
      categoria: categoria,
      preco: preco,
      imagemUrl: imagemBase64, // Enviando como texto
      controla_estoque: controlaEstoque,
      estoque: controlaEstoque ? estoque : null
    };

    // 3. Envia como JSON
    await fetchComAuth(`${API_URL}/me/produtos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(produtoData),
    });

    showSuccess("Produto cadastrado!", "");
    fecharModal(null, "modalProduto");
    limparProdutoForm();
    carregarProdutos();
  } catch (err) {
    console.error(err);
    showError("Erro ao cadastrar produto", err.message || "Erro no servidor");
  }
}

export async function carregarProdutos() {
  const lista = document.getElementById("listarPedidos");
  if (!lista) return;

  lista.innerHTML = '<p class="empty-state">Carregando produtos...</p>';

  try {
    const produtos = await fetchComAuth(`${API_URL}/me/produtos`);
    if (!Array.isArray(produtos) || produtos.length === 0) {
      lista.innerHTML = '<p class="empty-state">Nenhum produto cadastrado.</p>';
      return;
    }

    lista.innerHTML = produtos
      .map((produto) => {
        const controlaEstoque = Number(produto.controla_estoque) === 1;
        const estoque = Number(produto.estoque) || 0;
        let estoqueHtml = "";

        if (controlaEstoque) {
          if (estoque === 0) {
            estoqueHtml = `<small style="color:red; font-weight:bold;">Sem estoque</small>`;
          } else if (estoque < 5) {
            estoqueHtml = `<small style="color:red;">Estoque baixo: ${estoque}</small>`;
          } else {
            estoqueHtml = `<small>Estoque: ${estoque}</small>`;
          }
        }

        return `
          <div class="produto-card">
            <div class="produto-meta">
              <strong>${escapeHTML(produto.nome)}</strong>
              <span>R$ ${Number(produto.preco).toFixed(2)}</span>
              <small>${escapeHTML(produto.descricao)}</small>
              ${estoqueHtml}
            </div>
            <div class="acoes">
              <button onclick="editarProduto(${Number(produto.id)})">Editar</button>
              ${controlaEstoque ? `<button onclick="alterarEstoque(${Number(produto.id)}, 1)">+ Estoque</button><button onclick="alterarEstoque(${Number(produto.id)}, -1)">- Estoque</button>` : ""}
              <button onclick="deletarProduto(${Number(produto.id)})">Deletar</button>
            </div>
          </div>
        `;
      })
      .join("");
  } catch (err) {
    console.error("Erro ao carregar produtos:", err);
    lista.innerHTML = '<p class="empty-state">Erro ao carregar produtos.</p>';
  }
}

export function alterarEstoque(id, quantidade) {
  const rota =
    quantidade > 0
      ? `/produtos/${id}/estoque/add`
      : `/produtos/${id}/estoque/remove`;

  fetchComAuth(`${API_URL}${rota}`, {
    method: "PATCH",
    body: JSON.stringify({ quantidade: Math.abs(quantidade) }),
  })
    .then(() => {
      carregarProdutos();
    })
    .catch((err) => {
      console.error(err);
      showError("Erro ao atualizar estoque", err.message || "");
    });
}

export function editarProduto(id) {
  produtoEditando = id;

  fetchComAuth(`${API_URL}/me/produtos`)
    .then((produtos) => {
      const p = produtos.find((x) => x.id === id);
      if (!p) return;

      document.getElementById("nome").value = p.nome || "";
      document.getElementById("descricao").value = p.descricao || "";
      document.getElementById("categoria").value = p.categoria || "";
      document.getElementById("preco").value = p.preco || "";
      if (document.getElementById("editImagemAtual")) {
        document.getElementById("editImagemAtual").value = p.imagem || "";
      }

      const estoqueInput = document.getElementById("estoque");
      const checkbox = document.getElementById("controlaEstoque");
      const controla =
        p.controla_estoque !== undefined ? p.controla_estoque : p.estoque > 0;

      if (checkbox) checkbox.checked = controla;
      if (estoqueInput) {
        estoqueInput.value = p.estoque ?? 0;
        estoqueInput.disabled = !controla;
        estoqueInput.style.opacity = controla ? "1" : "0.5";
      }

      const title = document.getElementById("produtoModalTitle");
      if (title) title.textContent = "Editar Produto";

      abrirModal("produto");
    })
    .catch((err) => {
      console.error("Erro ao buscar produto:", err);
    });
}

export function deletarProduto(id) {
  Swal.fire({
    title: "Tem certeza?",
    text: "Você não poderá desfazer isso!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sim, deletar!",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#3085d6",
    cancelButtonColor: "#d33",
    showLoaderOnConfirm: true,
    preConfirm: async () => {
      try {
        await fetchComAuth(`${API_URL}/produtos/${id}`, {
          method: "DELETE",
        });
      } catch (error) {
        Swal.showValidationMessage("Erro ao deletar o produto");
      }
    },
    allowOutsideClick: () => !Swal.isLoading(),
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: "Deletado!",
        text: "O produto foi removido com sucesso.",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
      carregarProdutos();
    }
  });
}

export function salvarEdicao() {
  const nome = document.getElementById("nome")?.value;
  const descricao = document.getElementById("descricao")?.value;
  const categoria = document.getElementById("categoria")?.value;
  const preco = Number(
    document.getElementById("preco")?.value.replace(",", "."),
  );
  const imagemFile = document.getElementById("imagem")?.files?.[0];
  const controlaEstoque = document.getElementById("controlaEstoque")?.checked;
  const estoque = Number(document.getElementById("estoque")?.value || 0);

  if (!nome || !descricao || !categoria) {
    return showError("Preencha tudo", "Por favor, preencha todos os campos.");
  }

  if (isNaN(preco)) {
    return showError("Preço inválido", "Informe um valor de preço válido.");
  }

  if (controlaEstoque && (isNaN(estoque) || estoque < 0)) {
    return showError("Estoque inválido", "Informe um estoque válido.");
  }

  try {
    const produtoData = {
      nome: nome,
      descricao: descricao,
      categoria: categoria,
      preco: preco,
      controla_estoque: controlaEstoque,
      estoque: controlaEstoque ? estoque : null
    };

    if (imagemFile) {
      produtoData.imagemUrl = await converterParaBase64(imagemFile);
    }

    await fetchComAuth(`${API_URL}/produtos/${produtoEditando}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(produtoData),
    });

    showSuccess("Sucesso!", "Produto atualizado!");
    fecharModal(null, "modalProduto");
    limparProdutoForm();
    carregarProdutos();
  } catch (err) {
    showError("Erro", err.message || "Erro ao editar produto");
  }
}

function converterParaBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}