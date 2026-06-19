function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
}

const passwordRules = [
  { id: "reqLength", regex: /.{8,}/ },
  { id: "reqUpper", regex: /[A-Z]/ },
  { id: "reqLower", regex: /[a-z]/ },
  { id: "reqNumber", regex: /[0-9]/ },
];

function atualizarRequisitos(password) {
  passwordRules.forEach(({ id, regex }) => {
    const item = document.getElementById(id);
    if (!item) return;
    if (regex.test(password)) {
      item.classList.add("pass");
      item.classList.remove("fail");
    } else {
      item.classList.add("fail");
      item.classList.remove("pass");
    }
  });
}

async function trocarSenha() {
  const novaSenha = document.getElementById("novaSenha").value.trim();
  const confirmarSenha = document.getElementById("confirmarSenha").value.trim();
  const feedback = document.getElementById("feedback");
  const csrfToken = getCookie("csrf-token");

  atualizarRequisitos(novaSenha);

  feedback.textContent = "";
  feedback.classList.remove("error", "success");

  if (!novaSenha || !confirmarSenha) {
    feedback.textContent = "Preencha ambos os campos de senha.";
    feedback.classList.add("error");
    return;
  }

  if (novaSenha !== confirmarSenha) {
    feedback.textContent = "As senhas não coincidem.";
    feedback.classList.add("error");
    return;
  }

  const regras = [/.{8,}/, /[A-Z]/, /[a-z]/, /[0-9]/];

  const mensagemRegras = [
    "A senha deve ter ao menos 8 caracteres.",
    "Inclua pelo menos uma letra maiúscula.",
    "Inclua pelo menos uma letra minúscula.",
    "Inclua pelo menos um número.",
  ];

  const falhas = regras
    .map((reg, idx) => (!reg.test(novaSenha) ? mensagemRegras[idx] : null))
    .filter(Boolean);

  if (falhas.length > 0) {
    feedback.innerHTML = falhas.join("<br />");
    feedback.classList.add("error");
    return;
  }

  try {
    const res = await fetch("http://localhost:3000/api/auth/primeiro-acesso", {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify({ novaSenha }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.mensagem || "Erro ao trocar senha");
    }

    Swal.fire({
      icon: "success",
      title: "Senha alterada!",
      text: "Redirecionando...",
      timer: 1500,
      showConfirmButton: false,
    });

    setTimeout(() => {
      const role = localStorage.getItem("role");

      window.location.href =
        role === "superadmin" ? "superadmin.html" : "admin.html";
    }, 1500);
  } catch (err) {
    Swal.fire({
      icon: "error",
      title: "Erro",
      text: err.message || "Erro ao trocar senha",
    });
  }
}

const inputs = document.querySelectorAll("input");

inputs.forEach((input, index) =>
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();

      const proximoInput = inputs[index + 1];

      if (proximoInput) {
        proximoInput.focus();
      } else {
        Swal.fire({
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });

        trocarSenha();
      }
    }
  }),
);

document.addEventListener("DOMContentLoaded", () => {
  const novaSenhaInput = document.getElementById("novaSenha");

  if (novaSenhaInput) {
    novaSenhaInput.addEventListener("input", (event) => {
      atualizarRequisitos(event.target.value);
    });
  }
});
