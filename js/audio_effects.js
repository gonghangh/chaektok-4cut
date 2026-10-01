// 책톡네컷 (Chaektok 4-Cuts) Audio Effects Engine (Web Audio API & Speech Synthesis)
class ChaektokAudioEngine {
    constructor() {
        this.ctx = null;
        this.voiceEnabled = true;
        this.muted = false;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // 맑고 따뜻한 책톡 시그니처 멜로디 (C5 -> E5 -> G5 -> C6 실로폰 화음)
    playBookChime() {
        if (this.muted) return;
        this.init();
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        const now = this.ctx.currentTime;

        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.18);

            gain.gain.setValueAtTime(0, now + idx * 0.18);
            gain.gain.linearRampToValueAtTime(0.25, now + idx * 0.18 + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.18 + 1.1);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + idx * 0.18);
            osc.stop(now + idx * 0.18 + 1.2);
        });
    }

    // 카운트다운 비프음 (3, 2, 1) & 음성 안내
    playCountdownBeep(count) {
        if (this.muted) return;
        this.init();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // 1초 전 마지막 카운트는 더 높은 톤
        const freq = count === 1 ? 880 : 587.33; 
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.2);

        // 음성 카운트다운 (Web Speech)
        if (this.voiceEnabled && window.speechSynthesis) {
            try {
                window.speechSynthesis.cancel();
                const text = count === 1 ? "하나" : count === 2 ? "둘" : count === 3 ? "셋" : String(count);
                const utter = new SpeechSynthesisUtterance(text);
                utter.rate = 1.3;
                utter.pitch = 1.1;
                utter.lang = 'ko-KR';
                window.speechSynthesis.speak(utter);
            } catch (e) {
                // Speech synthesis fallback
            }
        }
    }

    // 카메라 셔터음 (기계식 셔터 사운드)
    playShutter() {
        if (this.muted) return;
        this.init();
        const now = this.ctx.currentTime;

        // 1. Shutter click noise
        const bufferSize = this.ctx.sampleRate * 0.12;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.02));
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2200;
        filter.Q.value = 2.5;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        noise.start(now);

        // 2. Mechanical click second transient
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(320, now + 0.04);
        osc.frequency.exponentialRampToValueAtTime(70, now + 0.14);

        oscGain.gain.setValueAtTime(0.5, now + 0.04);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

        osc.connect(oscGain);
        oscGain.connect(this.ctx.destination);

        osc.start(now + 0.04);
        osc.stop(now + 0.15);
    }

    // 터치 팝 효과음 (UI 피드백)
    playPop() {
        if (this.muted) return;
        this.init();
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(750, now);
        osc.frequency.exponentialRampToValueAtTime(350, now + 0.07);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.08);
    }

    // 인쇄 완료 축하 사운드
    playPrintFinish() {
        if (this.muted) return;
        this.init();
        const now = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // 도, 미, 솔, 높은 도

        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.1);

            gain.gain.setValueAtTime(0.25, now + idx * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.35);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + idx * 0.1);
            osc.stop(now + idx * 0.1 + 0.4);
        });
    }

    toggleMute() {
        this.muted = !this.muted;
        return this.muted;
    }
}

window.chaektokAudio = new ChaektokAudioEngine();
