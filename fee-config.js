// fee-config.js - v2.1 (服务费改为固定计算：>5jt 按 2% 取整到万位，下拉选项移除)

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    // ==================== 费用配置常量 ====================
    const FeeConfig = {
        // 管理费阶梯（单位：印尼盾）
        ADMIN_FEE_TIERS: [
            { max: 3000000, fee: 30000 },           // ≤ 3,000,000 固定 30,000
            { max: Infinity, feePercent: 1 }         // > 3,000,000 按 1%
        ],
        
        // 服务费配置（新规：>5,000,000 按 2% 固定，自动计算，无下拉选择）
        SERVICE_FEE_CONFIG: {
            FREE_THRESHOLD: 3000000,      // 3,000,000 以下免服务费
            PERCENT_THRESHOLD: 5000000,   // 5,000,000 以上启用百分比
            FIXED_PERCENT: 2,             // 固定百分比 2%
        },
        
        // 利率配置
        DEFAULT_INTEREST_RATE: 0.10,            // 10%
        DEFAULT_INTEREST_RATE_PERCENT: 10,      // 10%
        AVAILABLE_INTEREST_RATES: [10, 9.5, 9, 8.5, 8],
        
        // 还款期限配置
        MIN_REPAYMENT_TERM: 1,
        MAX_REPAYMENT_TERM: 10,
        DEFAULT_REPAYMENT_TERM: 5,
        
        // 最大延期月数
        MAX_EXTENSION_MONTHS: 10,
        
        // ==================== 管理费计算 ====================
        /**
         * 根据当金金额计算管理费
         * 规则：≤ 3,000,000 固定 30,000；> 3,000,000 按 1% 取整到万位
         * @param {number} loanAmount - 当金金额（印尼盾）
         * @returns {number} 管理费金额
         */
        calculateAdminFee(loanAmount) {
            if (!loanAmount || loanAmount <= 0) return 0;
            
            if (loanAmount <= 3000000) return 30000;
            // > 3,000,000 按 1% 计算，然后取整到 10,000 的倍数（向上取整）
            const rawFee = loanAmount * 0.01;
            return Math.ceil(rawFee / 10000) * 10000;
        },
        
        // ==================== 服务费计算（新规：固定百分比，自动计算） ====================
        /**
         * 根据当金金额计算服务费（固定规则，不再需要传入百分比）
         * 规则：≤ 5,000,000 免服务费；> 5,000,000 按 2% 收取，取整到 10,000
         * @param {number} loanAmount - 当金金额
         * @param {number} [percent] - 保留参数以兼容旧调用，但实际不再使用
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
            
            // 当金在 3,000,001 ~ 5,000,000：仍免服务费（新规）
            if (loanAmount <= cfg.PERCENT_THRESHOLD) {
                return { percent: 0, amount: 0 };
            }
            
            // 当金 > 5,000,000：按固定百分比 2% 计算，取整到 10,000
            const rawFee = loanAmount * (cfg.FIXED_PERCENT / 100);
            const amount = Math.ceil(rawFee / 10000) * 10000;
            return { percent: cfg.FIXED_PERCENT, amount: amount };
        },
        
        /**
         * 获取服务费百分比选项（已废弃，返回空字符串）
         * @deprecated 服务费不再提供下拉选择，此方法保留仅为兼容
         */
        getServiceFeePercentOptionsHtml(defaultPercent) {
            return ''; // 不再使用下拉框
        },
        
        // ==================== 利率相关 ====================
        getInterestRateOptionsHtml(defaultRatePercent) {
            const rates = this.AVAILABLE_INTEREST_RATES;
            const defaultVal = (defaultRatePercent !== null) ? defaultRatePercent : this.DEFAULT_INTEREST_RATE_PERCENT;
            return rates.map(r => `<option value="${r}"${r === defaultVal ? ' selected' : ''}>${r}%</option>`).join('');
        },
        
        // ==================== 还款期限相关 ====================
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
        
        // ==================== 典当期限相关 ====================
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
    
    console.log('✅ JF.FeeConfig v2.1 新规（管理费1%取整，服务费固定2%取整）');
})();
