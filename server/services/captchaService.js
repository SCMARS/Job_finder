const { Solver } = require('2captcha');
const logger = require('../utils/logger');

class CaptchaService {
  constructor() {
    this.apiKey = process.env.TWOCAPTCHA_API_KEY;
    this.solver = new Solver(this.apiKey);
    
    if (!this.apiKey) {
      logger.warn('2Captcha API key not found in environment variables');
    } else {
      logger.info('2Captcha service initialized successfully');
    }
  }

  /**
   * Решает обычную текстовую капчу через 2Captcha
   * @param {Buffer|string} imageData - Buffer изображения или base64 строка
   * @returns {Promise<string|null>} - Распознанный текст или null при ошибке
   */
  async solveCaptcha(imageData) {
    try {
      if (!this.apiKey) {
        logger.error('2Captcha API key not configured');
        return null;
      }

      logger.info('🔍 Отправляю капчу в 2Captcha для решения...');
      
      // Проверяем размер изображения
      const imageSize = Buffer.isBuffer(imageData) ? imageData.length : imageData.length;
      logger.info(`📊 Размер CAPTCHA изображения: ${imageSize} байт`);

      if (imageSize === 0) {
        logger.error('❌ Изображение CAPTCHA имеет размер 0 байт');
        return null;
      }
      
      let imageForSending;
      
      if (Buffer.isBuffer(imageData)) {
        // Конвертируем Buffer в base64
        imageForSending = imageData.toString('base64');
      } else if (typeof imageData === 'string') {
        // Уже строка (возможно base64)
        imageForSending = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      } else {
        throw new Error('Неподдерживаемый формат изображения');
      }

      // Отправляем в 2Captcha (правильный API для версии 3.0.5)
      const result = await this.solver.imageCaptcha(imageForSending, {
        numeric: 0, // 0 = любые символы, 1 = только цифры, 2 = только буквы
        min_len: 5,
        max_len: 7,
        phrase: 0, // 0 = одно слово, 1 = фраза из нескольких слов
        regsense: 1, // 1 = чувствительно к регистру, соответствует форме
        calc: 0, // 0 = обычная капча, 1 = математическое выражение
        lang: 'de' // язык капчи (немецкий)
      });

      // Разные версии библиотеки возвращают разные форматы: строка или объект { data, id } / { code }
      let solvedText = null;
      if (result && typeof result === 'string') {
        solvedText = result;
      } else if (result && typeof result === 'object') {
        // Популярные поля: data (строка решения), code (иногда)
        solvedText = result.data || result.code || null;
      }

      if (solvedText && typeof solvedText === 'string' && solvedText.trim().length > 0) {
        const captchaText = solvedText.trim();
        logger.info(`✅ 2Captcha успешно решила капчу: "${captchaText}"`);
        return captchaText;
      } else {
        logger.error('2Captcha вернула пустой результат', { result });
        return null;
      }

    } catch (error) {
      logger.error('❌ Ошибка при решении капчи через 2Captcha:', {
        error: error.message,
        stack: error.stack
      });
      return null;
    }
  }

  /**
   * Решает reCaptcha v2 через 2Captcha
   * @param {string} siteKey - Ключ сайта для reCaptcha
   * @param {string} pageUrl - URL страницы с капчей
   * @returns {Promise<string|null>} - Токен решения или null при ошибке
   */
  async solveRecaptchaV2(siteKey, pageUrl) {
    try {
      if (!this.apiKey) {
        logger.error('2Captcha API key not configured');
        return null;
      }

      logger.info('🔍 Решаю reCaptcha v2 через 2Captcha...', { siteKey, pageUrl });

      const result = await this.solver.recaptcha({
        googlekey: siteKey,
        pageurl: pageUrl
      });

      if (result && result.data) {
        const token = result.data;
        logger.info('✅ reCaptcha v2 успешно решена через 2Captcha');
        return token;
      } else {
        logger.error('2Captcha не смогла решить reCaptcha v2');
        return null;
      }

    } catch (error) {
      logger.error('❌ Ошибка при решении reCaptcha v2:', {
        error: error.message,
        stack: error.stack
      });
      return null;
    }
  }

  /**
   * Решает hCaptcha через 2Captcha
   * @param {string} siteKey - Ключ сайта для hCaptcha
   * @param {string} pageUrl - URL страницы с капчей
   * @returns {Promise<string|null>} - Токен решения или null при ошибке
   */
  async solveHCaptcha(siteKey, pageUrl) {
    try {
      if (!this.apiKey) {
        logger.error('2Captcha API key not configured');
        return null;
      }

      logger.info('🔍 Решаю hCaptcha через 2Captcha...', { siteKey, pageUrl });

      const result = await this.solver.hcaptcha({
        sitekey: siteKey,
        pageurl: pageUrl
      });

      if (result && result.data) {
        const token = result.data;
        logger.info('✅ hCaptcha успешно решена через 2Captcha');
        return token;
      } else {
        logger.error('2Captcha не смогла решить hCaptcha');
        return null;
      }

    } catch (error) {
      logger.error('❌ Ошибка при решении hCaptcha:', {
        error: error.message,
        stack: error.stack
      });
      return null;
    }
  }

  /**
   * Проверяет баланс аккаунта 2Captcha
   * @returns {Promise<number|null>} - Баланс в USD или null при ошибке
   */
  async getBalance() {
    try {
      if (!this.apiKey) {
        logger.error('2Captcha API key not configured');
        return null;
      }

      const result = await this.solver.balance();
      
      if (result && typeof result === 'number') {
        const balance = parseFloat(result);
        logger.info(`💰 Баланс 2Captcha: $${balance}`);
        return balance;
      } else {
        logger.error('Не удалось получить баланс 2Captcha', { result });
        return null;
      }

    } catch (error) {
      logger.error('❌ Ошибка при получении баланса 2Captcha:', {
        error: error.message,
        stack: error.stack
      });
      return null;
    }
  }

  /**
   * Проверяет работоспособность 2Captcha API
   * @returns {Promise<boolean>} - true если API работает
   */
  async testConnection() {
    try {
      const balance = await this.getBalance();
      return balance !== null;
    } catch (error) {
      logger.error('❌ 2Captcha API недоступно:', error.message);
      return false;
    }
  }
}

module.exports = new CaptchaService(); 