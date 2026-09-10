import express from 'express';
import cors from 'cors';
import userRoutes from './routes/user.routes';
import campaignRoutes from './routes/campaign.routes';

const app = express();

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/campaigns', campaignRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

export { app };
export default app;
