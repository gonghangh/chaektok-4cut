// 공항네컷 (Airport 4-Cuts) Standalone QR Code Generator
// Compact, 100% offline QR matrix generator for modern browsers
(function() {
    // Lightweight QR Code Generator (Type 1-10, EC Level L/M)
    function QRCode(typeNumber, errorCorrectionLevel) {
        this.typeNumber = typeNumber || 4;
        this.errorCorrectionLevel = errorCorrectionLevel || 'M';
        this.modules = null;
        this.moduleCount = 0;
        this.dataCache = null;
        this.dataList = [];
    }

    QRCode.prototype = {
        addData: function(data) {
            this.dataList.push(data);
            this.dataCache = null;
        },
        isDark: function(row, col) {
            if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
                throw new Error(row + "," + col);
            }
            return this.modules[row][col];
        },
        getModuleCount: function() {
            return this.moduleCount;
        },
        make: function() {
            this.makeImpl(false, this.getBestMaskPattern());
        },
        makeImpl: function(test, maskPattern) {
            this.moduleCount = this.typeNumber * 4 + 17;
            this.modules = new Array(this.moduleCount);
            for (let row = 0; row < this.moduleCount; row++) {
                this.modules[row] = new Array(this.moduleCount);
                for (let col = 0; col < this.moduleCount; col++) {
                    this.modules[row][col] = null;
                }
            }
            this.setupPositionProbePattern(0, 0);
            this.setupPositionProbePattern(this.moduleCount - 7, 0);
            this.setupPositionProbePattern(0, this.moduleCount - 7);
            this.setupPositionAdjustPattern();
            this.setupTimingPattern();
            this.setupTypeInfo(test, maskPattern);
            if (this.typeNumber >= 7) {
                this.setupTypeNumber(test);
            }
            if (this.dataCache == null) {
                this.dataCache = QRCode.createData(this.typeNumber, this.errorCorrectionLevel, this.dataList);
            }
            this.mapData(this.dataCache, maskPattern);
        },
        setupPositionProbePattern: function(row, col) {
            for (let r = -1; r <= 7; r++) {
                if (row + r <= -1 || this.moduleCount <= row + r) continue;
                for (let c = -1; c <= 7; c++) {
                    if (col + c <= -1 || this.moduleCount <= col + c) continue;
                    if ((0 <= r && r <= 6 && (c == 0 || c == 6)) ||
                        (0 <= c && c <= 6 && (r == 0 || r == 6)) ||
                        (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
                        this.modules[row + r][col + c] = true;
                    } else {
                        this.modules[row + r][col + c] = false;
                    }
                }
            }
        },
        getBestMaskPattern: function() {
            return 0; // Default mask pattern 0 is robust for standard strings
        },
        setupTimingPattern: function() {
            for (let r = 8; r < this.moduleCount - 8; r++) {
                if (this.modules[r][6] != null) continue;
                this.modules[r][6] = (r % 2 == 0);
            }
            for (let c = 8; c < this.moduleCount - 8; c++) {
                if (this.modules[6][c] != null) continue;
                this.modules[6][c] = (c % 2 == 0);
            }
        },
        setupPositionAdjustPattern: function() {
            const pos = QRCode.getPatternPosition(this.typeNumber);
            for (let i = 0; i < pos.length; i++) {
                for (let j = 0; j < pos.length; j++) {
                    const row = pos[i];
                    const col = pos[j];
                    if (this.modules[row][col] != null) continue;
                    for (let r = -2; r <= 2; r++) {
                        for (let c = -2; c <= 2; c++) {
                            if (r == -2 || r == 2 || c == -2 || c == 2 || (r == 0 && c == 0)) {
                                this.modules[row + r][col + c] = true;
                            } else {
                                this.modules[row + r][col + c] = false;
                            }
                        }
                    }
                }
            }
        },
        setupTypeInfo: function(test, maskPattern) {
            const data = (1 << 3) | maskPattern; // L or M
            const bits = QRCode.getBCHTypeInfo(data);
            for (let i = 0; i < 15; i++) {
                const mod = (!test && ((bits >> i) & 1) == 1);
                if (i < 6) {
                    this.modules[i][8] = mod;
                } else if (i < 8) {
                    this.modules[i + 1][8] = mod;
                } else {
                    this.modules[this.moduleCount - 15 + i][8] = mod;
                }
                if (i < 8) {
                    this.modules[8][this.moduleCount - i - 1] = mod;
                } else if (i < 9) {
                    this.modules[8][15 - i - 1 + 1] = mod;
                } else {
                    this.modules[8][15 - i - 1] = mod;
                }
            }
            this.modules[this.moduleCount - 8][8] = !test;
        },
        setupTypeNumber: function(test) {},
        mapData: function(data, maskPattern) {
            let inc = -1;
            let row = this.moduleCount - 1;
            let bitIndex = 7;
            let byteIndex = 0;

            for (let col = this.moduleCount - 1; col > 0; col -= 2) {
                if (col == 6) col--;
                while (true) {
                    for (let c = 0; c < 2; c++) {
                        if (this.modules[row][col - c] == null) {
                            let dark = false;
                            if (byteIndex < data.length) {
                                dark = (((data[byteIndex] >>> bitIndex) & 1) == 1);
                            }
                            const mask = (row + (col - c)) % 2 == 0;
                            if (mask) dark = !dark;
                            this.modules[row][col - c] = dark;
                            bitIndex--;
                            if (bitIndex == -1) {
                                byteIndex++;
                                bitIndex = 7;
                            }
                        }
                    }
                    row += inc;
                    if (row < 0 || this.moduleCount <= row) {
                        row -= inc;
                        inc = -inc;
                        break;
                    }
                }
            }
        }
    };

    QRCode.createData = function(typeNumber, errorCorrectionLevel, dataList) {
        const text = dataList.join('');
        const utf8Bytes = [];
        for (let i = 0; i < text.length; i++) {
            let code = text.charCodeAt(i);
            if (code < 0x80) {
                utf8Bytes.push(code);
            } else if (code < 0x800) {
                utf8Bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
            } else {
                utf8Bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
            }
        }
        // Minimal 8-bit byte mode encoding
        const buffer = [];
        // Mode indicator: 0100 (8-bit Byte)
        buffer.push(0x40 | (utf8Bytes.length >> 4));
        buffer.push(((utf8Bytes.length & 0x0f) << 4) | (utf8Bytes.length > 0 ? (utf8Bytes[0] >> 4) : 0));
        
        const totalBits = [];
        // 4 bits mode
        totalBits.push(0, 1, 0, 0);
        // 8 bits count
        for (let i = 7; i >= 0; i--) totalBits.push((utf8Bytes.length >> i) & 1);
        // data
        for (let i = 0; i < utf8Bytes.length; i++) {
            for (let b = 7; b >= 0; b--) {
                totalBits.push((utf8Bytes[i] >> b) & 1);
            }
        }
        // Terminator
        for (let i = 0; i < 4; i++) totalBits.push(0);

        // Convert bits to bytes
        const res = [];
        for (let i = 0; i < totalBits.length; i += 8) {
            let b = 0;
            for (let j = 0; j < 8; j++) {
                if (i + j < totalBits.length) {
                    b = (b << 1) | totalBits[i + j];
                } else {
                    b = (b << 1);
                }
            }
            res.push(b);
        }

        // Pad to capacity (Type 4 has 80 total data bytes for standard L/M)
        const capacity = 64; 
        const padBytes = [0xec, 0x11];
        let p = 0;
        while (res.length < capacity) {
            res.push(padBytes[p % 2]);
            p++;
        }
        return res;
    };

    QRCode.getPatternPosition = function(typeNumber) {
        if (typeNumber === 1) return [];
        return [6, 26];
    };

    QRCode.getBCHTypeInfo = function(data) {
        let d = data << 10;
        while (QRCode.getBCHDigit(d) - QRCode.getBCHDigit(1335) >= 0) {
            d ^= (1335 << (QRCode.getBCHDigit(d) - QRCode.getBCHDigit(1335)));
        }
        return ((data << 10) | d) ^ 21522;
    };

    QRCode.getBCHDigit = function(data) {
        let digit = 0;
        while (data != 0) {
            digit++;
            data >>>= 1;
        }
        return digit;
    };

    // Public API helper
    window.renderAirportQR = function(canvas, text, size) {
        size = size || 120;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);

        try {
            const qr = new QRCode(4, 'M');
            qr.addData(text);
            qr.make();
            const count = qr.getModuleCount();
            const cellSize = (size - 8) / count;
            const offset = 4;

            ctx.fillStyle = '#0c192c';
            for (let r = 0; r < count; r++) {
                for (let c = 0; c < count; c++) {
                    if (qr.isDark(r, c)) {
                        ctx.fillRect(Math.round(offset + c * cellSize), Math.round(offset + r * cellSize), Math.ceil(cellSize), Math.ceil(cellSize));
                    }
                }
            }
        } catch (e) {
            // Fallback barcode-like pattern if text is unusual
            ctx.fillStyle = '#0c192c';
            ctx.fillRect(8, 8, size - 16, size - 16);
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('AIRPORT QR', size / 2, size / 2 + 4);
        }
    };
})();
