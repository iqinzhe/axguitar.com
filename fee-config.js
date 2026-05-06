// fee-config.js - 费用配置中心
// 修改此文件即可调整管理费、利率、服务费的计算规则

'use strict';

(function() {
    // 如果 JF 命名空间不存在则创建
    window.JF = window.JF || {};
    
    const FeeConfig = {
        // ==================== 利率配置 ====================
        // 默认月利率（小数形式）
        DEFAULT_INTEREST_RATE: 0.085,      // 8.5%
        // 默认月利率（百分比形式，用于下拉选项）
        DEFAULT_INTEREST_RATE_PERCENT: 8.5,
        
        // 下拉选项的利率列表（百分比）
        INTEREST_RATE_OPTIONS: [10, 9.5, 9.0, 8.5, 8.0, 7.5],
        
        // ==================== 管理费配置 ====================
        // 档位: [上限金额, 费用金额]  （金额单位：印尼盾）
        ADMIN_FEE_TIERS: [
            { maxAmount: 500000, fee: 20000 },      // ≤500rb → 20rb
            { maxAmount: 3000000, fee: 30000 },     // ≤3jt → 30rb
            { maxAmount: Infinity, feePercent: 1 }   // >3jt → 1%
        ],
        
        // ==================== 服务费配置 ====================
        // 档位: [上限金额, 费率百分比]
        SERVICE_FEE_TIERS: [
            { maxAmount: 3000000, percent: 0 },      // ≤3jt → 0%
            { maxAmount: 5000000, percent: 1 },      // ≤5jt → 1%
            { maxAmount: Infinity, minPercent: 2, maxPercent: 6, defaultPercent: 2 }  // >5jt → 可选2-6%，默认2%
        ],
        
        // ==================== 通用工具方法 ====================
        
        /**
         * 计算管理费
         * @param {number} loanAmount 贷款金额
         * @returns {number} 管理费金额
         */
        calculateAdminFee(loanAmount) {
            if (!loanAmount || loanAmount <= 0) return 0;
            const tiers = this.ADMIN_FEE_TIERS;
            for (const tier of tiers) {
                if (loanAmount <= tier.maxAmount) {
                    if (tier.fee !== undefined) return tier.fee;
                    if (tier.feePercent) return Math.round(loanAmount * tier.feePercent / 100);
                }
            }
            return 0;
        },
        
        /**
         * 计算服务费
         * @param {number} loanAmount 贷款金额
         * @param {number} percent 用户选择的百分比（默认2）
         * @returns {{percent: number, amount: number}} 实际百分比和金额
         */
        calculateServiceFee(loanAmount, percent = 2) {
            if (!loanAmount || loanAmount <= 0) return { percent: 0, amount: 0 };
            const tiers = this.SERVICE_FEE_TIERS;
            for (const tier of tiers) {
                if (loanAmount <= tier.maxAmount) {
                    if (tier.percent !== undefined) {
                        return { percent: tier.percent, amount: Math.round(loanAmount * tier.percent / 100) };
                    }
                    if (tier.minPercent !== undefined) {
                        let finalPercent = percent;
                        if (finalPercent < tier.minPercent) finalPercent = tier.minPercent;
                        if (finalPercent > tier.maxPercent) finalPercent = tier.defaultPercent;
                        return { percent: finalPercent, amount: Math.round(loanAmount * finalPercent / 100) };
                    }
                }
            }
            return { percent: 0, amount: 0 };
        },
        
        /**
         * 生成利率下拉选项的HTML
         * @returns {string} HTML字符串
         */
        getInterestRateOptionsHtml() {
            const options = this.INTEREST_RATE_OPTIONS;
            const defaultPercent = this.DEFAULT_INTEREST_RATE_PERCENT;
            return options.map(r => `<option value="${r}"${r === defaultPercent ? ' selected' : ''}>${r}%</option>`).join('');
        },
        
        /**
         * 生成服务费百分比下拉选项的HTML
         * @returns {string} HTML字符串
         */
        getServiceFeePercentOptionsHtml() {
            const options = [2, 3, 4, 5, 6];
            const defaultPercent = 2;
            return options.map(o => `<option value="${o}"${o === defaultPercent ? ' selected' : ''}>${o}%</option>`).join('');
        }
    };
    
    // 挂载到全局
    window.JF.FeeConfig = FeeConfig;
    console.log('✅ 费用配置文件已加载 (fee-config.js)');
})();