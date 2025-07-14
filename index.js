const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const axios = require('axios');

const app = express();

// Render fournit le port dans process.env.PORT
const PORT = process.env.PORT || 3000;

// Render fournit l'hostname public dans cette variable
const HOSTNAME = process.env.RENDER_EXTERNAL_HOSTNAME || `localhost:${PORT}`;

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

async function shortenUrl(longUrl) {
  try {
    const res = await axios.get('https://is.gd/create.php', {
      params: { format: 'simple', url: longUrl },
    });
    return res.data;
  } catch (err) {
    console.error('Erreur raccourcisseur URL:', err);
    return longUrl; // Retourne l'URL longue si erreur
  }
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/index.html'));
});

app.get('/api/concerts', (req, res) => {
  const concerts = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/concerts.json')));
  res.json(concerts);
});

app.get('/acheter/:id', (req, res) => {
  const concerts = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/concerts.json')));
  const concert = concerts.find(c => c.id == req.params.id);
  if (!concert) return res.status(404).send('Concert introuvable');

  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Acheter un billet</title><link rel="stylesheet" href="/css/style.css" /></head>
    <body>
      <header>Babi4Show</header>
      <div class="container">
        <h1>🎤 ${concert.artiste}</h1>
        <p>📍 ${concert.lieu}</p>
        <p>📅 ${concert.date}</p>
        <p>💰 ${concert.prix} FCFA</p>
        <form action="/acheter/${concert.id}" method="post">
          <input name="nom" placeholder="Ton nom" required />
          <input name="email" type="email" placeholder="Ton email" required />
          <input name="telephone" type="tel" placeholder="Ton numéro de téléphone" required />
          <input name="quantite" type="number" min="1" max="10" value="1" required />
          <button type="submit">Valider</button>
        </form>
        <a href="/"><button>← Retour</button></a>
      </div>
    </body>
    </html>
  `);
});

app.post('/acheter/:id', async (req, res) => {
  const concerts = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/concerts.json')));
  const concert = concerts.find(c => c.id == req.params.id);
  if (!concert) return res.status(404).send('Concert introuvable');

  const achat = {
    idConcert: concert.id,
    artiste: concert.artiste,
    date: concert.date,
    nom: req.body.nom,
    email: req.body.email,
    telephone: req.body.telephone,
    quantite: req.body.quantite,
    timestamp: new Date().toISOString(),
  };

  const achatsPath = path.join(__dirname, 'data/achats.json');
  const achats = fs.existsSync(achatsPath) ? JSON.parse(fs.readFileSync(achatsPath)) : [];
  achats.push(achat);
  fs.writeFileSync(achatsPath, JSON.stringify(achats, null, 2));

  const qrData = JSON.stringify({
    artiste: achat.artiste,
    nom: achat.nom,
    email: achat.email,
    telephone: achat.telephone,
    quantite: achat.quantite,
    date: achat.date,
    timestamp: achat.timestamp,
  });

  const filename = `${achat.nom.replace(/ /g, "_")}_${Date.now()}.png`;
  const qrDir = path.join(__dirname, 'public/qrcodes');
  if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });
  const qrPath = path.join(qrDir, filename);

  await QRCode.toFile(qrPath, qrData);

  const qrUrl = `https://${HOSTNAME}/qrcodes/${filename}`;
  const shortUrl = await shortenUrl(qrUrl);

  const whatsappMessage = encodeURIComponent(
    `🎟️ Babi4Show - Billet\n` +
    `Nom : ${achat.nom}\n` +
    `Téléphone : ${achat.telephone}\n` +
    `Concert : ${achat.artiste}\n` +
    `Date : ${achat.date}\n` +
    `Billets : ${achat.quantite}\n\n` +
    `👉 Ton QR Code :\n${shortUrl}`
  );

  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Achat confirmé</title><link rel="stylesheet" href="/css/style.css" /></head>
    <body>
      <header>Babi4Show - Confirmation</header>
      <div class="container" style="text-align:center;">
        <h1>Merci ${achat.nom} !</h1>
        <p>Tu as réservé ${achat.quantite} billet(s) pour ${achat.artiste}.</p>
        <p>Voici ton QR code :</p>
        <img src="/qrcodes/${filename}" alt="QR Code" style="width:200px;" />
        <p>📲 Tu peux l’envoyer via WhatsApp :</p>
        <a href="https://wa.me/?text=${whatsappMessage}" target="_blank"><button>Envoyer sur WhatsApp</button></a>
        <br><br>
        <a href="/"><button>Retour à l'accueil</button></a>
      </div>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`🟢 Serveur lancé : http://${HOSTNAME}`);
});
