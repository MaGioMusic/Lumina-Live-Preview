// --- Phase-Based Launch Countdown ---
const phaseStepsElement = document.getElementById('phase-steps');
const phaseRailElement = document.getElementById('phase-rail');
const launchPhases = [
    { threshold: 0, label: 'Signal' },
    { threshold: 0.2, label: 'Architecture' },
    { threshold: 0.42, label: 'Calibration' },
    { threshold: 0.68, label: 'Sync' },
    { threshold: 0.9, label: 'Launch' }
];
const phaseStepElements = [];
const subscriptionWaveState = {
    active: false,
    startTime: 0,
    originX: 0,
    originY: 0,
    targetX: 0,
    targetY: 0,
    durationMs: 3200
};
let logoEchoResetTimer = null;
const newsletterSignupState = {
    turnstileToken: '',
    turnstileWidgetId: null
};

function triggerLogoEcho() {
    const logoElement = document.querySelector('.logo');
    if (!logoElement) return;

    logoElement.classList.remove('is-echoing');
    void logoElement.offsetWidth;
    logoElement.classList.add('is-echoing');

    if (logoEchoResetTimer) {
        clearTimeout(logoEchoResetTimer);
    }

    logoEchoResetTimer = setTimeout(() => {
        logoElement.classList.remove('is-echoing');
    }, 2200);
}

function triggerSubscriptionSuccessEffect(originX, originY) {
    const logoElement = document.querySelector('.logo');
    const logoRect = logoElement ? logoElement.getBoundingClientRect() : null;
    subscriptionWaveState.active = true;
    subscriptionWaveState.startTime = performance.now();
    subscriptionWaveState.originX = originX;
    subscriptionWaveState.originY = originY;
    subscriptionWaveState.targetX = logoRect
        ? logoRect.left + logoRect.width / 2
        : window.innerWidth / 2;
    subscriptionWaveState.targetY = logoRect
        ? logoRect.top + logoRect.height * 0.38
        : window.innerHeight * 0.18;
    triggerLogoEcho();
}

function clampValue(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function getLaunchPhaseSettings() {
    const configuredPhase = window.LUMINA_PUBLIC_CONFIG?.launchPhase || {};
    const totalDays = Number(configuredPhase.totalDays);
    const daysRemaining = Number(configuredPhase.daysRemaining);
    const safeTotalDays = Number.isFinite(totalDays) && totalDays > 0 ? totalDays : 90;
    const safeDaysRemaining = Number.isFinite(daysRemaining)
        ? clampValue(daysRemaining, 0, safeTotalDays)
        : safeTotalDays;

    return {
        totalDays: safeTotalDays,
        daysRemaining: safeDaysRemaining
    };
}

function formatLaunchWindowLabel(daysRemaining) {
    const roundedDays = Math.max(0, Math.ceil(daysRemaining));
    return `${roundedDays} ${roundedDays === 1 ? 'day' : 'days'}`;
}

function syncLaunchWindowCopy(daysRemaining) {
    const labelElement = document.getElementById('launch-window-days-label');
    if (!labelElement) return;

    labelElement.textContent = formatLaunchWindowLabel(daysRemaining);
}

function setNotifyFormStatus(message, isError = false) {
    const statusElement = document.getElementById('notify-form-status');
    if (!statusElement) return;

    statusElement.textContent = message;
    statusElement.classList.toggle('is-error', isError && Boolean(message));
    statusElement.classList.toggle('is-success', !isError && Boolean(message));
}

function resetNotifyTurnstile() {
    newsletterSignupState.turnstileToken = '';

    if (
        newsletterSignupState.turnstileWidgetId !== null
        && window.turnstile
        && typeof window.turnstile.reset === 'function'
    ) {
        window.turnstile.reset(newsletterSignupState.turnstileWidgetId);
    }
}

function initializeNotifyTurnstile() {
    const publicConfig = window.LUMINA_PUBLIC_CONFIG;
    const turnstileContainer = document.getElementById('notify-turnstile');

    if (!turnstileContainer || !publicConfig?.turnstileSiteKey) {
        return;
    }

    if (
        newsletterSignupState.turnstileWidgetId !== null
        || !window.turnstile
        || typeof window.turnstile.render !== 'function'
    ) {
        if (newsletterSignupState.turnstileWidgetId === null) {
            window.setTimeout(initializeNotifyTurnstile, 250);
        }
        return;
    }

    newsletterSignupState.turnstileWidgetId = window.turnstile.render(turnstileContainer, {
        sitekey: publicConfig.turnstileSiteKey,
        theme: 'dark',
        action: 'newsletter_signup',
        callback: (token) => {
            newsletterSignupState.turnstileToken = token;
            setNotifyFormStatus('');
        },
        'expired-callback': () => {
            newsletterSignupState.turnstileToken = '';
            setNotifyFormStatus('Security check expired. Please try again.', true);
        },
        'error-callback': () => {
            newsletterSignupState.turnstileToken = '';
            setNotifyFormStatus('Security check is unavailable right now.', true);
        }
    });
}

function setupLaunchPhaseSteps() {
    if (!phaseStepsElement || phaseStepElements.length > 0) return;

    launchPhases.forEach((phase) => {
        const stepElement = document.createElement('div');
        stepElement.className = 'phase-step is-upcoming';

        const nodeElement = document.createElement('span');
        nodeElement.className = 'phase-node';

        const labelElement = document.createElement('span');
        labelElement.className = 'phase-label';
        labelElement.textContent = phase.label;

        stepElement.appendChild(nodeElement);
        stepElement.appendChild(labelElement);
        phaseStepsElement.appendChild(stepElement);
        phaseStepElements.push(stepElement);
    });
}

function setPhaseRailProgress(progress) {
    if (!phaseRailElement) return;
    phaseRailElement.style.setProperty('--phase-progress', progress.toFixed(4));
}

function getActiveLaunchPhase(progress) {
    let activePhaseIndex = 0;

    for (const [index, phase] of launchPhases.entries()) {
        if (progress >= phase.threshold) {
            activePhaseIndex = index;
        }
    }

    return activePhaseIndex;
}

function startLaunchPhaseCountdown() {
    setupLaunchPhaseSteps();

    if (!phaseRailElement || phaseStepElements.length === 0) {
        return;
    }

    const { totalDays, daysRemaining } = getLaunchPhaseSettings();
    const progress = totalDays === 0 ? 1 : 1 - daysRemaining / totalDays;
    const clampedProgress = clampValue(progress, 0, 1);
    const activePhaseIndex = getActiveLaunchPhase(clampedProgress);
    const isComplete = daysRemaining === 0;

    syncLaunchWindowCopy(daysRemaining);
    setPhaseRailProgress(isComplete ? 1 : clampedProgress);

    phaseStepElements.forEach((stepElement, index) => {
        const isStepComplete = isComplete || index < activePhaseIndex;
        const isActive = !isComplete && index === activePhaseIndex;
        const isUpcoming = !isComplete && index > activePhaseIndex;

        stepElement.classList.toggle('is-complete', isStepComplete);
        stepElement.classList.toggle('is-active', isActive);
        stepElement.classList.toggle('is-upcoming', isUpcoming);
    });
}

startLaunchPhaseCountdown();

// --- Growing Network Background ---
function initNetworkBackground() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const lowDensityDisplay = devicePixelRatio <= 1.1;
    const columns = 18;
    const rows = 10;
    const buildDurationMs = 4600;
    const baseConnectionDistance = 265;
    const pulseCycleMs = 22000;
    const pulseEligibleDistance = 0.34;
    const nodes = [];
    const edges = [];
    const pulseEligibleIndices = [];

    let width = 0;
    let height = 0;
    let centerX = 0;
    let centerY = 0;
    let connectionDistance = baseConnectionDistance;
    let animationStart = performance.now();

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function randomRange(min, max) {
        return min + Math.random() * (max - min);
    }

    function shuffleInPlace(values) {
        for (let index = values.length - 1; index > 0; index--) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            const current = values[index];

            values[index] = values[swapIndex];
            values[swapIndex] = current;
        }
    }

    function smoothstep(edge0, edge1, value) {
        const amount = clamp((value - edge0) / (edge1 - edge0), 0, 1);
        return amount * amount * (3 - 2 * amount);
    }

    function getNodeIndex(column, row) {
        return row * columns + column;
    }

    function getFocusFade(x, y) {
        const dx = (x - centerX) / (width * 0.28);
        const dy = (y - centerY) / (height * 0.23);
        const distance = Math.hypot(dx, dy);

        return 0.18 + 0.82 * smoothstep(0.18, 1.0, distance);
    }

    function createNetwork() {
        nodes.length = 0;
        edges.length = 0;
        pulseEligibleIndices.length = 0;

        const horizontalSpread = width * 0.96;
        const verticalSpread = height * 0.78;

        for (let row = 0; row < rows; row++) {
            for (let column = 0; column < columns; column++) {
                const u = column / (columns - 1) - 0.5;
                const v = row / (rows - 1) - 0.5;
                const distanceFromCenter = Math.hypot(u * 0.95, v * 1.15);
                const activationBase = 0.08 + distanceFromCenter * 0.65 + Math.random() * 0.16;
                const pulseEligible = distanceFromCenter > pulseEligibleDistance;

                nodes.push({
                    baseX: u * horizontalSpread,
                    baseY: v * verticalSpread,
                    baseZ: randomRange(-140, 220) + (Math.random() - 0.5) * 90,
                    jitterX: randomRange(-28, 28),
                    jitterY: randomRange(-20, 20),
                    jitterZ: randomRange(12, 58),
                    radius: randomRange(1.15, 2.8),
                    activateAt: clamp(activationBase, 0, 1),
                    seed: Math.random() * Math.PI * 2,
                    pulseEligible,
                    pulsePhaseOffset: 0,
                    pulseStrength: pulseEligible ? randomRange(0.36, 0.72) : 0,
                    pulseHaloScale: randomRange(0.9, 1.18)
                });

                if (pulseEligible) {
                    pulseEligibleIndices.push(nodes.length - 1);
                }
            }
        }

        shuffleInPlace(pulseEligibleIndices);

        pulseEligibleIndices.forEach((nodeIndex, eligibleIndex) => {
            nodes[nodeIndex].pulsePhaseOffset = eligibleIndex / pulseEligibleIndices.length;
        });

        function connectNodes(from, to, weight) {
            edges.push({
                from,
                to,
                weight,
                revealAt: Math.max(nodes[from].activateAt, nodes[to].activateAt) + randomRange(0.02, 0.1),
                seed: Math.random() * Math.PI * 2
            });
        }

        for (let row = 0; row < rows; row++) {
            for (let column = 0; column < columns; column++) {
                const current = getNodeIndex(column, row);

                if (column < columns - 1) {
                    connectNodes(current, getNodeIndex(column + 1, row), 1.0);
                }

                if (row < rows - 1) {
                    connectNodes(current, getNodeIndex(column, row + 1), 0.95);
                }

                if (column < columns - 1 && row < rows - 1 && Math.random() > 0.14) {
                    connectNodes(current, getNodeIndex(column + 1, row + 1), 0.62);
                }

                if (column > 0 && row < rows - 1 && Math.random() > 0.56) {
                    connectNodes(current, getNodeIndex(column - 1, row + 1), 0.48);
                }

                if (column < columns - 2 && Math.random() > 0.66) {
                    connectNodes(current, getNodeIndex(column + 2, row), 0.4);
                }

                if (row < rows - 2 && Math.random() > 0.72) {
                    connectNodes(current, getNodeIndex(column, row + 2), 0.34);
                }
            }
        }
    }

    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        centerX = width / 2;
        centerY = height / 2;
        connectionDistance = Math.max(
            baseConnectionDistance,
            Math.max(
                width / Math.max(columns - 1, 1),
                height / Math.max(rows - 1, 1)
            ) * (lowDensityDisplay ? 1.6 : 1.45)
        );

        canvas.width = Math.floor(width * devicePixelRatio);
        canvas.height = Math.floor(height * devicePixelRatio);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

        animationStart = performance.now();
        createNetwork();
    }

    function projectNode(node, now, growth) {
        const driftTime = now * 0.00024 + node.seed;
        const depth = 680 + node.baseZ + Math.sin(driftTime * 0.8) * node.jitterZ;
        const scale = 760 / depth;
        const cameraDriftX = Math.sin(now * 0.00006) * 30;
        const cameraDriftY = Math.cos(now * 0.00005) * 22;
        const x = centerX + cameraDriftX + (node.baseX + Math.cos(driftTime) * node.jitterX) * scale;
        const y = centerY + cameraDriftY + (node.baseY + Math.sin(driftTime * 1.18) * node.jitterY) * scale;
        const reveal = smoothstep(node.activateAt - 0.08, node.activateAt + 0.12, growth);
        const twinkle = 0.78 + 0.22 * Math.sin(now * 0.002 + node.seed * 3.4);
        const focusFade = getFocusFade(x, y);
        const depthFade = clamp(scale * 0.92, 0.34, 1.1);
        let pulse = 0;

        if (node.pulseEligible && node.pulseStrength > 0) {
            const pulsePhase = (((now % pulseCycleMs) / pulseCycleMs) + node.pulsePhaseOffset) % 1;

            if (pulsePhase < 0.16) {
                pulse = smoothstep(0, 0.16, pulsePhase);
            } else if (pulsePhase < 0.26) {
                pulse = 1;
            } else if (pulsePhase < 0.44) {
                pulse = 1 - smoothstep(0.26, 0.44, pulsePhase);
            }

            pulse *= node.pulseStrength;
        }

        return {
            x,
            y,
            radius: node.radius * clamp(scale * 1.35, 0.8, 1.9),
            alpha: reveal * twinkle * focusFade * depthFade,
            pulse
        };
    }

    function render(now) {
        const growth = clamp((now - animationStart) / buildDurationMs, 0, 1);
        const projectedNodes = nodes.map((node) => projectNode(node, now, growth));
        const celebrationElapsed = now - subscriptionWaveState.startTime;
        const celebrationActive = subscriptionWaveState.active && celebrationElapsed < subscriptionWaveState.durationMs;
        const celebrationProgress = celebrationActive
            ? clamp(celebrationElapsed / subscriptionWaveState.durationMs, 0, 1)
            : 1;
        const celebrationStrength = celebrationActive
            ? 1 - smoothstep(0.72, 1, celebrationProgress)
            : 0;
        const celebrationWaveRadius = celebrationActive
            ? celebrationProgress * Math.hypot(width, height) * 0.92
            : 0;
        const celebrationWaveWidth = celebrationActive
            ? 120 + celebrationProgress * 160
            : 1;

        context.clearRect(0, 0, width, height);

        if (subscriptionWaveState.active && !celebrationActive) {
            subscriptionWaveState.active = false;
        }

        context.save();
        context.lineCap = 'round';

        for (const edge of edges) {
            const from = projectedNodes[edge.from];
            const to = projectedNodes[edge.to];
            const reveal = smoothstep(edge.revealAt - 0.05, edge.revealAt + 0.12, growth);

            if (reveal <= 0.02 || from.alpha <= 0.02 || to.alpha <= 0.02) {
                continue;
            }

            const distance = Math.hypot(to.x - from.x, to.y - from.y);
            if (distance > connectionDistance) {
                continue;
            }

            const alpha = Math.min(from.alpha, to.alpha)
                * reveal
                * edge.weight
                * clamp(1 - distance / connectionDistance, 0, 1)
                * (0.82 + 0.18 * Math.sin(now * 0.0015 + edge.seed))
                * (lowDensityDisplay ? 0.6 : 0.48);

            if (alpha <= 0.01) {
                continue;
            }

            context.beginPath();
            context.moveTo(from.x, from.y);
            context.lineTo(to.x, to.y);

            context.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.28, alpha * 0.52)})`;
            context.lineWidth = (lowDensityDisplay ? 1.24 : 1.04) + edge.weight * 0.72;
            context.stroke();

            context.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            context.lineWidth = (lowDensityDisplay ? 0.84 : 0.64) + edge.weight * 0.52;
            context.stroke();

            if (celebrationActive) {
                const midX = (from.x + to.x) * 0.5;
                const midY = (from.y + to.y) * 0.5;
                const distanceToWave = Math.abs(
                    Math.hypot(midX - subscriptionWaveState.originX, midY - subscriptionWaveState.originY)
                    - celebrationWaveRadius
                );
                const waveBoost = clamp(1 - distanceToWave / celebrationWaveWidth, 0, 1) * celebrationStrength;

                if (waveBoost > 0.01) {
                    context.beginPath();
                    context.moveTo(from.x, from.y);
                    context.lineTo(to.x, to.y);
                    context.strokeStyle = `rgba(255, 170, 54, ${waveBoost * 0.52})`;
                    context.lineWidth = (lowDensityDisplay ? 1.9 : 1.5) + edge.weight * 0.9;
                    context.stroke();
                }
            }
        }

        context.restore();

        projectedNodes.forEach((node, nodeIndex) => {
            if (node.alpha <= 0.02) {
                return;
            }

            let waveBoost = 0;
            if (celebrationActive) {
                const distanceToWave = Math.abs(
                    Math.hypot(node.x - subscriptionWaveState.originX, node.y - subscriptionWaveState.originY)
                    - celebrationWaveRadius
                );
                waveBoost = clamp(1 - distanceToWave / celebrationWaveWidth, 0, 1) * celebrationStrength;
            }

            if (node.pulse > 0.001) {
                const pulseRadius = node.radius * (4.6 + node.pulse * 1.4) * nodes[nodeIndex].pulseHaloScale;
                const pulseGradient = context.createRadialGradient(node.x, node.y, 0, node.x, node.y, pulseRadius);

                pulseGradient.addColorStop(0, `rgba(255, 245, 220, ${node.alpha * node.pulse * 0.22})`);
                pulseGradient.addColorStop(0.14, `rgba(243, 198, 69, ${node.alpha * node.pulse * 0.18})`);
                pulseGradient.addColorStop(0.38, `rgba(255, 170, 54, ${node.alpha * node.pulse * 0.095})`);
                pulseGradient.addColorStop(0.72, `rgba(207, 79, 0, ${node.alpha * node.pulse * 0.04})`);
                pulseGradient.addColorStop(1, 'rgba(207, 79, 0, 0)');

                context.beginPath();
                context.fillStyle = pulseGradient;
                context.arc(node.x, node.y, pulseRadius, 0, Math.PI * 2);
                context.fill();
            }

            const ambientGlowRadius = node.radius * 2.75;
            const ambientGradient = context.createRadialGradient(node.x, node.y, 0, node.x, node.y, ambientGlowRadius);

            ambientGradient.addColorStop(0, `rgba(255, 255, 255, ${node.alpha * 0.14})`);
            ambientGradient.addColorStop(0.34, `rgba(255, 255, 255, ${node.alpha * 0.045})`);
            ambientGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

            context.beginPath();
            context.fillStyle = ambientGradient;
            context.arc(node.x, node.y, ambientGlowRadius, 0, Math.PI * 2);
            context.fill();

            const warmMix = Math.max(node.pulse * 0.84, waveBoost * 0.96);
            const coreRed = Math.round(255);
            const coreGreen = Math.round(255 - warmMix * 86);
            const coreBlue = Math.round(255 - warmMix * 201);

            context.beginPath();
            context.fillStyle = `rgba(${coreRed}, ${coreGreen}, ${coreBlue}, ${Math.min(0.98, node.alpha * (0.9 + warmMix * 0.08))})`;
            context.arc(node.x, node.y, Math.max(0.9, node.radius * (1 + node.pulse * 0.12)), 0, Math.PI * 2);
            context.fill();
        });

        requestAnimationFrame(render);
    }

    resize();
    requestAnimationFrame(render);
    window.addEventListener('resize', resize);
}

// Ensure elements exist then run
window.onload = () => {
    initNetworkBackground();
    initializeNotifyTurnstile();

    const infoBtn = document.getElementById('info-btn');
    const infoModal = document.getElementById('info-modal');
    
    const notifyBtn = document.getElementById('notify-btn');
    const notifyModal = document.getElementById('notify-modal');

    const closeBtns = document.querySelectorAll('.close-btn');

    if (infoBtn && infoModal) {
        infoBtn.addEventListener('click', () => {
            infoModal.classList.add('show');
        });
    }

    if (notifyBtn && notifyModal) {
        notifyBtn.addEventListener('click', () => {
            setNotifyFormStatus('');
            resetNotifyTurnstile();
            notifyModal.classList.add('show');
        });
    }

    closeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) {
                modal.classList.remove('show');
            }
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('show');
        }
    });

    // Notify form: save email through the protected Edge Function
    const notifyForm = document.getElementById('notify-form');
    if (notifyForm) {
        notifyForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const emailInput = notifyForm.querySelector('#notify-email');
            const submitBtn = notifyForm.querySelector('button[type="submit"]');
            const email = emailInput ? emailInput.value.trim() : '';
            const publicConfig = window.LUMINA_PUBLIC_CONFIG;

            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                setNotifyFormStatus('Enter a valid email address.', true);
                return;
            }

            if (!newsletterSignupState.turnstileToken) {
                setNotifyFormStatus('Complete the security check before subscribing.', true);
                return;
            }

            if (!publicConfig?.newsletterSignupUrl) {
                setNotifyFormStatus('Signup service is not configured yet.', true);
                return;
            }

            const submitRect = submitBtn
                ? submitBtn.getBoundingClientRect()
                : { left: window.innerWidth / 2, top: window.innerHeight * 0.62, width: 0, height: 0 };
            const originX = submitRect.left + submitRect.width / 2;
            const originY = submitRect.top + submitRect.height / 2;

            setNotifyFormStatus('');

            if (submitBtn) {
                submitBtn.textContent = '...';
                submitBtn.style.pointerEvents = 'none';
                submitBtn.disabled = true;
            }

            let saved = false;
            let errorMessage = 'Unable to save your request right now.';

            try {
                const response = await fetch(publicConfig.newsletterSignupUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email,
                        token: newsletterSignupState.turnstileToken
                    })
                });

                const payload = await response.json().catch(() => ({}));
                saved = response.ok && payload.success === true;

                if (!saved && typeof payload.error === 'string' && payload.error.trim()) {
                    errorMessage = payload.error.trim();
                }
            } catch (err) {
                console.error('Newsletter signup request failed:', err);
            }

            resetNotifyTurnstile();

            if (submitBtn) {
                submitBtn.textContent = saved ? 'ACCESS CONFIRMED' : 'Try again';
            }

            if (saved) {
                if (notifyModal) {
                    notifyModal.classList.remove('show');
                }
                triggerSubscriptionSuccessEffect(originX, originY);
                if (emailInput) {
                    emailInput.value = '';
                }
                setNotifyFormStatus('');
            } else {
                setNotifyFormStatus(errorMessage, true);
            }

            setTimeout(() => {
                if (submitBtn) {
                    submitBtn.textContent = 'Subscribe';
                    submitBtn.style.pointerEvents = '';
                    submitBtn.disabled = false;
                }
            }, 3200);
        });
    }
};
