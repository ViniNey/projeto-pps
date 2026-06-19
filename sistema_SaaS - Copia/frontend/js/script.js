const API_URL = "http://localhost:3000/api";

let horariosEstabelecimento = null;
let establishmentId = null;
let pedidoEnviado = false;
let carregou = false;
let produtosGlobais = [];

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function mostrarTituloEstabelecimento(establishmentId) {
  if (!establishmentId) {
    return;
  }

  fetch(`${API_URL}/estabelecimentos/${establishmentId}`)
    .then((res) => {
      if (!res.ok) {
        throw new Error("Estabelecimento não encontrado");
      }
      return res.json();
    })
    .then((estabelecimento) => {
      const titleEl = document.getElementById("establishment-title");
      if (titleEl) {
        titleEl.textContent = estabelecimento.nome;
      }
    })
    .catch(() => {
      const titleEl = document.getElementById("establishment-title");
      if (titleEl) {
        titleEl.textContent = "Cardápio";
      }
    });
}

function mostrarToast(mensagem, tipo = "sucesso") {
  const toast = document.getElementById("toast");
  if (!toast) return;

  const title = toast.querySelector(".toast-title");
  const message = toast.querySelector(".toast-message");
  const icon = toast.querySelector(".toast-icon i");
  const progress = toast.querySelector(".toast-progress");

  toast.classList.remove("erro");

  title.textContent = tipo === "erro" ? "Erro" : "Sucesso";
  message.textContent = mensagem;

  if (tipo === "erro") {
    toast.classList.add("erro");
    icon.className = "fas fa-times";
  } else {
    icon.className = "fas fa-check";
  }

  progress.style.animation = "none";
  progress.offsetHeight;
  progress.style.animation = null;

  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}

function mostrarToastSucesso(msg) {
  mostrarToast(msg, "sucesso");
}

async function carregarProdutos() {
  if (carregou) return;
  carregou = true;

  const container = document.getElementById("lista-produtos");
  const establishmentSlug = getQueryParam("estab");

  if (!establishmentSlug) {
    alert("Estabelecimento não informado ❌");
    return;
  }

  container.innerHTML =
    "<p style='text-align:center'>Carregando produtos...</p>";

  try {
    const resEstab = await fetch(
      `${API_URL}/estabelecimentos?slug=${encodeURIComponent(establishmentSlug)}`,
    );

    if (!resEstab.ok) throw new Error("Estabelecimento não encontrado");

    const estabelecimento = await resEstab.json();

    horariosEstabelecimento = estabelecimento.horarios;

    verificarStatusLoja();
    setInterval(verificarStatusLoja, 60000);

    const bannerEl = document.getElementById("banner-estabelecimento");

    if (bannerEl) {
      const banner = estabelecimento.banner;

      bannerEl.src = banner
        ? banner.startsWith("http")
          ? banner
          : `${API_URL}/uploads/${banner}`
        : "galery/banner-padrao.png";
    }

    const logoEl = document.getElementById("logo-estabelecimento");
    const logoCopy = document.querySelector(".marquee-copy");

    if (logoEl) logoEl.textContent = estabelecimento.nome;
    if (logoCopy) logoCopy.textContent = estabelecimento.nome;

    const titleEl = document.getElementById("establishment-title");
    if (titleEl) titleEl.textContent = estabelecimento.nome;

    atualizarFooterComEstabelecimento(estabelecimento);

    const url = `${API_URL}/produtos?slug=${encodeURIComponent(establishmentSlug)}`;

    const res = await fetch(url);

    if (!res.ok) throw new Error("Erro ao buscar produtos");

    const produtos = await res.json();
    produtosGlobais = produtos;

    const produtosPorCategoria = {};

    produtos.forEach((produto) => {
      const categoria = produto.categoria || "Outros";

      if (!produtosPorCategoria[categoria]) {
        produtosPorCategoria[categoria] = [];
      }

      produtosPorCategoria[categoria].push(produto);
    });

    container.innerHTML = "";

    const grid = document.createElement("div");
    grid.classList.add("card-grid");

    Object.keys(produtosPorCategoria).forEach((categoria) => {
      const categoriaBox = document.createElement("div");
      categoriaBox.classList.add("categoria-box");

      const header = document.createElement("div");
      header.classList.add("categoria-header");

      const icon = document.createElement("span");
      icon.classList.add("categoria-icon");
      icon.textContent = getIcon(categoria);

      const titulo = document.createElement("h2");
      titulo.textContent = categoria;

      header.appendChild(icon);
      header.appendChild(titulo);

      const linha = document.createElement("div");
      linha.classList.add("categoria-linha");

      const gridCategoria = document.createElement("div");
      gridCategoria.classList.add("card-grid");

      categoriaBox.appendChild(header);
      categoriaBox.appendChild(linha);
      categoriaBox.appendChild(gridCategoria);

      container.appendChild(categoriaBox);

      produtosPorCategoria[categoria].forEach((produto) => {
        const card = document.createElement("div");
        card.classList.add("card");

        const semEstoque = produto.esgotado;

        const img = document.createElement("img");
        img.src = produto.imagem;
        img.classList.add("card-img");

        const content = document.createElement("div");
        content.classList.add("card-content");

        const titulo = document.createElement("h3");
        titulo.textContent = produto.nome;
        titulo.classList.add("card-title");

        const desc = document.createElement("p");
        desc.textContent = produto.descricao;
        desc.classList.add("card-desc");

        const preco = document.createElement("span");
        preco.textContent = `R$ ${Number(produto.preco).toFixed(2)}`;
        preco.classList.add("card-preco");

        const estoque = document.createElement("small");
        estoque.classList.add("estoque-texto");
        estoque.dataset.id = produto.id;

        const estoqueReal = calcularEstoqueDisponivel(produto);

        if (Number(produto.controla_estoque) === 1) {
          estoque.textContent = semEstoque
            ? "Esgotado"
            : `Estoque: ${estoqueReal}`;
          content.appendChild(estoque);
        }

        const btn = document.createElement("button");
        btn.classList.add("btn-adicionar");

        if (semEstoque) {
          btn.textContent = "Esgotado";
          btn.disabled = true;
          btn.style.opacity = "0.6";
          btn.style.cursor = "not-allowed";
        } else {
          btn.textContent = "Adicionar";
          btn.onclick = () => adicionarItem(produto);
        }

        content.appendChild(titulo);
        content.appendChild(desc);
        content.appendChild(preco);
        content.appendChild(estoque);
        content.appendChild(btn);

        card.appendChild(img);
        card.appendChild(content);
        gridCategoria.appendChild(card);
      });
    });

    container.appendChild(grid);
  } catch (erro) {
    console.error(erro);

    container.innerHTML = `
      <p style="text-align:center; color:red;">
        Estabelecimento não encontrado 😢
      </p>
    `;
  }
}

function atualizarEstoqueVisual() {
  document.querySelectorAll(".estoque-texto").forEach((el) => {
    const produtoId = Number(el.dataset.id);

    const produto = produtosGlobais.find((p) => p.id === produtoId);
    if (!produto) return;

    const btn = el.parentElement.querySelector(".btn-adicionar");

    if (Number(produto.controla_estoque) !== 1) {
      el.textContent = ""; // ou nem mostra nada
      if (btn) {
        btn.textContent = "Adicionar";
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
      }
      return;
    }

    const estoqueAtual = calcularEstoqueDisponivel(produto);

    if (estoqueAtual <= 0) {
      el.textContent = "Esgotado";

      if (btn) {
        btn.textContent = "Esgotado";
        btn.disabled = true;
        btn.style.opacity = "0.6";
        btn.style.cursor = "not-allowed";
      }
    } else {
      el.textContent = `Estoque: ${estoqueAtual}`;

      if (btn) {
        btn.textContent = "Adicionar";
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
      }
    }
  });
}

function getIcon(categoria) {
  switch (categoria.toLowerCase()) {
    case "bebida":
    case "bebidas":
      return "🍹";
    case "lanche":
    case "lanches":
      return "🍔";
    case "porções":
      return "🍟";
    case "sobremesa":
      return "🍰";
    default:
      return "🍽️";
  }
}

carregarProdutos();

function focarCategoria(categoria) {
  document.querySelectorAll(".menu-tab").forEach((tab) => {
    if (tab.textContent.trim() === categoria) {
      tab.classList.add("active");
    } else {
      tab.classList.remove("active");
    }
  });

  if (categoria === "Ajuda") {
    const contatos = document.getElementById("contatos");
    if (contatos) {
      contatos.scrollIntoView({ behavior: "smooth" });
    }
    document.querySelectorAll(".card").forEach((card) => {
      card.style.display = "";
    });
    return;
  }

  document.querySelectorAll(".card").forEach((card) => {
    const categoriaCard = card.dataset.categoria || "Todos";
    card.style.display =
      categoria === "Todos" || categoriaCard === categoria ? "" : "none";
  });

  const tabs = document.getElementById("menuTabs");
  const toggle = document.getElementById("categoryToggle");
  if (window.innerWidth <= 650 && tabs && toggle) {
    tabs.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  }
}

function fecharMenuCategorias() {
  const menu = document.getElementById("menuTabs");
  const toggle = document.getElementById("categoryToggle");
  if (!menu || !toggle) return;
  menu.classList.remove("open");
  toggle.setAttribute("aria-expanded", "false");
}

function toggleCategoryMenu() {
  const menu = document.getElementById("menuTabs");
  const toggle = document.getElementById("categoryToggle");
  if (!menu || !toggle) return;

  const open = menu.classList.toggle("open");
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
}

function toggleMenu() {
  const nav = document.getElementById("navLinks");
  if (nav) nav.classList.toggle("active");
}

document.getElementById("ano").textContent = new Date().getFullYear();

//lojaAberta = true; manter a loja aberta para teste!, = false; funciona no horario
let modoTeste = false;
let lojaAberta = true;

function verificarStatusLoja() {
  const statusEl = document.getElementById("status-loja");

  if (!statusEl) return;

  if (!horariosEstabelecimento) return;

  const agora = new Date();

  const dias = [
    "domingo",
    "segunda",
    "terca",
    "quarta",
    "quinta",
    "sexta",
    "sabado",
  ];

  const diaAtual = dias[agora.getDay()];
  const horaAtual = agora.getHours();
  const minutoAtual = agora.getMinutes();

  const horarioHoje = horariosEstabelecimento[diaAtual];

  if (!horarioHoje) {
    lojaAberta = false;
    statusEl.textContent = " Fechado hoje";
    statusEl.classList.add("fechada");
    return;
  }

  const [hA, mA] = horarioHoje.abertura.split(":");
  const [hF, mF] = horarioHoje.fechamento.split(":");

  const abertura = Number(hA) * 60 + Number(mA);
  const fechamento = Number(hF) * 60 + Number(mF);
  const agoraMin = horaAtual * 60 + minutoAtual;

  lojaAberta = agoraMin >= abertura && agoraMin < fechamento;

  if (modoTeste) {
    statusEl.textContent = " Loja Aberta (modo teste)";
    statusEl.classList.remove("fechada");
    lojaAberta = true;
    return;
  }

  if (lojaAberta) {
    statusEl.textContent = "Loja Aberta";
    statusEl.classList.remove("fechada");
  } else {
    statusEl.textContent = "Loja Fechada";
    statusEl.classList.add("fechada");
  }
}

let pedido = [];

function atualizarBotaoFinalizar() {
  const btnFinalizar = document.getElementById("btn-finalizar");
  const btnVerPedido = document.getElementById("btn-ver-pedido");
  const botoesCarrinho = document.querySelectorAll(".btn-ver-pedido");
  const contadorCarrinho = document.getElementById("contador-carrinho");

  const temPedido = pedido.length > 0;
  const quantidadeTotal = pedido.reduce(
    (total, item) => total + item.quantidade,
    0,
  );

  if (btnFinalizar) {
    btnFinalizar.style.display = temPedido ? "block" : "none";
  }

  if (btnVerPedido) {
    btnVerPedido.style.display = temPedido ? "inline-flex" : "none";
  }

  botoesCarrinho.forEach((btn) => {
    btn.style.display = temPedido ? "block" : "none";
  });

  if (contadorCarrinho) {
    contadorCarrinho.textContent = quantidadeTotal;
    contadorCarrinho.style.display = temPedido ? "inline-block" : "none";
  }

  const categoryToggle = document.getElementById("categoryToggle");
  if (categoryToggle) {
    if (temPedido && window.innerWidth <= 650) {
      categoryToggle.style.display = "none";
    } else {
      categoryToggle.style.display = "";
    }
  }
}

function adicionarItem(produto) {
  if (!lojaAberta) {
    Swal.fire({
      icon: "info",
      title: "Loja Fechada 🕒",
      text: "Estamos fechados no momento.",
      confirmButtonText: "Ok",
      confirmButtonColor: "#d33",
    });
    return;
  }

  const itemExistente = pedido.find((p) => p.id === produto.id);

  if (itemExistente) {
    itemExistente.quantidade++;
  } else {
    pedido.push({
      id: produto.id,
      nome: produto.nome,
      preco: Number(produto.preco),
      quantidade: 1,
    });
  }

  mostrarToast(`${produto.nome} adicionado ao pedido!`);
  atualizarEstoqueVisual();
  fecharMenuCategorias();
  atualizarBotaoFinalizar();
  atualizarBotaoFinalizar();
  atualizarTotalPagamento();
}

function finalizarPedido() {
  if (pedido.length === 0) {
    mostrarToast("Nenhum item no pedido!", "erro");
    return;
  }

  // abre modal de pagamento primeiro
  document.getElementById("modalPagamento").style.display = "flex";
}

let formaPagamento = "";

function selecionarPagamento(tipo) {
  formaPagamento = tipo;

  document.getElementById("modalPagamento").style.display = "none";

  // abre o próximo modal (dados do cliente)
  document.getElementById("modalConfirmacao").style.display = "flex";

  esconderBusca();

  const btnPedido = document.getElementById("btn-ver-pedido");
  if (btnPedido) btnPedido.style.display = "none";
}

function mostrarToastErro(msg) {
  mostrarToast(msg, "erro");
}

function enviarPedido(tipoEntrega) {
  if (pedidoEnviado) return;

  pedidoEnviado = true;

  const nomeCliente = document.getElementById("inputNomeCliente").value.trim();
  const mesa = document.getElementById("inputMesa").value.trim();
  const endereco = document.getElementById("inputEndereco").value.trim();
  const establishmentSlug = getQueryParam("estab");

  if (!nomeCliente) {
    mostrarToast("Digite o nome do cliente.", "erro");
    pedidoEnviado = false;
    return;
  }

  if (!formaPagamento) {
    mostrarToast("Selecione a forma de pagamento.", "erro");
    pedidoEnviado = false;
    return;
  }

  if (tipoEntrega === "Mesa" && !mesa) {
    mostrarToast("Informe o número da mesa.", "erro");
    pedidoEnviado = false;
    return;
  }

  if (tipoEntrega === "Entrega" && !endereco) {
    mostrarToast("Informe o endereço de entrega.", "erro");
    pedidoEnviado = false;
    return;
  }

  fetch(`${API_URL}/pedidos/salvar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      slug: establishmentSlug,
      itens: pedido,
      forma_pagamento: formaPagamento,
      tipo_entrega: tipoEntrega,
      mesa: tipoEntrega === "Mesa" ? mesa : null,
      nome_cliente: nomeCliente,
      endereco: tipoEntrega === "Entrega" ? endereco : null,
    }),
  })
    .then((res) => {
      if (!res.ok) throw new Error("Erro ao salvar pedido");
      return res.json();
    })
    .then(() => {
      // ✅ sucesso
      mostrarToastSucesso("Pedido enviado com sucesso!");

      pedido = [];
      atualizarListaPedido();
      atualizarBotaoFinalizar();

      document.getElementById("modalConfirmacao").style.display = "none";
      document.getElementById("modalPedido").style.display = "none";

      pedidoEnviado = false;
    })
    .catch((err) => {
      console.error(err);
      mostrarToast("Erro ao enviar pedido!", "erro");

      pedidoEnviado = false;
    });
}

function closeToast() {
  const toast = document.getElementById("toast");
  toast.classList.remove("show");
}

function esconderBusca() {
  const busca = document.getElementById("buscaContainer");
  if (busca) busca.style.display = "none";
}
function mostrarBusca() {
  const busca = document.getElementById("buscaContainer");
  if (busca) busca.style.display = "block";
}

function abrirModalPedido() {
  if (pedido.length === 0) {
    return;
  }

  atualizarListaPedido();
  atualizarTotalPagamento();
  document.getElementById("modalPedido").style.display = "flex";
  esconderBusca();
}

function fecharModalPedido() {
  document.getElementById("modalPedido").style.display = "none";
}

function fecharModalMesa() {
  const modal = document.getElementById("modalConfirmacao");
  if (modal) modal.style.display = "none";
  atualizarBotaoFinalizar();
}

function fecharModalPagamento() {
  document.getElementById("modalPagamento").style.display = "none";
  atualizarBotaoFinalizar();
}

function atualizarListaPedido() {
  const lista = document.getElementById("listaPedido");
  lista.innerHTML = "";

  let total = 0;

  pedido.forEach((item, index) => {
    const li = document.createElement("li");

    const subtotal = item.subtotal || 0;

    li.textContent = `${item.nome || "Produto"} x${item.quantidade}`;

    const btnRemover = document.createElement("button");
    btnRemover.textContent = "-";
    btnRemover.classList.add("btn-remover");

    btnRemover.onclick = () => {
      if (item.quantidade > 1) {
        item.quantidade--;
      } else {
        pedido.splice(index, 1);
      }

      atualizarListaPedido();
      atualizarBotaoFinalizar();
      atualizarEstoqueVisual();
    };

    li.appendChild(btnRemover);
    lista.appendChild(li);
  });

  const totalPedidoModal = document.getElementById("totalPedidoModal");

  if (totalPedidoModal) {
    totalPedidoModal.textContent =
      pedido.length > 0 ? "Total calculado no servidor" : "";
  }
}

function calcularEstoqueDisponivel(produto) {
  if (Number(produto.controla_estoque) !== 1) {
    return null;
  }
  const itemCarrinho = pedido.find((p) => p.id === produto.id);

  const quantidadeNoCarrinho = itemCarrinho ? itemCarrinho.quantidade : 0;

  return (
    (produto.estoque || 0) -
    (produto.estoque_reservado || 0) -
    quantidadeNoCarrinho
  );
}

function calcularTotalPedido() {
  return pedido.reduce((total, item) => {
    const produto = item.preco || 0;
    return total + produto * item.quantidade;
  }, 0);
}

function atualizarTotalPagamento() {
  const total = calcularTotalPedido();

  const span = document.getElementById("totalPagamento");

  if (span) {
    span.textContent = total.toFixed(2).replace(".", ",");
  }
}

function removerAcentos(texto) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function filtrarCardapio() {
  const campo = document.getElementById("campoBusca");
  const busca = removerAcentos(campo.value.toLowerCase());

  const buscaContainer = document.getElementById("buscaContainer");

  if (busca.length > 0) {
    buscaContainer.classList.add("active");
    esconderBanner();
    esconderFooter();
  } else {
    buscaContainer.classList.remove("active");
    mostrarBanner();
    mostrarFooter();
  }

  let algumCardVisivel = false;
  document.querySelectorAll(".card-grid").forEach((grid) => {
    let algumVisivel = false;
    grid.querySelectorAll(".card").forEach((card) => {
      const titulo = removerAcentos(
        card.querySelector(".card-title")?.textContent.toLowerCase() || "",
      );
      const desc = removerAcentos(
        card.querySelector(".card-desc")?.textContent.toLowerCase() || "",
      );

      if (titulo.includes(busca) || desc.includes(busca)) {
        card.style.display = "";
        algumVisivel = true;
        algumCardVisivel = true;
      } else {
        card.style.display = "none";
      }
    });

    const tituloSecao = grid.previousElementSibling;
    if (tituloSecao && tituloSecao.tagName === "H2") {
      tituloSecao.style.display = algumVisivel ? "" : "none";
    }
  });

  let msgGlobal = document.getElementById("msg-nao-encontrado-global");
  if (!algumCardVisivel) {
    if (!msgGlobal) {
      msgGlobal = document.createElement("div");
      msgGlobal.id = "msg-nao-encontrado-global";
      msgGlobal.className = "msg-nao-encontrado";
      msgGlobal.textContent = "Esse item não existe no cardápio.";
      msgGlobal.style.color = "red";
      msgGlobal.style.textAlign = "center";
      msgGlobal.style.margin = "32px 0";
      const cardapio = document.getElementById("cardapio");
      cardapio.appendChild(msgGlobal);
    }
  } else if (msgGlobal) {
    msgGlobal.remove();
  }
}

let lastScrollTop = 0;
const navbar = document.querySelector(".navbar");
const buscaContainer = document.getElementById("buscaContainer");

window.addEventListener("scroll", function () {
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  if (navbar) {
    navbar.style.transform =
      scrollTop > lastScrollTop ? "translateY(-100%)" : "translateY(0)";
  }
  if (buscaContainer) {
    buscaContainer.style.transform =
      scrollTop > lastScrollTop ? "translateY(-100%)" : "translateY(0)";
  }
  lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
});

function esconderBanner() {
  const header = document.querySelector(".header");
  const logo = document.getElementById("logo-estabelecimento");
  const status = document.getElementById("status-loja");

  if (header) header.style.display = "none";
  if (logo) logo.style.display = "none";
  if (status) status.style.display = "none";
}

function mostrarBanner() {
  const header = document.querySelector(".header");
  const logo = document.getElementById("logo-estabelecimento");
  const status = document.getElementById("status-loja");

  if (header) header.style.display = "";
  if (logo) logo.style.display = "";
  if (status) status.style.display = "";
}

function esconderFooter() {
  const footer = document.querySelector("footer");
  if (footer) footer.style.display = "none";
}

function mostrarFooter() {
  const footer = document.querySelector("footer");
  if (footer) footer.style.display = "";
}

const quantidades = {};

const btnScrool = document.getElementById("btnScrool");
let lastScrollTopBtn = 0;

window.addEventListener("scroll", function () {
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

  if (btnScrool) {
    if (scrollTop > 300 && scrollTop < lastScrollTopBtn) {
      btnScrool.classList.add("visible");
    } else {
      btnScrool.classList.remove("visible");
    }
  }

  lastScrollTopBtn = scrollTop;
});

if (btnScrool) {
  btnScrool.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const linkWhats = document.getElementById("link-whatsapp");
  const disabledMsg =
    "Como o modo teste está ativado, esses links estão desativados.";

  function handleFooterLinkClick(e, url) {
    if (modoTeste) {
      e.preventDefault();
      mostrarToast(disabledMsg);
      return;
    }

    if (!url || url === "#") {
      e.preventDefault();
      mostrarToast("Contato via WhatsApp indisponível no momento.", "erro");
      return;
    }

    window.open(url, "_blank");
    e.preventDefault();
  }

  if (linkWhats) {
    linkWhats.addEventListener("click", (e) =>
      handleFooterLinkClick(e, linkWhats.href),
    );
  }

  const searchButton = document.getElementById("searchButton");
  if (searchButton) {
    searchButton.addEventListener("click", toggleBusca);
  }
});

function atualizarFooterComEstabelecimento(estabelecimento) {
  const footerEstabName = document.getElementById("footer-estab-name");
  const linkWhatsFooter = document.getElementById("link-whatsapp");
  const linkWhatsHeader = document.getElementById("link-whatsapp-header");
  const footerPhone = document.getElementById("footer-phone");

  if (footerEstabName) {
    footerEstabName.textContent = estabelecimento.nome || "Estabelecimento";
  }

  const telefone = estabelecimento.telefone || "";
  const telefoneLimpo = telefone.replace(/[^0-9]/g, "");
  const whatsappUrl =
    telefoneLimpo.length >= 8 ? `https://wa.me/${telefoneLimpo}` : "#";
  const whatsappTexto =
    telefoneLimpo.length >= 8 ? "WhatsApp" : "WhatsApp indisponível";

  if (linkWhatsFooter) {
    linkWhatsFooter.href = whatsappUrl;
    linkWhatsFooter.textContent = whatsappTexto;
  }

  if (linkWhatsHeader) {
    linkWhatsHeader.href = whatsappUrl;
  }

  if (footerPhone) {
    footerPhone.textContent = telefone
      ? `Telefone: ${telefone}`
      : "Telefone não informado";
  }
}

function toggleBusca() {
  const busca = document.getElementById("buscaContainer");
  const campo = document.getElementById("campoBusca");
  if (!busca) return;

  if (
    busca.style.display === "none" ||
    getComputedStyle(busca).display === "none"
  ) {
    busca.style.display = "block";
    if (campo) campo.focus();
  } else {
    busca.style.display = "none";
  }
}
