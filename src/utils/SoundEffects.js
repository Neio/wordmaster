/**
 * Utility for playing high-quality recorded sound effects with a 
 * synthesized Web Audio API fallback.
 */
class SoundEffects {
    constructor() {
        this.ctx = null;
        // Pre-load audio files
        this.successAudio = new Audio('assets/sounds/success.mp3');
        this.failureAudio = new Audio('assets/sounds/failure.mp3');
    }

    /**
     * Initializes the AudioContext. 
     * Must be called in response to a user gesture to comply with browser policies.
     */
    init() {
        if (!this.ctx) {
            try {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.warn('Web Audio API not supported in this browser:', e);
            }
        }
        
        // Ensure context is resumed if suspended (common in many browsers)
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    /**
     * Plays a high-quality "sparkle" sound for success.
     */
    playSuccess() {
        this.successAudio.currentTime = 0;
        this.successAudio.play().catch(e => {
            if (e.name === 'AbortError') return; // Ignore aborts from rapid playback
            console.warn('Audio file playback failed, falling back to synthesis:', e);
            this._playSynthesizedSuccess();
        });
    }

    /**
     * Plays a high-quality "oops" sound for failure.
     */
    playFailure() {
        this.failureAudio.currentTime = 0;
        this.failureAudio.play().catch(e => {
            if (e.name === 'AbortError') return; // Ignore aborts from rapid playback
            console.warn('Audio file playback failed, falling back to synthesis:', e);
            this._playSynthesizedFailure();
        });
    }

    /**
     * Synthesized "sparkle" sound for success (fallback).
     */
    _playSynthesizedSuccess() {
        this.init();
        if (!this.ctx) return;

        const startTime = this.ctx.currentTime;
        this._playCuteNote(659.25, startTime, 0.3, 'sine');     // E5
        this._playCuteNote(880.00, startTime + 0.05, 0.3, 'sine'); // A5
        this._playCuteNote(1318.51, startTime + 0.10, 0.4, 'sine'); // E6
    }

    /**
     * Synthesized "oops" sound for failure (fallback).
     */
    _playSynthesizedFailure() {
        this.init();
        if (!this.ctx) return;

        const startTime = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(392.00, startTime); // G4
        osc.frequency.exponentialRampToValueAtTime(196.00, startTime + 0.25); // G3
        
        gain.gain.setValueAtTime(0.15, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + 0.3);
    }

    /**
     * Internal helper to play a cute note with a soft envelope.
     */
    _playCuteNote(freq, startTime, duration, type = 'sine') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);
        
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
    }
}

export const soundEffects = new SoundEffects();
