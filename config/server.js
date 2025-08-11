const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const mysql = require('mysql');

// Connexion à la base de données
const db = mysql.createConnection({
  host: '192.168.11.105',
  user: 'root',
  password: '',
  database: 'gestion_stock',
});

db.connect((err) => {
  if (err) {
    console.error('Erreur de connexion à la base de données:', err);
  } else {
    console.log('✅ Connecté à la base de données MySQL.');
  }
});

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Routes personnalisées (à adapter si tu as ces fichiers)
const produitsRoutes = require('../routes/produitsPM');
const commandesRoutes = require('../routes/cmdRoute');
const achatsRoutes = require('../routes/achatsRoute');
const clientsRoutes = require('../routes/clientsRoute');

app.use('/api/produits', produitsRoutes);
app.use('/api/commandes', commandesRoutes);
app.use('/api/achats', achatsRoutes);
app.use('/api/clients', clientsRoutes);

// Route de login corrigée
app.post('/api/login', (req, res) => {
  const { login, mot_de_passe } = req.body;

  if (!login || !mot_de_passe) {
    return res.status(400).json({ success: false, message: 'Champs requis manquants.' });
  }

  const sql = 'SELECT * FROM employes WHERE login = ?';
  db.query(sql, [login], async (err, results) => {
    if (err) {
      console.error('Erreur SQL:', err);
      return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }

    if (results.length === 0) {
      return res.status(401).json({ success: false, message: 'Utilisateur non trouvé.' });
    }

    const user = results[0];
    const passwordMatch = await bcrypt.compare(mot_de_passe, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Mot de passe incorrect.' });
    }

    res.json({
      success: true,
      message: 'Connexion réussie',
      user: {
        id: user.id,
        login: user.login,
        matricule: user.matricule,
      },
    });
  });
});

// Route test
app.get('/', (req, res) => {
  res.send('✅ API gestion stock est en ligne');
});

// Démarrage du serveur
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});
