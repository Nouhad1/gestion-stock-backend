const express = require('express'); 
const router = express.Router();
const db = require('../config/db');

// Ajouter une nouvelle commande
router.post('/', (req, res) => {
  let { client_id, produit_reference, quantite_commande, metres_commandees } = req.body;

  if (!client_id || !produit_reference || quantite_commande === undefined) {
    return res.status(400).json({ message: 'Champs manquants' });
  }

  quantite_commande = parseFloat(quantite_commande);
  if (isNaN(quantite_commande) || quantite_commande <= 0) {
    return res.status(400).json({ message: 'Quantité commande invalide' });
  }

  metres_commandees = metres_commandees !== undefined ? parseFloat(metres_commandees) : 0;
  if (isNaN(metres_commandees)) metres_commandees = 0;

  // Récupérer le produit
  db.query(
    `SELECT designation, COALESCE(quantite_stock, 0) AS quantite_stock, 
            COALESCE(longueur_par_rouleau, 0) AS longueur_par_rouleau 
     FROM produits 
     WHERE reference = ?`,
    [produit_reference],
    (err, produitRows) => {
      if (err) {
        console.error('Erreur MySQL :', err);
        return res.status(500).json({ message: 'Erreur serveur' });
      }

      if (produitRows.length === 0) {
        return res.status(404).json({ message: 'Produit introuvable' });
      }

      const produit = produitRows[0];
      const designation = produit.designation || '';
      const quantite_stock = parseFloat(produit.quantite_stock) || 0;
      const longueur_par_rouleau = parseFloat(produit.longueur_par_rouleau) || 0;

      const isLaniere = designation.toLowerCase().includes('roul');

      if (isLaniere) {
        const qteMaxPossible = quantite_stock * longueur_par_rouleau;

        if (metres_commandees > qteMaxPossible) {
          return res.status(400).json({
            message: `La quantité demandée (${metres_commandees} m) dépasse le stock disponible (${qteMaxPossible} m).`
          });
        }

        const rouleauxUtilises = metres_commandees / longueur_par_rouleau;
        const nouveauStock = quantite_stock - rouleauxUtilises;

        db.query(
          `INSERT INTO commandes (client_id, produit_reference, quantite_commande, date_commande, metres_commandees) 
           VALUES (?, ?, ?, NOW(), ?)`,
          [client_id, produit_reference, quantite_commande, metres_commandees],
          (err) => {
            if (err) {
              console.error('Erreur insertion commande :', err);
              return res.status(500).json({ message: 'Erreur serveur' });
            }

            db.query(
              `UPDATE produits SET quantite_stock = ? WHERE reference = ?`,
              [parseFloat(nouveauStock.toFixed(2)), produit_reference],
              (err) => {
                if (err) {
                  console.error('Erreur mise à jour stock :', err);
                  return res.status(500).json({ message: 'Erreur serveur' });
                }
                res.status(201).json({ message: 'Commande enregistrée avec succès' });
              }
            );
          }
        );

      } else {
        if (quantite_commande > quantite_stock) {
          return res.status(400).json({ message: 'Stock insuffisant' });
        }

        const nouveauStock = quantite_stock - quantite_commande;

        db.query(
          `INSERT INTO commandes (client_id, produit_reference, quantite_commande, date_commande) 
           VALUES (?, ?, ?, NOW())`,
          [client_id, produit_reference, quantite_commande],
          (err) => {
            if (err) {
              console.error('Erreur insertion commande :', err);
              return res.status(500).json({ message: 'Erreur serveur' });
            }

            db.query(
              `UPDATE produits SET quantite_stock = ? WHERE reference = ?`,
              [parseFloat(nouveauStock.toFixed(2)), produit_reference],
              (err) => {
                if (err) {
                  console.error('Erreur mise à jour stock :', err);
                  return res.status(500).json({ message: 'Erreur serveur' });
                }
                res.status(201).json({ message: 'Commande enregistrée avec succès' });
              }
            );
          }
        );
      }
    }
  );
});

// Récupérer toutes les commandes
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT 
        c.numCmd, 
        cl.nom AS nom_client, 
        p.designation AS designation_produit, 
        c.quantite_commande, 
        c.metres_commandees,
        DATE_FORMAT(c.date_commande, '%Y-%m-%d') AS date_commande
      FROM commandes c
      JOIN clients cl ON c.client_id = cl.id
      JOIN produits p ON c.produit_reference = p.reference
      ORDER BY c.date_commande DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Erreur lors de la récupération des commandes :', err);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération' });
  }
});

// Statistiques journalières des commandes (par mois et année)
router.get('/stats/journalier', async (req, res) => {
  const { mois, annee } = req.query;

  if (!mois || !annee) {
    return res.status(400).json({ message: 'Mois et année sont requis' });
  }

  const moisInt = parseInt(mois, 10);
  const anneeInt = parseInt(annee, 10);

  if (isNaN(moisInt) || isNaN(anneeInt) || moisInt < 1 || moisInt > 12) {
    return res.status(400).json({ message: 'Mois ou année invalide' });
  }

  try {
    const [rows] = await db.promise().query(
      `SELECT DATE(date_commande) AS jour, COUNT(numCmd) AS total
       FROM commandes
       WHERE MONTH(date_commande) = ? AND YEAR(date_commande) = ?
       GROUP BY jour
       ORDER BY jour`,
      [moisInt, anneeInt]
    );

    res.json(rows);
  } catch (err) {
    console.error('Erreur récupération stats :', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
