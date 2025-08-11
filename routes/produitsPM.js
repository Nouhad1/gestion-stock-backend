const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Extrait rouleaux (partie entière) et mètres (partie décimale * longueur par rouleau) sans soustraction en chaîne "X,Y"
function formatStockDecimal(stockFloat, longueurParRouleau) {
  if (!longueurParRouleau || longueurParRouleau <= 0) {
    return stockFloat.toString();
  }
  const rouleaux = Math.floor(stockFloat);
  const resteDecimal = stockFloat - rouleaux;
  const metresRestants = Math.round(resteDecimal * longueurParRouleau);
  return `${rouleaux},${metresRestants}`;
}

// GET tous les produits avec prix moyen et longueur_par_rouleau
router.get('/', (req, res) => {
  const sql = `
    SELECT 
      p.reference, 
      p.designation, 
      p.prix_unitaire, 
      COALESCE(AVG(a.prix_achat), 0) AS prix_moyen_achat,
      COALESCE(p.quantite_stock, 0) AS quantite_stock,
      COALESCE(p.longueur_par_rouleau, 0) AS longueur_par_rouleau
    FROM produits p
    LEFT JOIN achats a ON a.produit_reference = p.reference
    GROUP BY 
      p.reference, 
      p.designation, 
      p.prix_unitaire, 
      p.quantite_stock, 
      p.longueur_par_rouleau
    ORDER BY p.reference;
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error('Erreur MySQL:', err);
      return res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }

    const produitsAvecStockFormatte = rows.map(p => {
      if (p.longueur_par_rouleau > 0) {
        const stockFormate = formatStockDecimal(p.quantite_stock, p.longueur_par_rouleau);
        return {
          ...p,
          stockAffiche: stockFormate // ex: "6,25"
        };
      } else {
        return { ...p, stockAffiche: p.quantite_stock.toString() };
      }
    });

    res.json(produitsAvecStockFormatte);
  });
});

// PUT pour modifier un produit
router.put('/:reference', (req, res) => {
  const { reference } = req.params;
  const { designation, prix_unitaire, quantite_stock } = req.body;

  if (!designation || prix_unitaire == null || quantite_stock == null) {
    return res.status(400).json({ message: 'Champs manquants pour la mise à jour' });
  }

  const sql = `
    UPDATE produits
    SET designation = ?, prix_unitaire = ?, quantite_stock = ?
    WHERE reference = ?
  `;

  db.query(sql, [designation, prix_unitaire, quantite_stock, reference], (err, result) => {
    if (err) {
      console.error('Erreur lors de la mise à jour du produit :', err);
      return res.status(500).json({ message: 'Erreur lors de la mise à jour du produit' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }

    res.json({ message: 'Produit mis à jour avec succès' });
  });
});

// GET produit par référence avec historique achats
router.get('/:reference', (req, res) => {
  const { reference } = req.params;

  const sql = `
    SELECT p.*,
      (SELECT GROUP_CONCAT(prix_achat) FROM achats WHERE produit_reference = p.reference) AS historique_achats
    FROM produits p
    WHERE p.reference = ?
  `;

  db.query(sql, [reference], (err, results) => {
    if (err) {
      console.error('Erreur MySQL :', err);
      return res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }

    const produit = results[0];
    produit.historique_achats = produit.historique_achats
      ? produit.historique_achats.split(',').map(Number)
      : [];

    res.json(produit);
  });
});

module.exports = router;
