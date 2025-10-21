import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import eventsRouter from './eventsRouter.js';
import adminRouter, { requireAdmin } from './adminRouter.js';
import paymentsRouter from './paymentsRouter.js';
import './queue.js'; // comment this if you run workers separately
const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use('/api', eventsRouter);
app.use('/api', paymentsRouter);
app.use('/api/admin', adminRouter);

app.use(express.static(path.join(__dirname, 'public')));
app.get('/admin', (req,res)=> res.sendFile(path.join(__dirname,'public','admin.html')));
app.get('/admin/offers', (req,res)=> res.sendFile(path.join(__dirname,'public','admin_offers.html')));

app.get('/health', (req,res)=> res.json({ ok:true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('DISCO API listening on', PORT));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log('DISCO API listening on', port));
