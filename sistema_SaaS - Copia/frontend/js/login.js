function login() {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;

  fetch("http://localhost:3000/api/admin/login", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, senha }),
  })
    .then(async (res) => {
      let data = {};

      try {
        data = await res.json();
      } catch {
        data = { mensagem: "Erro inesperado no servidor" };
      }

      if (!res.ok) {
        throw new Error(data.mensagem || "Erro no loguin");
      }

      return data;
    })
    .then((data) => {
      if (data.mensagem === "Login sucesso") {
        localStorage.setItem("role", data.role);
        localStorage.setItem(
          "establishmentId",
          data.establishmentId ? String(data.establishmentId) : "",
        );
        localStorage.setItem("establishmentName", data.establishmentName || "");

        if (data.primeiroLogin) {
          window.location.href = "trocar-senha.html";
        } else {
          window.location.href =
            data.role === "superadmin" ? "superadmin.html" : "admin.html";
        }
      }
    })

    .catch((err) => {
      document.getElementById("erro").innerText =
        err.message || "Erro ao fazer login";
    });
}

document.getElementById("senha").addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    e.preventDefault();
    login();
  }
});

const inputs = document.querySelectorAll("#email, #senha");

inputs.forEach((input, index) => {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();

      const proximo = inputs[index + 1];

      if (proximo) {
        proximo.focus();
      }
    }
  });
});

window.onload = () => {
  feather.replace();
};

function getCookie(name) {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(name + "="))
    ?.split("=")[1];
}

function toggleSenha() {
  const input = document.getElementById("senha");
  const icon = document.querySelector(".toggle-password");

  if (input.type === "password") {
    input.type = "text";
    icon.innerHTML = '<i data-feather="eye-off"></i>';
  } else {
    input.type = "password";
    icon.innerHTML = '<i data-feather="eye"></i>';
  }

  feather.replace();
}
