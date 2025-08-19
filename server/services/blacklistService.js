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
			'arbeitnehmerüberlassung',
			'personaldienstleistung',
			'leiharbeit'
		];
		this._load();
	}

	_load() {
		try {
			if (!fs.existsSync(this.configDir)) {
				fs.mkdirSync(this.configDir, { recursive: true });
			}
			if (fs.existsSync(this.filePath)) {
				const raw = fs.readFileSync(this.filePath, 'utf8');
				const parsed = JSON.parse(raw);
				if (Array.isArray(parsed)) {
					this.list = parsed.map(s => String(s).toLowerCase().trim()).filter(Boolean);
				}
			}
			// Ensure defaults present at least once
			if (this.list.length === 0) {
				this.list = [...new Set(this.defaults)];
				this._save();
			}
		} catch (error) {
			logger.error('Failed to load blacklist', { error: error.message });
			this.list = [...new Set(this.defaults)];
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
		if (this.list.length === 0) {
			this.list = [...new Set(this.defaults)];
		}
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
}

module.exports = new BlacklistService(); 