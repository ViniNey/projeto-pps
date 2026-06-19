const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const multer = require("multer");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const Joi = require("joi");
const xss = require("xss");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");

require("dotenv").config();

const connectionReady = require("./database/connection");
const { fileTypeFromBuffer } = require("file-type");
const streamifier = require("streamifier");

// IMPORTA SUA API
const createApi = require("./api");

let connection;

function sanitizar(req, res, next) {
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === "string") {
        req.body[key] = xss(req.body[key]);
      }
    }
  }

  next();
}

// ================= CLOUDINARY =================
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

// ================= RATE LIMIT =================
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,

  message: {
    mensagem: "Muitas requisições. Aguarde alguns minutos.",
  },

  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,

  message: {
    mensagem: "Muitas tentativas. Tente novamente em 15 minutos.",
  },

  standardHeaders: true,
  legacyHeaders: false,
});

// ================= UPLOAD =================
const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExt = [".jpg", ".jpeg", ".png", ".webp"];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Tipo inválido"));
    }

    if (!allowedExt.includes(ext)) {
      return cb(new Error("Extensão inválida"));
    }

    cb(null, true);
  },
});

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
app.use(sanitizar);
app.use(limiter);
app.use(
  helmet({
    crossOriginResourcePolicy: false,

    contentSecurityPolicy: (() => {
      const base = {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdn.socket.io", "https://unpkg.com"],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
        connectSrc: ["'self'"],
      };

      if (process.env.NODE_ENV === "production") {
        // production: require secure websocket and stricter connect sources
        base.connectSrc.push("wss://meusite.com");
      } else {
        // development: allow localhost and ws
        base.connectSrc.push("http://localhost:3000", "ws://localhost:3000");
        // allow inline styles during development only
        base.styleSrc.push("'unsafe-inline'");
      }

      return { directives: base };
    })(),
  }),
);

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

function verificarCSRF(req, res, next) {
  const csrfCookie = req.cookies["csrf-token"];
  const csrfHeader = req.headers["x-csrf-token"];

  if (!csrfCookie || !csrfHeader) {
    return res.status(403).json({
      mensagem: "CSRF token ausente",
    });
  }

  if (csrfCookie !== csrfHeader) {
    return res.status(403).json({
      mensagem: "CSRF token inválido",
    });
  }

  next();
}

// ================= UPLOAD HELPERS =================
async function validarBuffer(buffer) {
  const type = await fileTypeFromBuffer(buffer);

  if (!type || !allowedTypes.includes(type.mime)) {
    const err = new Error("Arquivo fraudado detectado!");
    err.statusCode = 400;
    throw err;
  }
}

function uploadCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "produtos" },
      (error, result) => {
        if (result) resolve(result);
        else reject(error);
      },
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
}

// ================= CONEXÃO =================
connectionReady.then((conn) => {
  connection = conn;

  // ================= SOCKET =================
  const server = http.createServer(app);

  const socketConnections = new Map();

  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });
  io.use((socket, next) => {
    const ip =
      socket.handshake.headers["x-forwarded-for"] || socket.handshake.address;

    const now = Date.now();

    // cria registro do IP
    if (!socketConnections.has(ip)) {
      socketConnections.set(ip, []);
    }

    // pega conexões recentes (último minuto)
    const connections = socketConnections
      .get(ip)
      .filter((time) => now - time < 60000);

    // máximo 10 conexões por minuto
    if (connections.length >= 10) {
      return next(new Error("Muitas conexões. Tente novamente."));
    }

    // salva conexão atual
    connections.push(now);

    socketConnections.set(ip, connections);

    const cookies = socket.handshake.headers.cookie || "";

    if (!cookies) {
      return next(new Error("Cookie não encontrado"));
    }

    const token = cookies
      .split(";")
      .find((c) => c.trim().startsWith("token="))
      ?.split("=")[1];

    if (!token) {
      return next(new Error("Token não encontrado"));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      connection.query(
        "SELECT id, role, active, establishment_id FROM admin WHERE id = ?",
        [decoded.id],
        (err, results) => {
          if (err) return next(new Error("Erro interno"));
          if (results.length === 0)
            return next(new Error("Usuário não encontrado"));

          const user = results[0];

          if (user.active !== 1) return next(new Error("Usuário desativado"));

          socket.user = {
            id: user.id,
            role: user.role,
            establishmentId: user.establishment_id,
          };

          next();
        },
      );
    } catch {
      return next(new Error("Token inválido"));
    }
  });

  io.on("connection", (socket) => {
    console.log("🟢 Socket conectado:", socket.id);

    if (!socket.user) {
      console.log("🔴 Socket sem usuário (desconectando)");
      return socket.disconnect();
    }

    const { establishmentId, id, role } = socket.user;

    console.log("👤 Usuário autenticado: ID ", id);
    console.log("ROLE:", role);
    console.log("Establishment:", establishmentId);

    if (establishmentId) {
      const room = `estab_${establishmentId}`;
      socket.join(room);

      console.log(`📥 Entrou na sala: ${room}`);
    }

    socket.on("disconnect", () => {
      console.log("🔴 Socket desconectado:", socket.id);
    });
  });

  app.set("io", io);

  // ================= API =================
  app.use(
    "/api",
    createApi({
      connection,
      verificarToken,
      verificarCSRF,
      verificarSuperAdmin,
      upload,
      schemaProduto,
      validarBuffer,
      uploadCloudinary,
      cloudinary,
      loginLimiter,
      jwt,
    }),
  );

  // ================= 404 =================
  app.use((req, res) => {
    res.status(404).json({ error: "Rota não encontrada" });
  });

  // ================= START =================
  server.listen(3000, () => {
    console.log("Servidor rodando na porta 3000");
  });
});
