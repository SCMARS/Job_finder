const express = require('express');
const router = express.Router();
const captchaService = require('../services/captchaService');
const logger = require('../utils/logger');

/**
 * GET /api/captcha/balance
 * Проверяет баланс аккаунта 2Captcha
 */
router.get('/balance', async (req, res) => {
  try {
    logger.info('Checking 2Captcha balance...');
    
    const balance = await captchaService.getBalance();
    
    if (balance !== null) {
      res.json({
        success: true,
        balance: balance,
        currency: 'USD',
        message: `Баланс 2Captcha: $${balance}`
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Не удалось получить баланс 2Captcha'
      });
    }
    
  } catch (error) {
    logger.error('Error checking 2Captcha balance:', error);
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

/**
 * GET /api/captcha/test
 * Тестирует подключение к 2Captcha API
 */
router.get('/test', async (req, res) => {
  try {
    logger.info('Testing 2Captcha API connection...');
    
    const isWorking = await captchaService.testConnection();
    
    if (isWorking) {
      const balance = await captchaService.getBalance();
      res.json({
        success: true,
        status: 'connected',
        balance: balance,
        message: '2Captcha API работает нормально'
      });
    } else {
      res.status(400).json({
        success: false,
        status: 'disconnected',
        error: '2Captcha API недоступно'
      });
    }
    
  } catch (error) {
    logger.error('Error testing 2Captcha API:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при тестировании 2Captcha API'
    });
  }
});

/**
 * POST /api/captcha/solve
 * Решает CAPTCHA изображение через 2Captcha
 * Body: { image: "base64_string" } или { imageUrl: "url" }
 */
router.post('/solve', async (req, res) => {
  try {
    const { image, imageUrl } = req.body;
    
    if (!image && !imageUrl) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо предоставить image (base64) или imageUrl'
      });
    }
    
    logger.info('Solving CAPTCHA via 2Captcha...', {
      hasImage: !!image,
      hasImageUrl: !!imageUrl
    });
    
    let imageData = image;
    if (imageUrl && !image) {
      // Загружаем изображение по URL (для будущей реализации)
      return res.status(400).json({
        success: false,
        error: 'Загрузка по URL пока не поддерживается, используйте base64'
      });
    }
    
    const captchaText = await captchaService.solveCaptcha(imageData);
    
    if (captchaText) {
      res.json({
        success: true,
        text: captchaText,
        message: `CAPTCHA решена: "${captchaText}"`
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Не удалось решить CAPTCHA'
      });
    }
    
  } catch (error) {
    logger.error('Error solving CAPTCHA:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при решении CAPTCHA'
    });
  }
});

module.exports = router; 