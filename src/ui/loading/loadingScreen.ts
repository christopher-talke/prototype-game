import './loading.css';

let el: HTMLElement | null = null;
let fill: HTMLElement | null = null;
let status: HTMLElement | null = null;

/**
 * Creates and appends the full-screen loading overlay with a progress bar.
 * Call `setLoadingProgress` to update it, then `hideLoadingScreen` to fade out.
 *
 * UI layer - shown once during initial asset load before the game loop starts.
 */
export function showLoadingScreen() {
    el = document.createElement('div');
    el.id = 'loading-screen';
    el.innerHTML = `
        <div id="loading-title">Sightline</div>
        <div id="loading-subtitle">2D Tactical Arena Shooter</div>
        <div id="loading-bar-track"><div id="loading-bar-fill"></div></div>
        <div id="loading-status">initializing</div>
    `;
    document.body.appendChild(el);
    fill = document.getElementById('loading-bar-fill')!;
    status = document.getElementById('loading-status')!;
}

/**
 * Updates the loading bar fill width and status text.
 * @param percent - Progress percentage (0-100, clamped)
 * @param text - Status message shown below the bar
 */
export function setLoadingProgress(percent: number, text: string) {
    if (fill) fill.style.width = `${Math.min(100, percent)}%`;
    if (status) status.textContent = text;
}

/**
 * Fades out the loading screen and removes it from the DOM after the
 * CSS transition completes (500ms).
 * @returns Resolves when the element has been removed
 */
export function hideLoadingScreen(): Promise<void> {
    return new Promise((resolve) => {
        if (!el) {
            resolve();
            return;
        }
        el.classList.add('fade-out');
        setTimeout(() => {
            el?.remove();
            el = null;
            resolve();
        }, 500);
    });
}
