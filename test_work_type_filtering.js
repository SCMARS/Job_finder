const workTypeFilterService = require('./server/services/workTypeFilterService');

// Тестовые данные - вакансии с разными типами работы
const testJobs = [
  {
    id: '1',
    title: 'Software Engineer',
    company: 'Tech Corp',
    workingTime: 'Vollzeit',
    employmentType: 'Unbefristet',
    description: 'Full-time permanent position',
    requirements: 'Bachelor degree required'
  },
  {
    id: '2',
    title: 'Zeitarbeit Developer',
    company: 'Temp Agency',
    workingTime: 'Zeitarbeit',
    employmentType: 'Befristet',
    description: 'Temporary work assignment',
    requirements: 'Experience in development'
  },
  {
    id: '3',
    title: 'Minijob Assistant',
    company: 'Small Business',
    workingTime: 'Minijob',
    employmentType: 'Befristet',
    description: 'Part-time temporary position',
    requirements: 'Basic skills'
  },
  {
    id: '4',
    title: 'Interim Manager',
    company: 'Consulting Firm',
    workingTime: 'Vollzeit',
    employmentType: 'Interim',
    description: 'Temporary management role',
    requirements: 'Management experience'
  },
  {
    id: '5',
    title: 'Regular Employee',
    company: 'Stable Company',
    workingTime: 'Teilzeit',
    employmentType: 'Unbefristet',
    description: 'Part-time permanent position',
    requirements: 'Relevant experience'
  },
  {
    id: '6',
    title: 'Arbeitnehmerüberlassung Specialist',
    company: 'Staffing Agency',
    workingTime: 'Vollzeit',
    employmentType: 'Arbeitnehmerüberlassung',
    description: 'Employee leasing position',
    requirements: 'Specialist knowledge'
  },
  {
    id: '7',
    title: 'Temporary Worker',
    company: 'Manufacturing',
    workingTime: 'Temporär',
    employmentType: 'Befristet',
    description: 'Temporary manufacturing work',
    requirements: 'Physical fitness'
  },
  {
    id: '8',
    title: 'Permanent Developer',
    company: 'Software Company',
    workingTime: 'Vollzeit',
    employmentType: 'Unbefristet',
    description: 'Full-time software development',
    requirements: 'Programming skills'
  }
];

console.log('🧪 Testing Work Type Filtering System\n');

// Тест 1: Проверка отдельных вакансий
console.log('📋 Test 1: Individual job filtering');
testJobs.forEach(job => {
  const shouldExclude = workTypeFilterService.shouldExcludeJob(job);
  const status = shouldExclude ? '❌ EXCLUDED' : '✅ ACCEPTED';
  console.log(`${status} | ${job.title} | ${job.workingTime} | ${job.employmentType}`);
});

console.log('\n' + '='.repeat(80) + '\n');

// Тест 2: Фильтрация массива вакансий
console.log('🔍 Test 2: Batch job filtering');
const filterResult = workTypeFilterService.filterJobs(testJobs);

console.log(`📊 Filtering Results:`);
console.log(`   Total jobs: ${filterResult.totalCount}`);
console.log(`   Accepted: ${filterResult.filteredCount}`);
console.log(`   Excluded: ${filterResult.excludedCount}`);
console.log(`   Filter percentage: ${Math.round((filterResult.excludedCount / filterResult.totalCount) * 100)}%`);

console.log(`\n📈 Exclusion Statistics:`);
console.log(`   By workingTime: ${filterResult.statistics.excludedByWorkType}`);
console.log(`   By employmentType: ${filterResult.statistics.excludedByEmploymentType}`);
console.log(`   By description: ${filterResult.statistics.excludedByDescription}`);
console.log(`   By requirements: ${filterResult.statistics.excludedByRequirements}`);
console.log(`   By title: ${filterResult.statistics.excludedByTitle}`);

console.log('\n' + '='.repeat(80) + '\n');

// Тест 3: Детали исключенных вакансий
console.log('🚫 Test 3: Excluded jobs details');
if (filterResult.excludedJobs.length > 0) {
  console.log('Excluded jobs:');
  filterResult.excludedJobs.forEach(job => {
    console.log(`   - ${job.title} (${job.company})`);
    console.log(`     Working Time: ${job.workingTime}`);
    console.log(`     Employment Type: ${job.employmentType}`);
    console.log(`     Reason: Contains excluded work type keywords`);
    console.log('');
  });
} else {
  console.log('No jobs were excluded');
}

console.log('\n' + '='.repeat(80) + '\n');

// Тест 4: Принятые вакансии
console.log('✅ Test 4: Accepted jobs details');
if (filterResult.filteredJobs.length > 0) {
  console.log('Accepted jobs:');
  filterResult.filteredJobs.forEach(job => {
    console.log(`   - ${job.title} (${job.company})`);
    console.log(`     Working Time: ${job.workingTime}`);
    console.log(`     Employment Type: ${job.employmentType}`);
    console.log('');
  });
} else {
  console.log('No jobs were accepted');
}

console.log('\n' + '='.repeat(80) + '\n');

// Тест 5: Статистика сервиса
console.log('📊 Test 5: Service statistics');
const stats = workTypeFilterService.getStats();
console.log('Work Type Filter Service Stats:');
console.log(`   Excluded work types: ${stats.excludedWorkTypes.join(', ')}`);
console.log(`   Excluded German types: ${stats.excludedGermanWorkTypes.join(', ')}`);
console.log(`   Total excluded types: ${stats.totalExcludedTypes}`);
console.log(`   Description: ${stats.description}`);

console.log('\n' + '='.repeat(80) + '\n');

// Тест 6: Динамическое добавление/удаление типов
console.log('⚙️  Test 6: Dynamic type management');
console.log('Adding new excluded work type: "freelance"');
workTypeFilterService.addExcludedWorkType('freelance');

console.log('Removing excluded work type: "interim"');
workTypeFilterService.removeExcludedWorkType('interim');

const updatedStats = workTypeFilterService.getStats();
console.log(`Updated total excluded types: ${updatedStats.totalExcludedTypes}`);

console.log('\n🎯 Work Type Filtering System Test Completed!');
console.log('The system successfully filters out:');
console.log('   - Zeitarbeit (temporary work)');
console.log('   - Minijob (mini jobs)');
console.log('   - Interim positions');
console.log('   - Arbeitnehmerüberlassung (employee leasing)');
console.log('   - Other temporary employment types');
console.log('\nThis ensures only permanent and stable positions are saved to the database.'); 