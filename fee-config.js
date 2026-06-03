// fee-config.js - v2.2 (修复：补全 ≤500,000 管理费阶梯；删除死配置 FIXED_PERCENT；服务费中段改用常量)

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    const FeeConfig = {
        ADMIN_FEE_TIERS: [
            { max: 500000,  fee: 20000 },   // ≤ 500,000：固定 20,000
            { max: 3000000, fee: 30000 },   // ≤ 3,000,000：固定 30,000
            { max: Infinity, feePercent: 1 } // > 3,000,000：按 1%（进位取整到万）
        ],
        
        SERVICE_FEE_CONFIG: {
            FREE_THRESHOLD:    3000000, // ≤ 3,000,000：免服务费
            PERCENT_THRESHOLD: 5000000, // 3,000,001 ~ 5,000,000：固定 1%
            MIN_PERCENT: 2,             // 最低百分比 2%
            MAX_PERCENT: 10,            // 最高百分比 10%
            DEFAULT_PERCENT: 2,         // 默认百分比 2%
        },
        
        DEFAULT_INTEREST_RATE: 0.10,
        DEFAULT_INTEREST_RATE_PERCENT: 10,
        AVAILABLE_INTEREST_RATES: [10, 9.5, 9, 8.5, 8],
        
        MIN_REPAYMENT_TERM: 1,
        MAX_REPAYMENT_TERM: 10,
        DEFAULT_REPAYMENT_TERM: 5,
        MAX_EXTENSION_MONTHS: 10,
        
        calculateAdminFee(loanAmount) {
            if (!loanAmount || loanAmount <= 0) return 0;
            for (const tier of this.ADMIN_FEE_TIERS) {
                if (loanAmount <= tier.max) {
                    if (tier.fee !== undefined) return tier.fee;
                    // feePercent 分支（> 3,000,000）：按比例后进位取整到万
                    const rawFee = loanAmount * (tier.feePercent / 100);
                    return Math.ceil(rawFee / 10000) * 10000;
                }
            }
            return 0;
        },
        
        calculateServiceFee(loanAmount, percent) {
            if (!loanAmount || loanAmount <= 0) return { percent: 0, amount: 0 };
            const cfg = this.SERVICE_FEE_CONFIG;
            // ≤300万：免服务费
            if (loanAmount <= cfg.FREE_THRESHOLD) {
                return { percent: 0, amount: 0 };
            }
            // 300万~500万：固定 1%（等同 MIN_PERCENT 下限），不受传入 percent 影响
            if (loanAmount <= cfg.PERCENT_THRESHOLD) {
                const amount = Math.ceil(loanAmount * (cfg.MIN_PERCENT / 100) / 10000) * 10000;
                return { percent: cfg.MIN_PERCENT, amount };
            }
            // >500万：使用传入 percent，范围限制在 MIN~MAX 之间
            let validPercent = percent;
            if (validPercent === undefined || validPercent === null || isNaN(validPercent)) {
                validPercent = cfg.DEFAULT_PERCENT;
            } else if (validPercent < cfg.MIN_PERCENT) {
                validPercent = cfg.MIN_PERCENT;
            } else if (validPercent > cfg.MAX_PERCENT) {
                validPercent = cfg.MAX_PERCENT;
            }
            const rawFee = loanAmount * (validPercent / 100);
            const amount = Math.ceil(rawFee / 10000) * 10000;
            return { percent: validPercent, amount };
        },
        
        getServiceFeePercentOptionsHtml() {
            return ''; // 不再使用下拉
        },
        
        getInterestRateOptionsHtml(defaultRatePercent) {
            const rates = this.AVAILABLE_INTEREST_RATES;
            const defaultVal = (defaultRatePercent !== null) ? defaultRatePercent : this.DEFAULT_INTEREST_RATE_PERCENT;
            return rates.map(r => `<option value="${r}"${r === defaultVal ? ' selected' : ''}>${r}%</option>`).join('');
        },
        
        getRepaymentTermOptionsHtml(defaultMonths) {
            const lang = Utils?.lang || 'id';
            const label = lang === 'id' ? 'bulan' : '个月';
            const options = [];
            for (let m = this.MIN_REPAYMENT_TERM; m <= this.MAX_REPAYMENT_TERM; m++) {
                const selected = (m === defaultMonths) ? ' selected' : '';
                options.push(`<option value="${m}"${selected}>${m} ${label}</option>`);
            }
            return options.join('');
        },
        
        calculateFixedMonthlyPayment(loanAmount, monthlyRate, months) {
            if (!loanAmount || loanAmount <= 0 || !months || months <= 0) return 0;
            if (monthlyRate <= 0) return loanAmount / months;
            const pow = Math.pow(1 + monthlyRate, months);
            return (loanAmount * monthlyRate * pow) / (pow - 1);
        },
        
        roundMonthlyPayment(amount) {
            return Math.ceil(amount / 10000) * 10000;
        },
        
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
        
        calculatePawnDueDate(startDate, termMonths) {
            if (!startDate || !termMonths || termMonths <= 0) return '';
            const [year, month, day] = startDate.split('-').map(Number);
            const totalMonths = month - 1 + termMonths;
            const newYear = year + Math.floor(totalMonths / 12);
            const newMonth = (totalMonths % 12) + 1;
            const daysInNewMonth = new Date(Date.UTC(newYear, newMonth, 0)).getUTCDate();
            const newDay = Math.min(day, daysInNewMonth);
            return newYear + '-' + String(newMonth).padStart(2, '0') + '-' + String(newDay).padStart(2, '0');
        }
    };
    
    JF.FeeConfig = FeeConfig;
    window.FeeConfig = FeeConfig;
    
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
    }
    
    console.log('✅ JF.FeeConfig v2.2 (补全管理费阶梯；删除 FIXED_PERCENT 死配置；服务费中段改用常量)');
})();
