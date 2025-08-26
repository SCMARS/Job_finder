const logger = require('../utils/logger');

class WorkTypeFilterService {
  constructor() {
    // Типы работы, которые нужно исключить
    this.excludedWorkTypes = [
      'zeitarbeit',
      'minijob',
      'temporary work',
      'temp work',
      'interim',
      'arbeitnehmerüberlassung',
      'personaldienstleistung'
    ];

    // Немецкие варианты
    this.excludedGermanWorkTypes = [
      'zeitarbeit',
      'minijob',
      'befristet',
      'temporär',
      'interim',
      'arbeitnehmerüberlassung',
      'personaldienstleistung',
      'personalvermittlung'
    ];

    logger.info('WorkTypeFilterService initialized', {
      excludedTypes: this.excludedWorkTypes.length,
      excludedGermanTypes: this.excludedGermanWorkTypes.length
    });
  }

  /**
   * Проверяет, является ли компания временным агентством по названию
   * @param {string} companyName - Название компании
   * @returns {boolean} true если это временное агентство
   */
  isTempAgencyByCompanyName(companyName) {
    if (!companyName) return false;
    
    const company = String(companyName).toLowerCase().trim();
    
    // Расширенный список ключевых слов для временных агентств
    const tempAgencyKeywords = [
      'personal', 'personaldienst', 'personalservice', 'personalmanagement',
      'zeitarbeit', 'zeitarbeits', 'arbeitnehmerüberlassung', 'personaldienstleistung',
      'personalvermittlung', 'interim', 'temporary', 'temp', 'staffing',
      'recruiting', 'recruitment', 'hr', 'human resources', 'consulting',
      'premium', 'expert', 'partner', 'time', 'bindan', 'hofmann', 'trio',
      'office people', 'bks personal', 'personalhansa', 'jobsvs', 'timepartner',
      'xpertia', 'alphaconsult', 'peag personal', 'faktor m', 'persona service'
    ];
    
    return tempAgencyKeywords.some(keyword => company.includes(keyword));
  }

  /**
   * Проверяет, нужно ли исключить вакансию по типу работы
   * @param {Object} job - Вакансия для проверки
   * @returns {boolean} true если вакансию нужно исключить
   */
  shouldExcludeJob(job) {
    try {
      if (!job) return false;

      // ПРИОРИТЕТ 1: Проверяем название компании на временные агентства
      if (job.company) {
        const companyName = String(job.company).toLowerCase().trim();
        
        // Расширенный список ключевых слов для временных агентств
        const tempAgencyKeywords = [
          'personal', 'personaldienst', 'personalservice', 'personalmanagement',
          'zeitarbeit', 'zeitarbeits', 'arbeitnehmerüberlassung', 'personaldienstleistung',
          'personalvermittlung', 'interim', 'temporary', 'temp', 'staffing',
          'recruiting', 'recruitment', 'hr', 'human resources', 'consulting',
          'premium', 'expert', 'partner', 'time', 'bindan', 'hofmann', 'trio',
          'office people', 'bks personal', 'personalhansa', 'jobsvs', 'timepartner',
          'xpertia', 'alphaconsult', 'peag personal', 'faktor m', 'persona service'
        ];
        
        if (tempAgencyKeywords.some(keyword => companyName.includes(keyword))) {
          logger.debug('Job excluded by company name (temp agency)', {
            jobId: job.id,
            company: job.company,
            reason: 'Company name contains temporary agency keywords'
          });
          return true;
        }
      }

      // ПРИОРИТЕТ 2: Проверяем поле workingTime (Arbeitszeit)
      if (job.workingTime) {
        const workingTime = String(job.workingTime).toLowerCase().trim();
        if (this.excludedWorkTypes.some(type => workingTime.includes(type))) {
          logger.debug('Job excluded by workingTime', {
            jobId: job.id,
            workingTime: job.workingTime,
            reason: 'Matches excluded work type'
          });
          return true;
        }
      }

      // ПРИОРИТЕТ 3: Проверяем поле employmentType (Befristung)
      if (job.employmentType) {
        const employmentType = String(job.employmentType).toLowerCase().trim();
        if (this.excludedWorkTypes.some(type => employmentType.includes(type))) {
          logger.debug('Job excluded by employmentType', {
            jobId: job.id,
            employmentType: job.employmentType,
            reason: 'Matches excluded employment type'
          });
          return true;
        }
      }

      // ПРИОРИТЕТ 4: Проверяем описание вакансии на наличие ключевых слов
      if (job.description) {
        const description = String(job.description).toLowerCase();
        if (this.excludedWorkTypes.some(type => description.includes(type))) {
          logger.debug('Job excluded by description keywords', {
            jobId: job.id,
            reason: 'Description contains excluded work type keywords'
          });
          return true;
        }
      }

      // ПРИОРИТЕТ 5: Проверяем требования на наличие ключевых слов
      if (job.requirements) {
        const requirements = String(job.requirements).toLowerCase();
        if (this.excludedWorkTypes.some(type => requirements.includes(type))) {
          logger.debug('Job excluded by requirements keywords', {
            jobId: job.id,
            reason: 'Requirements contain excluded work type keywords'
          });
          return true;
        }
      }

      // ПРИОРИТЕТ 6: Проверяем название вакансии на наличие ключевых слов
      if (job.title) {
        const title = String(job.title).toLowerCase();
        if (this.excludedWorkTypes.some(type => title.includes(type))) {
          logger.debug('Job excluded by title keywords', {
            jobId: job.id,
            title: job.title,
            reason: 'Title contains excluded work type keywords'
          });
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('Error checking if job should be excluded', {
        error: error.message,
        jobId: job?.id
      });
      return false; // В случае ошибки не исключаем вакансию
    }
  }

  /**
   * Фильтрует массив вакансий, исключая нежелательные типы работы
   * @param {Array} jobs - Массив вакансий для фильтрации
   * @returns {Object} Результат фильтрации
   */
  filterJobs(jobs) {
    try {
      if (!Array.isArray(jobs)) {
        logger.warn('Invalid jobs array provided to filterJobs', { jobs });
        return { filteredJobs: [], excludedCount: 0, totalCount: 0 };
      }

      const totalCount = jobs.length;
      const filteredJobs = [];
      const excludedJobs = [];
      let excludedByCompanyName = 0;
      let excludedByWorkType = 0;
      let excludedByEmploymentType = 0;
      let excludedByDescription = 0;
      let excludedByRequirements = 0;
      let excludedByTitle = 0;

      for (const job of jobs) {
        if (this.shouldExcludeJob(job)) {
          excludedJobs.push(job);
          
          // Подсчитываем причины исключения для статистики
          if (job.company && this.isTempAgencyByCompanyName(job.company)) {
            excludedByCompanyName++;
          } else if (job.workingTime && this.excludedWorkTypes.some(type => 
            String(job.workingTime).toLowerCase().includes(type))) {
            excludedByWorkType++;
          } else if (job.employmentType && this.excludedWorkTypes.some(type => 
            String(job.employmentType).toLowerCase().includes(type))) {
            excludedByEmploymentType++;
          } else if (job.description && this.excludedWorkTypes.some(type => 
            String(job.description).toLowerCase().includes(type))) {
            excludedByDescription++;
          } else if (job.requirements && this.excludedWorkTypes.some(type => 
            String(job.requirements).toLowerCase().includes(type))) {
            excludedByRequirements++;
          } else if (job.title && this.excludedWorkTypes.some(type => 
            String(job.title).toLowerCase().includes(type))) {
            excludedByTitle++;
          }
        } else {
          filteredJobs.push(job);
        }
      }

      const excludedCount = excludedJobs.length;
      const filteredCount = filteredJobs.length;

      // Логируем статистику фильтрации
      if (excludedCount > 0) {
        logger.info('Work type filtering completed', {
          totalCount,
          filteredCount,
          excludedCount,
          excludedByCompanyName,
          excludedByWorkType,
          excludedByEmploymentType,
          excludedByDescription,
          excludedByRequirements,
          excludedByTitle,
          filterPercent: Math.round((excludedCount / totalCount) * 100) + '%'
        });

        // Логируем примеры исключенных вакансий
        if (excludedJobs.length > 0) {
          logger.debug('Examples of excluded jobs', {
            examples: excludedJobs.slice(0, 3).map(job => ({
              id: job.id,
              title: job.title,
              company: job.company,
              workingTime: job.workingTime,
              employmentType: job.employmentType
            }))
          });
        }
      }

              return {
          filteredJobs,
          excludedJobs,
          excludedCount,
          filteredCount,
          totalCount,
          statistics: {
            excludedByCompanyName,
            excludedByWorkType,
            excludedByEmploymentType,
            excludedByDescription,
            excludedByRequirements,
            excludedByTitle
          }
        };
    } catch (error) {
      logger.error('Error filtering jobs by work type', {
        error: error.message,
        jobsCount: jobs?.length
      });
      return { filteredJobs: jobs || [], excludedCount: 0, totalCount: jobs?.length || 0 };
    }
  }

  /**
   * Получает статистику по исключенным типам работы
   * @returns {Object} Статистика фильтрации
   */
  getStats() {
    return {
      excludedWorkTypes: this.excludedWorkTypes,
      excludedGermanWorkTypes: this.excludedGermanWorkTypes,
      totalExcludedTypes: this.excludedWorkTypes.length,
      totalExcludedGermanTypes: this.excludedGermanWorkTypes.length,
      description: 'Filters out temporary work, Zeitarbeit, Minijob and similar employment types'
    };
  }

  /**
   * Добавляет новый тип работы для исключения
   * @param {string} workType - Новый тип работы для исключения
   */
  addExcludedWorkType(workType) {
    if (workType && typeof workType === 'string') {
      const normalizedType = workType.toLowerCase().trim();
      if (!this.excludedWorkTypes.includes(normalizedType)) {
        this.excludedWorkTypes.push(normalizedType);
        logger.info('Added new excluded work type', { workType: normalizedType });
      }
    }
  }

  /**
   * Удаляет тип работы из списка исключений
   * @param {string} workType - Тип работы для удаления из исключений
   */
  removeExcludedWorkType(workType) {
    if (workType && typeof workType === 'string') {
      const normalizedType = workType.toLowerCase().trim();
      const index = this.excludedWorkTypes.indexOf(normalizedType);
      if (index > -1) {
        this.excludedWorkTypes.splice(index, 1);
        logger.info('Removed excluded work type', { workType: normalizedType });
      }
    }
  }
}

module.exports = new WorkTypeFilterService(); 