    // 格式化金额为千位分隔符（用于输入框显示）
    formatNumberWithCommas: function(x) {
        if (x === null || x === undefined || x === '') return '';
        var num = String(x).replace(/[,\s]/g, '');
        if (isNaN(num) || num === '') return '';
        return Number(num).toLocaleString('en-US');
    },

    // 将千位分隔符格式的字符串转为数字
    parseNumberFromCommas: function(x) {
        if (!x) return 0;
        return parseInt(String(x).replace(/[,\s]/g, '')) || 0;
    },

    // 监听输入框，实时格式化金额（千位分隔符）
    bindAmountFormat: function(inputElement) {
        if (!inputElement) return;
        inputElement.addEventListener('input', function(e) {
            var rawValue = e.target.value;
            var num = Utils.parseNumberFromCommas(rawValue);
            if (!isNaN(num) && num !== '') {
                e.target.value = Utils.formatNumberWithCommas(num);
            }
        });
    },
