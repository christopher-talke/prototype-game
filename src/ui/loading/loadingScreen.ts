import './loading.css';

let el: HTMLElement | null = null;
let fill: HTMLElement | null = null;
let status: HTMLElement | null = null;

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

export function setLoadingProgress(percent: number, text: string) {
    if (fill) fill.style.width = `${Math.min(100, percent)}%`;
    if (status) status.textContent = text;
}

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
