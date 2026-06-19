const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// IMPORTA DEPENDÊNCIAS QUE JÁ EXISTEM NO SERVER
module.exports = ({
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
}) => {
  // ================= ADMIN =================

  router.post(
    "/admin/register",
    verificarToken,
    verificarCSRF,
    verificarSuperAdmin,
    async (req, res) => {
      const { email, senha, role, establishmentName } = req.body;
      const normalizedRole = role ? String(role).trim().toLowerCase() : "";

      if (!email || !senha || !normalizedRole) {
        return res.status(400).json({ mensagem: "Preencha todos os campos!" });
      }

      if (!["admin", "superadmin"].includes(normalizedRole)) {
        return res
          .status(400)
          .json({ mensagem: "Role inválido. Use admin ou superadmin." });
      }

      if (normalizedRole === "admin" && !establishmentName) {
        return res
          .status(400)
          .json({ mensagem: "Informe o nome do estabelecimento" });
      }

      try {
        const hash = await bcrypt.hash(senha, 12);

        const createAdmin = (establishmentId = null) => {
          connection.query(
            "INSERT INTO admin (email, senha, role, establishment_id, active, deactivated_at) VALUES (?, ?, ?, ?, 1, NULL)",
            [email, hash, normalizedRole, establishmentId],
            (err) => {
              if (err) return res.status(500).json(err);

              res.json({ mensagem: "Admin criado!" });
            },
          );
        };

        if (normalizedRole === "admin") {
          const slug = gerarSlug(establishmentName);

          connection.query(
            "SELECT id FROM estabelecimentos WHERE nome = ?",
            [establishmentName],
            (err, results) => {
              if (err) {
                console.error("ERRO:", err);
                return res.status(500).json({ mensagem: "Erro no servidor" });
              }

              if (results.length > 0) {
                return createAdmin(results[0].id);
              }

              connection.query(
                "SELECT id FROM estabelecimentos WHERE slug = ?",
                [slug],
                (err, slugResults) => {
                  if (err) return res.status(500).json(err);

                  if (slugResults.length > 0) {
                    return res.status(400).json({
                      mensagem:
                        "Já existe um estabelecimento com esse nome (slug duplicado)",
                    });
                  }

                  connection.query(
                    "INSERT INTO estabelecimentos (nome, slug) VALUES (?, ?)",
                    [establishmentName, slug],
                    (insertErr, insertResult) => {
                      if (insertErr) return res.status(500).json(insertErr);

                      createAdmin(insertResult.insertId);
                    },
                  );
                },
              );
            },
          );
        } else {
          createAdmin(null);
        }
      } catch (error) {
        res.status(500).json(error);
      }
    },
  );

  router.post("/admin/logout", (req, res) => {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    res.clearCookie("csrf-token", {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    return res.json({ mensagem: "Logout realizado com sucesso" });
  });

  router.get("/admin/me", verificarToken, verificarCSRF, (req, res) => {
    res.json({
      id: req.user.id,
      role: req.user.role,
      establishmentId: req.user.establishmentId,
    });
  });

  router.put(
    "/auth/primeiro-acesso",
    verificarToken,
    verificarCSRF,
    async (req, res) => {
      try {
        const { novaSenha } = req.body;
        const userId = req.user.id;

        if (!novaSenha) {
          return res.status(400).json({
            mensagem: "Nova senha obrigatória",
          });
        }

        const hash = await bcrypt.hash(novaSenha, 12);

        await connection.query(
          "UPDATE admin SET senha = ?, primeiro_login = 0 WHERE id = ?",
          [hash, userId],
        );

        res.json({
          mensagem: "Senha atualizada com sucesso",
        });
      } catch (err) {
        console.error("Erro trocar senha:", err);

        res.status(500).json({
          mensagem: "Erro no servidor",
        });
      }
    },
  );

  router.get("/admin/check-token", verificarToken, (req, res) => {
    res.json({ valid: true, user: req.user });
  });

  // ================= ESTABELECIMENTOS =================

  router.get("/estabelecimentos", (req, res) => {
    const { slug } = req.query;

    connection.query(
      "SELECT * FROM estabelecimentos WHERE slug = ?",
      [slug],
      (err, results) => {
        if (err) return res.status(500).json(err);

        if (results.length === 0) {
          return res.status(404).json({ mensagem: "Não encontrado" });
        }

        const estabelecimento = results[0];

        if (typeof estabelecimento.horarios === "string") {
          try {
            estabelecimento.horarios = JSON.parse(estabelecimento.horarios);
          } catch (e) {
            estabelecimento.horarios = null;
          }
        }

        res.json(estabelecimento);
      },
    );
  });

  router.get("/estabelecimentos/:id", (req, res) => {
    const { id } = req.params;

    connection.query(
      "SELECT id, nome, slug, banner FROM estabelecimentos WHERE id = ?",
      [id],
      (err, results) => {
        if (err) {
          return res.status(500).json(err);
        }
        if (results.length === 0) {
          return res
            .status(404)
            .json({ mensagem: "Estabelecimento não encontrado" });
        }
        res.json(results[0]);
      },
    );
  });

  router.put(
    "/estabelecimentos/:id/banner",
    verificarToken,
    verificarCSRF,
    upload.single("banner"),
    async (req, res) => {
      try {
        const { id } = req.params;

        if (!req.file) {
          return res.status(400).json({ mensagem: "Nenhuma imagem enviada" });
        }

        await validarBuffer(req.file.buffer);

        const result = await uploadCloudinary(req.file.buffer);

        const novaUrl = result.secure_url;
        const novoPublicId = result.public_id;

        connection.query(
          "SELECT banner, banner_public_id FROM estabelecimentos WHERE id = ?",
          [id],
          async (err, results) => {
            if (err) return res.status(500).json(err);

            if (results.length === 0) {
              return res
                .status(404)
                .json({ mensagem: "Estabelecimento não encontrado" });
            }

            const bannerAntigo = results[0].banner;
            const publicIdAntigo = results[0].banner_public_id;

            if (publicIdAntigo) {
              try {
                await cloudinary.uploader.destroy(publicIdAntigo);
                console.log("Banner antigo deletado");
              } catch (e) {
                console.log("Erro ao deletar banner antigo:", e);
              }
            }

            connection.query(
              "UPDATE estabelecimentos SET banner = ?, banner_public_id = ? WHERE id = ?",
              [novaUrl, novoPublicId, id],
              (updateErr) => {
                if (updateErr) return res.status(500).json(updateErr);

                res.json({
                  mensagem: "Banner atualizado com sucesso!",
                  banner: novaUrl,
                });
              },
            );
          },
        );
      } catch (err) {
        console.error(err);
        res.status(err.statusCode || 500).json({
          erro: err.message || "Erro no servidor",
        });
      }
    },
  );

  // ================= PRODUTOS =================

  router.get("/produtos", (req, res) => {
    const { slug } = req.query;

    if (!slug) {
      return res.status(400).json({ error: "Slug obrigatório" });
    }

    // 1. Buscar estabelecimento pelo slug
    const sqlEstab = `
    SELECT id 
    FROM estabelecimentos 
    WHERE slug = ?
    LIMIT 1
  `;

    connection.query(sqlEstab, [slug], (err, estab) => {
      if (err) {
        return res
          .status(500)
          .json({ error: "Erro ao buscar estabelecimento" });
      }

      if (estab.length === 0) {
        return res
          .status(404)
          .json({ error: "Estabelecimento não encontrado" });
      }

      const establishmentId = estab[0].id;

      // 2. Buscar produtos com status de estoque
      const sqlProdutos = `
      SELECT *,
        CASE 
          WHEN controla_estoque = true AND estoque <= 0 THEN true
          ELSE false
        END as esgotado
      FROM produtos
      WHERE establishment_id = ?
    `;

      connection.query(sqlProdutos, [establishmentId], (err, results) => {
        if (err) {
          return res.status(500).json({ error: "Erro ao buscar produtos" });
        }

        res.json(results);
      });
    });
  });

  router.get("/me/produtos", verificarToken, verificarCSRF, (req, res) => {
    const establishmentId = req.user.establishmentId;

    if (req.user.role === "superadmin") {
      connection.query(
        `SELECT *,
        CASE 
          WHEN controla_estoque = true AND estoque <= 0 THEN true
          ELSE false
        END as esgotado
      FROM produtos`,
        (err, results) => {
          if (err) return res.status(500).json(err);
          return res.json(results);
        },
      );
      return;
    }

    if (!establishmentId) {
      return res.status(400).json({
        mensagem: "Admin sem estabelecimento associado",
      });
    }

    connection.query(
      `SELECT *,
      CASE 
        WHEN controla_estoque = true AND estoque <= 0 THEN true
        ELSE false
      END as esgotado
    FROM produtos
    WHERE establishment_id = ?`,
      [establishmentId],
      (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
      },
    );
  });

  router.post(
    "/me/produtos",
    verificarToken,
    verificarCSRF,
    upload.single("imagem"),
    async (req, res) => {
      try {
        const { error, value } = schemaProduto.validate(req.body);

        if (error) {
          return res.status(400).json({
            erro: error.details[0].message,
          });
        }

        if (!req.file) {
          return res.status(400).json({ erro: "Imagem obrigatória" });
        }

        await validarBuffer(req.file.buffer);

        const result = await uploadCloudinary(req.file.buffer);
        console.log("Upload cadastro:", result);

        const imagemUrl = result.secure_url;
        const imagemPublicId = result.public_id;

        const { nome, descricao, categoria, preco, controla_estoque, estoque } =
          value;

        const controlaEstoque =
          controla_estoque === true || controla_estoque === "true";

        const estoqueFinal = controlaEstoque ? Number(estoque ?? 0) : null;

        const establishmentId = req.user.establishmentId;

        const sql = `
        INSERT INTO produtos 
         (nome, descricao, categoria, preco, imagem, imagem_public_id,
         establishment_id, controla_estoque, estoque)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

        if (
          controlaEstoque &&
          (estoqueFinal === null || isNaN(estoqueFinal) || estoqueFinal < 0)
        ) {
          return res.status(400).json({
            erro: "Estoque inválido",
          });
        }

        connection.query(
          sql,
          [
            nome,
            descricao,
            categoria,
            preco,
            imagemUrl,
            imagemPublicId,
            establishmentId,
            controlaEstoque,
            estoqueFinal,
          ],
          (err) => {
            if (err) {
              console.error(err);
              return res.status(500).json({
                erro: "Erro ao inserir produto",
              });
            }

            res.status(201).json({
              mensagem: "Produto adicionado com sucesso!",
              imagem: imagemUrl,
            });
          },
        );
      } catch (err) {
        console.error(err);

        res.status(err.statusCode || 500).json({
          erro: err.message || "Erro no servidor",
        });
      }
    },
  );

  router.put(
    "/produtos/:id",
    verificarToken,
    verificarCSRF,
    upload.single("imagem"),
    async (req, res) => {
      try {
        const id = req.params.id;

        // 👇 conversão importante (igual fizemos no POST)
        req.body.controla_estoque = req.body.controla_estoque === "true";

        const { nome, descricao, categoria, preco, estoque, controla_estoque } =
          req.body;

        const controlaEstoque = controla_estoque;

        let imagemUrl = null;
        let imagemPublicId = null;

        if (req.file) {
          await validarBuffer(req.file.buffer);

          const result = await uploadCloudinary(req.file.buffer);
          console.log("Upload edição:", result);

          imagemUrl = result.secure_url;
          imagemPublicId = result.public_id;
        }

        if (!nome || !descricao || !categoria || !preco) {
          return res.status(400).json({
            erro: "Nome, descrição, categoria e preço são obrigatórios!",
          });
        }

        const estoqueFinal = controlaEstoque ? Number(estoque ?? 0) : null;

        if (controlaEstoque && (isNaN(estoqueFinal) || estoqueFinal < 0)) {
          return res.status(400).json({
            erro: "Estoque inválido",
          });
        }

        connection.query(
          "SELECT imagem, imagem_public_id, establishment_id FROM produtos WHERE id = ?",
          [id],
          async (err, results) => {
            if (err) return res.status(500).json(err);

            if (results.length === 0) {
              return res.status(404).json({ erro: "Produto não encontrado" });
            }

            const produto = results[0];
            const establishmentId = req.user.establishmentId;

            if (
              req.user.role !== "superadmin" &&
              produto.establishment_id !== establishmentId
            ) {
              return res.status(403).json({ mensagem: "Acesso negado" });
            }

            const imagemAntiga = produto.imagem;
            const imagemPublicIdAntigo = produto.imagem_public_id;

            // 👇 deleta imagem antiga se tiver nova
            if (imagemUrl && imagemPublicIdAntigo) {
              try {
                await cloudinary.uploader.destroy(imagemPublicIdAntigo);
                console.log("Imagem antiga deletada");
              } catch (e) {
                console.log("Erro ao deletar imagem antiga:", e);
              }
            }

            const imagemParaSalvar = imagemUrl || imagemAntiga;
            const publicIdParaSalvar = imagemPublicId || imagemPublicIdAntigo;

            connection.query(
              `UPDATE produtos 
             SET nome = ?, descricao = ?, categoria = ?, preco = ?, 
                 estoque = ?, controla_estoque = ?, 
                 imagem = ?, imagem_public_id = ?
             WHERE id = ?`,
              [
                nome,
                descricao,
                categoria,
                preco,
                estoqueFinal,
                controlaEstoque,
                imagemParaSalvar,
                publicIdParaSalvar,
                id,
              ],
              (updateErr) => {
                if (updateErr) {
                  return res.status(500).json(updateErr);
                }

                res.json({
                  mensagem: "Produto atualizado com sucesso",
                  imagem: imagemParaSalvar,
                });
              },
            );
          },
        );
      } catch (err) {
        console.error(err);
        res.status(500).json({ erro: err.message });
      }
    },
  );

  router.delete(
    "/produtos/:id",
    verificarToken,
    verificarCSRF,
    async (req, res) => {
      const id = req.params.id;

      connection.query(
        "SELECT imagem_public_id, establishment_id FROM produtos WHERE id = ?",
        [id],
        async (err, results) => {
          if (err) {
            return res.status(500).json(err);
          }

          if (results.length === 0) {
            return res.status(404).json({ mensagem: "Produto não encontrado" });
          }

          const produto = results[0];
          const establishmentId = req.user.establishmentId;

          if (
            req.user.role !== "superadmin" &&
            produto.establishment_id !== establishmentId
          ) {
            return res.status(403).json({ mensagem: "Acesso negado" });
          }

          const publicId = produto.imagem_public_id;

          if (publicId) {
            try {
              await cloudinary.uploader.destroy(publicId);
              console.log("Imagem deletada do Cloudinary");
            } catch (err) {
              console.log("Erro ao deletar imagem:", err);
            }
          }

          connection.query("DELETE FROM produtos WHERE id = ?", [id], (err) => {
            if (err) {
              return res.status(500).json(err);
            }

            res.json({ mensagem: "Produto deletado com sucesso" });
          });
        },
      );
    },
  );

  router.patch(
    "/produtos/:id/estoque",
    verificarToken,
    verificarCSRF,
    (req, res) => {
      const { id } = req.params;
      const estoque = Number(req.body.estoque);

      if (estoque === undefined || isNaN(estoque)) {
        return res.status(400).json({ mensagem: "Estoque inválido" });
      }

      connection.query(
        "SELECT establishment_id FROM produtos WHERE id = ?",
        [id],
        (err, results) => {
          if (err) return res.status(500).json(err);

          if (results.length === 0) {
            return res.status(404).json({ mensagem: "Produto não encontrado" });
          }

          const produto = results[0];

          if (
            req.user.role !== "superadmin" &&
            produto.establishment_id !== req.user.establishmentId
          ) {
            return res.status(403).json({ mensagem: "Acesso negado" });
          }

          connection.query(
            "UPDATE produtos SET estoque = ? WHERE id = ?",
            [estoque, id],
            (err) => {
              if (err) return res.status(500).json(err);

              res.json({ mensagem: "Estoque atualizado com sucesso" });
            },
          );
        },
      );
    },
  );

  // ================= PEDIDOS =================

  router.post("/pedidos", (req, res) => {
    const { establishment_id, itens } = req.body;

    if (!itens || itens.length === 0) {
      return res.status(400).json({ mensagem: "Pedido vazio" });
    }

    const ids = itens.map((item) => item.id);

    const sql = `SELECT id, nome, preco FROM produtos WHERE id IN (?)`;

    connection.query(sql, [ids], (err, resultados) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ mensagem: "Erro no servidor" });
      }

      let total = 0;
      let detalhes = [];

      itens.forEach((item) => {
        const produto = resultados.find((p) => p.id === item.id);

        if (!produto) {
          return res.status(400).json({ mensagem: "Produto inválido" });
        }

        const subtotal = produto.preco * item.quantidade;
        total += subtotal;

        detalhes.push({
          nome: produto.nome,
          quantidade: item.quantidade,
          preco: produto.preco,
          subtotal: subtotal,
        });
      });

      res.json({
        total,
        itens: detalhes,
      });
    });
  });

  router.post("/pedidos/salvar", async (req, res) => {
    const {
      slug,
      itens,
      forma_pagamento,
      tipo_entrega,
      mesa,
      nome_cliente,
      endereco,
    } = req.body;

    if (!slug || !itens?.length) {
      return res.status(400).json({ mensagem: "Dados inválidos" });
    }

    const conn = await connection.getConnection();

    try {
      await conn.beginTransaction();

      const [estabResult] = await conn.query(
        "SELECT id FROM estabelecimentos WHERE slug = ?",
        [slug],
      );

      if (!estabResult.length) {
        await conn.rollback();

        return res.status(404).json({
          mensagem: "Estabelecimento não encontrado",
        });
      }

      const establishment_id = estabResult[0].id;

      let total = 0;
      let itensFinal = [];

      for (const item of itens) {
        const [rows] = await conn.query(
          `SELECT id, nome, preco, controla_estoque, estoque, estoque_reservado
         FROM produtos 
         WHERE id = ?`,
          [item.id],
        );

        const produto = rows[0];

        if (!produto) {
          await conn.rollback();

          return res.status(400).json({
            mensagem: "Produto inválido",
          });
        }

        const subtotal = produto.preco * item.quantidade;

        total += subtotal;

        itensFinal.push({
          id: produto.id,
          nome: produto.nome,
          preco: produto.preco,
          quantidade: item.quantidade,
          subtotal,
        });

        if (Number(produto.controla_estoque) === 1) {
          const [result] = await conn.query(
            `UPDATE produtos
           SET estoque_reservado = estoque_reservado + ?
           WHERE id = ?
           AND (estoque - estoque_reservado) >= ?`,
            [item.quantidade, produto.id, item.quantidade],
          );

          if (result.affectedRows === 0) {
            await conn.rollback();

            return res.status(400).json({
              mensagem: `Estoque insuficiente para ${produto.nome}`,
            });
          }
        }
      }

      const [resultPedido] = await conn.query(
        `INSERT INTO pedidos 
      (
        establishment_id,
        itens,
        total,
        forma_pagamento,
        tipo_entrega,
        mesa,
        nome_cliente,
        endereco
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          establishment_id,
          JSON.stringify(itensFinal),
          total,
          forma_pagamento,
          tipo_entrega,
          mesa || null,
          nome_cliente || null,
          endereco || null,
        ],
      );

      await conn.commit();

      const io = req.app.get("io");

      if (io) {
        io.to(`estab_${establishment_id}`).emit("novoPedido", {
          pedido_id: resultPedido.insertId,
          establishment_id,
          itens: itensFinal,
          total,
          nome_cliente,
          tipo_entrega,
          mesa,
        });
      }

      res.json({
        mensagem: "Pedido salvo com sucesso",
        pedido_id: resultPedido.insertId,
        total,
        itens: itensFinal,
      });
    } catch (err) {
      await conn.rollback();

      console.error(err);

      res.status(500).json({
        mensagem: "Erro ao salvar pedido",
      });
    } finally {
      conn.release();
    }
  });

  router.get("/admin/pedidos", verificarToken, verificarCSRF, (req, res) => {
    const establishmentId = req.user.establishmentId;

    const sql = `SELECT id, itens, total, forma_pagamento, tipo_entrega, mesa, nome_cliente, endereco, created_at FROM pedidos WHERE establishment_id = ? AND status = 'pendente' ORDER BY created_at DESC`;

    connection.query(sql, [establishmentId], (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ mensagem: "Erro ao buscar pedidos" });
      }

      res.json(results);
    });
  });

  router.delete(
    "/admin/pedidos/:id",
    verificarToken,
    verificarCSRF,
    async (req, res) => {
      const { id } = req.params;
      const establishmentId = req.user.establishmentId;

      const conn = await connection.getConnection();

      try {
        await conn.beginTransaction();

        const [results] = await conn.query(
          `SELECT itens FROM pedidos 
       WHERE id = ? AND establishment_id = ?`,
          [id, establishmentId],
        );

        if (results.length === 0) {
          await conn.rollback();

          return res.status(404).json({
            mensagem: "Pedido não encontrado",
          });
        }

        const itens =
          typeof results[0].itens === "string"
            ? JSON.parse(results[0].itens)
            : results[0].itens;

        for (const item of itens) {
          const [rows] = await conn.query(
            `SELECT controla_estoque 
         FROM produtos 
         WHERE id = ? 
         AND establishment_id = ?`,
            [item.id, establishmentId],
          );

          const produto = rows[0];

          if (!produto) continue;

          if (Number(produto.controla_estoque) === 1) {
            await conn.query(
              `UPDATE produtos
           SET estoque_reservado = GREATEST(estoque_reservado - ?, 0)
           WHERE id = ? 
           AND establishment_id = ?`,
              [item.quantidade, item.id, establishmentId],
            );
          }
        }

        await conn.query(
          `DELETE FROM pedidos 
       WHERE id = ? 
       AND establishment_id = ?`,
          [id, establishmentId],
        );

        await conn.commit();

        res.json({
          mensagem: "Pedido excluído e estoque corrigido!",
        });
      } catch (err) {
        await conn.rollback();

        console.error(err);

        res.status(500).json({
          mensagem: "Erro ao excluir pedido",
        });
      } finally {
        conn.release();
      }
    },
  );

  router.put(
    "/admin/pedidos/:id/finalizar",
    verificarToken,
    verificarCSRF,
    async (req, res) => {
      const pedidoId = req.params.id;
      const establishmentId = req.user.establishmentId;

      const conn = await connection.getConnection();

      try {
        await conn.beginTransaction();

        // ================= BUSCAR PEDIDO =================
        const [pedidos] = await conn.query(
          `SELECT * 
         FROM pedidos 
         WHERE id = ? 
         AND establishment_id = ? 
         AND status = 'pendente'`,
          [pedidoId, establishmentId],
        );

        if (pedidos.length === 0) {
          await conn.rollback();
          return res.status(404).json({
            mensagem: "Pedido não encontrado",
          });
        }

        const pedido = pedidos[0];

        const itens =
          typeof pedido.itens === "string"
            ? JSON.parse(pedido.itens)
            : pedido.itens;

        // ================= VALIDAR ESTOQUE =================
        for (const item of itens) {
          const [rows] = await conn.query(
            `SELECT estoque, estoque_reservado, controla_estoque 
           FROM produtos 
           WHERE id = ?`,
            [item.id],
          );

          const produto = rows[0];

          if (!produto) {
            await conn.rollback();

            return res.status(400).json({
              mensagem: "Produto não encontrado",
            });
          }

          if (Number(produto.controla_estoque) !== 1) continue;

          const estoque = Number(produto.estoque) || 0;
          const reservado = Number(produto.estoque_reservado) || 0;

          const disponivel = estoque - reservado + item.quantidade;

          if (disponivel < item.quantidade) {
            await conn.rollback();

            return res.status(400).json({
              mensagem: `Estoque insuficiente para ${item.nome}`,
            });
          }
        }

        // ================= BAIXAR ESTOQUE =================
        for (const item of itens) {
          const [rows] = await conn.query(
            `SELECT controla_estoque 
           FROM produtos 
           WHERE id = ?`,
            [item.id],
          );

          const produto = rows[0];

          if (Number(produto.controla_estoque) === 1) {
            await conn.query(
              `UPDATE produtos 
             SET estoque = estoque - ?, 
                 estoque_reservado = estoque_reservado - ?
             WHERE id = ?`,
              [item.quantidade, item.quantidade, item.id],
            );
          }
        }

        // ================= HISTÓRICO =================
        await conn.query(
          `INSERT INTO historico_pedidos 
        (
          pedido_id,
          establishment_id,
          itens,
          total,
          forma_pagamento,
          tipo_entrega,
          mesa,
          nome_cliente,
          endereco
        ) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pedido.id,
            pedido.establishment_id,
            JSON.stringify(itens),
            pedido.total,
            pedido.forma_pagamento,
            pedido.tipo_entrega,
            pedido.mesa,
            pedido.nome_cliente,
            pedido.endereco,
          ],
        );

        // ================= DELETE PEDIDO =================
        await conn.query(`DELETE FROM pedidos WHERE id = ?`, [pedidoId]);

        await conn.commit();

        res.json({
          mensagem: "Pedido finalizado com sucesso",
        });
      } catch (err) {
        await conn.rollback();

        console.error(err);

        res.status(500).json({
          mensagem: "Erro ao finalizar pedido",
        });
      } finally {
        conn.release();
      }
    },
  );

  return router;
};
