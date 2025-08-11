const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const connection = require('../config/db'); // change ce chemin si nécessaire

// Route de connexion
router.post('/', (req, res) => {
  const { login, mot_de_passe } = req.body;
  console.log("Tentative de connexion :", login); // Debug

  if (!login || !mot_de_passe) {
    return res.status(400).json({ message: 'Login et mot de passe requis.' });
  }

  connection.query(
    'SELECT * FROM employes WHERE login = ?',
    [login],
    (err, results) => {
      if (err) {
        console.error("Erreur SQL :", err);
        return res.status(500).json({ message: 'Erreur serveur.' });
      }

      if (results.length === 0) {
        return res.status(401).json({ message: 'Utilisateur non trouvé.' });
      }

      const utilisateur = results[0];

      bcrypt.compare(mot_de_passe, utilisateur.mot_de_passe, (err, isMatch) => {
        if (err) {
          console.error("Erreur bcrypt :", err);
          return res.status(500).json({ message: 'Erreur interne.' });
        }

        if (!isMatch) {
          return res.status(401).json({ message: 'Mot de passe incorrect.' });
        }

        res.status(200).json({ message: 'Connexion réussie', user: utilisateur });
      });
    }
  );
});

module.exports = router;
