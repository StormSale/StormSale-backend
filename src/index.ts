import express from 'express';
import cors from 'cors';
import userRoutes from './routes/user.routes';
import campaignRoutes from './routes/campaign.routes';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/users', userRoutes);
app.use('/api/campaigns', campaignRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(`🚀 StormSale Backend running on http://localhost:${PORT}`);
});
