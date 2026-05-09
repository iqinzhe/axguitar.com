/**
 * JF! Gadai — 集成测试
 * 覆盖：费率计算 + 支付幂等性
 *
 * 运行方式（在项目根目录打开终端）：
 *   node test-jf.js
 *
 * 不需要安装任何额外工具，Node.js 自带即可。
 */

'use strict';

// ─────────────────────────────────────────────
// 1. 迷你测试框架（不依赖任何外部库）
// ─────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

function expect(description, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) {
        process.stdout.write(`  ✅ ${description}\n`);
        passed++;
    } else {
        process.stdout.write(`  ❌ ${description}\n`);
        process.stdout.write(`       期望: ${JSON.stringify(expected)}\n`);
        process.stdout.write(`       实际: ${JSON.stringify(actual)}\n`);
        failed++;
        failures.push(description);
    }
}

function expectApprox(description, actual, expected, tolerance = 1) {
    const ok = Math.abs(actual - expected) <= tolerance;
    if (ok) {
        process.stdout.write(`  ✅ ${description}\n`);
        passed++;
    } else {
        process.stdout.write(`  ❌ ${description}\n`);
        process.stdout.write(`       期望: ≈${expected}（允许误差±${tolerance}）\n`);
        process.stdout.write(`       实际: ${actual}\n`);
        failed++;
        failures.push(description);
    }
}

function section(title) {
    process.stdout.write(`\n📋 ${title}\n${'─'.repeat(50)}\n`);
}

// ─────────────────────────────────────────────
// 2. 从 fee-config.js 提取纯计算逻辑
//    （去掉 window 依赖，只保留函数本身）
// ─────────────────────────────────────────────
const FeeConfig = {
    ADMIN_FEE_TIERS: [
        { max: 500000, fee: 20000 },
        { max: 3000000, fee: 30000 },
        { max: Infinity, feePercent: 1 }
    ],
    SERVICE_FEE_CONFIG: {
        FREE_THRESHOLD: 3000000,
        PERCENT_THRESHOLD: 5000000,
        MIN_PERCENT: 2,
        MAX_PERCENT: 10,
        DEFAULT_PERCENT: 2
    },
    DEFAULT_INTEREST_RATE: 0.10,
    DEFAULT_INTEREST_RATE_PERCENT: 10,
    AVAILABLE_INTEREST_RATES: [10, 9.5, 9, 8.5, 8],
    MIN_REPAYMENT_TERM: 1,
    MAX_REPAYMENT_TERM: 10,

    calculateAdminFee(loanAmount) {
        if (!loanAmount || loanAmount <= 0) return 0;
        if (loanAmount <= 500000) return 20000;
        if (loanAmount <= 3000000) return 30000;
        return Math.round(loanAmount * 0.01);
    },

    calculateServiceFee(loanAmount, percent) {
        if (!loanAmount || loanAmount <= 0) return { percent: 0, amount: 0 };
        const cfg = this.SERVICE_FEE_CONFIG;
        if (loanAmount <= cfg.FREE_THRESHOLD) return { percent: 0, amount: 0 };
        if (loanAmount <= cfg.PERCENT_THRESHOLD) {
            return { percent: 1, amount: Math.round(loanAmount * 0.01) };
        }
        let validPercent = percent;
        if (percent === undefined || percent === null || isNaN(percent)) {
            validPercent = cfg.DEFAULT_PERCENT;
        } else if (percent < cfg.MIN_PERCENT) {
            validPercent = cfg.MIN_PERCENT;
        } else if (percent > cfg.MAX_PERCENT) {
            validPercent = cfg.MAX_PERCENT;
        }
        return {
            percent: validPercent,
            amount: Math.round(loanAmount * validPercent / 100)
        };
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

    calculatePawnDueDate(startDate, termMonths) {
        if (!startDate || !termMonths || termMonths <= 0) return '';
        const [year, month, day] = startDate.split('-').map(Number);
        const totalMonths = month - 1 + termMonths;
        const newYear = year + Math.floor(totalMonths / 12);
        const newMonth = (totalMonths % 12) + 1;
        const daysInNewMonth = new Date(Date.UTC(newYear, newMonth, 0)).getUTCDate();
        const newDay = Math.min(day, daysInNewMonth);
        return (
            newYear + '-' +
            String(newMonth).padStart(2, '0') + '-' +
            String(newDay).padStart(2, '0')
        );
    }
};

// ─────────────────────────────────────────────
// 3. 模拟客户端幂等性检查逻辑
//    （与 app-payments.js 的 localStorage 机制一致）
// ─────────────────────────────────────────────
const MockStorage = {};
const IDEMPOTENCY_WINDOW_MS = 2 * 60 * 1000; // 2 分钟

function buildIdempotencyKey(orderId, type) {
    return `jf_pay_lock_${orderId}_${type}`;
}

function checkIdempotency(orderId, type, nowMs = Date.now()) {
    const key = buildIdempotencyKey(orderId, type);
    const existing = MockStorage[key];
    if (existing) {
        const elapsed = nowMs - existing.timestamp;
        if (elapsed < IDEMPOTENCY_WINDOW_MS) {
            return { isDuplicate: true, elapsed };
        }
    }
    MockStorage[key] = { timestamp: nowMs };
    return { isDuplicate: false };
}

function clearIdempotency(orderId, type) {
    delete MockStorage[buildIdempotencyKey(orderId, type)];
}

// ─────────────────────────────────────────────
// 4. 测试用例
// ─────────────────────────────────────────────

// ── 管理费 ──
section('管理费 calculateAdminFee');

expect(
    '当金 0 → 管理费 0',
    FeeConfig.calculateAdminFee(0), 0
);
expect(
    '当金 300,000（≤500k）→ 管理费 20,000',
    FeeConfig.calculateAdminFee(300000), 20000
);
expect(
    '当金 500,000（边界）→ 管理费 20,000',
    FeeConfig.calculateAdminFee(500000), 20000
);
expect(
    '当金 1,000,000（501k~3M）→ 管理费 30,000',
    FeeConfig.calculateAdminFee(1000000), 30000
);
expect(
    '当金 3,000,000（边界）→ 管理费 30,000',
    FeeConfig.calculateAdminFee(3000000), 30000
);
expect(
    '当金 5,000,000（>3M）→ 管理费 1%=50,000',
    FeeConfig.calculateAdminFee(5000000), 50000
);
expect(
    '当金 10,000,000 → 管理费 1%=100,000',
    FeeConfig.calculateAdminFee(10000000), 100000
);
expect(
    '当金 10,500,000 → 管理费 1%=105,000（四舍五入）',
    FeeConfig.calculateAdminFee(10500000), 105000
);

// ── 服务费 ──
section('服务费 calculateServiceFee');

expect(
    '当金 ≤3,000,000 → 免服务费',
    FeeConfig.calculateServiceFee(3000000, 5), { percent: 0, amount: 0 }
);
expect(
    '当金 3,000,001~5,000,000 → 固定 1%，忽略传入百分比',
    FeeConfig.calculateServiceFee(4000000, 8), { percent: 1, amount: 40000 }
);
expect(
    '当金 >5,000,000，百分比 5% → 正常计算',
    FeeConfig.calculateServiceFee(10000000, 5), { percent: 5, amount: 500000 }
);
expect(
    '当金 >5,000,000，百分比 10%（上限）→ 不超出',
    FeeConfig.calculateServiceFee(10000000, 10), { percent: 10, amount: 1000000 }
);
expect(
    '百分比 15%（超上限）→ 截断为 10%，不重置为默认 2%',
    FeeConfig.calculateServiceFee(10000000, 15), { percent: 10, amount: 1000000 }
);
expect(
    '百分比 1%（低于下限 2%）→ 截断为 2%',
    FeeConfig.calculateServiceFee(10000000, 1), { percent: 2, amount: 200000 }
);
expect(
    '百分比 undefined → 使用默认 2%',
    FeeConfig.calculateServiceFee(10000000, undefined), { percent: 2, amount: 200000 }
);
expect(
    '百分比 NaN → 使用默认 2%',
    FeeConfig.calculateServiceFee(10000000, NaN), { percent: 2, amount: 200000 }
);

// ── 固定还款 ──
section('固定还款额 calculateFixedMonthlyPayment');

expect(
    '当金 0 → 月还款 0',
    FeeConfig.calculateFixedMonthlyPayment(0, 0.10, 5), 0
);
expect(
    '利率 0 → 等额本金 = 本金 / 期数',
    FeeConfig.calculateFixedMonthlyPayment(10000000, 0, 5), 2000000
);
expectApprox(
    '当金 10,000,000，月利率 10%，5期 → 约 2,637,975',
    Math.round(FeeConfig.calculateFixedMonthlyPayment(10000000, 0.10, 5)),
    2637975,
    5
);
expectApprox(
    '当金 5,000,000，月利率 8.5%，3期',
    Math.round(FeeConfig.calculateFixedMonthlyPayment(5000000, 0.085, 3)),
    1957696,
    5
);

section('月还款取整 roundMonthlyPayment');

expect('1,000,001 → 向上取万位 = 1,010,000', FeeConfig.roundMonthlyPayment(1000001), 1010000);
expect('1,010,000 → 已是整万，不变', FeeConfig.roundMonthlyPayment(1010000), 1010000);
expect('2,637,975 → 向上取万 = 2,640,000', FeeConfig.roundMonthlyPayment(2637975), 2640000);

// ── 典当到期日 ──
section('典当到期日 calculatePawnDueDate');

expect(
    '2025-01-15 + 3个月 → 2025-04-15',
    FeeConfig.calculatePawnDueDate('2025-01-15', 3), '2025-04-15'
);
expect(
    '2025-10-15 + 3个月（跨年）→ 2026-01-15',
    FeeConfig.calculatePawnDueDate('2025-10-15', 3), '2026-01-15'
);
expect(
    '2025-01-31 + 1个月 → 2025-02-28（2月无31日，截断）',
    FeeConfig.calculatePawnDueDate('2025-01-31', 1), '2025-02-28'
);
expect(
    '2024-01-31 + 1个月 → 2024-02-29（2024闰年）',
    FeeConfig.calculatePawnDueDate('2024-01-31', 1), '2024-02-29'
);
expect(
    '2025-03-31 + 1个月 → 2025-04-30（4月无31日）',
    FeeConfig.calculatePawnDueDate('2025-03-31', 1), '2025-04-30'
);
expect(
    '期数为空 → 返回空字符串',
    FeeConfig.calculatePawnDueDate('2025-01-15', 0), ''
);
expect(
    '日期为空 → 返回空字符串',
    FeeConfig.calculatePawnDueDate('', 3), ''
);

// ── 支付幂等性 ──
section('支付幂等性（2分钟窗口）');

const ORDER_A = 'order-001';
const ORDER_B = 'order-002';
const NOW = Date.now();

const first = checkIdempotency(ORDER_A, 'interest', NOW);
expect('首次提交 → 不是重复', first.isDuplicate, false);

const second = checkIdempotency(ORDER_A, 'interest', NOW + 30000); // 30秒后
expect('30秒内再次提交 → 判定为重复', second.isDuplicate, true);

const third = checkIdempotency(ORDER_A, 'interest', NOW + 90000); // 90秒后
expect('90秒内再次提交 → 仍是重复', third.isDuplicate, true);

const fourth = checkIdempotency(ORDER_A, 'interest', NOW + 121000); // 121秒后（超窗口）
expect('121秒后提交 → 窗口过期，允许通过', fourth.isDuplicate, false);

const diffType = checkIdempotency(ORDER_A, 'principal', NOW + 30000);
expect('相同订单但不同类型（本金）→ 独立判断，不是重复', diffType.isDuplicate, false);

const diffOrder = checkIdempotency(ORDER_B, 'interest', NOW + 30000);
expect('不同订单相同类型 → 独立判断，不是重复', diffOrder.isDuplicate, false);

clearIdempotency(ORDER_A, 'interest');
const afterClear = checkIdempotency(ORDER_A, 'interest', NOW + 30000);
expect('手动清除锁后 → 可重新提交', afterClear.isDuplicate, false);

// ── 边界：异常输入 ──
section('异常输入防御');

expect('管理费：负数当金 → 0', FeeConfig.calculateAdminFee(-1000), 0);
expect('管理费：null → 0', FeeConfig.calculateAdminFee(null), 0);
expect('管理费：undefined → 0', FeeConfig.calculateAdminFee(undefined), 0);
expect('服务费：当金负数 → 免费', FeeConfig.calculateServiceFee(-1, 5), { percent: 0, amount: 0 });
expect('固定还款：期数0 → 0', FeeConfig.calculateFixedMonthlyPayment(10000000, 0.10, 0), 0);

// ─────────────────────────────────────────────
// 5. 汇总
// ─────────────────────────────────────────────
const total = passed + failed;
process.stdout.write('\n' + '═'.repeat(50) + '\n');
process.stdout.write(`测试结果：${passed}/${total} 通过`);

if (failed === 0) {
    process.stdout.write('  🎉 全部通过！\n');
} else {
    process.stdout.write(`  ⚠️  ${failed} 项失败\n`);
    process.stdout.write('\n失败项目：\n');
    failures.forEach(f => process.stdout.write(`  • ${f}\n`));
    process.exit(1); // 有失败时退出码为 1，方便 CI 检测
}
