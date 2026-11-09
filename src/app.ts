import express from 'express';
import cors from 'cors';
import userRoutes from './routes/user.routes';
import campaignRoutes from './routes/campaign.routes';
import organizationRoutes from './routes/organization.routes';
import referralRoutes from './routes/referral.routes';
import fraudRoutes from './routes/fraud.routes';
import shortLinkRoutes from './routes/shortlink.routes';
import webhookRoutes from './routes/webhook.routes';

const app = express();

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/fraud', fraudRoutes);
app.use('/api/links', shortLinkRoutes);
app.use('/api/webhooks', webhookRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

export { app };
export default app;
