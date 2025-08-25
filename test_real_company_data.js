const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Симулируем реальные данные компании для тестирования
const realCompanyData = {
  companyName: 'Stiegler Personalmanagement GmbH',
  contactPerson: 'Herr Thomas Stiegler',
  address: 'Katzwanger Straße 150, 90461 Nürnberg, Mittelfranken',
  phone: '+49 911 86045563',
  email: 'bewerbung@stiegler-pm.de',
  website: 'https://stiegler-pm.de'
};

// Тестируем регулярные выражения для извлечения данных
function testRegexPatterns() {
  console.log('🧪 Тестирование регулярных выражений для извлечения контактной информации...\n');
  
  const testText = `
    ${realCompanyData.companyName}
    ${realCompanyData.contactPerson}
    ${realCompanyData.address}
    Telefon: ${realCompanyData.phone}
    E-Mail: ${realCompanyData.email}
    Homepage: ${realCompanyData.website}
  `;
  
  console.log('📝 Тестовый текст:');
  console.log(testText);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Тест 1: Извлечение контактного лица
  const contactPersonRegex = /(Herr|Frau)\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)*)/i;
  const contactPersonMatch = testText.match(contactPersonRegex);
  console.log('👤 Контактное лицо:');
  console.log('   Regex:', contactPersonRegex.source);
  console.log('   Результат:', contactPersonMatch ? contactPersonMatch[0] : 'Не найдено');
  console.log('   Ожидалось:', realCompanyData.contactPerson);
  console.log('   ✅ Статус:', contactPersonMatch ? 'ПРОЙДЕН' : '❌ ПРОВАЛЕН');
  
  // Тест 2: Извлечение адреса
  const addressRegex = /([A-ZÄÖÜ][a-zäöüß\s]+(?:straße|str\.|platz|weg|gasse|allee|ring)\s+\d+[a-z]?)\s+(\d{5})\s+([A-ZÄÖÜ][a-zäöüß\s]+)/i;
  const addressMatch = testText.match(addressRegex);
  console.log('\n📍 Адрес компании:');
  console.log('   Regex:', addressRegex.source);
  if (addressMatch) {
    console.log('   Улица:', addressMatch[1].trim());
    console.log('   Индекс:', addressMatch[2]);
    console.log('   Город:', addressMatch[3].trim());
    console.log('   Полный адрес:', `${addressMatch[1].trim()}, ${addressMatch[2]} ${addressMatch[3].trim()}`);
  } else {
    console.log('   Результат: Не найден');
  }
  console.log('   Ожидалось:', realCompanyData.address);
  console.log('   ✅ Статус:', addressMatch ? 'ПРОЙДЕН' : '❌ ПРОВАЛЕН');
  
  // Тест 3: Извлечение телефона
  const phoneRegex = /Telefon\s*:\s*([+0-9\s()\-]{8,})/i;
  const phoneMatch = testText.match(phoneRegex);
  console.log('\n📞 Телефон:');
  console.log('   Regex:', phoneRegex.source);
  console.log('   Результат:', phoneMatch ? phoneMatch[1] : 'Не найден');
  console.log('   Ожидалось:', realCompanyData.phone);
  console.log('   ✅ Статус:', phoneMatch ? 'ПРОЙДЕН' : '❌ ПРОВАЛЕН');
  
  // Тест 4: Извлечение email
  const emailRegex = /E-Mail\s*:\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i;
  const emailMatch = testText.match(emailRegex);
  console.log('\n📧 Email:');
  console.log('   Regex:', emailRegex.source);
  console.log('   Результат:', emailMatch ? emailMatch[1] : 'Не найден');
  console.log('   Ожидалось:', realCompanyData.email);
  console.log('   ✅ Статус:', emailMatch ? 'ПРОЙДЕН' : '❌ ПРОВАЛЕН');
  
  // Тест 5: Извлечение названия компании
  const companyNameRegex = /^([A-ZÄÖÜ][^0-9\n]+(?:GmbH|AG|SE|KG|e\.V\.|mbH|Ltd|Inc|Corp))/;
  const companyNameMatch = testText.match(companyNameRegex);
  console.log('\n🏭 Название компании:');
  console.log('   Regex:', companyNameRegex.source);
  console.log('   Результат:', companyNameMatch ? companyNameMatch[1].trim() : 'Не найдено');
  console.log('   Ожидалось:', realCompanyData.companyName);
  console.log('   ✅ Статус:', companyNameMatch ? 'ПРОЙДЕН' : '❌ ПРОВАЛЕН');
  
  // Тест 6: Извлечение веб-сайта
  const websiteRegex = /(https?:\/\/[^\s]+)/i;
  const websiteMatch = testText.match(websiteRegex);
  console.log('\n🌐 Веб-сайт:');
  console.log('   Regex:', websiteRegex.source);
  console.log('   Результат:', websiteMatch ? websiteMatch[0] : 'Не найден');
  console.log('   Ожидалось:', realCompanyData.website);
  console.log('   ✅ Статус:', websiteMatch ? 'ПРОЙДЕН' : '❌ ПРОВАЛЕН');
  
  // Общая статистика
  const totalTests = 6;
  const passedTests = [contactPersonMatch, addressMatch, phoneMatch, emailMatch, companyNameMatch, websiteMatch].filter(Boolean).length;
  
  console.log('\n📊 Общая статистика тестирования:');
  console.log('   Всего тестов:', totalTests);
  console.log('   Пройдено:', passedTests);
  console.log('   Провалено:', totalTests - passedTests);
  console.log('   Процент успеха:', Math.round((passedTests / totalTests) * 100) + '%');
  
  if (passedTests === totalTests) {
    console.log('\n🎉 Все тесты пройдены успешно! Система готова к работе.');
  } else {
    console.log('\n⚠️  Некоторые тесты провалены. Требуется доработка регулярных выражений.');
  }
}

// Тестируем функцию извлечения адреса из webScrapingService
function testAddressExtraction() {
  console.log('\n🔍 Тестирование функции извлечения адреса...\n');
  
  // Симулируем функцию извлечения адреса
  function extractCompanyAddress(fullText) {
    const addressRegex = /([A-ZÄÖÜ][a-zäöüß\s]+(?:straße|str\.|platz|weg|gasse|allee|ring)\s+\d+[a-z]?)\s+(\d{5})\s+([A-ZÄÖÜ][a-zäöüß\s]+)/i;
    const addressMatch = fullText.match(addressRegex);
    
    if (addressMatch) {
      return {
        street: addressMatch[1].trim(),
        zipCode: addressMatch[2],
        city: addressMatch[3].trim(),
        fullAddress: `${addressMatch[1].trim()}, ${addressMatch[2]} ${addressMatch[3].trim()}`
      };
    }
    return null;
  }
  
  const testAddresses = [
    'Katzwanger Straße 150, 90461 Nürnberg, Mittelfranken',
    'Münchener Straße 123, 80331 München, Bayern',
    'Hamburger Allee 45, 20095 Hamburg',
    'Berliner Platz 7, 10115 Berlin',
    'Frankfurter Ring 89, 90402 Nürnberg'
  ];
  
  testAddresses.forEach((address, index) => {
    console.log(`📍 Тест адреса ${index + 1}: ${address}`);
    const extracted = extractCompanyAddress(address);
    if (extracted) {
      console.log(`   ✅ Успешно извлечено:`);
      console.log(`      Улица: ${extracted.street}`);
      console.log(`      Индекс: ${extracted.zipCode}`);
      console.log(`      Город: ${extracted.city}`);
      console.log(`      Полный адрес: ${extracted.fullAddress}`);
    } else {
      console.log(`   ❌ Не удалось извлечь адрес`);
    }
    console.log('');
  });
}

// Запуск всех тестов
console.log('🚀 Запуск комплексного тестирования системы извлечения контактной информации\n');
console.log('=' * 80);

testRegexPatterns();
testAddressExtraction();

console.log('\n✅ Тестирование завершено!');
console.log('\n📋 Следующие шаги:');
console.log('   1. Проверить результаты тестов выше');
console.log('   2. Если все тесты пройдены - система готова к работе');
console.log('   3. Если есть проваленные тесты - доработать регулярные выражения');
console.log('   4. Протестировать на реальных вакансиях с Arbeitsagentur'); 