// 책톡네컷 (Chaektok 4-Cuts) Camera Management Engine
class ChaektokCamera {
    constructor(videoElement) {
        this.video = videoElement;
        this.stream = null;
        this.currentDeviceId = null;
        this.isMirrored = true;
        this.devices = [];
    }

    async getDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.devices = devices.filter(d => d.kind === 'videoinput');
            return this.devices;
        } catch (err) {
            console.error('카메라 목록 조회 실패:', err);
            return [];
        }
    }

    async startCamera(preferredDeviceId = null) {
        if (this.stream) {
            this.stopCamera();
        }

        const devices = await this.getDevices();
        
        let targetId = preferredDeviceId;
        if (!targetId && devices.length > 0) {
            // 외장 웹캠 또는 USB 카메라 우선 감지
            const extCam = devices.find(d => 
                d.label.toLowerCase().includes('usb') || 
                d.label.toLowerCase().includes('c7000') || 
                d.label.toLowerCase().includes('webcam')
            );
            targetId = extCam ? extCam.deviceId : devices[0].deviceId;
        }

        const constraints = {
            audio: false,
            video: {
                width: { ideal: 1920, min: 1280 },
                height: { ideal: 1080, min: 720 },
                frameRate: { ideal: 30 }
            }
        };

        if (targetId) {
            constraints.video.deviceId = { exact: targetId };
        }

        try {
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            await this.video.play();
            this.currentDeviceId = targetId;
            this.updateMirror();
            return { success: true, deviceId: targetId };
        } catch (err) {
            console.warn('고해상도로 카메라 시작 실패, 기본 설정으로 재시도:', err);
            try {
                this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                this.video.srcObject = this.stream;
                await this.video.play();
                this.updateMirror();
                return { success: true, deviceId: null };
            } catch (fallbackErr) {
                console.error('카메라 시작 최종 실패:', fallbackErr);
                return { success: false, error: fallbackErr.message };
            }
        }
    }

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
            this.video.srcObject = null;
        }
    }

    toggleMirror() {
        this.isMirrored = !this.isMirrored;
        this.updateMirror();
        return this.isMirrored;
    }

    updateMirror() {
        if (this.isMirrored) {
            this.video.style.transform = 'scaleX(-1)';
        } else {
            this.video.style.transform = 'scaleX(1)';
        }
    }

    // 현재 카메라 화면을 고화질로 캡처
    capturePhoto() {
        if (!this.video || !this.stream) {
            throw new Error('카메라 스트림이 준비되지 않았습니다.');
        }

        const videoW = this.video.videoWidth || 1280;
        const videoH = this.video.videoHeight || 720;

        const offCanvas = document.createElement('canvas');
        offCanvas.width = videoW;
        offCanvas.height = videoH;
        const offCtx = offCanvas.getContext('2d');

        offCtx.save();
        if (this.isMirrored) {
            offCtx.translate(videoW, 0);
            offCtx.scale(-1, 1);
        }

        offCtx.drawImage(this.video, 0, 0, videoW, videoH);
        offCtx.restore();

        return offCanvas.toDataURL('image/png', 1.0);
    }
}
