import express from 'express';
import multer from 'multer';
import { readFileSync, writeFileSync, unlinkSync, readdirSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CONTENT_PATH = join(ROOT, 'src', 'data', 'content.json');
const IMAGES_DIR = join(ROOT, 'public', 'images');

const app = express();
app.use(express.json());

// Serve immagini per anteprima
app.use('/images', express.static(IMAGES_DIR));

// Upload foto — salva con nome originale
const upload = multer({
  storage: multer.diskStorage({
    destination: IMAGES_DIR,
    filename: (_req, file, cb) => cb(null, file.originalname),
  }),
});

// ---------- API ----------

// Leggi contenuti
app.get('/api/content', (_req, res) => {
  const data = JSON.parse(readFileSync(CONTENT_PATH, 'utf-8'));
  res.json(data);
});

// Salva contenuti
app.post('/api/content', (req, res) => {
  writeFileSync(CONTENT_PATH, JSON.stringify(req.body, null, 2));
  res.json({ ok: true });
});

// Lista immagini in public/images
app.get('/api/images', (_req, res) => {
  const files = readdirSync(IMAGES_DIR).filter(f =>
    /\.(jpe?g|png|webp|gif)$/i.test(f)
  );
  res.json(files);
});

// Upload immagine
app.post('/api/images/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nessun file' });
  res.json({ filename: req.file.originalname, src: `/images/${req.file.originalname}` });
});

// Elimina immagine
app.delete('/api/images/:filename', (req, res) => {
  try {
    unlinkSync(join(IMAGES_DIR, req.params.filename));
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'File non trovato' });
  }
});

// Deploy su Vercel
app.post('/api/deploy', (_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked' });
  res.write('Avvio deploy su Vercel...\n');

  const child = exec('npx vercel --prod', { cwd: ROOT });
  child.stdout?.on('data', d => res.write(d));
  child.stderr?.on('data', d => res.write(d));
  child.on('close', code => {
    res.write(code === 0 ? '\n✅ Deploy completato!' : '\n❌ Errore nel deploy');
    res.end();
  });
});

// ---------- FRONTEND ----------

app.get('/', (_req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

app.listen(3000, () => {
  console.log('\n🏔️  CMS Rifugio Rosmini');
  console.log('   http://localhost:3000\n');
});
