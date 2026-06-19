const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
require("dotenv").config();

const dbName = process.env.DB_NAME;
if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD) {
  throw new Error(
    "As variáveis de ambiente DB_HOST, DB_USER e DB_PASSWORD são obrigatórias.",
  );
}
if (!dbName) {
  throw new Error("A variável de ambiente DB_NAME é obrigatória.");
}

async function initConnection() {
  const connection = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: dbName,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: false,
  });

  const createProdutosTableSQL = `
   CREATE TABLE IF NOT EXISTS produtos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    preco DECIMAL(10,2) NOT NULL,
    imagem VARCHAR(255),
    controla_estoque TINYINT(1) DEFAULT 0,
    estoque INT NOT NULL DEFAULT 0,
    estoque_reservado INT NOT NULL DEFAULT 0,
    establishment_id INT NOT NULL,
    categoria VARCHAR(100),
    imagem_public_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )  `;

  const createEstabelecimentosTableSQL = `
    CREATE TABLE IF NOT EXISTS estabelecimentos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(255) NOT NULL UNIQUE,
      slug VARCHAR(255),
      banner VARCHAR(255),
      telefone VARCHAR(20),
      chave_pix VARCHAR(100),
      horarios JSON,
      cor_primaria VARCHAR(20),
      cor_secundaria VARCHAR(20),
      banner_public_id VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`;

  const createAdminTableSQL = `
    CREATE TABLE IF NOT EXISTS admin (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(100) NOT NULL UNIQUE,
      senha VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL,
      establishment_id INT DEFAULT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      deactivated_at DATETIME DEFAULT NULL,
      tentativas_login INT NOT NULL DEFAULT 0,
      bloqueado TINYINT(1) NOT NULL DEFAULT 0,
      primeiro_login TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`;

  const createPedidosTableSQL = `
    CREATE TABLE IF NOT EXISTS pedidos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      establishment_id INT NOT NULL,
      itens JSON NOT NULL,
      total DECIMAL(10,2) NOT NULL,
      forma_pagamento VARCHAR(50),
      tipo_entrega VARCHAR(50),
      mesa VARCHAR(50),
      nome_cliente VARCHAR(255),
      endereco TEXT,
      status ENUM('pendente', 'finalizado') DEFAULT 'pendente',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (establishment_id) REFERENCES estabelecimentos(id)
    )`;

  const createHistoricoTableSQL = `
    CREATE TABLE IF NOT EXISTS historico_pedidos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      pedido_id INT NOT NULL,
      establishment_id INT NOT NULL,
      itens JSON NOT NULL,
      total DECIMAL(10,2) NOT NULL,
      forma_pagamento VARCHAR(50),
      tipo_entrega VARCHAR(50),
      mesa VARCHAR(50),
      nome_cliente VARCHAR(255),
      endereco TEXT,
      finalizado_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (establishment_id) REFERENCES estabelecimentos(id)
    )`;

  await connection.query(createProdutosTableSQL);
  await connection.query(createEstabelecimentosTableSQL);
  await connection.query(createPedidosTableSQL);
  await connection.query(createHistoricoTableSQL);
  await connection.query(createAdminTableSQL);

  console.log("Base de dados conectada com sucesso!");

  return connection;
}

module.exports = initConnection();
