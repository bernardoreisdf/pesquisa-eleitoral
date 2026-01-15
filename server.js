const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

const db = new sqlite3.Database('./db.sqlite');

// Criar tabelas
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cpf_hash TEXT UNIQUE,
    pagou INTEGER DEFAULT 0,
    votou INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS votos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    primeiro_turno TEXT,
    segundo_turno TEXT
  )`);
});

function hashCPF(cpf) {
  return crypto.createHash('sha256').update(cpf).digest('hex');
}

// Cadastro CPF
app.post('/api/cadastrar', (req, res) => {
  const { cpf } = req.body;
  if (!cpf) return res.status(400).json({ erro: 'CPF obrigatório' });

  const cpfHash = hashCPF(cpf);
  db.run(
    `INSERT OR IGNORE INTO usuarios (cpf_hash) VALUES (?)`,
    [cpfHash],
    () => res.json({ ok: true })
  );
});

// PIX simulado
app.post('/api/pix', (req, res) => {
  const { cpf } = req.body;
  const cpfHash = hashCPF(cpf);

  setTimeout(() => {
    db.run(`UPDATE usuarios SET pagou = 1 WHERE cpf_hash = ?`, [cpfHash]);
  }, 2000);

  res.json({
    valor: 2.0,
    mensagem: 'PIX simulado aprovado (demo)'
  });
});

// Status
app.post('/api/status', (req, res) => {
  const { cpf } = req.body;
  const cpfHash = hashCPF(cpf);

  db.get(
    `SELECT pagou, votou FROM usuarios WHERE cpf_hash = ?`,
    [cpfHash],
    (err, row) => {
      if (!row) return res.json({ pagou: false, votou: false });
      res.json(row);
    }
  );
});

// Votar
app.post('/api/votar', (req, res) => {
  const { cpf, primeiro, segundo } = req.body;
  const cpfHash = hashCPF(cpf);

  db.get(
    `SELECT id, pagou, votou FROM usuarios WHERE cpf_hash = ?`,
    [cpfHash],
    (err, user) => {
      if (!user || !user.pagou || user.votou) {
        return res.status(403).json({ erro: 'Voto não autorizado' });
      }

      db.run(
        `INSERT INTO votos (usuario_id, primeiro_turno, segundo_turno)
         VALUES (?, ?, ?)`,
        [user.id, primeiro, segundo]
      );

      db.run(`UPDATE usuarios SET votou = 1 WHERE id = ?`, [user.id]);
      res.json({ ok: true });
    }
  );
});

// Resultados
app.get('/api/resultados', (req, res) => {
  db.all(
    `SELECT primeiro_turno, COUNT(*) as total
     FROM votos GROUP BY primeiro_turno`,
    (err, rows) => res.json(rows)
  );
});

// Porta dinâmica (Render exige isso)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
