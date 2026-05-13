// fee-config.js - v2.1 (服务费固定2%取整到万位，保留手工修改能力)

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    const FeeConfig = {
        ADMIN_FEE_TIERS: [
            { max: 3000000, fee: 30000 },
            { max: Infinity, feePercent: 1 }
        ],
        
        SERVICE_FEE_CONFIG: {
            FREE_THRESHOLD: 3000000,
            PERCENT_THRESHOLD: 5000000,
            FIXED_PERCENT: 2,
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
            if (loanAmount <= 3000000) return 30000;
            const rawFee = loanAmount * 0.01;
            return Math.ceil(rawFee / 10000) * 10000;
        },
        
        calculateServiceFee(loanAmount, percent) {
            if (!loanAmount || loanAmount <= 0) return { percent: 0, amount: 0 };
            const cfg = this.SERVICE_FEE_CONFIG;
            if (loanAmount <= cfg.PERCENT_THRESHOLD) {
                return { percent: 0, amount: 0 };
            }
            const rawFee = loanAmount * (cfg.FIXED_PERCENT / 100);
            const amount = Math.ceil(rawFee / 10000) * 10000;
            return { percent: cfg.FIXED_PERCENT, amount: amount };
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
    
    console.log('✅ JF.FeeConfig v2.2 (服务费可手工修改)');
})();
