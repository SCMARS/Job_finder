const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const contactEnrichmentService = require('./server/services/contactEnrichmentService');
const logger = require('./server/utils/logger');

async function testEnhancedContactExtraction() {
  console.log('🧪 Тестирование расширенного извлечения контактной информации...\n');
  
  
  const testJob = {
    id: 'test-12345-enhanced-S',
    company: 'Stiegler Personalmanagement GmbH',
    title: 'Test Position',
    location: 'Nürnberg',
    description: 'Test job description'
  };
  
  console.log('📝 Тестовая вакансия:', {
    id: testJob.id,
    company: testJob.company,
    title: testJob.title,
    location: testJob.location
  });
  
  try {
    console.log('\n🔍 Запуск обогащения контактов...\n');
    
    const enrichmentResult = await contactEnrichmentService.enrichJob(testJob);
    
    console.log('✅ Результат обогащения:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Основные контакты
    console.log('📧 Email:', enrichmentResult.contactEmail || 'Не найден');
    console.log('📞 Phone:', enrichmentResult.contactPhone || 'Не найден');
    
    // Расширенная информация
    console.log('\n🏢 Расширенная информация о компании:');
    console.log('👤 Контактное лицо:', enrichmentResult.contactPerson || 'Не найдено');
    console.log('📍 Адрес компании:', enrichmentResult.companyAddress || 'Не найден');
    console.log('🌐 Сайт компании:', enrichmentResult.companyWebsite || 'Не найден');
    console.log('🏭 Извлеченное название:', enrichmentResult.extractedCompanyName || 'Не найдено');
    
    // Детали адреса
    if (enrichmentResult.companyAddressDetails) {
      console.log('\n📮 Детали адреса:');
      console.log('   Улица:', enrichmentResult.companyAddressDetails.street || 'Не указана');
      console.log('   Индекс:', enrichmentResult.companyAddressDetails.zipCode || 'Не указан');
      console.log('   Город:', enrichmentResult.companyAddressDetails.city || 'Не указан');
    }
    
    // Статистика обогащения
    console.log('\n📊 Статистика обогащения:');
    console.log('   Статус:', enrichmentResult.enrichment?.status || 'pending');
    console.log('   Уверенность:', enrichmentResult.enrichment?.confidence || 'unknown');
    console.log('   Реальный email:', enrichmentResult.enrichment?.hasRealEmail ? 'Да' : 'Нет');
    
    // Все найденные контакты
    if (enrichmentResult.enrichment?.realContacts?.length > 0) {
      console.log('\n📋 Все найденные контакты:');
      enrichmentResult.enrichment.realContacts.forEach((contact, index) => {
        console.log(`   ${index + 1}. ${contact.type}: ${contact.value}`);
        if (contact.details) {
          console.log(`      Детали:`, contact.details);
        }
      });
    }
    
    // Пример данных как в требовании пользователя
    console.log('\n🎯 Идеальный результат должен содержать:');
    console.log('   Компания: Stiegler Personalmanagement GmbH');
    console.log('   Контактное лицо: Herr Thomas Stiegler');
    console.log('   Адрес: Katzwanger Straße 150, 90461 Nürnberg, Mittelfranken');
    console.log('   Телефон: +49 911 86045563');
    console.log('   Email: bewerbung@stiegler-pm.de');
    
    console.log('\n✅ Тест завершен!');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Запуск теста
testEnhancedContactExtraction()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  }); 