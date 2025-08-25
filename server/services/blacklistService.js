const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class BlacklistService {
	constructor() {
		this.configDir = path.join(__dirname, '..', 'config');
		this.filePath = path.join(this.configDir, 'blacklist.json');
		this.list = [];
		
		this.defaults = [
			'zeitarbeit',
			'zeitarbeits',
			'personalservice',
			'personal service',
			'temporary work',
			'temp work',
			'staffing',
			'recruiting',
			'recruitment',
			'arbeitnehmerüberlassung',
			'personaldienstleistung',
			'personalvermittlung',
			'interim',
			'randstad',
			'adecco',
			'manpower',
			'kelly services',
			'hays'
		];
		this._load();
	}

	_load() {
		try {
			if (!fs.existsSync(this.configDir)) {
				fs.mkdirSync(this.configDir, { recursive: true });
			}
			
			// Загружаем существующий список
			if (fs.existsSync(this.filePath)) {
				const raw = fs.readFileSync(this.filePath, 'utf8');
				const parsed = JSON.parse(raw);
				if (Array.isArray(parsed)) {
					this.list = parsed.map(s => String(s).toLowerCase().trim()).filter(Boolean);
				}
			}
			
			// Добавляем дефолтные термины если их нет
			let needsSave = false;
			for (const term of this.defaults) {
				if (!this.list.includes(term)) {
					this.list.push(term);
					needsSave = true;
				}
			}
			
			if (needsSave) {
				this._save();
				logger.info('Added default Zeitarbeit filter terms', { 
					count: this.defaults.length,
					total: this.list.length 
				});
			}
		} catch (error) {
			logger.error('Failed to load blacklist', { error: error.message });
			this.list = [...this.defaults]; // Используем дефолтные термины как fallback
		}
	}

	_save() {
		try {
			fs.writeFileSync(this.filePath, JSON.stringify(this.list, null, 2), 'utf8');
			logger.info('Blacklist saved', { count: this.list.length });
		} catch (error) {
			logger.error('Failed to save blacklist', { error: error.message });
		}
	}

	getList() {
		return [...this.list];
	}

	setList(terms) {
		if (!Array.isArray(terms)) return this.getList();
		this.list = [...new Set(terms.map(s => String(s).toLowerCase().trim()).filter(Boolean))];
		this._save();
		return this.getList();
	}

	add(term) {
		const t = String(term || '').toLowerCase().trim();
		if (!t) return this.getList();
		if (!this.list.includes(t)) {
			this.list.push(t);
			this._save();
		}
		return this.getList();
	}

	remove(term) {
		const t = String(term || '').toLowerCase().trim();
		const before = this.list.length;
		this.list = this.list.filter(x => x !== t);
		if (this.list.length !== before) {
			this._save();
		}
		return this.getList();
	}

	/**
	 * Returns true if a job should be filtered out based on company name
	 */
	isBlockedCompany(companyName) {
		if (!companyName) return false;
		const lower = String(companyName).toLowerCase();
		return this.list.some(term => lower.includes(term));
	}

	/**
	 * Check if company is Zeitarbeit (temporary work agency)
	 */
	isZeitarbeit(companyName) {
		if (!companyName) return false;
		const lower = String(companyName).toLowerCase();
		const zeitarbeitTerms = [
			'zeitarbeit', 'zeitarbeits', 'personalservice', 'personal service',
			'temporary work', 'temp work', 'staffing', 'recruiting', 'recruitment',
			'arbeitnehmerüberlassung', 'personaldienstleistung', 'personalvermittlung',
			'interim', 'randstad', 'adecco', 'manpower', 'kelly services', 'hays'
		];
		return zeitarbeitTerms.some(term => lower.includes(term));
	}

	/**
	 * Get filtering statistics
	 */
	getStats() {
		return {
			totalTerms: this.list.length,
			defaultTerms: this.defaults.length,
			customTerms: this.list.length - this.defaults.length,
			zeitarbeitProtection: true
		};
	}
}

module.exports = new BlacklistService(); 