// fee-config.js - v2.0
// 服务费百分比越上限时截断到最大值，而非重置为默认值

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    // ==================== 费用配置常量 ====================
    const FeeConfig = {
        // 管理费阶梯（单位：印尼盾）
        ADMIN_FEE_TIERS: [
            { max: 500000, fee: 20000 },
            { max: 3000000, fee: 30000 },
            { max: Infinity, feePercent: 1 }  // 超过 3,000,000 按 1%
        ],
        
        // 服务费配置
        SERVICE_FEE_CONFIG: {
            FREE_THRESHOLD: 3000000,      // 3,000,000 以下免服务费
            PERCENT_THRESHOLD: 5000000,   // 5,000,000 以上启用百分比
            MIN_PERCENT: 2,               // 最低百分比 2%
            MAX_PERCENT: 12,              // 最高百分比 12%
            DEFAULT_PERCENT: 2            // 默认百分比 2%
        },
        
        // 利率配置
        DEFAULT_INTEREST_RATE: 0.085,           // 8.5%
        DEFAULT_INTEREST_RATE_PERCENT: 8.5,     // 8.5%
        AVAILABLE_INTEREST_RATES: [10, 9.5, 9, 8.5, 8, 7.5],
        
        // 还款期限配置
        MIN_REPAYMENT_TERM: 1,
        MAX_REPAYMENT_TERM: 10,
        DEFAULT_REPAYMENT_TERM: 5,
        
        // 最大延期月数
        MAX_EXTENSION_MONTHS: 10,
        
        // ==================== 管理费计算 ====================
        /**
         * 根据当金金额计算管理费
         * @param {number} loanAmount - 当金金额（印尼盾）
         * @returns {number} 管理费金额
         */
        calculateAdminFee(loanAmount) {
            if (!loanAmount || loanAmount <= 0) return 0;
            
            if (loanAmount <= 500000) return 20000;
            if (loanAmount <= 3000000) return 30000;
            return Math.round(loanAmount * 0.01);  // 1%
        },
        
        // ==================== 服务费计算（修复版） ====================
        /**
         * 根据当金金额和服务费百分比计算服务费
         * 【修复 #4】百分比越上限时截断到最大值，而非重置为默认值
         * @param {number} loanAmount - 当金金额
         * @param {number} percent - 服务费百分比（0-12）
         * @returns {Object} { percent: number, amount: number }
         */
        calculateServiceFee(loanAmount, percent) {
            if (!loanAmount || loanAmount <= 0) {
                return { percent: 0, amount: 0 };
            }
            
            const cfg = this.SERVICE_FEE_CONFIG;
            
            // 当金 ≤ 3,000,000：免服务费
            if (loanAmount <= cfg.FREE_THRESHOLD) {
                return { percent: 0, amount: 0 };
            }
            
            // 当金在 3,000,001 ~ 5,000,000：固定 1%
            if (loanAmount <= cfg.PERCENT_THRESHOLD) {
                const amount = Math.round(loanAmount * 0.01);
                return { percent: 1, amount: amount };
            }
            
            // 当金 > 5,000,000：按百分比计算
            // 【修复 #4】截断到有效范围 [MIN_PERCENT, MAX_PERCENT]，而非重置为 DEFAULT_PERCENT
            let validPercent = percent;
            
            if (percent === undefined || percent === null || isNaN(percent)) {
                validPercent = cfg.DEFAULT_PERCENT;
            } else if (percent < cfg.MIN_PERCENT) {
                // 低于最小值时，使用最小值（截断）
                validPercent = cfg.MIN_PERCENT;
                console.warn(`[FeeConfig] 服务费百分比 ${percent}% 低于最小值 ${cfg.MIN_PERCENT}%，已截断为 ${cfg.MIN_PERCENT}%`);
            } else if (percent > cfg.MAX_PERCENT) {
                // 【修复 #4】超过最大值时，截断到最大值（而非重置为默认值）
                validPercent = cfg.MAX_PERCENT;
                console.warn(`[FeeConfig] 服务费百分比 ${percent}% 超过最大值 ${cfg.MAX_PERCENT}%，已截断为 ${cfg.MAX_PERCENT}%`);
            } else {
                validPercent = percent;
            }
            
            const amount = Math.round(loanAmount * validPercent / 100);
            return { percent: validPercent, amount: amount };
        },
        
        /**
         * 获取服务费百分比选项（用于下拉框）
         * @param {number} defaultPercent - 默认选中的百分比
         * @returns {string} HTML 选项字符串
         */
        getServiceFeePercentOptionsHtml(defaultPercent = 2) {
            const cfg = this.SERVICE_FEE_CONFIG;
            const options = [];
            for (let p = cfg.MIN_PERCENT; p <= cfg.MAX_PERCENT; p++) {
                const selected = (p === defaultPercent) ? ' selected' : '';
                options.push(`<option value="${p}"${selected}>${p}%</option>`);
            }
            return options.join('');
        },
        
        // ==================== 利率相关 ====================
        /**
         * 获取利率选项（用于下拉框）
         * @param {number} defaultRatePercent - 默认利率（百分比）
         * @returns {string} HTML 选项字符串
         */
        getInterestRateOptionsHtml(defaultRatePercent = null) {
            const rates = this.AVAILABLE_INTEREST_RATES;
            const defaultVal = (defaultRatePercent !== null) ? defaultRatePercent : this.DEFAULT_INTEREST_RATE_PERCENT;
            return rates.map(r => `<option value="${r}"${r === defaultVal ? ' selected' : ''}>${r}%</option>`).join('');
        },
        
        // ==================== 还款期限相关 ====================
        /**
         * 获取还款期限选项
         * @param {number} defaultMonths - 默认月数
         * @returns {string} HTML 选项字符串
         */
        getRepaymentTermOptionsHtml(defaultMonths = 5) {
            const lang = Utils?.lang || 'id';
            const label = lang === 'id' ? 'bulan' : '个月';
            const options = [];
            for (let m = this.MIN_REPAYMENT_TERM; m <= this.MAX_REPAYMENT_TERM; m++) {
                const selected = (m === defaultMonths) ? ' selected' : '';
                options.push(`<option value="${m}"${selected}>${m} ${label}</option>`);
            }
            return options.join('');
        },
        
        /**
         * 计算固定还款每月金额
         * @param {number} loanAmount - 贷款金额
         * @param {number} monthlyRate - 月利率（小数）
         * @param {number} months - 还款月数
         * @returns {number} 每月还款金额
         */
        calculateFixedMonthlyPayment(loanAmount, monthlyRate, months) {
            if (!loanAmount || loanAmount <= 0 || !months || months <= 0) return 0;
            if (monthlyRate <= 0) return loanAmount / months;
            const pow = Math.pow(1 + monthlyRate, months);
            return (loanAmount * monthlyRate * pow) / (pow - 1);
        },
        
        /**
         * 四舍五入每月还款金额到万位
         * @param {number} amount - 原始金额
         * @returns {number} 取整后的金额
         */
        roundMonthlyPayment(amount) {
            return Math.ceil(amount / 10000) * 10000;
        },
        
        // ==================== 典当期限相关 ====================
        /**
         * 获取典当期限选项（1-10个月，无默认选中）
         * @returns {string} HTML 选项字符串
         */
        getPawnTermOptionsHtml() {
            const lang = Utils?.lang || 'id';
            const label = lang === 'id' ? 'bulan' : '个月';
            const defaultOption = lang === 'id' 
                ? '<option value="">-- Pilih Jangka Waktu --</option>'
                : '<option value="">-- 请选择期限 --</option>';
            const options = [defaultOption];
            for (let m = 1; m <= 10; m++) {
                options.push(`<option value="${m}">${m} ${label}</option>`);
            }
            return options.join('');
        },
        
        /**
         * 计算典当到期日
         * @param {string} startDate - 起始日期 (YYYY-MM-DD)
         * @param {number} termMonths - 期限月数
         * @returns {string} 到期日 (YYYY-MM-DD)
         */
        calculatePawnDueDate(startDate, termMonths) {
            if (!startDate || !termMonths || termMonths <= 0) return '';
            const [year, month, day] = startDate.split('-').map(Number);
            const totalMonths = month - 1 + termMonths;
            const newYear = year + Math.floor(totalMonths / 12);
            const newMonth = (totalMonths % 12) + 1;
            const daysInNewMonth = new Date(Date.UTC(newYear, newMonth, 0)).getUTCDate();
            const newDay = Math.min(day, daysInNewMonth);
            return (
                newYear +
                '-' +
                String(newMonth).padStart(2, '0') +
                '-' +
                String(newDay).padStart(2, '0')
            );
        }
    };
    
    // 挂载到命名空间
    JF.FeeConfig = FeeConfig;
    window.FeeConfig = FeeConfig;
    
    // 同步到 Utils（如果 Utils 已加载）
    if (window.Utils) {
        window.Utils.DEFAULT_AGREED_INTEREST_RATE = FeeConfig.DEFAULT_INTEREST_RATE;
        window.Utils.DEFAULT_AGREED_INTEREST_RATE_PERCENT = FeeConfig.DEFAULT_INTEREST_RATE_PERCENT;
        window.Utils.calculateAdminFee = FeeConfig.calculateAdminFee.bind(FeeConfig);
        window.Utils.calculateServiceFee = FeeConfig.calculateServiceFee.bind(FeeConfig);
        window.Utils.calculateFixedMonthlyPayment = FeeConfig.calculateFixedMonthlyPayment.bind(FeeConfig);
        window.Utils.roundMonthlyPayment = FeeConfig.roundMonthlyPayment.bind(FeeConfig);
        window.Utils.getInterestRateOptions = FeeConfig.getInterestRateOptionsHtml.bind(FeeConfig);
        window.Utils.getServiceFeePercentOptions = FeeConfig.getServiceFeePercentOptionsHtml.bind(FeeConfig);
        window.Utils.getRepaymentTermOptions = FeeConfig.getRepaymentTermOptionsHtml.bind(FeeConfig);
        window.Utils.getPawnTermOptions = FeeConfig.getPawnTermOptionsHtml.bind(FeeConfig);
        window.Utils.calculatePawnDueDate = FeeConfig.calculatePawnDueDate.bind(FeeConfig);
        
        console.log('✅ FeeConfig 已同步到 Utils');
    }
    
    console.log('✅ JF.FeeConfig v2.1 修复版（服务费百分比截断而非重置为默认值）');
})();
