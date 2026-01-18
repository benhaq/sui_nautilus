import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import '../../public/styles/IntroPage.css'
import mascos from '../../public/images/intro/mascot.png'
// import logoMedSecondary from '../../public/images/Logos/Logo-secondary-full.png'

// Room Data
const ROOMS = [
    { id: 'ownership', icon: 'dna', title: 'Data Ownership', desc: 'Patients fully own and control their medical records. No organization can access them without your permission.', features: ['100% access permission rights', 'No centralized control point', 'Complete self-custody', 'You decide who can view'], color: 0x0ea5e9, x: -11.5, z: -20 },
    { id: 'encryption', icon: 'shield', title: 'Threshold Encryption', desc: 'Seal technology with M-of-N mechanism ensures no single point of failure. Data is protected by multiple parties.', features: ['M-of-N Threshold encryption', 'No single point of failure', 'Secure key recovery', 'AES-256-GCM encryption'], color: 0x10b981, x: 11.5, z: -20 },
    { id: 'blockchain', icon: 'chain', title: 'Sui Blockchain', desc: 'Store metadata and immutable audit trail on Sui blockchain. Fast transactions with low cost.', features: ['Immutable audit trail', 'Sub-second transactions', 'Low gas fees', 'Secure smart contracts'], color: 0x8b5cf6, x: -11.5, z: -45 },
    { id: 'storage', icon: 'server', title: 'Walrus Storage', desc: 'Decentralized storage with data encrypted before saving. No one can read data without the key.', features: ['Decentralized storage', 'Encryption before upload', 'Content ID retrieval', 'No single provider dependency'], color: 0xf59e0b, x: 11.5, z: -45 },
    { id: 'tee', icon: 'chip', title: 'TEE Oyster CVM', desc: 'Process sensitive data in AWS Nitro Enclave with PCR verification. Completely isolated environment.', features: ['AWS Nitro Enclave', 'PCR Verification', 'Isolated environment', 'Hardware attestation'], color: 0xec4899, x: -11.5, z: -70 },
    { id: 'compliance', icon: 'doc', title: 'HIPAA & GDPR', desc: 'Fully compliant with international medical data security standards HIPAA and GDPR.', features: ['HIPAA Technical Safeguards', 'GDPR Data Portability', 'Right to data deletion', 'Complete audit trail'], color: 0x06b6d4, x: 11.5, z: -70 }
];

const ICONS = {
    dna: '<svg viewBox="0 0 24 24"><path d="M12 2C12 2 12.5 3 13 4C13.5 5 14 6 14.5 7C15 8 16 8 17 8C18 8 19 9 20 10C21 11 22 13 22 13C22 13 20 13 18 13C16 13 15 14 14.5 15C14 16 13.5 17 13 18C12.5 19 12 20 12 20C12 20 11.5 19 11 18C10.5 17 10 16 9.5 15C9 14 8 13 6 13C4 13 2 13 2 13C2 13 3 11 4 10C5 9 6 8 7 8C8 8 9 8 9.5 7C10 6 10.5 5 11 4C11.5 3 12 2 12 2ZM7 16C7 16 8 16 9 17C10 18 11 19 12 22C13 19 14 18 15 17C16 16 17 16 17 16" stroke="currentColor" fill="none" stroke-width="2"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 22S4 18 4 12V6L12 3L20 6V12C20 18 12 22 12 22Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8V16" stroke="currentColor" stroke-width="2"/><path d="M8 12H16" stroke="currentColor" stroke-width="2"/></svg>',
    chain: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    server: '<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="8" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/><line x1="6" y1="6" x2="6.01" y2="6" stroke="currentColor" stroke-width="2"/><line x1="6" y1="18" x2="6.01" y2="18" stroke="currentColor" stroke-width="2"/></svg>',
    chip: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 9H15V15H9V9Z" fill="currentColor"/><line x1="9" y1="9" x2="4" y2="9" stroke="currentColor" stroke-width="2"/><line x1="20" y1="9" x2="15" y2="9" stroke="currentColor" stroke-width="2"/><line x1="9" y1="15" x2="4" y2="15" stroke="currentColor" stroke-width="2"/><line x1="20" y1="15" x2="15" y2="15" stroke="currentColor" stroke-width="2"/><line x1="9" y1="4" x2="9" y2="9" stroke="currentColor" stroke-width="2"/><line x1="15" y1="4" x2="15" y2="9" stroke="currentColor" stroke-width="2"/><line x1="9" y1="20" x2="9" y2="15" stroke="currentColor" stroke-width="2"/><line x1="15" y1="20" x2="15" y2="15" stroke="currentColor" stroke-width="2"/></svg>',
    doc: '<svg viewBox="0 0 24 24"><path d="M14 2H6C5 2 4 3 4 4V20C4 21 5 22 6 22H18C19 22 20 21 20 20V8L14 2Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14 2V8H20" stroke="currentColor" stroke-width="2"/><line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" stroke-width="2"/><line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" stroke-width="2"/><line x1="10" y1="9" x2="8" y2="9" stroke="currentColor" stroke-width="2"/></svg>',
    default: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
};

// Audio Manager Class
class AudioManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.isMuted = false;
        this.lastFootstep = 0;
        this.scanOsc = null;
        this.scanGain = null;
    }

    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = 0.3;
    }

    playFootstep() {
        if (!this.ctx || this.isMuted || Date.now() - this.lastFootstep < 400) return;
        this.lastFootstep = Date.now();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        const baseFreq = 120 + Math.random() * 40;
        osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 0.15);

        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);

        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.05);
        gain2.gain.setValueAtTime(0.02, this.ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
        osc2.connect(gain2);
        gain2.connect(this.masterGain);
        osc2.start();
        osc2.stop(this.ctx.currentTime + 0.05);
    }

    playUI(type) {
        if (!this.ctx || this.isMuted) return;

        const playNote = (freq, startTime, duration) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.08, startTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(startTime);
            osc.stop(startTime + duration);
        };

        const now = this.ctx.currentTime;
        if (type === 'enter') {
            playNote(261.63, now, 0.4);
            playNote(329.63, now + 0.1, 0.4);
            playNote(392.00, now + 0.2, 0.4);
            playNote(523.25, now + 0.3, 0.6);
        } else {
            playNote(523.25, now, 0.4);
            playNote(392.00, now + 0.1, 0.4);
            playNote(329.63, now + 0.2, 0.6);
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.masterGain) {
            this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.3, this.ctx.currentTime, 0.05);
        }
        if (this.isMuted) this.stopScanSound();
        return this.isMuted;
    }

    startScanSound() {
        if (!this.ctx || this.isMuted || this.scanOsc) return;

        this.scanOsc = this.ctx.createOscillator();
        this.scanGain = this.ctx.createGain();

        this.scanOsc.type = 'sawtooth';
        this.scanOsc.frequency.setValueAtTime(200, this.ctx.currentTime);
        this.scanOsc.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 1.0);

        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 15;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 50;
        lfo.connect(lfoGain);
        lfoGain.connect(this.scanOsc.frequency);
        lfo.start();

        this.scanGain.gain.setValueAtTime(0, this.ctx.currentTime);
        this.scanGain.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 0.1);

        this.scanOsc.connect(this.scanGain);
        this.scanGain.connect(this.masterGain);
        this.scanOsc.start();

        this.scanOsc.lfo = lfo;
    }

    stopScanSound() {
        if (!this.scanOsc) return;

        try {
            this.scanGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
            this.scanOsc.stop(this.ctx.currentTime + 0.2);
            if (this.scanOsc.lfo) this.scanOsc.lfo.stop(this.ctx.currentTime + 0.2);
        } catch (e) { }

        this.scanOsc = null;
        this.scanGain = null;
    }
}

export default function IntroPage() {
    const navigate = useNavigate();
    const sceneRef = useRef(null);
    const loadBarRef = useRef(null);
    const loadingRef = useRef(null);
    const welcomeRef = useRef(null);
    const muteBtnRef = useRef(null);
    const minimapPlayerRef = useRef(null);
    const minimapCanvasRef = useRef(null);
    const roomPanelRef = useRef(null);
    const rIconRef = useRef(null);
    const rTitleRef = useRef(null);
    const rDescRef = useRef(null);
    const rListRef = useRef(null);
    const fadeOverlayRef = useRef(null);
    const promptRef = useRef(null);

    useEffect(() => {
        let scene, camera, renderer;
        let mascot, mascotParts = {};
        let pos = { x: 0, z: 8 };
        let targetRotation = 0;
        let keys = {};
        let walkTime = 0;
        let isWalking = false;

        let interactionTimer = 0;
        const INTERACTION_DURATION = 1.0;
        let activeRoomId = null;

        let endingTriggered = false;
        let endingTimer = 0;
        let portalSwirl = null;
        let portalGodRay = null;
        let portalLight = null;

        let drones = [];

        let scannerGroup = null;
        let scannerMesh = null;
        let scannerTextSprite = null;
        let scannerCanvas = null;
        let scannerCtx = null;
        let scannerTexture = null;
        let lastScanPercent = -1;

        let ripples = [];
        let wallMeshes = [];
        let wallPulseIntensity = 0;
        let circuitTexture = null;

        const audio = new AudioManager();

        let isAnimatingCamera = false;
        let cameraTarget = new THREE.Vector3();
        let cameraLookAtTarget = new THREE.Vector3();
        let smoothedLookAt = new THREE.Vector3(0, 3, -10);
        let currentRoomData = null;
        let doorAnimationState = 0;
        let doors = new Map();
        let stationIcons = new Map();

        function init() {
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0xf0f9ff);
            scene.fog = new THREE.FogExp2(0xf0f9ff, 0.015);

            camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
            camera.position.set(0, 4.5, 6);

            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.2;
            sceneRef.current.appendChild(renderer.domElement);

            const ambient = new THREE.AmbientLight(0xffffff, 0.7);
            scene.add(ambient);

            const mainLight = new THREE.DirectionalLight(0xffffff, 0.5);
            mainLight.position.set(15, 30, 10);
            mainLight.castShadow = true;
            mainLight.shadow.mapSize.width = 2048;
            mainLight.shadow.mapSize.height = 2048;
            mainLight.shadow.camera.near = 0.5;
            mainLight.shadow.camera.far = 100;
            mainLight.shadow.camera.left = -30;
            mainLight.shadow.camera.right = 30;
            mainLight.shadow.camera.top = 30;
            mainLight.shadow.camera.bottom = -30;
            scene.add(mainLight);

            const panelGeo = new THREE.BoxGeometry(4, 0.2, 8);
            const panelMat = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                emissive: 0xffffff,
                emissiveIntensity: 1.0,
                toneMapped: false
            });

            for (let z = 0; z >= -90; z -= 20) {
                const light = new THREE.PointLight(0xf0f9ff, 0.6, 25);
                light.position.set(0, 6, z);
                scene.add(light);

                const panel = new THREE.Mesh(panelGeo, panelMat);
                panel.position.set(0, 7.9, z);
                scene.add(panel);
            }

            const pipeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4, metalness: 0.6 });
            const pipeLong = new THREE.CylinderGeometry(0.3, 0.3, 110, 8);
            pipeLong.rotateX(Math.PI / 2);

            const p1 = new THREE.Mesh(pipeLong, pipeMat);
            p1.position.set(-5, 7.5, -45);
            scene.add(p1);
            const p2 = new THREE.Mesh(pipeLong, pipeMat);
            p2.position.set(-5.8, 7.7, -45);
            scene.add(p2);
            const p3 = new THREE.Mesh(pipeLong, pipeMat);
            p3.position.set(5, 7.5, -45);
            scene.add(p3);

            createSignage("DATA SECURITY WING", 0, 6.5, -5, 0);
            createSignage("BIO-LABS", 0, 6.5, -45, 0);
            createSignage("RESTRICTED AREA", 0, 6.5, -85, 0);

            createEnvironment();
            createMascot();
            setupMinimap();
            setupControls();

            animate();

            let progress = 0;
            const loadInterval = setInterval(() => {
                progress += Math.random() * 12 + 3;
                if (progress >= 100) {
                    progress = 100;
                    clearInterval(loadInterval);
                    setTimeout(() => {
                        if (loadingRef.current) loadingRef.current.classList.add('hidden');
                        if (welcomeRef.current) welcomeRef.current.classList.add('show');
                    }, 500);
                }
                if (loadBarRef.current) loadBarRef.current.style.width = progress + '%';
            }, 100);
        }

        function createCircuitTexture() {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, 512, 512);

            ctx.strokeStyle = '#0ea5e9';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.fillStyle = '#0ea5e9';

            for (let i = 0; i < 20; i++) {
                const x = Math.random() * 512;
                const y = Math.random() * 512;
                const len = Math.random() * 100 + 50;
                const vertical = Math.random() > 0.5;

                ctx.beginPath();
                ctx.moveTo(x, y);
                if (vertical) {
                    ctx.lineTo(x, y + len);
                    ctx.arc(x, y + len, 5, 0, Math.PI * 2);
                } else {
                    ctx.lineTo(x + len, y);
                    ctx.arc(x + len, y, 5, 0, Math.PI * 2);
                }
                ctx.stroke();
                ctx.fill();
            }

            for (let i = 0; i < 5; i++) {
                const x = Math.random() * 512;
                const y = Math.random() * 512;
                ctx.beginPath();
                for (let s = 0; s < 6; s++) {
                    const angle = s * Math.PI / 3;
                    const hx = x + Math.cos(angle) * 30;
                    const hy = y + Math.sin(angle) * 30;
                    if (s === 0) ctx.moveTo(hx, hy);
                    else ctx.lineTo(hx, hy);
                }
                ctx.closePath();
                ctx.stroke();
            }

            const tex = new THREE.CanvasTexture(canvas);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            return tex;
        }

        function createEnvironment() {
            const floorGeo = new THREE.PlaneGeometry(26, 120);
            const floorMat = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                roughness: 0.05,
                metalness: 0.1
            });
            const floor = new THREE.Mesh(floorGeo, floorMat);
            floor.rotation.x = -Math.PI / 2;
            floor.position.z = -40;
            floor.receiveShadow = true;
            scene.add(floor);

            for (let x = -9; x <= 9; x += 4.5) {
                const line = new THREE.Mesh(
                    new THREE.PlaneGeometry(0.05, 120),
                    new THREE.MeshBasicMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0.6 })
                );
                line.rotation.x = -Math.PI / 2;
                line.position.set(x, 0.01, -40);
                scene.add(line);
            }

            circuitTexture = createCircuitTexture();
            const wallMat = new THREE.MeshStandardMaterial({
                color: 0xf8fafc,
                roughness: 0.3,
                metalness: 0.1,
                emissive: 0x0ea5e9,
                emissiveMap: circuitTexture,
                emissiveIntensity: 0.0
            });

            const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 120), wallMat);
            leftWall.position.set(-12, 4, -40);
            leftWall.receiveShadow = true;
            scene.add(leftWall);
            wallMeshes.push(leftWall);

            const rightWall = leftWall.clone();
            rightWall.position.x = 12;
            scene.add(rightWall);
            wallMeshes.push(rightWall);

            const ceiling = new THREE.Mesh(
                new THREE.PlaneGeometry(26, 120),
                new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.9 })
            );
            ceiling.rotation.x = Math.PI / 2;
            ceiling.position.set(0, 7, -40);
            scene.add(ceiling);

            const endWall = new THREE.Mesh(new THREE.BoxGeometry(26, 8, 0.5), wallMat);
            endWall.position.set(0, 4, -100);
            scene.add(endWall);

            ROOMS.forEach(r => createBioStation(r));

            createPortal();

            createDrone(-4, -20, 20);
            createDrone(4, -55, 25);
            createDrone(0, -80, 15);
        }

        function createBioStation(data) {
            const group = new THREE.Group();
            const isLeft = data.x < 0;

            group.position.set(data.x, 4.5, data.z);
            group.rotation.y = isLeft ? Math.PI / 2 : -Math.PI / 2;

            const frameMat = new THREE.MeshStandardMaterial({
                color: 0xe2e8f0,
                roughness: 0.3,
                metalness: 0.7,
            });

            const postGeo = new THREE.BoxGeometry(0.4, 5, 0.4);
            const leftPost = new THREE.Mesh(postGeo, frameMat);
            leftPost.position.set(-1.8, 0, 0);
            leftPost.castShadow = true;
            group.add(leftPost);

            const rightPost = leftPost.clone();
            rightPost.position.set(1.8, 0, 0);
            group.add(rightPost);

            const headerGeo = new THREE.BoxGeometry(4, 0.4, 0.5);
            const header = new THREE.Mesh(headerGeo, frameMat);
            header.position.set(0, 2.3, 0.05);
            header.castShadow = true;
            group.add(header);

            const thresholdGeo = new THREE.BoxGeometry(3.6, 0.1, 0.4);
            const thresholdMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
            const threshold = new THREE.Mesh(thresholdGeo, thresholdMat);
            threshold.position.set(0, -2.45, 0);
            group.add(threshold);

            const glassMat = new THREE.MeshPhysicalMaterial({
                color: 0xffffff,
                metalness: 0.1,
                roughness: 0.3,
                transmission: 0.7,
                thickness: 1.0,
                ior: 1.5,
                clearcoat: 0.8,
                clearcoatRoughness: 0.1,
                transparent: true
            });
            const glass = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4.6, 0.1), glassMat);
            glass.position.set(0, 0, 0);
            group.add(glass);

            doors.set(data.id, glass);

            const panelGroup = new THREE.Group();
            panelGroup.position.set(1.8, 0, 0.25);

            const scannerBox = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.1), new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8 }));
            panelGroup.add(scannerBox);

            const screenGeo = new THREE.PlaneGeometry(0.2, 0.3);
            const screenMat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9 });
            const screen = new THREE.Mesh(screenGeo, screenMat);
            screen.position.set(0, 0.05, 0.055);
            panelGroup.add(screen);

            const indicatorLight = new THREE.PointLight(0x0ea5e9, 0.5, 2);
            indicatorLight.position.set(0, 0, 0.1);
            panelGroup.add(indicatorLight);

            group.add(panelGroup);

            const iconGroup = new THREE.Group();
            iconGroup.position.set(0, 0, 0.3);

            createStationIcon(iconGroup, data.id, data.color);

            iconGroup.scale.set(0.8, 0.8, 0.8);

            group.add(iconGroup);
            stationIcons.set(data.id, iconGroup);

            const chamberLight = new THREE.PointLight(data.color, 1.0, 10);
            chamberLight.position.set(0, 1, -2);
            group.add(chamberLight);

            const labelCanvas = document.createElement('canvas');
            labelCanvas.width = 512;
            labelCanvas.height = 128;
            const lCtx = labelCanvas.getContext('2d');
            lCtx.fillStyle = 'rgba(15, 23, 42, 0.8)';
            lCtx.fillRect(0, 0, 512, 128);
            lCtx.strokeStyle = '#' + data.color.toString(16).padStart(6, '0');
            lCtx.lineWidth = 4;
            lCtx.strokeRect(4, 4, 504, 120);
            lCtx.fillStyle = '#ffffff';
            lCtx.font = 'bold 50px Inter';
            lCtx.textAlign = 'center';
            lCtx.textBaseline = 'middle';
            lCtx.fillText(data.title.toUpperCase(), 256, 64);

            const labelTex = new THREE.CanvasTexture(labelCanvas);
            const labelMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.6), new THREE.MeshBasicMaterial({ map: labelTex, transparent: true }));
            labelMesh.position.set(0, 2.9, 0.3);
            group.add(labelMesh);

            const marker = new THREE.Mesh(
                new THREE.RingGeometry(0.8, 1.0, 32),
                new THREE.MeshBasicMaterial({ color: data.color, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
            );
            marker.rotation.x = -Math.PI / 2;
            marker.position.set(0, -4.45, 1.5);
            group.add(marker);

            const forwardOffset = 1.5;
            data.markerPos = {
                x: isLeft ? data.x + forwardOffset : data.x - forwardOffset,
                z: data.z
            };

            scene.add(group);
        }

        function createStationIcon(parent, type, colorHex) {
            const material = new THREE.MeshStandardMaterial({
                color: colorHex,
                roughness: 0.2,
                metalness: 0.8,
                emissive: colorHex,
                emissiveIntensity: 0.4
            });

            if (type === 'ownership') {
                for (let i = 0; i < 10; i++) {
                    const y = (i - 4.5) * 0.25;
                    const angle = i * 0.6;
                    const r = 0.5;
                    const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), material);
                    b1.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
                    parent.add(b1);
                    const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), material);
                    b2.position.set(Math.cos(angle + Math.PI) * r, y, Math.sin(angle + Math.PI) * r);
                    parent.add(b2);
                    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 4), material);
                    bar.rotation.x = Math.PI / 2;
                    bar.rotation.z = angle;
                    bar.position.y = y;
                    parent.add(bar);
                }
            } else if (type === 'tee') {
                const heart = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6, 0), material);
                parent.add(heart);
                const tube = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.05, 8, 32), material);
                tube.rotation.x = Math.PI / 2;
                parent.add(tube);
            } else if (type === 'encryption') {
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.3), material);
                parent.add(body);
                const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 8, 16, Math.PI), material);
                shackle.position.y = 0.35;
                parent.add(shackle);
            } else if (type === 'blockchain') {
                const link1 = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 8, 16), material);
                link1.position.y = 0.3;
                link1.rotation.y = Math.PI / 2;
                parent.add(link1);
                const link2 = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 8, 16), material);
                link2.position.y = -0.3;
                parent.add(link2);
            } else if (type === 'storage') {
                const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.8), material);
                for (let i = -2; i <= 2; i++) {
                    const c = box.clone();
                    c.position.y = i * 0.25;
                    parent.add(c);
                }
            } else {
                const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), material);
                parent.add(crystal);
            }
        }

        function createSignage(text, x, y, z, rotY) {
            const canvas = document.createElement('canvas');
            canvas.width = 1024;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, 1024, 256);

            ctx.shadowColor = '#0ea5e9';
            ctx.shadowBlur = 30;
            ctx.strokeStyle = '#0ea5e9';
            ctx.lineWidth = 12;

            const r = 20;
            ctx.beginPath();
            ctx.moveTo(20 + r, 20);
            ctx.lineTo(1004 - r, 20);
            ctx.quadraticCurveTo(1004, 20, 1004, 20 + r);
            ctx.lineTo(1004, 236 - r);
            ctx.quadraticCurveTo(1004, 236, 1004 - r, 236);
            ctx.lineTo(20 + r, 236);
            ctx.quadraticCurveTo(20, 236, 20, 236 - r);
            ctx.lineTo(20, 20 + r);
            ctx.quadraticCurveTo(20, 20, 20 + r, 20);
            ctx.stroke();

            ctx.shadowBlur = 40;
            ctx.shadowColor = '#00ffff';
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 90px "Inter", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text.toUpperCase(), 512, 128);

            const tex = new THREE.CanvasTexture(canvas);

            const ironMat = new THREE.MeshStandardMaterial({
                color: 0x1e293b,
                roughness: 0.4,
                metalness: 0.9,
            });

            const faceMat = new THREE.MeshStandardMaterial({
                color: 0x000000,
                roughness: 0.2,
                metalness: 0.8,
                emissive: 0xffffff,
                emissiveMap: tex,
                emissiveIntensity: 1.5
            });

            const geometry = new THREE.BoxGeometry(4, 1, 0.2);

            const materials = [
                ironMat, ironMat, ironMat, ironMat, faceMat, faceMat
            ];

            const signMesh = new THREE.Mesh(geometry, materials);
            signMesh.position.set(x, y, z);
            signMesh.rotation.y = rotY;
            signMesh.castShadow = true;
            signMesh.receiveShadow = true;

            const rodGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.5, 8);
            const rodMat = new THREE.MeshStandardMaterial({
                color: 0x334155,
                metalness: 0.8,
                roughness: 0.5
            });

            const rodL = new THREE.Mesh(rodGeo, rodMat);
            rodL.position.set(-1.5, 0.75, 0);
            signMesh.add(rodL);

            const rodR = rodL.clone();
            rodR.position.set(1.5, 0.75, 0);
            signMesh.add(rodR);

            const mountGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.1, 16);
            const mountMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.5 });

            const mountL = new THREE.Mesh(mountGeo, mountMat);
            mountL.position.set(0, 0.75, 0);
            rodL.add(mountL);

            const mountR = mountL.clone();
            mountR.position.set(0, 0.75, 0);
            rodR.add(mountR);

            scene.add(signMesh);
        }

        function createDrone(startX, startZ, rangeZ) {
            const droneGroup = new THREE.Group();
            droneGroup.position.set(startX, 6, startZ);

            const bodyGeo = new THREE.SphereGeometry(0.4, 24, 24);
            const bodyMat = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                roughness: 0.2,
                metalness: 0.5
            });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.castShadow = true;
            droneGroup.add(body);

            const eyeGeo = new THREE.SphereGeometry(0.15, 16, 16);
            const eyeMat = new THREE.MeshStandardMaterial({
                color: 0x0ea5e9,
                emissive: 0x0ea5e9,
                emissiveIntensity: 1.0
            });
            const eye = new THREE.Mesh(eyeGeo, eyeMat);
            eye.position.set(0, 0, 0.3);
            eye.scale.z = 0.5;
            droneGroup.add(eye);

            const crossGroup = new THREE.Group();
            crossGroup.position.set(0.3, 0.1, 0);
            crossGroup.rotation.y = Math.PI / 2;
            crossGroup.scale.set(0.15, 0.15, 0.15);
            droneGroup.add(crossGroup);

            const cMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
            const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.1), cMat);
            const hBar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.1), cMat);
            crossGroup.add(vBar);
            crossGroup.add(hBar);

            const ringGeo = new THREE.TorusGeometry(0.5, 0.05, 8, 32);
            const ringMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = Math.PI / 2;
            droneGroup.add(ring);

            scene.add(droneGroup);

            const drone = {
                mesh: droneGroup,
                baseY: 6,
                startZ: startZ,
                rangeZ: rangeZ,
                speed: 1.5 + Math.random(),
                offset: Math.random() * 100,
                state: 'patrol',

                update: (delta, playerPos) => {
                    const time = Date.now() * 0.001 + drone.offset;

                    drone.mesh.position.y = drone.baseY + Math.sin(time * 3) * 0.2;

                    const dist = drone.mesh.position.distanceTo(playerPos);

                    if (dist < 8) {
                        drone.state = 'watch';
                        const targetLook = new THREE.Vector3(playerPos.x, playerPos.y + 1, playerPos.z);
                        drone.mesh.lookAt(targetLook);
                    } else {
                        drone.state = 'patrol';
                        const patrolTime = time * 0.5 * (3 / drone.speed);
                        const zOffset = Math.sin(patrolTime) * (drone.rangeZ / 2);
                        const targetZ = drone.startZ + zOffset;
                        const dir = Math.cos(patrolTime);
                        const lookZ = targetZ + (dir * 5);
                        const targetLook = new THREE.Vector3(startX, drone.baseY, lookZ);
                        drone.mesh.lookAt(targetLook);
                        drone.mesh.position.z = targetZ;
                    }
                }
            };

            drones.push(drone);
            return drone;
        }

        function createScanner() {
            scannerGroup = new THREE.Group();
            scannerGroup.visible = false;
            scene.add(scannerGroup);

            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 32;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#00000000';
            ctx.fillRect(0, 0, 128, 32);
            ctx.fillStyle = '#0ea5e9';
            ctx.fillRect(0, 14, 128, 4);

            const gridTex = new THREE.CanvasTexture(canvas);
            gridTex.wrapS = THREE.RepeatWrapping;
            gridTex.wrapT = THREE.RepeatWrapping;
            gridTex.repeat.set(1, 10);

            const cylGeo = new THREE.CylinderGeometry(1.5, 1.5, 3.5, 32, 1, true);
            const cylMat = new THREE.MeshBasicMaterial({
                color: 0x0ea5e9,
                map: gridTex,
                transparent: true,
                opacity: 0.6,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending
            });
            scannerMesh = new THREE.Mesh(cylGeo, cylMat);
            scannerMesh.position.y = 1.75;
            scannerMesh.geometry.translate(0, 1.75, 0);
            scannerMesh.position.y = 0;
            scannerMesh.scale.y = 0;
            scannerGroup.add(scannerMesh);

            scannerCanvas = document.createElement('canvas');
            scannerCanvas.width = 512;
            scannerCanvas.height = 128;
            scannerCtx = scannerCanvas.getContext('2d');
            scannerTexture = new THREE.CanvasTexture(scannerCanvas);

            const spriteMat = new THREE.SpriteMaterial({ map: scannerTexture, transparent: true });
            scannerTextSprite = new THREE.Sprite(spriteMat);
            scannerTextSprite.position.set(0, 3.5, 0);
            scannerTextSprite.scale.set(4, 1, 1);
            scannerGroup.add(scannerTextSprite);
        }

        function updateScannerText(percent) {
            if (Math.floor(percent) === lastScanPercent) return;
            lastScanPercent = Math.floor(percent);

            const ctx = scannerCtx;
            ctx.clearRect(0, 0, 512, 128);

            ctx.font = 'bold 60px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#0ea5e9';
            ctx.shadowColor = '#0ea5e9';
            ctx.shadowBlur = 10;
            ctx.fillText(`SCANNING... ${lastScanPercent}%`, 256, 80);

            ctx.fillStyle = 'rgba(14, 165, 233, 0.2)';
            ctx.fillRect(106, 100, 300, 10);

            ctx.fillStyle = '#0ea5e9';
            ctx.fillRect(106, 100, 300 * (percent / 100), 10);

            scannerTexture.needsUpdate = true;
        }

        function createPortal() {
            createScanner();
            const portalGroup = new THREE.Group();
            portalGroup.position.set(0, 5, -98);
            scene.add(portalGroup);

            const frameGeo = new THREE.TorusGeometry(6, 0.8, 16, 50);
            const frameMat = new THREE.MeshStandardMaterial({
                color: 0x334155,
                roughness: 0.2,
                metalness: 0.9
            });
            const frame = new THREE.Mesh(frameGeo, frameMat);
            portalGroup.add(frame);

            const horizonGeo = new THREE.CircleGeometry(5.8, 32);
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext('2d');
            const grad = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.2, '#0ea5e9');
            grad.addColorStop(0.6, '#0f172a');
            grad.addColorStop(1, '#000000');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 512, 512);

            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 100; i++) {
                ctx.beginPath();
                ctx.arc(Math.random() * 512, Math.random() * 512, Math.random() * 3, 0, Math.PI * 2);
                ctx.fill();
            }

            const swirlTex = new THREE.CanvasTexture(canvas);
            const horizonMat = new THREE.MeshBasicMaterial({
                map: swirlTex,
                side: THREE.DoubleSide
            });
            portalSwirl = new THREE.Mesh(horizonGeo, horizonMat);
            portalGroup.add(portalSwirl);

            portalLight = new THREE.PointLight(0x0ea5e9, 0, 20);
            portalLight.position.set(0, 0, 2);
            portalGroup.add(portalLight);

            portalGodRay = new THREE.SpotLight(0xffffff, 0);
            portalGodRay.position.set(0, 5, -100);
            portalGodRay.target.position.set(0, 0, -50);
            portalGodRay.angle = Math.PI / 8;
            portalGodRay.penumbra = 0.5;
            portalGodRay.distance = 60;
            portalGodRay.castShadow = true;
            scene.add(portalGodRay);
            scene.add(portalGodRay.target);
        }

        function createMascot() {
            mascot = new THREE.Group();
            mascotParts = {};

            const skinMat = new THREE.MeshPhysicalMaterial({
                color: 0x38bdf8,
                roughness: 0.3,
                metalness: 0.1,
                clearcoat: 0.1,
                clearcoatRoughness: 0.2
            });
            const bellyMat = new THREE.MeshStandardMaterial({
                color: 0xe0f2fe,
                roughness: 0.4
            });
            const coatMat = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                roughness: 0.5,
                side: THREE.DoubleSide
            });
            const eyeBlackMat = new THREE.MeshPhysicalMaterial({
                color: 0x111111,
                roughness: 0.0,
                metalness: 0.2,
                clearcoat: 1.0
            });
            const metalMat = new THREE.MeshStandardMaterial({
                color: 0x94a3b8,
                roughness: 0.2,
                metalness: 1.0
            });

            const bodyGeo = new THREE.SphereGeometry(0.75, 24, 24);
            const body = new THREE.Mesh(bodyGeo, skinMat);
            body.geometry.translate(0, 0.2, 0);
            body.scale.set(1.1, 1.0, 1.1);
            body.position.y = 0.9;
            body.castShadow = true;
            mascot.add(body);
            mascotParts.body = body;

            const belly = new THREE.Mesh(new THREE.SphereGeometry(0.65, 24, 24), bellyMat);
            belly.scale.set(0.9, 0.85, 0.5);
            belly.position.set(0, 0.2, 0.48);
            body.add(belly);

            const coatGroup = new THREE.Group();
            body.add(coatGroup);

            const coatGeo = new THREE.CylinderGeometry(0.78, 0.85, 1.1, 24, 1, true, 0, Math.PI * 1.4);
            const coat = new THREE.Mesh(coatGeo, coatMat);
            coat.rotation.y = Math.PI * 1.3;
            coat.position.y = 0.1;
            coatGroup.add(coat);

            const collar = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.1, 16, 32, Math.PI * 1.3), coatMat);
            collar.rotation.x = Math.PI / 2;
            collar.rotation.z = Math.PI * 1.35;
            collar.position.y = 0.7;
            coatGroup.add(collar);

            const badge = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.02), metalMat);
            badge.position.set(0.45, 0.3, 0.65);
            badge.rotation.y = -0.4;
            coatGroup.add(badge);

            const stethGroup = new THREE.Group();
            body.add(stethGroup);
            const stethTube = new THREE.Mesh(new THREE.TorusGeometry(0.77, 0.04, 8, 24, Math.PI * 1.6), new THREE.MeshStandardMaterial({ color: 0x334155 }));
            stethTube.rotation.x = Math.PI / 2;
            stethTube.rotation.z = Math.PI * 1.2;
            stethTube.position.y = 0.72;
            stethGroup.add(stethTube);

            const stethBell = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 16), metalMat);
            stethBell.rotation.x = Math.PI / 2;
            stethBell.position.set(0.1, 0.1, 0.82);
            stethGroup.add(stethBell);

            const headGroup = new THREE.Group();
            headGroup.position.set(0, 1.0, 0);
            body.add(headGroup);
            mascotParts.head = headGroup;

            const head = new THREE.Mesh(new THREE.SphereGeometry(0.8, 24, 24), skinMat);
            head.position.y = 0.6;
            headGroup.add(head);

            const snout = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.3, 4, 12), skinMat);
            snout.rotation.z = Math.PI / 2;
            snout.position.set(0, 0.4, 0.6);
            headGroup.add(snout);

            const leftEyeGroup = new THREE.Group();
            leftEyeGroup.position.set(-0.35, 0.7, 0.65);
            leftEyeGroup.rotation.y = -0.3;
            headGroup.add(leftEyeGroup);

            const eyeGeo = new THREE.SphereGeometry(0.18, 16, 16);
            const leftEye = new THREE.Mesh(eyeGeo, eyeBlackMat);
            leftEye.scale.z = 0.6;
            leftEyeGroup.add(leftEye);
            const sparkle = new THREE.Mesh(new THREE.SphereGeometry(0.04), new THREE.MeshBasicMaterial({ color: 0xffffff }));
            sparkle.position.set(0.08, 0.08, 0.15);
            leftEyeGroup.add(sparkle);

            const rightEyeGroup = leftEyeGroup.clone();
            rightEyeGroup.position.set(0.35, 0.7, 0.65);
            rightEyeGroup.rotation.y = 0.3;
            headGroup.add(rightEyeGroup);

            const capGroup = new THREE.Group();
            capGroup.position.set(0, 1.3, 0);
            capGroup.rotation.z = -0.15;
            capGroup.rotation.x = -0.1;
            headGroup.add(capGroup);

            const capMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.25, 24), new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.6 }));
            capGroup.add(capMesh);
            const capTop = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.6 }));
            capTop.position.y = 0.12;
            capGroup.add(capTop);

            const armGeo = new THREE.CapsuleGeometry(0.15, 0.4, 4, 8);
            const legGeo = new THREE.CapsuleGeometry(0.25, 0.4, 4, 8);

            const leftArmGroup = new THREE.Group();
            leftArmGroup.position.set(-0.8, 0.3, 0.1);
            body.add(leftArmGroup);
            mascotParts.leftArm = leftArmGroup;

            const leftArm = new THREE.Mesh(armGeo, skinMat);
            leftArm.rotation.z = -0.3;
            leftArm.rotation.x = 0.5;
            leftArm.position.y = -0.2;
            leftArmGroup.add(leftArm);
            const leftSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.3), coatMat);
            leftSleeve.position.set(0, -0.1, 0);
            leftSleeve.rotation.z = -0.3;
            leftSleeve.rotation.x = 0.5;
            leftArmGroup.add(leftSleeve);

            const rightArmGroup = new THREE.Group();
            rightArmGroup.position.set(0.8, 0.3, 0.1);
            body.add(rightArmGroup);
            mascotParts.rightArm = rightArmGroup;

            const rightArm = new THREE.Mesh(armGeo, skinMat);
            rightArm.rotation.z = 0.3;
            rightArm.rotation.x = 0.5;
            rightArm.position.y = -0.2;
            rightArmGroup.add(rightArm);
            const rightSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.3), coatMat);
            rightSleeve.position.set(0, -0.1, 0);
            rightSleeve.rotation.z = 0.3;
            rightSleeve.rotation.x = 0.5;
            rightArmGroup.add(rightSleeve);

            const leftLegGroup = new THREE.Group();
            leftLegGroup.position.set(-0.4, -0.5, 0);
            body.add(leftLegGroup);
            mascotParts.leftLeg = leftLegGroup;

            const leftLeg = new THREE.Mesh(legGeo, skinMat);
            leftLeg.position.y = -0.2;
            leftLegGroup.add(leftLeg);

            const rightLegGroup = new THREE.Group();
            rightLegGroup.position.set(0.4, -0.5, 0);
            body.add(rightLegGroup);
            mascotParts.rightLeg = rightLegGroup;

            const rightLeg = new THREE.Mesh(legGeo, skinMat);
            rightLeg.position.y = -0.2;
            rightLegGroup.add(rightLeg);

            const tailGroup = new THREE.Group();
            tailGroup.position.set(0, -0.4, -0.7);
            body.add(tailGroup);
            mascotParts.tail = tailGroup;

            const tail = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 16), skinMat);
            tail.rotation.x = -Math.PI / 1.8;
            tail.position.set(0, 0, -0.3);
            tailGroup.add(tail);

            mascot.position.set(pos.x, 0, pos.z);
            mascot.castShadow = true;

            const ringGeo = new THREE.RingGeometry(1.2, 1.4, 32, 1, 0, 0);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
            const timerRing = new THREE.Mesh(ringGeo, ringMat);
            timerRing.rotation.x = -Math.PI / 2;
            timerRing.position.y = 0.1;
            timerRing.visible = false;
            mascot.add(timerRing);
            mascotParts.timerRing = timerRing;

            scene.add(mascot);
        }

        function animateMascot(delta) {
            if (!mascot || !mascotParts.leftLeg) return;

            walkTime += delta * (isWalking ? 12 : 3);

            const legAmp = isWalking ? 0.6 : 0.05;
            mascotParts.leftLeg.rotation.x = Math.sin(walkTime) * legAmp;
            mascotParts.rightLeg.rotation.x = Math.sin(walkTime + Math.PI) * legAmp;

            const armAmp = isWalking ? 0.2 : 0.05;
            mascotParts.leftArm.rotation.z = 0.2 + Math.sin(walkTime) * armAmp;
            mascotParts.rightArm.rotation.z = -0.2 - Math.sin(walkTime) * armAmp;

            const tailAmp = isWalking ? 0.3 : 0.1;
            mascotParts.tail.rotation.y = Math.sin(walkTime * 0.8) * tailAmp;

            mascotParts.head.rotation.y = Math.sin(walkTime * 0.5) * 0.1;
            mascotParts.head.rotation.z = Math.sin(walkTime) * 0.05;

            mascot.position.y = Math.abs(Math.sin(walkTime * 2)) * 0.1;
        }

        function setupMinimap() {
            const canvas = minimapCanvasRef.current;
            if (!canvas) return;
            ROOMS.forEach(r => {
                const dot = document.createElement('div');
                dot.className = 'minimap-room';
                dot.style.background = '#' + r.color.toString(16).padStart(6, '0');
                const left = ((r.x + 24) / 48) * 100;
                const top = ((10 - r.z) / 110) * 100;
                dot.style.left = left + '%';
                dot.style.top = top + '%';
                canvas.appendChild(dot);
            });
        }

        function updateMinimap() {
            const player = minimapPlayerRef.current;
            if (!player) return;
            const left = ((pos.x + 24) / 48) * 100;
            const top = ((10 - pos.z) / 110) * 100;
            player.style.left = left + '%';
            player.style.top = top + '%';
        }

        function setupControls() {
            const handleKeyDown = (e) => {
                const key = e.key.toLowerCase();
                keys[key] = true;
                if (e.key === 'Escape') closePanel();
            };
            const handleKeyUp = (e) => {
                keys[e.key.toLowerCase()] = false;
            };
            const handleResize = () => {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            };

            window.addEventListener('keydown', handleKeyDown);
            window.addEventListener('keyup', handleKeyUp);
            window.addEventListener('resize', handleResize);

            return () => {
                window.removeEventListener('keydown', handleKeyDown);
                window.removeEventListener('keyup', handleKeyUp);
                window.removeEventListener('resize', handleResize);
            };
        }

        function createRipple(posArg) {
            const geo = new THREE.TorusGeometry(0.5, 0.1, 8, 32);
            const mat = new THREE.MeshBasicMaterial({
                color: 0x0ea5e9,
                transparent: true,
                opacity: 0.8,
                side: THREE.DoubleSide
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.rotation.x = Math.PI / 2;
            mesh.position.set(posArg.x, 0.1, posArg.z);
            scene.add(mesh);

            ripples.push({
                mesh: mesh,
                age: 0,
                maxAge: 1.5
            });
        }

        function updateRipples(delta) {
            for (let i = ripples.length - 1; i >= 0; i--) {
                const rip = ripples[i];
                rip.age += delta;

                const scale = 1 + rip.age * 8;
                rip.mesh.scale.set(scale, scale, 1);
                rip.mesh.material.opacity = 0.8 * (1 - rip.age / rip.maxAge);

                if (scale > 20 && scale < 22) {
                    wallPulseIntensity = 1.5;
                }

                if (rip.age >= rip.maxAge) {
                    scene.remove(rip.mesh);
                    rip.mesh.geometry.dispose();
                    rip.mesh.material.dispose();
                    ripples.splice(i, 1);
                }
            }

            if (wallPulseIntensity > 0) {
                wallPulseIntensity -= delta * 3.0;
                if (wallPulseIntensity < 0) wallPulseIntensity = 0;

                wallMeshes.forEach(mesh => {
                    mesh.material.emissiveIntensity = wallPulseIntensity;
                });
            }
        }

        function showPanel(r) {
            currentRoomData = r;
            isAnimatingCamera = true;

            audio.playUI('enter');

            const isLeft = r.x < 0;
            const lookX = isLeft ? r.x + 3 : r.x - 3;
            cameraTarget.set(lookX, 4.5, r.z);
            cameraLookAtTarget.set(r.x, 4.5, r.z);

            if (rIconRef.current) rIconRef.current.innerHTML = ICONS[r.icon] || ICONS.default;
            if (rTitleRef.current) rTitleRef.current.textContent = r.title;
            if (rDescRef.current) rDescRef.current.textContent = r.desc;
            if (rListRef.current) rListRef.current.innerHTML = r.features.map(f => `<li><span class="li-icon">▶</span> ${f}</li>`).join('');
            if (roomPanelRef.current) roomPanelRef.current.classList.add('show');

            keys = {};
            isWalking = false;
        }

        function closePanel() {
            isAnimatingCamera = false;
            currentRoomData = null;
            interactionTimer = 0;
            if (roomPanelRef.current) roomPanelRef.current.classList.remove('show');
            audio.playUI('exit');
        }

        let lastTime = 0;
        function animate(time = 0) {
            requestAnimationFrame(animate);

            const delta = Math.min((time - lastTime) / 1000, 0.1);
            lastTime = time;

            const speed = 8 * delta;
            let moving = false;

            if (keys['w'] || keys['arrowup']) { pos.z -= speed; targetRotation = Math.PI; moving = true; }
            if (keys['s'] || keys['arrowdown']) { pos.z += speed; targetRotation = 0; moving = true; }
            if (keys['a'] || keys['arrowleft']) { pos.x -= speed; targetRotation = Math.PI / 2; moving = true; }
            if (keys['d'] || keys['arrowright']) { pos.x += speed; targetRotation = -Math.PI / 2; moving = true; }

            if ((keys['w'] || keys['arrowup']) && (keys['a'] || keys['arrowleft'])) targetRotation = Math.PI * 0.75;
            if ((keys['w'] || keys['arrowup']) && (keys['d'] || keys['arrowright'])) targetRotation = -Math.PI * 0.75;
            if ((keys['s'] || keys['arrowdown']) && (keys['a'] || keys['arrowleft'])) targetRotation = Math.PI * 0.25;
            if ((keys['s'] || keys['arrowdown']) && (keys['d'] || keys['arrowright'])) targetRotation = -Math.PI * 0.25;

            isWalking = moving;

            pos.x = Math.max(-9, Math.min(9, pos.x));
            pos.z = Math.max(-95, Math.min(12, pos.z));

            if (mascot) {
                mascot.position.x = pos.x;
                mascot.position.z = pos.z;

                let rotDiff = targetRotation - mascot.rotation.y;
                while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
                while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
                mascot.rotation.y += rotDiff * 0.1;

                animateMascot(delta);

                if (isWalking) {
                    audio.playFootstep();
                    if (Math.random() < 0.1) createRipple(mascot.position);
                }
            }

            if (!endingTriggered && mascot) {
                if (pos.z < -85) {
                    endingTriggered = true;
                    endingTimer = 0;
                    isWalking = false;
                    keys = {};
                }
            } else if (endingTriggered && mascot) {
                endingTimer += delta;

                if (portalSwirl) portalSwirl.rotation.z -= delta * 2;

                if (endingTimer < 0.5) {
                    targetRotation = Math.PI;
                    mascot.rotation.y = THREE.MathUtils.lerp(mascot.rotation.y, targetRotation, 0.1);
                } else {
                    mascot.rotation.y = Math.PI;
                }

                if (endingTimer > 0.5 && endingTimer < 2.5) {
                    if (mascotParts.rightArm) {
                        mascotParts.rightArm.rotation.z = 2.5 + Math.sin((endingTimer - 0.5) * 10) * 0.5;
                        mascotParts.rightArm.rotation.x = 0;
                    }
                }

                if (endingTimer > 2.0) {
                    if (portalGodRay && portalGodRay.intensity < 100) {
                        portalGodRay.intensity += delta * 50;
                    }
                    if (portalLight && portalLight.intensity < 5) {
                        portalLight.intensity += delta * 2;
                    }
                }

                if (endingTimer > 3.0 && endingTimer < 4.5) {
                    const t = (endingTimer - 3.0) / 1.5;
                    const scale = 1.0 - t;
                    mascot.scale.setScalar(Math.max(0, scale));
                    mascot.position.lerp(new THREE.Vector3(0, 5, -98), 0.05);
                }

                if (endingTimer > 4.0) {
                    if (fadeOverlayRef.current) fadeOverlayRef.current.style.opacity = 1;
                }

                if (endingTimer > 5.5) {
                    // Navigate to main page instead of external link
                    navigate('/home');
                }
            }

            if (isAnimatingCamera) {
                const lerpSpeed = 0.1;
                camera.position.lerp(cameraTarget, lerpSpeed);

                const currentLookAt = new THREE.Vector3();
                camera.getWorldDirection(currentLookAt);
                const targetDir = new THREE.Vector3().subVectors(cameraLookAtTarget, camera.position).normalize();
                const lerpedDir = currentLookAt.lerp(targetDir, lerpSpeed);
                camera.lookAt(camera.position.clone().add(lerpedDir));

                doorAnimationState = Math.min(1, doorAnimationState + delta * 2);
            } else {
                const camTargetX = pos.x * 0.3;
                const camTargetY = 3.0;
                const camTargetZ = pos.z + 14;

                cameraTarget.set(camTargetX, camTargetY, camTargetZ);
                cameraLookAtTarget.set(pos.x * 0.1, 6.0, pos.z - 40);

                camera.position.lerp(cameraTarget, 0.03);
                smoothedLookAt.lerp(cameraLookAtTarget, 0.05);
                camera.lookAt(smoothedLookAt);

                doorAnimationState = Math.max(0, doorAnimationState - delta * 2);
            }

            const timeVal = Date.now() * 0.001;
            stationIcons.forEach((icon, id) => {
                icon.rotation.y = timeVal * 0.5;
                icon.position.y = 4.5 + Math.sin(timeVal * 2) * 0.1;

                if (id === 'tee') {
                    const scale = 1 + Math.sin(timeVal * 4) * 0.1;
                    icon.scale.set(scale, scale, scale);
                }
            });

            drones.forEach(drone => {
                if (mascot) {
                    drone.update(delta, mascot.position);
                }
            });

            updateRipples(delta);
            updateMinimap();

            if (!isAnimatingCamera && mascotParts.timerRing) {
                let nearest = null;
                let minDist = 999;

                ROOMS.forEach(r => {
                    if (r.markerPos) {
                        const dist = Math.sqrt((pos.x - r.markerPos.x) ** 2 + (pos.z - r.markerPos.z) ** 2);
                        if (dist < 2.0 && dist < minDist) {
                            minDist = dist;
                            nearest = r;
                        }
                    }
                });

                if (nearest) {
                    if (nearest.id !== activeRoomId) {
                        interactionTimer += delta;

                        if (scannerGroup) {
                            if (!scannerGroup.visible) {
                                scannerGroup.visible = true;
                                audio.startScanSound();
                            }
                            scannerGroup.position.set(pos.x, 0.05, pos.z);
                            scannerMesh.rotation.y += delta * 2;

                            const progress = Math.min(interactionTimer / INTERACTION_DURATION, 1.0);
                            scannerMesh.scale.y = progress;
                            updateScannerText(progress * 100);

                            if (progress > 0.9) {
                                scannerMesh.material.color.setHex(Date.now() % 200 < 100 ? 0x10b981 : 0x0ea5e9);
                            } else {
                                scannerMesh.material.color.setHex(0x0ea5e9);
                            }
                        }

                        if (mascotParts.timerRing) mascotParts.timerRing.visible = false;

                        if (interactionTimer >= INTERACTION_DURATION) {
                            showPanel(nearest);
                            activeRoomId = nearest.id;
                            scannerGroup.visible = false;
                            audio.stopScanSound();
                        }
                    }
                } else {
                    interactionTimer = 0;
                    lastScanPercent = -1;
                    if (scannerGroup && scannerGroup.visible) {
                        scannerGroup.visible = false;
                        audio.stopScanSound();
                    }

                    if (mascotParts.timerRing) {
                        mascotParts.timerRing.visible = false;
                        mascotParts.timerRing.geometry.dispose();
                        mascotParts.timerRing.geometry = new THREE.RingGeometry(1.2, 1.4, 32, 1, 0, 0);
                    }
                    if (!isAnimatingCamera) activeRoomId = null;
                }
            }

            renderer.render(scene, camera);
        }

        window.startGame = () => {
            if (welcomeRef.current) welcomeRef.current.classList.remove('show');
            audio.init();
        };

        window.closePanel = closePanel;

        window.toggleAudio = () => {
            const isMuted = audio.toggleMute();
            if (muteBtnRef.current) {
                muteBtnRef.current.textContent = isMuted ? '🔇' : '🔊';
                muteBtnRef.current.classList.toggle('muted', isMuted);
            }
        };

        init();

        return () => {
            if (renderer) {
                renderer.dispose();
                if (sceneRef.current && renderer.domElement) {
                    sceneRef.current.removeChild(renderer.domElement);
                }
            }
        };
    }, []);

    return (
        <div className="intro-page-wrapper">
            <div id="fade-overlay" ref={fadeOverlayRef}></div>
            {/* Loading */}
            <div id="loading" ref={loadingRef}>
                <div className="flex justify-center w-full">
                    <img src={mascos} alt="Dr. Dino" />
                </div>
                <p className="loading-text">Loading 3D world...</p>
                <div className="loading-bar-container">
                    <div className="loading-bar" ref={loadBarRef}></div>
                </div>
                <p className="loading-tip">Use WASD or arrow keys to move</p>
            </div>

            {/* Welcome */}
            <div id="welcome" ref={welcomeRef}>
                <div className="welcome-box">
                    <div className="flex justify-center w-full">
                        <img src={mascos} alt="Dr. Dino" />
                    </div>
                    <h2>Welcome to MedNG!</h2>
                    <p>I'm Dr. Dino! Control me to explore the medical corridor and discover the amazing security features
                        of MedNG!</p>
                    <button className="start-btn" onClick={() => window.startGame()}>Start Exploring</button>
                </div>
            </div>

            {/* 3D Scene */}
            <div id="scene" ref={sceneRef}></div>

            {/* UI */}
            <div id="ui">
                <div className="header">
                
                    <div className="logo">🏥</div>
                    <h1> MedNG</h1>
                    <button className="mute-btn" ref={muteBtnRef} onClick={() => window.toggleAudio()}>🔊</button>
                </div>

                <div className="char-status">
                    <img src="mascot.png" alt="Dr. Dino" />
                    <div className="info">
                        <h5>Dr. Dino</h5>
                        <span>● Exploring</span>
                    </div>
                </div>

                <div className="controls">
                    <h4>Controls</h4>
                    <div className="row"><span className="key">W</span> Move forward</div>
                    <div className="row"><span className="key">S</span> Move backward</div>
                    <div className="row"><span className="key">A</span> Move left</div>
                    <div className="row"><span className="key">D</span> Move right</div>
                    <div className="row"><span className="key">E</span> Interact with room</div>
                </div>

                <div className="minimap">
                    <h5>Map</h5>
                    <div className="minimap-canvas" ref={minimapCanvasRef}>
                        <div className="minimap-player" ref={minimapPlayerRef}></div>
                    </div>
                </div>

                <div id="room-panel" ref={roomPanelRef}>
                    <div className="room-content">
                        <button className="close-btn" onClick={() => window.closePanel()}>✕</button>

                        <div className="ecg-container">
                            <svg viewBox="0 0 200 60">
                                <path className="ecg-line"
                                    d="M0,30 L20,30 L25,10 L30,50 L35,30 L45,30 L50,10 L55,50 L60,30 L200,30"></path>
                            </svg>
                        </div>

                        <div className="panel-header">
                            <div className="icon" ref={rIconRef}></div>
                            <div>
                                <h3 ref={rTitleRef}>Room Name</h3>
                                <div className="panel-meta">SECURE CONNECTION ESTABLISHED</div>
                            </div>
                        </div>

                        <p ref={rDescRef}>Description</p>

                        <ul ref={rListRef}></ul>
                    </div>
                </div>

                <div id="prompt" ref={promptRef}>Press <strong>E</strong> to enter room</div>
            </div>
        </div>
    );
}

