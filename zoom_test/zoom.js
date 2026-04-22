// Configuration variables
let SCREEN_AREA_USED = 0.9;

// State variables
let successfulActions = 0;
let zoomCurrentScale = 1.0;
let zoomTargetSize = 0;
let zoomInnerBaseSize = 0;
let zoomHoldTimeout = null;
let successChimes = [];
let errorChime;

// Trial variables
let NUM_ACTIONS = 10;
let MAX_TRIAL_TIME_LIMIT = 1_000_000_000;
let skipTrial = false;
let showKeepFingersDownPrompt = false;

// Constants
const ZOOM_SENSITIVITY = 0.005;
const ZOOM_TOLERANCE = 0.08;
const ZOOM_HOLD_TIME = 300;
const ZOOM_MIN_SCALE = 0.4;
const ZOOM_MAX_SCALE = 2.5;
const ZOOM_TARGET_SCALE_MIN = 0.55;
const ZOOM_TARGET_SCALE_MAX = 1.8;

function loadChimes() {
    for (var i = 1; i <= 1; i++) {
        successChimes.push(new Audio('audio/chime_' + i + '.mp3'));
    }
    errorChime = new Audio('audio/error_1.mp3');
}

function playChime(success) {
    if (success) {
        let soundToPlay = successChimes[Math.floor(Math.random() * successChimes.length)];
        console.log(`Playing chime ${soundToPlay.src}`);
        soundToPlay.pause();
        soundToPlay.currentTime = 0;
        soundToPlay.play();
    } else {
        errorChime.play();
    }
}

function getRandomRange(min, max) {
    return Math.random() * (max - min) + min;
}

function generateZoomTarget() {
    let targetScale;
    let attempts = 0;

    // Use logarithmic sampling for balanced zoom in/out distribution
    // This makes "zoom to 2x" equally likely as "zoom to 0.5x"
    const logMin = Math.log(ZOOM_TARGET_SCALE_MIN);
    const logMax = Math.log(ZOOM_TARGET_SCALE_MAX);

    do {
        const logScale = getRandomRange(logMin, logMax);
        targetScale = Math.exp(logScale);
        attempts++;
    } while ((Math.abs(targetScale - zoomCurrentScale) / zoomCurrentScale < 0.15 || Math.abs(targetScale - 1.0) < 0.15) && attempts < 50);

    zoomTargetSize = zoomInnerBaseSize * targetScale;
    zoomCurrentScale = 1.0;

    const innerSize = zoomInnerBaseSize * zoomCurrentScale;

    const targetOutline = document.getElementById('zoom-target-outline');
    targetOutline.style.width = `${zoomTargetSize}px`;
    targetOutline.style.height = `${zoomTargetSize}px`;

    const innerSquare = document.getElementById('zoom-inner-square');
    innerSquare.style.width = `${innerSize}px`;
    innerSquare.style.height = `${innerSize}px`;
    innerSquare.classList.remove('zoom-match');
}

let zoomActive = false;

document.addEventListener('keydown', (e) => { if (e.key === 'Control') zoomActive = true; });
document.addEventListener('keyup', (e) => { if (e.key === 'Control') zoomActive = false; });

function handleZoomWheelEvent(e) {
    // Trackpad pinch-to-zoom fires wheel events with ctrlKey=true (synthetic).
    // Always preventDefault for these so the browser doesn't zoom the page.
    const isPinchZoom = e.ctrlKey;

    if (!zoomActive && !isPinchZoom) return;

    e.preventDefault();

    let normalizedDeltaY = e.deltaY;
    if (e.deltaMode === 1) {
        normalizedDeltaY *= 16;
    } else if (e.deltaMode === 2) {
        normalizedDeltaY *= window.innerHeight;
    }

    zoomCurrentScale -= normalizedDeltaY * ZOOM_SENSITIVITY;
    zoomCurrentScale = Math.max(ZOOM_MIN_SCALE, Math.min(ZOOM_MAX_SCALE, zoomCurrentScale));

    const currentSize = zoomInnerBaseSize * zoomCurrentScale;
    const innerSquare = document.getElementById('zoom-inner-square');
    innerSquare.style.width = `${currentSize}px`;
    innerSquare.style.height = `${currentSize}px`;

    checkZoomMatch();
}

function checkZoomMatch() {
    if (zoomHoldTimeout) {
        clearTimeout(zoomHoldTimeout);
        zoomHoldTimeout = null;
    }

    const currentSize = zoomInnerBaseSize * zoomCurrentScale;
    const ratio = currentSize / zoomTargetSize;
    const innerSquare = document.getElementById('zoom-inner-square');

    // Use adaptive tolerance - more forgiving when current/target sizes are small
    const adaptiveTolerance = ZOOM_TOLERANCE + (0.03 / Math.max(ratio, 0.3));
    if (ratio >= 1 - adaptiveTolerance && ratio <= 1 + adaptiveTolerance) {
        innerSquare.classList.add('zoom-match');
        zoomHoldTimeout = setTimeout(() => {
            const recheckSize = zoomInnerBaseSize * zoomCurrentScale;
            const recheckRatio = recheckSize / zoomTargetSize;
            const recheckAdaptiveTolerance = ZOOM_TOLERANCE + (0.03 / Math.max(recheckRatio, 0.3));
            if (recheckRatio >= 1 - recheckAdaptiveTolerance && recheckRatio <= 1 + recheckAdaptiveTolerance) {
                onZoomSuccess();
            } else {
                innerSquare.classList.remove('zoom-match');
            }
        }, ZOOM_HOLD_TIME);
    } else {
        innerSquare.classList.remove('zoom-match');
    }
}

function onZoomSuccess() {
    generateZoomTarget();
    successfulActions += 1;
    console.log('zoom completed - action ' + successfulActions);
    playChime(true);
}

function startExperience() {
    loadChimes();
    successfulActions = 0;
    zoomCurrentScale = 1.0;
    zoomInnerBaseSize = Math.min(window.innerWidth, window.innerHeight) * 0.25;

    generateZoomTarget();

    document.addEventListener('wheel', handleZoomWheelEvent, { passive: false });

    const percentageView = SCREEN_AREA_USED * 100;
    document.getElementById('container-outline').style.width = `${percentageView}vw`;
    document.getElementById('container-outline').style.height = `${percentageView}vh`;

    document.getElementById('start-screen').style.display = "none";
    document.getElementById('experience-screen').style.display = "";

    if (showKeepFingersDownPrompt) {
        document.getElementById('top-prompt').style.display = "";
    }

    startTimer();
}

// Function to get URL parameters
function getURLParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has(name)) {
        return [true, urlParams.get(name)]
    }
    else {
        return [false, '']
    }
}

// Function to initialize condition from URL parameter
function initializeExpectedConditionFromURL() {
    const [skipStartScreen, _] = getURLParameter('skipStartScreen');
    const [keepFingersDown, __] = getURLParameter('keepFingersDown');
    showKeepFingersDownPrompt = keepFingersDown;
    if (keepFingersDown) {
        document.getElementById('start-explanation').textContent =
            "Pinch to zoom until the blue square matches the purple outline. Try to keep your fingers on the surface while zooming, but lift up when needed to make the next zoom motion.";
    }
    let [has, value] = getURLParameter('timeLimit');
    if (has) {
        MAX_TRIAL_TIME_LIMIT = parseInt(value, 10);
    }

    [has, value] = getURLParameter('expectedActions')
    if (has) {
        NUM_ACTIONS = parseInt(value, 10);
        if (skipStartScreen) {
            startExperience();
        }
        return;
    }
}

function startTimer() {
    let startTime = null;
    function loop(timestamp) {
        if (!startTime) {
            startTime = timestamp;
        }

        elapsed = timestamp - startTime;
        if (successfulActions >= NUM_ACTIONS || elapsed > MAX_TRIAL_TIME_LIMIT || skipTrial) {
            if (window.vuplex) {
                // send message to Unity
                window.vuplex.postMessage({ type: "test_result", message: "" })
            }            return;
        }
        window.requestAnimationFrame(loop);
    }
    window.requestAnimationFrame(loop);
}

// Initialize condition from URL when page loads
window.addEventListener('load', initializeExpectedConditionFromURL);

// --- Block all forms of browser zoom so the gesture is reserved for the task. ---

// 1. Trackpad pinch on desktop fires wheel events with ctrlKey=true.
window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) e.preventDefault();
}, { passive: false });

// 2. Keyboard zoom (Ctrl/Cmd + +/-/=/0).
window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) &&
        (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
        e.preventDefault();
    }
});

// 3. Safari/iOS gesture events.
window.addEventListener('gesturestart',  (e) => e.preventDefault());
window.addEventListener('gesturechange', (e) => e.preventDefault());
window.addEventListener('gestureend',    (e) => e.preventDefault());

// 4. VR / touch browsers: real two-finger pinch comes in as touch events.
//    These MUST be passive: false, and they MUST preventDefault on touchstart
//    (not just touchmove) or the browser will start its native pinch-zoom.
let pinchStartDist = 0;
let pinchActive = false;

function touchDist(t0, t1) {
    const dx = t0.clientX - t1.clientX;
    const dy = t0.clientY - t1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

document.addEventListener('touchstart', (e) => {
    if (e.touches.length >= 2) {
        e.preventDefault();
        pinchActive = true;
        pinchStartDist = touchDist(e.touches[0], e.touches[1]);
    }
}, { passive: false });

document.addEventListener('touchmove', (e) => {
    if (e.touches.length >= 2 && pinchActive) {
        e.preventDefault();

        const dist = touchDist(e.touches[0], e.touches[1]);
        // Convert pinch distance delta into a wheel-equivalent deltaY,
        // so the existing handleZoomWheelEvent logic drives the inner square.
        const scaleDelta = (dist - pinchStartDist) * 0.01;
        // Negative deltaY = zoom in (matches wheel convention used by your code).
        const fakeDeltaY = -scaleDelta / ZOOM_SENSITIVITY;
        handleZoomWheelEvent({
            deltaY: fakeDeltaY,
            deltaMode: 0,
            ctrlKey: true,
            preventDefault: () => {},
        });
        pinchStartDist = dist;
    }
}, { passive: false });

document.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) pinchActive = false;
}, { passive: false });

// 5. Block the double-tap-to-zoom shortcut on touch.
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
}, { passive: false });

// register listener for data passed to WebView from Unity
window.addEventListener('vuplexmessage', event => {
    const action = JSON.parse(event.value);
    if (action && action.type === 'zoom_start') {
        zoomActive = true;
    } else if (action && action.type === 'zoom_end') {
        zoomActive = false;
    } else if (action && action.type === 'skip') {
        skipTrial = true;
    }
});
