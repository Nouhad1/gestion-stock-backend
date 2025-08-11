const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET /api/achats : liste tous les achats avec prix_achat
router.get('/', (req, res) => {
  const sql = `
    SELECT a.id, a.produit_reference AS reference, p.designation, a.quantite_achat, a.prix_achat,
           DATE_FORMAT(a.date_achat, '%Y-%m-%d') AS date_achat
    FROM achats a
    JOIN produits p ON a.produit_reference = p.reference
    ORDER BY a.date_achat DESC
  `;
  db.query(sql, (err, result) => {
    if (err) {
      console.error('Erreur lors de la récupération des achats', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    res.json(result);
  });
});

// POST /api/achats : ajoute un nouvel achat avec prix_achat
router.post('/', (req, res) => {
  const { produit_reference, quantite_achat, prix_achat } = req.body;

  if (!produit_reference || !quantite_achat || !prix_achat) {
    return res.status(400).json({ error: 'Champs manquants' });
  }

  const insertSql = `
    INSERT INTO achats (produit_reference, quantite_achat, prix_achat, date_achat)
    VALUES (?, ?, ?, NOW())
  `;

  db.query(insertSql, [produit_reference, quantite_achat, prix_achat], (err, result) => {
    if (err) {
      console.error('Erreur insertion achat', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    // Mise à jour du stock du produit correspondant
    const updateSql = `
      UPDATE produits
      SET quantite_stock = COALESCE(quantite_stock, 0) + ?
      WHERE reference = ?
    `;
    db.query(updateSql, [quantite_achat, produit_reference], (err2) => {
      if (err2) {
        console.error('Erreur mise à jour stock', err2);
        return res.status(500).json({ error: 'Erreur mise à jour stock' });
      }

      res.status(201).json({ message: 'Achat ajouté et stock mis à jour' });
    });
  });
});

// PUT /api/achats/:id : met à jour un achat existant (quantité uniquement)
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { quantite_achat, prix_achat } = req.body;

  if (quantite_achat == null) {
    return res.status(400).json({ error: 'Quantité manquante' });
  }

  // Récupérer l'ancienne quantité et produit_reference pour ajuster le stock
  const selectSql = `SELECT quantite_achat, produit_reference FROM achats WHERE id = ?`;

  db.query(selectSql, [id], (err, rows) => {
    if (err) {
      console.error('Erreur récupération achat', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Achat non trouvé' });
    }

    const oldQuantite = rows[0].quantite_achat;
    const produitRef = rows[0].produit_reference;
    const diff = quantite_achat - oldQuantite;

    // Mise à jour de la quantité d'achat & prix achat
    const updateAchatSql = `UPDATE achats SET quantite_achat = ? , prix_achat = ? WHERE id = ?`;
    db.query(updateAchatSql, [quantite_achat, prix_achat, id], (err2) => {
      if (err2) {
        console.error('Erreur mise à jour achat', err2);
        return res.status(500).json({ error: 'Erreur serveur' });
      }

      // Mise à jour du stock
      const updateStockSql = `
        UPDATE produits
        SET quantite_stock = COALESCE(quantite_stock, 0) + ?
        WHERE reference = ?
      `;
      db.query(updateStockSql, [diff, produitRef], (err3) => {
        if (err3) {
          console.error('Erreur mise à jour du stock', err3);
          return res.status(500).json({ error: 'Erreur stock' });
        }

        res.json({ message: 'Achat et stock mis à jour' });
      });
    });
  });
});

module.exports = router;
