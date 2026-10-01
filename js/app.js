// 책톡네컷 (Chaektok 4-Cuts) Kiosk Controller Application
class ChaektokBoothApp {
    constructor() {
        // App State
        this.currentScreen = 'screen-welcome';
        this.theme = 'custom_chaektok';
        this.customUploadedMask = null;
        this.timerSeconds = 5;
        this.currentFilter = 'normal';
        this.bookTitle = '오늘의 책톡 📚';
        this.userName = '책과 함께';
        this.copies = 1;
        this.stamps = [];

        // Stamp / Sticker Tool State
        this.selectedStampIcon = '📚';
        this.stampSize = 65;
        this.isDraggingStamp = false;
        this.draggedStampIndex = -1;
        this.dragOffset = { x: 0, y: 0 };
        this.dragRaf = null;

        // Shooting State
        this.capturedCuts = [];
        this.targetCutsCount = 4;
        this.isCountingDown = false;
        this.countdownTimer = null;
        this.autoResetTimer = null;

        // Rendered Canvas Result
        this.finalCanvas = null;
        this.finalDataUrl = null;
        this.finalA4Canvas = null;
        this.finalA4DataUrl = null;
        this.printPaper = 'a4'; // 기본값: A4 1장에 4장 모아찍기
        this.savedSessionFiles = null;

        // Printers & Devices
        this.printers = [];
        this.selectedPrinter = null;
        this.selectedCameraId = null;

        // Subsystems
        this.camera = null;
        this.renderer = new ChaektokFrameRenderer();
        this.audio = window.chaektokAudio;
    }

    async init() {
        this.initDOM();
        this.bindEvents();
        this.bindKeyboardShortcuts();

        // Initialize Camera
        const videoEl = document.getElementById('cam-video');
        this.camera = new ChaektokCamera(videoEl);

        // Load devices and printers
        await this.loadPrinters();
        await this.setupCameraList();

        console.log('책톡네컷 키오스크 시스템이 준비되었습니다 📚');
    }

    initDOM() {
        this.screens = {
            welcome: document.getElementById('screen-welcome'),
            layout: document.getElementById('screen-layout'),
            shooting: document.getElementById('screen-shooting'),
            customize: document.getElementById('screen-customize'),
            print: document.getElementById('screen-print')
        };
    }

    // 화면 전환 매니저
    switchScreen(targetId) {
        Object.keys(this.screens).forEach(key => {
            const screen = this.screens[key];
            if (screen.id === targetId) {
                screen.classList.add('active');
                screen.style.display = 'flex';
                setTimeout(() => screen.style.opacity = '1', 10);
            } else {
                screen.style.opacity = '0';
                setTimeout(() => {
                    screen.classList.remove('active');
                    screen.style.display = 'none';
                }, 250);
            }
        });

        this.currentScreen = targetId;

        // Screen specific hooks
        if (targetId === 'screen-welcome') {
            this.resetSession();
            this.camera.stopCamera();
        } else if (targetId === 'screen-shooting') {
            this.startCameraSession();
        } else if (targetId === 'screen-customize') {
            this.camera.stopCamera();
            this.updateCustomizePreview();
        } else if (targetId === 'screen-print') {
            this.setupPrintScreen();
        }
    }

    // 장치 및 프린터 목록 조회
    async loadPrinters() {
        try {
            const res = await fetch('/api/printers');
            const data = await res.json();
            if (data.success && data.printers) {
                this.printers = data.printers;
                const select = document.getElementById('select-printer-device');
                if (select) {
                    select.innerHTML = '';
                    const l8180 = this.printers.find(p => p.Name.includes('L8180') || p.DriverName.includes('L8180'));
                    this.selectedPrinter = l8180 ? l8180.Name : (this.printers[0] ? this.printers[0].Name : '기본 프린터');

                    this.printers.forEach(p => {
                        const opt = document.createElement('option');
                        opt.value = p.Name;
                        opt.textContent = `${p.Name} (${p.DriverName})`;
                        if (p.Name === this.selectedPrinter) opt.selected = true;
                        select.appendChild(opt);
                    });
                }

                const badge = document.getElementById('printer-status-text');
                if (badge) badge.textContent = `${this.selectedPrinter} 준비됨`;
                const targetText = document.getElementById('target-printer-name');
                if (targetText) targetText.textContent = this.selectedPrinter;
            }
        } catch (e) {
            console.warn('로컬 프린터 API 미연결 (웹 브라우저 인쇄 모드로 동작):', e);
            const badge = document.getElementById('printer-status-text');
            if (badge) badge.textContent = '포토 프린터 지원';
            const targetText = document.getElementById('target-printer-name');
            if (targetText) targetText.textContent = '시스템 기본 프린터';
        }
    }

    async setupCameraList() {
        const devices = await this.camera.getDevices();
        const select = document.getElementById('select-camera-device');
        if (!select) return;

        select.innerHTML = '';
        devices.forEach((d, i) => {
            const opt = document.createElement('option');
            opt.value = d.deviceId;
            opt.textContent = d.label || `카메라 ${i + 1}`;
            if (d.deviceId === this.selectedCameraId) opt.selected = true;
            select.appendChild(opt);
        });

        select.addEventListener('change', async (e) => {
            this.selectedCameraId = e.target.value;
            if (this.currentScreen === 'screen-shooting') {
                await this.camera.startCamera(this.selectedCameraId);
            }
        });
    }

    // 카메라 세션 시작
    async startCameraSession() {
        const success = await this.camera.startCamera(this.selectedCameraId);
        if (!success) {
            alert('웹캠 카메라를 연결할 수 없습니다. 브라우저 카메라 권한을 확인해주세요!');
        }
        this.updateSlotsDisplay();
    }

    // 세션 초기화
    resetSession() {
        this.capturedCuts = [];
        this.stamps = [];
        this.currentFilter = 'normal';
        this.isCountingDown = false;
        clearInterval(this.countdownTimer);
        clearTimeout(this.autoResetTimer);
        this.finalCanvas = null;
        this.finalDataUrl = null;
        this.finalA4Canvas = null;
        this.finalA4DataUrl = null;
        this.savedSessionFiles = null;
    }

    bindEvents() {
        // 1. Welcome Screen
        const btnStart = document.getElementById('btn-start-checkin');
        if (btnStart) {
            btnStart.addEventListener('click', () => {
                this.audio.playPop();
                this.audio.playBookChime();
                this.switchScreen('screen-layout');
            });
        }

        const screenWelcome = document.getElementById('screen-welcome');
        if (screenWelcome) {
            screenWelcome.addEventListener('click', (e) => {
                if (e.target.closest('#btn-start-checkin')) return;
                this.audio.playPop();
                this.audio.playBookChime();
                this.switchScreen('screen-layout');
            });
        }

        // Header Buttons
        const btnSound = document.getElementById('btn-sound-toggle');
        if (btnSound) {
            btnSound.addEventListener('click', () => {
                const muted = this.audio.toggleMute();
                btnSound.textContent = muted ? '🔇' : '🔊';
                btnSound.classList.toggle('active', !muted);
            });
        }

        const btnFs = document.getElementById('btn-fullscreen-toggle');
        if (btnFs) {
            btnFs.addEventListener('click', () => {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(() => {});
                    btnFs.textContent = '🗗';
                } else {
                    document.exitFullscreen().catch(() => {});
                    btnFs.textContent = '⛶';
                }
            });
        }

        const btnSettings = document.getElementById('btn-settings');
        const modalSettings = document.getElementById('modal-settings');
        const btnCloseSettings = document.getElementById('btn-close-settings');
        if (btnSettings && modalSettings) {
            btnSettings.addEventListener('click', () => {
                modalSettings.style.display = 'flex';
            });
        }
        if (btnCloseSettings && modalSettings) {
            btnCloseSettings.addEventListener('click', () => {
                modalSettings.style.display = 'none';
            });
        }

        // 2. Layout Screen: Timer Selection
        const timerBtns = document.querySelectorAll('.timer-btn');
        timerBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.audio.playPop();
                timerBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.timerSeconds = parseInt(btn.dataset.seconds, 10) || 5;
            });
        });

        // Custom Frame File Upload
        const frameInput = document.getElementById('input-custom-frame-file');
        if (frameInput) {
            frameInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                    this.customUploadedMask = evt.target.result;
                    this.theme = 'custom_uploaded';

                    // UI 업데이트
                    const customCard = document.getElementById('card-custom-frame');
                    if (customCard) {
                        customCard.style.display = 'flex';
                        customCard.querySelector('img').src = evt.target.result;
                        customCard.classList.add('active');
                        document.getElementById('card-chaektok').classList.remove('active');
                    }
                    this.audio.playPop();
                };
                reader.readAsDataURL(file);
            });
        }

        // Frame card selection
        const cardChaektok = document.getElementById('card-chaektok');
        const cardCustom = document.getElementById('card-custom-frame');
        if (cardChaektok) {
            cardChaektok.addEventListener('click', () => {
                this.audio.playPop();
                this.theme = 'custom_chaektok';
                this.customUploadedMask = null;
                cardChaektok.classList.add('active');
                if (cardCustom) cardCustom.classList.remove('active');
            });
        }
        if (cardCustom) {
            cardCustom.addEventListener('click', () => {
                this.audio.playPop();
                this.theme = 'custom_uploaded';
                cardCustom.classList.add('active');
                if (cardChaektok) cardChaektok.classList.remove('active');
            });
        }

        // Navigation: Layout -> Shooting
        const btnNextToShoot = document.getElementById('btn-to-shooting');
        if (btnNextToShoot) {
            btnNextToShoot.addEventListener('click', () => {
                this.audio.playPop();
                this.switchScreen('screen-shooting');
            });
        }

        const btnBackToWelcome = document.getElementById('btn-back-to-welcome');
        if (btnBackToWelcome) {
            btnBackToWelcome.addEventListener('click', () => {
                this.audio.playPop();
                this.switchScreen('screen-welcome');
            });
        }

        // 3. Shooting Screen
        const btnShoot = document.getElementById('btn-start-countdown');
        if (btnShoot) {
            btnShoot.addEventListener('click', () => {
                if (!this.isCountingDown) {
                    this.startCountdownSequence();
                }
            });
        }

        const btnMirror = document.getElementById('btn-cam-mirror');
        if (btnMirror) {
            btnMirror.addEventListener('click', () => {
                const isMirrored = this.camera.toggleMirror();
                btnMirror.classList.toggle('active', isMirrored);
                this.audio.playPop();
            });
        }

        const btnRetake = document.getElementById('btn-retake-last');
        if (btnRetake) {
            btnRetake.addEventListener('click', () => {
                this.audio.playPop();
                this.retakeLastShot();
            });
        }

        const btnBackToLayout = document.getElementById('btn-back-to-layout');
        if (btnBackToLayout) {
            btnBackToLayout.addEventListener('click', () => {
                this.audio.playPop();
                this.switchScreen('screen-layout');
            });
        }

        // 4. Customize Screen: Filter selection
        const filterCards = document.querySelectorAll('.filter-card');
        filterCards.forEach(card => {
            card.addEventListener('click', () => {
                this.audio.playPop();
                filterCards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                this.currentFilter = card.dataset.filter;
                this.updateCustomizePreview();
            });
        });

        // Sticker selection & canvas interaction
        const stampBtns = document.querySelectorAll('.btn-stamp-item');
        stampBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.audio.playPop();
                stampBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedStampIcon = btn.dataset.stamp;
            });
        });

        const btnAddStamp = document.getElementById('btn-add-stamp-center');
        if (btnAddStamp) {
            btnAddStamp.addEventListener('click', () => {
                this.audio.playPop();
                this.addStampAt(0.5, 0.5);
            });
        }

        const btnClearStamps = document.getElementById('btn-clear-stamps');
        if (btnClearStamps) {
            btnClearStamps.addEventListener('click', () => {
                this.audio.playPop();
                this.stamps = [];
                this.updateCustomizePreview();
            });
        }

        const btnRemoveLastStamp = document.getElementById('btn-remove-last-stamp');
        if (btnRemoveLastStamp) {
            btnRemoveLastStamp.addEventListener('click', () => {
                this.audio.playPop();
                if (this.stamps.length > 0) {
                    this.stamps.pop();
                    this.updateCustomizePreview();
                }
            });
        }

        // Stamp drag & drop on canvas
        const previewCanvas = document.getElementById('canvas-preview');
        if (previewCanvas) {
            previewCanvas.addEventListener('mousedown', (e) => this.handleCanvasDown(e));
            window.addEventListener('mousemove', (e) => this.handleCanvasMove(e));
            window.addEventListener('mouseup', () => this.handleCanvasUp());

            previewCanvas.addEventListener('touchstart', (e) => this.handleCanvasDown(e.touches[0]), { passive: false });
            window.addEventListener('touchmove', (e) => {
                if (this.isDraggingStamp) {
                    e.preventDefault();
                    this.handleCanvasMove(e.touches[0]);
                }
            }, { passive: false });
            window.addEventListener('touchend', () => this.handleCanvasUp());
        }

        // Quick Tag Pills
        const tagPills = document.querySelectorAll('.tag-pill');
        tagPills.forEach(pill => {
            pill.addEventListener('click', () => {
                this.audio.playPop();
                const text = pill.dataset.text || pill.textContent.trim();
                const input = document.getElementById('input-book-text');
                if (input) {
                    input.value = text;
                    this.bookTitle = text;
                    this.updateCustomizePreview();
                }
            });
        });

        const bookTextInput = document.getElementById('input-book-text');
        if (bookTextInput) {
            bookTextInput.addEventListener('input', (e) => {
                this.bookTitle = e.target.value;
                this.updateCustomizePreview();
            });
        }

        // Navigation: Customize -> Print
        const btnToPrint = document.getElementById('btn-to-print');
        if (btnToPrint) {
            btnToPrint.addEventListener('click', () => {
                this.audio.playPop();
                this.audio.playBookChime();
                this.switchScreen('screen-print');
            });
        }

        const btnBackToShooting = document.getElementById('btn-back-to-shooting');
        if (btnBackToShooting) {
            btnBackToShooting.addEventListener('click', () => {
                this.audio.playPop();
                this.capturedCuts = [];
                this.switchScreen('screen-shooting');
            });
        }

        // 5. Print Screen
        const paperOptions = document.querySelectorAll('.paper-select-card');
        paperOptions.forEach(opt => {
            opt.addEventListener('click', () => {
                this.audio.playPop();
                paperOptions.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                this.printPaper = opt.dataset.paper;
                this.updatePrintPreview();
            });
        });

        // Print Action Button
        const btnPrint = document.getElementById('btn-trigger-print');
        if (btnPrint) {
            btnPrint.addEventListener('click', () => {
                this.triggerPrint();
            });
        }

        // Download PNG Buttons
        const btnDownloadSingle = document.getElementById('btn-download-single');
        if (btnDownloadSingle) {
            btnDownloadSingle.addEventListener('click', () => {
                this.audio.playPop();
                this.downloadImage(this.finalDataUrl, `chaektok4cut_${this.getTimestamp()}.png`);
            });
        }

        const btnDownloadA4 = document.getElementById('btn-download-a4');
        if (btnDownloadA4) {
            btnDownloadA4.addEventListener('click', () => {
                this.audio.playPop();
                if (this.finalA4DataUrl) {
                    this.downloadImage(this.finalA4DataUrl, `chaektok4cut_A4_4cuts_${this.getTimestamp()}.png`);
                }
            });
        }

        // QR Code Modal
        const btnShowQr = document.getElementById('btn-show-qr');
        const modalQr = document.getElementById('modal-qrcode');
        const btnCloseQr = document.getElementById('btn-close-qr');
        if (btnShowQr && modalQr) {
            btnShowQr.addEventListener('click', () => {
                this.audio.playPop();
                this.generateQrModal();
                modalQr.style.display = 'flex';
            });
        }
        if (btnCloseQr && modalQr) {
            btnCloseQr.addEventListener('click', () => {
                modalQr.style.display = 'none';
            });
        }

        // Reset to Home
        const btnFinishHome = document.getElementById('btn-finish-home');
        if (btnFinishHome) {
            btnFinishHome.addEventListener('click', () => {
                this.audio.playPop();
                this.switchScreen('screen-welcome');
            });
        }
    }

    bindKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            // 스페이스바: 촬영 트리거
            if (e.code === 'Space') {
                if (this.currentScreen === 'screen-shooting' && !this.isCountingDown) {
                    e.preventDefault();
                    this.startCountdownSequence();
                } else if (this.currentScreen === 'screen-welcome') {
                    e.preventDefault();
                    this.switchScreen('screen-layout');
                }
            } else if (e.code === 'Escape') {
                const modals = document.querySelectorAll('.modal');
                modals.forEach(m => m.style.display = 'none');
            }
        });
    }

    // 촬영 카운트다운 시작
    startCountdownSequence() {
        if (this.isCountingDown) return;
        this.isCountingDown = true;

        let timeLeft = this.timerSeconds;
        const overlay = document.getElementById('countdown-overlay');
        const countText = document.getElementById('countdown-number');
        if (overlay) overlay.style.display = 'flex';
        if (countText) countText.textContent = timeLeft;

        this.audio.playCountdownBeep(timeLeft);

        this.countdownTimer = setInterval(() => {
            timeLeft--;
            if (timeLeft > 0) {
                if (countText) countText.textContent = timeLeft;
                this.audio.playCountdownBeep(timeLeft);
            } else {
                clearInterval(this.countdownTimer);
                if (overlay) overlay.style.display = 'none';
                this.takeSingleShot();
            }
        }, 1000);
    }

    // 단일 컷 캡처
    takeSingleShot() {
        this.isCountingDown = false;
        clearInterval(this.countdownTimer);
        const overlay = document.getElementById('countdown-overlay');
        if (overlay) overlay.style.display = 'none';

        // Flash effect
        const flash = document.getElementById('flash-overlay');
        if (flash) {
            flash.classList.add('active');
            setTimeout(() => flash.classList.remove('active'), 150);
        }
        this.audio.playShutter();

        try {
            const photoDataUrl = this.camera.capturePhoto();
            this.capturedCuts.push(photoDataUrl);
            this.updateSlotsDisplay();

            // 다음 컷 또는 완료 체크
            if (this.capturedCuts.length < this.targetCutsCount) {
                setTimeout(() => {
                    if (this.currentScreen === 'screen-shooting') {
                        this.startCountdownSequence();
                    }
                }, 1500);
            } else {
                // 4컷 모두 촬영 완료! 커스텀 화면으로 이동
                setTimeout(() => {
                    this.audio.playBookChime();
                    this.switchScreen('screen-customize');
                }, 1200);
            }
        } catch (e) {
            console.error('사진 캡처 실패:', e);
            this.isCountingDown = false;
            this.updateSlotsDisplay();
        }
    }

    retakeLastShot() {
        if (this.capturedCuts.length > 0) {
            this.capturedCuts.pop();
            this.isCountingDown = false;
            clearInterval(this.countdownTimer);
            const overlay = document.getElementById('countdown-overlay');
            if (overlay) overlay.style.display = 'none';
            this.updateSlotsDisplay();
        }
    }

    updateSlotsDisplay() {
        const count = this.capturedCuts.length;
        const maxCuts = this.targetCutsCount || 4;
        const cutsBadge = document.getElementById('cuts-indicator');
        const shootLabel = document.getElementById('btn-shoot-label');

        if (cutsBadge) {
            cutsBadge.textContent = `CUT ${Math.min(count + 1, maxCuts)} / ${maxCuts}`;
        }

        for (let i = 0; i < 4; i++) {
            const slot = document.getElementById(`slot-${i}`);
            if (!slot) continue;
            slot.classList.remove('current');

            if (i < count) {
                slot.innerHTML = `<img src="${this.capturedCuts[i]}" alt="컷 ${i + 1}">`;
            } else {
                slot.innerHTML = `<span>${i + 1}</span>`;
            }
        }

        if (count < maxCuts) {
            const curSlot = document.getElementById(`slot-${count}`);
            if (curSlot) curSlot.classList.add('current');
            if (shootLabel) shootLabel.textContent = `${count + 1}번째 컷 촬영하기 (총 ${maxCuts}컷)`;
        } else {
            if (shootLabel) shootLabel.textContent = '완료 (프레임 꾸미기)';
        }
    }

    // 커스텀 프리뷰 Canvas 렌더링
    async updateCustomizePreview(skipA4 = false) {
        if (this.capturedCuts.length === 0) return;

        const canvas = await this.renderer.render(this.capturedCuts, {
            theme: this.theme,
            filter: this.currentFilter,
            customText: this.bookTitle,
            stamps: this.stamps,
            customUploadedMask: this.customUploadedMask
        });

        this.finalCanvas = canvas;
        this.finalDataUrl = canvas.toDataURL('image/png', 0.95);

        // UI에 미리보기 표시
        const previewCanvas = document.getElementById('canvas-preview');
        if (previewCanvas) {
            if (previewCanvas.width !== canvas.width || previewCanvas.height !== canvas.height) {
                previewCanvas.width = canvas.width;
                previewCanvas.height = canvas.height;
            }
            const pCtx = previewCanvas.getContext('2d');
            pCtx.drawImage(canvas, 0, 0);
        }

        // A4 1장에 4장 모아찍기 (2x2) 고해상도 캔버스 동시 생성
        if (!skipA4) {
            try {
                this.finalA4Canvas = await this.renderer.renderA4Composite(canvas);
                this.finalA4DataUrl = this.finalA4Canvas.toDataURL('image/png', 0.95);
            } catch (e) {
                console.warn('A4 합성 캔버스 생성 실패:', e);
            }
        }
    }

    // 스티커 추가
    addStampAt(relX, relY) {
        this.stamps.push({
            icon: this.selectedStampIcon,
            relX: relX,
            relY: relY,
            size: this.stampSize,
            rotation: 0
        });
        this.updateCustomizePreview(true);
    }

    handleCanvasDown(e) {
        const previewCanvas = document.getElementById('canvas-preview');
        if (!previewCanvas) return;
        const rect = previewCanvas.getBoundingClientRect();
        const clientX = e.clientX;
        const clientY = e.clientY;

        const clickRelX = (clientX - rect.left) / rect.width;
        const clickRelY = (clientY - rect.top) / rect.height;

        let hitIndex = -1;
        for (let i = this.stamps.length - 1; i >= 0; i--) {
            const st = this.stamps[i];
            const dist = Math.hypot(st.relX - clickRelX, (st.relY - clickRelY) * (rect.height / rect.width));
            if (dist < 0.1) {
                hitIndex = i;
                break;
            }
        }

        if (hitIndex !== -1) {
            this.isDraggingStamp = true;
            this.draggedStampIndex = hitIndex;
            const st = this.stamps[hitIndex];
            this.dragOffset = {
                x: clickRelX - st.relX,
                y: clickRelY - st.relY
            };
        } else {
            this.addStampAt(clickRelX, clickRelY);
        }
    }

    handleCanvasMove(e) {
        if (!this.isDraggingStamp || this.draggedStampIndex === -1) return;
        const previewCanvas = document.getElementById('canvas-preview');
        if (!previewCanvas) return;
        const rect = previewCanvas.getBoundingClientRect();

        const moveRelX = (e.clientX - rect.left) / rect.width;
        const moveRelY = (e.clientY - rect.top) / rect.height;

        const st = this.stamps[this.draggedStampIndex];
        st.relX = Math.max(0.05, Math.min(0.95, moveRelX - this.dragOffset.x));
        st.relY = Math.max(0.05, Math.min(0.95, moveRelY - this.dragOffset.y));

        if (!this.dragRaf) {
            this.dragRaf = requestAnimationFrame(() => {
                this.updateCustomizePreview(true);
                this.dragRaf = null;
            });
        }
    }

    handleCanvasUp() {
        if (this.isDraggingStamp) {
            this.isDraggingStamp = false;
            this.draggedStampIndex = -1;
            this.updateCustomizePreview(false); // 전체 갱신 (A4 포함)
        }
    }

    // 인쇄 화면 준비
    async setupPrintScreen() {
        this.updatePrintPreview();
        await this.autoSaveToBackend();
    }

    updatePrintPreview() {
        const thumb = document.getElementById('print-final-thumb');
        const statusText = document.getElementById('target-printer-status');
        const printLabel = document.getElementById('btn-print-label');
        const guideText = document.getElementById('print-guide-text');

        if (this.printPaper === 'a4') {
            if (thumb && this.finalA4DataUrl) thumb.src = this.finalA4DataUrl;
            if (statusText) statusText.textContent = 'A4 1장에 4장 모아찍기 준비 완료';
            if (printLabel) printLabel.textContent = 'A4 4장 모아찍기 인쇄';
            if (guideText) guideText.textContent = 'A4 1장에 4장이 인쇄되어 친구들과 1장씩 나누어 갖기 좋습니다 ✂️';
        } else {
            if (thumb && this.finalDataUrl) thumb.src = this.finalDataUrl;
            if (statusText) statusText.textContent = '4x6 포토 인화지 출력 준비 완료';
            if (printLabel) printLabel.textContent = '4x6 포토용지 인쇄';
            if (guideText) guideText.textContent = '4x6 포토 인화지에 선명하고 꽉 차게 1장 인쇄됩니다';
        }
    }

    // 서버로 사진 자동 전송 및 저장
    async autoSaveToBackend() {
        try {
            const res = await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mainImage: this.finalDataUrl,
                    a4Image: this.finalA4DataUrl,
                    cuts: this.capturedCuts
                })
            });
            const data = await res.json();
            if (data.success) {
                this.savedSessionFiles = data.files;
                console.log('책톡네컷 로컬 저장 완료:', data.timestamp);
            }
        } catch (e) {
            console.warn('로컬 저장 요청 실패 (오프라인 모드 유지):', e);
        }
    }

    // 독립 iframe을 활용한 100% 무결점 인쇄 엔진
    printViaIframe(dataUrl, paperSize = 'a4') {
        return new Promise((resolve) => {
            let iframe = document.getElementById('chaektok-print-frame');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'chaektok-print-frame';
                iframe.style.position = 'fixed';
                iframe.style.top = '-10000px';
                iframe.style.left = '-10000px';
                iframe.style.border = 'none';
                iframe.style.zIndex = '-1';
                document.body.appendChild(iframe);
            }

            const isA4 = paperSize === 'a4';
            iframe.style.width = isA4 ? '210mm' : '4in';
            iframe.style.height = isA4 ? '297mm' : '6in';

            const pageCss = isA4
                ? `@page { size: A4 portrait; margin: 0; }
                   * { margin: 0; padding: 0; box-sizing: border-box; }
                   html, body { width: 210mm; height: 297mm; margin: 0; padding: 0; background: #ffffff; overflow: hidden; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                   img { width: 210mm; height: 297mm; display: block; object-fit: contain; }`
                : `@page { size: 4in 6in; margin: 0; }
                   * { margin: 0; padding: 0; box-sizing: border-box; }
                   html, body { width: 4in; height: 6in; margin: 0; padding: 0; background: #ffffff; overflow: hidden; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                   img { width: 4in; height: 6in; display: block; object-fit: fill; }`;

            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>책톡네컷 · Chaektok 4-CUTS</title>
                    <style>${pageCss}</style>
                </head>
                <body>
                    <img id="print-target-img" src="${dataUrl}">
                </body>
                </html>
            `);
            doc.close();

            const img = doc.getElementById('print-target-img');
            const trigger = () => {
                setTimeout(() => {
                    try {
                        iframe.contentWindow.focus();
                        iframe.contentWindow.print();
                    } catch(e) {
                        window.print();
                    }
                    resolve();
                }, 250);
            };

            if (img.complete && img.naturalWidth > 0) {
                trigger();
            } else {
                img.onload = trigger;
                setTimeout(trigger, 1000);
            }
        });
    }

    // 인쇄 실행
    async triggerPrint() {
        const btnPrint = document.getElementById('btn-trigger-print');
        if (btnPrint) btnPrint.disabled = true;

        const isA4 = this.printPaper === 'a4';
        const targetDataUrl = isA4 ? this.finalA4DataUrl : this.finalDataUrl;

        this.audio.playPop();

        // 1. 서버 직접 인쇄 API 시도
        let printedByServer = false;
        if (this.savedSessionFiles) {
            try {
                const targetFilePath = isA4 ? this.savedSessionFiles.a4 : this.savedSessionFiles.main;
                const res = await fetch('/api/print', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        imagePath: targetFilePath,
                        printerName: this.selectedPrinter,
                        paperSize: this.printPaper
                    })
                });
                const data = await res.json();
                if (data.success) {
                    printedByServer = true;
                    this.showPrintModal('포토 프린터로 출력이 전송되었습니다! 잠시 후 사진이 나옵니다 🖨️');
                }
            } catch (e) {
                console.log('서버 직접 인쇄 불가, 브라우저 대화상자로 인쇄 진행');
            }
        }

        // 2. 브라우저 iframe 인쇄 폴백
        if (!printedByServer) {
            await this.printViaIframe(targetDataUrl, this.printPaper);
        }

        this.audio.playPrintFinish();
        if (btnPrint) btnPrint.disabled = false;
    }

    showPrintModal(msg) {
        const modal = document.getElementById('modal-print-notice');
        if (modal) {
            modal.querySelector('.notice-text').textContent = msg;
            modal.style.display = 'flex';
            setTimeout(() => { modal.style.display = 'none'; }, 3500);
        }
    }

    downloadImage(dataUrl, fileName) {
        if (!dataUrl) return;
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    generateQrModal() {
        const qrContainer = document.getElementById('qrcode-canvas-container');
        if (!qrContainer) return;
        qrContainer.innerHTML = '';

        // 현재 웹페이지 URL 또는 배포 URL 생성
        const targetUrl = window.location.href;
        
        try {
            const qr = new QRCode(4, 'M');
            qr.addData(targetUrl);
            qr.make();

            const count = qr.getModuleCount();
            const canvas = document.createElement('canvas');
            const size = 220;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');

            const cellSize = size / count;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, size, size);
            ctx.fillStyle = '#065f46';

            for (let r = 0; r < count; r++) {
                for (let c = 0; c < count; c++) {
                    if (qr.isDark(r, c)) {
                        ctx.fillRect(c * cellSize, r * cellSize, cellSize + 0.5, cellSize + 0.5);
                    }
                }
            }
            qrContainer.appendChild(canvas);
        } catch (e) {
            console.error('QR 코드 생성 오류:', e);
            qrContainer.textContent = targetUrl;
        }
    }

    getTimestamp() {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    }
}

// Global App Instance Initialization
window.addEventListener('DOMContentLoaded', () => {
    window.chaektokApp = new ChaektokBoothApp();
    window.chaektokApp.init();
});
