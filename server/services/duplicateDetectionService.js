const logger = require('../utils/logger');

class DuplicateDetectionService {
  constructor() {
    this.similarityThreshold = 0.85; // Порог схожести для определения дубликатов
  }

  /**
   * Проверяет, является ли вакансия дубликатом существующих
   * @param {Object} newJob - Новая вакансия для проверки
   * @param {Array} existingJobs - Массив существующих вакансий
   * @returns {Object|null} Информация о дубликате или null
   */
  detectDuplicate(newJob, existingJobs) {
    try {
      if (!existingJobs || existingJobs.length === 0) {
        return null;
      }

      // Нормализуем данные новой вакансии
      const normalizedNewJob = this.normalizeJob(newJob);
      
      let bestMatch = null;
      let highestSimilarity = 0;

      for (const existingJob of existingJobs) {
        const normalizedExistingJob = this.normalizeJob(existingJob);
        
        // Проверяем точное совпадение по ID
        if (normalizedNewJob.id === normalizedExistingJob.id) {
          return {
            type: 'exact_id_match',
            existingJob: existingJob,
            similarity: 1.0,
            reason: 'Exact ID match'
          };
        }

        // Проверяем схожесть по основным параметрам
        const similarity = this.calculateSimilarity(normalizedNewJob, normalizedExistingJob);
        
        if (similarity > highestSimilarity) {
          highestSimilarity = similarity;
          bestMatch = existingJob;
        }
      }

      // Если схожесть выше порога, считаем дубликатом
      if (highestSimilarity >= this.similarityThreshold && bestMatch) {
        return {
          type: 'similar_job',
          existingJob: bestMatch,
          similarity: highestSimilarity,
          reason: this.getSimilarityReason(normalizedNewJob, this.normalizeJob(bestMatch))
        };
      }

      return null;
    } catch (error) {
      logger.error('Error detecting duplicate', { 
        error: error.message, 
        newJobId: newJob?.id 
      });
      return null;
    }
  }

  /**
   * Нормализует данные вакансии для сравнения
   * @param {Object} job - Вакансия
   * @returns {Object} Нормализованная вакансия
   */
  normalizeJob(job) {
    return {
      id: (job.id || '').toString().toLowerCase().trim(),
      title: (job.title || '').toLowerCase().trim(),
      company: (job.company || '').toLowerCase().trim(),
      location: (job.location || '').toLowerCase().trim(),
      description: (job.description || '').toLowerCase().trim(),
      employmentType: (job.employmentType || '').toLowerCase().trim(),
      workingTime: (job.workingTime || '').toLowerCase().trim(),
      // Добавляем извлеченные данные о компании
      extractedCompanyName: (job.extractedCompanyName || '').toLowerCase().trim(),
      companyAddress: (job.companyAddress || '').toLowerCase().trim(),
      contactPerson: (job.contactPerson || '').toLowerCase().trim()
    };
  }

  /**
   * Вычисляет схожесть между двумя вакансиями
   * @param {Object} job1 - Первая вакансия
   * @param {Object} job2 - Вторая вакансия
   * @returns {number} Коэффициент схожести (0-1)
   */
  calculateSimilarity(job1, job2) {
    const weights = {
      title: 0.35,        // Заголовок вакансии - самый важный
      company: 0.25,      // Название компании
      location: 0.20,     // Местоположение
      description: 0.15,  // Описание
      employmentType: 0.05 // Тип занятости
    };

    let totalSimilarity = 0;
    let totalWeight = 0;

    // Схожесть заголовка
    if (job1.title && job2.title) {
      const titleSimilarity = this.calculateTextSimilarity(job1.title, job2.title);
      totalSimilarity += titleSimilarity * weights.title;
      totalWeight += weights.title;
    }

    // Схожесть компании
    if (job1.company && job2.company) {
      const companySimilarity = this.calculateTextSimilarity(job1.company, job2.company);
      totalSimilarity += companySimilarity * weights.company;
      totalWeight += weights.company;
    }

    // Схожесть местоположения
    if (job1.location && job2.location) {
      const locationSimilarity = this.calculateTextSimilarity(job1.location, job2.location);
      totalSimilarity += locationSimilarity * weights.location;
      totalWeight += weights.location;
    }

    // Схожесть описания (если есть)
    if (job1.description && job2.description) {
      const descSimilarity = this.calculateTextSimilarity(job1.description, job2.description);
      totalSimilarity += descSimilarity * weights.description;
      totalWeight += weights.description;
    }

    // Схожесть типа занятости
    if (job1.employmentType && job2.employmentType) {
      const typeSimilarity = this.calculateTextSimilarity(job1.employmentType, job2.employmentType);
      totalSimilarity += typeSimilarity * weights.employmentType;
      totalWeight += weights.employmentType;
    }

    // Проверяем специальные случаи для MW PowerEngineering GmbH
    if (this.isSpecialCompanyCase(job1, job2)) {
      totalSimilarity += 0.1; // Бонус за специальный случай
      totalWeight += 0.1;
    }

    return totalWeight > 0 ? totalSimilarity / totalWeight : 0;
  }

  /**
   * Проверяет специальные случаи для определенных компаний
   * @param {Object} job1 - Первая вакансия
   * @param {Object} job2 - Вторая вакансия
   * @returns {boolean} Является ли специальным случаем
   */
  isSpecialCompanyCase(job1, job2) {
    const specialCompanies = [
      'mw powerengineering gmbh',
      'stiegler personalmanagement gmbh'
    ];

    const company1 = job1.company || job1.extractedCompanyName || '';
    const company2 = job2.company || job2.extractedCompanyName || '';

    return specialCompanies.some(special => 
      company1.includes(special) && company2.includes(special)
    );
  }

  /**
   * Вычисляет схожесть между двумя текстами
   * @param {string} text1 - Первый текст
   * @param {string} text2 - Второй текст
   * @returns {number} Коэффициент схожести (0-1)
   */
  calculateTextSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    if (text1 === text2) return 1;

    // Простая схожесть на основе общих слов
    const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 2));
    const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 2));

    if (words1.size === 0 || words2.size === 0) return 0;

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Возвращает причину схожести
   * @param {Object} job1 - Первая вакансия
   * @param {Object} job2 - Вторая вакансия
   * @returns {string} Причина схожести
   */
  getSimilarityReason(job1, job2) {
    const reasons = [];

    if (this.calculateTextSimilarity(job1.title, job2.title) > 0.8) {
      reasons.push('Similar job titles');
    }

    if (this.calculateTextSimilarity(job1.company, job2.company) > 0.8) {
      reasons.push('Same company');
    }

    if (this.calculateTextSimilarity(job1.location, job2.location) > 0.8) {
      reasons.push('Same location');
    }

    if (this.isSpecialCompanyCase(job1, job2)) {
      reasons.push('Special company case (MW PowerEngineering/Stiegler)');
    }

    return reasons.join(', ') || 'Multiple similar attributes';
  }

  /**
   * Фильтрует дубликаты из массива вакансий
   * @param {Array} jobs - Массив вакансий
   * @returns {Object} Результат фильтрации
   */
  filterDuplicates(jobs) {
    const uniqueJobs = [];
    const duplicates = [];
    const duplicateGroups = [];

    for (let i = 0; i < jobs.length; i++) {
      const currentJob = jobs[i];
      let isDuplicate = false;

      // Проверяем, является ли текущая вакансия дубликатом уже обработанных
      for (let j = 0; j < uniqueJobs.length; j++) {
        const existingJob = uniqueJobs[j];
        const duplicateInfo = this.detectDuplicate(currentJob, [existingJob]);

        if (duplicateInfo) {
          isDuplicate = true;
          duplicates.push({
            newJob: currentJob,
            existingJob: existingJob,
            duplicateInfo: duplicateInfo
          });

          // Группируем дубликаты
          let groupFound = false;
          for (const group of duplicateGroups) {
            if (group.some(job => job.id === existingJob.id)) {
              group.push(currentJob);
              groupFound = true;
              break;
            }
          }
          if (!groupFound) {
            duplicateGroups.push([existingJob, currentJob]);
          }

          break;
        }
      }

      if (!isDuplicate) {
        uniqueJobs.push(currentJob);
      }
    }

    return {
      uniqueJobs,
      duplicates,
      duplicateGroups,
      totalOriginal: jobs.length,
      totalUnique: uniqueJobs.length,
      totalDuplicates: duplicates.length
    };
  }

  /**
   * Логирует информацию о дубликатах
   * @param {Object} filterResult - Результат фильтрации
   */
  logDuplicateInfo(filterResult) {
    logger.info('Duplicate detection completed', {
      totalOriginal: filterResult.totalOriginal,
      totalUnique: filterResult.totalUnique,
      totalDuplicates: filterResult.totalDuplicates
    });

    if (filterResult.duplicates.length > 0) {
      logger.info('Duplicates found', {
        duplicateCount: filterResult.duplicates.length,
        examples: filterResult.duplicates.slice(0, 3).map(d => ({
          newJob: { id: d.newJob.id, title: d.newJob.title, company: d.newJob.company },
          existingJob: { id: d.existingJob.id, title: d.existingJob.title, company: d.existingJob.company },
          similarity: d.duplicateInfo.similarity,
          reason: d.duplicateInfo.reason
        }))
      });
    }
  }
}

module.exports = new DuplicateDetectionService(); 