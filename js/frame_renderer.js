// 책톡네컷 (Chaektok 4-Cuts) Canvas Rendering Engine
// 300 DPI Ultra High Quality Photo Booth Frame Renderer
class ChaektokFrameRenderer {
    constructor() {
        // 기본 4x6 인화지 규격 (300 DPI: 1200 x 1800 픽셀)
        this.width = 1200;
        this.height = 1800;

        // 책톡네컷 프레임 정의
        this.customFrames = {
            'custom_chaektok': {
                name: '책톡네컷 (Chaektokism)',
                maskSrc: 'frames/mask_chaektok.png',
                thumbSrc: 'frames/frame_chaektok.png',
                origW: 724,
                origH: 1024,
                targetCuts: 4,
                slots: [
                    { x: 44, y: 61, w: 304, h: 407 },   // 1 (상단 좌)
                    { x: 377, y: 138, w: 303, h: 407 }, // 2 (상단 우 - 스태거드)
                    { x: 44, y: 492, w: 304, h: 407 },  // 3 (하단 좌 - 책톡 오버레이)
                    { x: 377, y: 564, w: 303, h: 407 }  // 4 (하단 우 - 스태거드)
                ]
            }
        };

        // 이미지 캐시
        this.maskCache = {};
    }

    // 4컷 사진과 옵션을 받아 최종 인쇄용 Canvas 생성
    async render(photos, options = {}) {
        const {
            theme = 'custom_chaektok',
            filter = 'normal',
            customText = '책과 함께한 소중한 순간 📚',
            showDate = true,
            stamps = [],
            customUploadedMask = null
        } = options;

        const canvas = document.createElement('canvas');
        canvas.width = this.width;
        canvas.height = this.height;
        const ctx = canvas.getContext('2d');

        // 필터가 적용된 사진 이미지 로드
        const loadedImages = await this.loadAndFilterPhotos(photos, filter);

        // 책톡네컷 프레임 렌더링
        await this.renderCustomUserFrame(ctx, loadedImages, theme, customUploadedMask);

        // 스탬프 장식 그리기
        if (stamps && stamps.length > 0) {
            this.drawStamps(ctx, 0, 0, this.width, this.height, { stamps });
        }

        return canvas;
    }

    // 책톡네컷 커스텀 프레임 렌더링
    async renderCustomUserFrame(ctx, images, themeKey, uploadedMaskUrl) {
        let frameConfig = this.customFrames[themeKey] || this.customFrames['custom_chaektok'];
        let maskImgSrc = uploadedMaskUrl || (frameConfig ? frameConfig.maskSrc : 'frames/mask_chaektok.png');

        const targetW = this.width;   // 1200
        const targetH = this.height;  // 1800

        // 흰 배경으로 초기화
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetW, targetH);

        // 원본 724x1024 프레임을 4x6 비율에 맞게 스케일링 및 중앙 배치
        const origW = frameConfig ? frameConfig.origW : 724;
        const origH = frameConfig ? frameConfig.origH : 1024;

        const scale = Math.min(targetW / origW, targetH / origH);
        const drawW = origW * scale;
        const drawH = origH * scale;
        const offsetX = (targetW - drawW) / 2;
        const offsetY = (targetH - drawH) / 2;

        const slots = frameConfig ? frameConfig.slots : [
            { x: 44, y: 61, w: 304, h: 407 },
            { x: 377, y: 138, w: 303, h: 407 },
            { x: 44, y: 492, w: 304, h: 407 },
            { x: 377, y: 564, w: 303, h: 407 }
        ];

        // 1. 슬롯 위치에 사용자 사진 먼저 그리기
        for (let i = 0; i < slots.length; i++) {
            if (images[i] && slots[i]) {
                const s = slots[i];
                const sx = offsetX + s.x * scale;
                const sy = offsetY + s.y * scale;
                const sw = s.w * scale;
                const sh = s.h * scale;

                ctx.save();
                // 슬롯 영역으로 클리핑 (2px 안쪽으로 클립하여 프레임 외곽으로 튀어나가지 않도록 함)
                ctx.beginPath();
                ctx.rect(sx - 1, sy - 1, sw + 2, sh + 2);
                ctx.clip();

                // 사진을 슬롯 비율에 맞게 채워서(Center Crop) 그리기
                const img = images[i];
                const imgAspect = img.width / img.height;
                const slotAspect = sw / sh;
                let dx, dy, dw, dh;

                if (imgAspect > slotAspect) {
                    dh = img.height;
                    dw = img.height * slotAspect;
                    dx = (img.width - dw) / 2;
                    dy = 0;
                } else {
                    dw = img.width;
                    dh = img.width / slotAspect;
                    dx = 0;
                    dy = (img.height - dh) / 2;
                }

                ctx.drawImage(img, dx, dy, dw, dh, sx, sy, sw, sh);
                ctx.restore();
            }
        }

        // 2. 투명 마스크 프레임을 사진 위에 덧씌우기 (Overlay)
        // -> 이렇게 하면 프레임의 책톡 캐릭터, 레터링, 장식이 사진 위로 깔끔하게 얹어집니다!
        if (maskImgSrc) {
            try {
                let maskImg = this.maskCache[maskImgSrc];
                if (!maskImg) {
                    maskImg = await this.loadImage(maskImgSrc);
                    this.maskCache[maskImgSrc] = maskImg;
                }
                ctx.drawImage(maskImg, offsetX, offsetY, drawW, drawH);
            } catch (err) {
                console.warn('프레임 마스크 로드 실패:', err);
            }
        }
    }

    // A4 1장에 4장 모아찍기 (2x2 그리드) 캔버스 생성 (300 DPI A4)
    async renderA4Composite(singleCanvas) {
        const a4W = 2480; // A4 @ 300 DPI (210mm)
        const a4H = 3508; // A4 @ 300 DPI (297mm)

        const a4Canvas = document.createElement('canvas');
        a4Canvas.width = a4W;
        a4Canvas.height = a4H;
        const a4Ctx = a4Canvas.getContext('2d');

        // 깔끔한 흰색 종이 배경
        a4Ctx.fillStyle = '#ffffff';
        a4Ctx.fillRect(0, 0, a4W, a4H);

        // 2x2 배치 규격 계산
        const marginX = 80;
        const marginY = 80;
        const availW = (a4W - marginX * 2);
        const availH = (a4H - marginY * 2);

        const cardW = availW / 2;
        const cardH = availH / 2;

        const photoAspect = singleCanvas.width / singleCanvas.height; // 1200 / 1800 = 0.6667
        const slotAspect = cardW / cardH;

        let fitW, fitH;
        if (photoAspect > slotAspect) {
            fitW = cardW * 0.95;
            fitH = fitW / photoAspect;
        } else {
            fitH = cardH * 0.95;
            fitW = fitH * photoAspect;
        }

        // 4개의 위치 (좌상, 우상, 좌하, 우하)
        const positions = [
            { x: marginX + (cardW - fitW) / 2, y: marginY + (cardH - fitH) / 2 },
            { x: marginX + cardW + (cardW - fitW) / 2, y: marginY + (cardH - fitH) / 2 },
            { x: marginX + (cardW - fitW) / 2, y: marginY + cardH + (cardH - fitH) / 2 },
            { x: marginX + cardW + (cardW - fitW) / 2, y: marginY + cardH + (cardH - fitH) / 2 }
        ];

        // 4장 그리기
        positions.forEach(pos => {
            a4Ctx.save();
            // 미세한 그림자 및 경계선
            a4Ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
            a4Ctx.shadowBlur = 12;
            a4Ctx.shadowOffsetX = 0;
            a4Ctx.shadowOffsetY = 4;
            a4Ctx.drawImage(singleCanvas, pos.x, pos.y, fitW, fitH);
            a4Ctx.restore();

            // 얇은 테두리선
            a4Ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
            a4Ctx.lineWidth = 1;
            a4Ctx.strokeRect(pos.x, pos.y, fitW, fitH);
        });

        // 십자 자름선 (가위 점선 안내선)
        a4Ctx.save();
        a4Ctx.setLineDash([12, 12]);
        a4Ctx.strokeStyle = '#94a3b8';
        a4Ctx.lineWidth = 2;

        // 세로 중심 자름선
        const midX = a4W / 2;
        a4Ctx.beginPath();
        a4Ctx.moveTo(midX, 40);
        a4Ctx.lineTo(midX, a4H - 40);
        a4Ctx.stroke();

        // 가로 중심 자름선
        const midY = a4H / 2;
        a4Ctx.beginPath();
        a4Ctx.moveTo(40, midY);
        a4Ctx.lineTo(a4W - 40, midY);
        a4Ctx.stroke();

        // 중앙 자름선 가위 아이콘 텍스트
        a4Ctx.fillStyle = '#64748b';
        a4Ctx.font = '28px sans-serif';
        a4Ctx.textAlign = 'center';
        a4Ctx.textBaseline = 'middle';
        a4Ctx.fillText('✂️ 절취선', midX, 35);
        a4Ctx.fillText('✂️ 절취선', midX, a4H - 35);
        a4Ctx.fillText('✂️ 절취선', 45, midY);
        a4Ctx.fillText('✂️ 절취선', a4W - 45, midY);

        // 중앙 로고 & 워터마크 안내
        a4Ctx.fillStyle = '#065f46';
        a4Ctx.font = 'bold 22px "Malgun Gothic", sans-serif';
        a4Ctx.fillText('📚 책톡네컷 · Chaektok 4-CUTS', midX, midY - 20);
        a4Ctx.font = '16px sans-serif';
        a4Ctx.fillStyle = '#6b7280';
        a4Ctx.fillText('1장씩 예쁘게 잘라서 친구들과 함께 나누어 간직하세요!', midX, midY + 15);

        a4Ctx.restore();

        return a4Canvas;
    }

    // 사진 필터 적용 및 이미지 로드
    async loadAndFilterPhotos(photos, filterName) {
        const loaded = [];
        for (const dataUrl of photos) {
            const img = await this.loadImage(dataUrl);
            const filteredCanvas = this.applyFilter(img, filterName);
            loaded.push(filteredCanvas);
        }
        return loaded;
    }

    applyFilter(img, filterName) {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        switch (filterName) {
            case 'bright':
                ctx.filter = 'brightness(1.12) contrast(1.05) saturate(1.08)';
                break;
            case 'bw':
                ctx.filter = 'grayscale(100%) contrast(1.2) brightness(0.98)';
                break;
            case 'vintage':
                ctx.filter = 'sepia(45%) contrast(1.08) brightness(0.95) saturate(1.1)';
                break;
            case 'warm':
                ctx.filter = 'sepia(25%) saturate(1.25) brightness(1.03) contrast(1.02)';
                break;
            case 'cool':
                ctx.filter = 'hue-rotate(185deg) saturate(1.1) brightness(1.02) contrast(1.04)';
                break;
            case 'normal':
            default:
                ctx.filter = 'none';
                break;
        }

        ctx.drawImage(img, 0, 0);

        // 흑백/빈티지 후처리 톤 보정
        if (filterName === 'vintage') {
            ctx.fillStyle = 'rgba(217, 119, 6, 0.08)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else if (filterName === 'warm') {
            ctx.fillStyle = 'rgba(245, 158, 11, 0.06)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        return canvas;
    }

    // 스탬프/스티커 그리기
    drawStamps(ctx, ox, oy, w, h, options) {
        const stamps = options.stamps || [];
        stamps.forEach(stamp => {
            const x = ox + stamp.relX * w;
            const y = oy + stamp.relY * h;
            const size = stamp.size || 65;

            ctx.save();
            ctx.translate(x, y);
            if (stamp.rotation) {
                ctx.rotate(stamp.rotation * Math.PI / 180);
            }

            ctx.font = `${size}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // 은은한 그림자
            ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetY = 3;

            ctx.fillText(stamp.icon, 0, 0);
            ctx.restore();
        });
    }

    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = (e) => reject(e);
            img.src = src;
        });
    }
}
