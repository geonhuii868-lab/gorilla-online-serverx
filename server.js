const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));
app.use('/api/', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET;
const DEV_NAME = process.env.DEVELOPER_NICKNAME || '개발자';
const DEV_PASSWORD = process.env.DEVELOPER_PASSWORD;
if (!JWT_SECRET || JWT_SECRET.length < 32) { console.error('ERROR: JWT_SECRET must be a random string of at least 32 characters.'); process.exit(1); }
if (!DEV_PASSWORD || DEV_PASSWORD.length < 12 || DEV_PASSWORD.startsWith('replace_')) { console.error('ERROR: Set a strong DEVELOPER_PASSWORD (12+ characters) in environment variables.'); process.exit(1); }
const DB_FILE = path.join(__dirname, 'data.json');
let db = { players: {}, users: {} };
try { if (fs.existsSync(DB_FILE)) db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }; } catch (e) { console.error('Could not read data.json:', e.message); }
function persist() { const tmp = DB_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db, null, 2)); fs.renameSync(tmp, DB_FILE); }
function cleanName(v) { return String(v || '').trim().replace(/[<>\u0000-\u001f]/g, '').slice(0, 16); }
function sign(user) { return jwt.sign({ id: user.id, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '30d' }); }
function auth(req, res, next) { const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''); try { req.user = jwt.verify(token, JWT_SECRET); next(); } catch { res.status(401).json({ error: '로그인이 필요합니다.' }); } }
function developer(req, res, next) { if (req.user.role !== 'developer') return res.status(403).json({ error: '개발자 권한이 없습니다.' }); next(); }
function publicPlayer(p) { return { id: p.id, name: p.name, level: p.level || 1, online: Date.now() - (p.lastSeen || 0) < 45000 }; }

app.post('/api/register', async (req, res) => {
  const name = cleanName(req.body.name), password = String(req.body.password || '');
  if (name.length < 2 || password.length < 8 || password.length > 128) return res.status(400).json({ error: '닉네임은 2~16자, 비밀번호는 8~128자로 입력하세요.' });
  if (name.toLowerCase() === DEV_NAME.toLowerCase()) return res.status(400).json({ error: '개발자 계정은 별도로 설정한 계정만 사용할 수 있습니다.' });
  if (Object.values(db.users).some(u => u.name.toLowerCase() === name.toLowerCase())) return res.status(409).json({ error: '이미 사용 중인 닉네임입니다.' });
  const user = { id: crypto.randomUUID(), name, passwordHash: await bcrypt.hash(password, 12), role: 'player', createdAt: Date.now() };
  db.users[user.id] = user; db.players[user.id] = { id: user.id, name, level: 1, save: {}, inbox: [], lastSeen: Date.now() }; persist();
  res.json({ token: sign(user), player: publicPlayer(db.players[user.id]) });
});
app.post('/api/login', async (req, res) => {
  const name = cleanName(req.body.name), password = String(req.body.password || '');
  const user = Object.values(db.users).find(u => u.name.toLowerCase() === name.toLowerCase());
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: '닉네임 또는 비밀번호가 올바르지 않습니다.' });
  res.json({ token: sign(user), player: publicPlayer(db.players[user.id]) });
});
app.post('/api/developer/login', async (req, res) => {
  const name = cleanName(req.body.name), password = String(req.body.password || '');
  if (name !== DEV_NAME || password !== DEV_PASSWORD) return res.status(401).json({ error: '개발자 로그인 정보가 올바르지 않습니다.' });
  let user = Object.values(db.users).find(u => u.role === 'developer');
  if (!user) { user = { id: 'developer-root', name: DEV_NAME, passwordHash: await bcrypt.hash(DEV_PASSWORD, 12), role: 'developer', createdAt: Date.now() }; db.users[user.id] = user; db.players[user.id] ||= { id: user.id, name: DEV_NAME, level: 1, save: {}, inbox: [], lastSeen: Date.now() }; persist(); }
  res.json({ token: sign(user), player: publicPlayer(db.players[user.id]) });
});
app.get('/api/me', auth, (req, res) => { const p = db.players[req.user.id]; if (!p) return res.status(404).json({ error: '플레이어를 찾을 수 없습니다.' }); res.json({ player: publicPlayer(p), save: p.save || {} }); });
app.get('/api/players', auth, (req, res) => { res.json({ players: Object.values(db.players).map(publicPlayer).sort((a,b) => b.level-a.level) }); });
app.put('/api/me/save', auth, (req, res) => {
  const p = db.players[req.user.id]; if (!p) return res.status(404).json({ error: '플레이어를 찾을 수 없습니다.' });
  const save = req.body.save; if (!save || typeof save !== 'object' || Array.isArray(save)) return res.status(400).json({ error: '저장 데이터 형식이 올바르지 않습니다.' });
  p.save = save; p.level = Math.max(1, Math.min(1_000_000_000, Number(save.level) || 1)); p.lastSeen = Date.now(); persist(); res.json({ ok: true });
});
app.post('/api/heartbeat', auth, (req, res) => { const p = db.players[req.user.id]; if (!p) return res.status(404).json({ error: '플레이어를 찾을 수 없습니다.' }); p.lastSeen = Date.now(); p.level = Math.max(1, Number(req.body.level) || p.level || 1); persist(); res.json({ ok: true }); });
app.get('/api/rewards', auth, (req, res) => { const p = db.players[req.user.id]; if (!p) return res.status(404).json({ error: '플레이어를 찾을 수 없습니다.' }); const rewards = p.inbox || []; p.inbox = []; persist(); res.json({ rewards }); });
app.post('/api/developer/grant', auth, developer, (req, res) => {
  const { targetId, reward } = req.body || {}; const target = db.players[String(targetId || '')];
  if (!target) return res.status(404).json({ error: '대상 플레이어를 찾을 수 없습니다.' });
  if (!reward || !['sword','currency','level','title','ability'].includes(reward.type)) return res.status(400).json({ error: '지원하지 않는 보상입니다.' });
  const safe = { id: crypto.randomUUID(), ...reward, issuedAt: Date.now(), issuedBy: req.user.name };
  if (JSON.stringify(safe).length > 2000) return res.status(400).json({ error: '보상 데이터가 너무 큽니다.' });
  target.inbox ||= []; target.inbox.push(safe); target.lastSeen = target.lastSeen || Date.now(); persist(); res.json({ ok: true, message: `${target.name}에게 보상을 지급 대기열에 추가했습니다.` });
});
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`Gorilla game server listening on port ${PORT}`));
