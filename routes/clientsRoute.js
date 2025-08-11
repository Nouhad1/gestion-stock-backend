const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Récupérer tous les clients
router.get('/', async (req, res) => {
  try {
    const [clients] = await db.promise().query('SELECT id, nom FROM clients');
    res.json(clients);
  } catch (error) {
    console.error('Erreur récupération clients:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
