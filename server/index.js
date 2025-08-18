require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const logger = require('./utils/logger');

// Import routes
const jobRoutes = require('./routes/jobs');
const configRoutes = require('./routes/config');
const sheetsRoutes = require('./routes/sheets');
const automationRoutes = require('./routes/automation');
const enrichmentRoutes = require('./routes/enrichment');
const captchaRoutes = require('./routes/captcha');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for large job data
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes
app.use('/api/jobs', jobRoutes);
app.use('/api/config', configRoutes);
app.use('/api/sheets', sheetsRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api/enrichment', enrichmentRoutes);
app.use('/api/captcha', captchaRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// Serve static files from React build (in production)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
});

// Extend server timeouts for long-running enrichment
server.setTimeout(10800000); // 3 hours
server.headersTimeout = 10800050;
server.keepAliveTimeout = 10800050; 