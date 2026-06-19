const express = require("express");
const cors = require("cors");
const http = require("http");
const jwt = require("jsonwebtoken");
const path = require("path");
const Joi = require("joi");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");

require("dotenv").config();

const connectionReady = require("./database/connection");

// IMPORTA API
const createApi = require("./api");

let connection;

// ================= VALIDAÇÃO =================
const schemaProduto = Joi.object({
  nome: Joi.string().min(3).max(100).required(),
  descricao: Joi.string().max(500).required(),
  categoria: Joi.string().required(),
  preco: Joi.number().positive().required(),
  controla_estoque: Joi.boolean().optional(),
  estoque: Joi.number().min(0).optional(),
});

// ================= EXPRESS =================
const app = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? ["https://meusite.com"]
    : [
        "http://localhost:3000",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
      ];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// ================= AUTH =================
function verificarToken(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ mensagem: "Acesso negado!" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    connection.query(
      "SELECT active, establishment_id, role FROM admin WHERE id = ?",
      [decoded.id],
      (err, results) => {
        if (err) return res.status(500).json({ mensagem: "Erro interno" });

        if (results.length === 0 || results[0].active !== 1) {
          return res.status(401).json({ mensagem: "Usuário inválido" });
        }

        req.user = {
          ...decoded,
          role: results[0].role,
          establishmentId: results[0].establishment_id,
        };

        next();
      },
    );
  } catch (err) {
    return res.status(401).json({ mensagem: "Token inválido" });
  }
}

function verificarSuperAdmin(req, res, next) {
  if (req.user.role !== "superadmin") {
    return res.status(403).json({ mensagem: "Acesso negado!" });
  }
  next();
}

// ================= CONEXÃO =================
connectionReady.then((conn) => {
  connection = conn;

  // ================= API =================
  app.use(
    "/api",
    createApi({
      connection,
      verificarToken,
      schemaProduto,
      jwt,
    }),
  );

  // ================= 404 =================
  app.use((req, res) => {
    res.status(404).json({ error: "Rota não encontrada" });
  });

  // ================= START =================
  app.listen(3000, () => {
    console.log("Servidor rodando na porta 3000");
  });
});
