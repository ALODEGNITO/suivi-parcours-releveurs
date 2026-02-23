    /* js/logout.js
    Déconnexion automatique + alerte avant déconnexion + propagation entre onglets
    Usage: inclure <script src="js/logout.js"></script> dans chaque page (sauf login.html)
    */

    (function () {
    // ========== CONFIG ==========
    const INACTIVITY_LIMIT = 45 * 60 * 1000; // 45 minutes
    const WARNING_BEFORE = 60 * 1000;       // 60 secondes avant la déconnexion
    const REDIRECT_PAGE = "login.html";     // Page de login
    const LOGOUT_KEY = "gc_force_logout";   // clé localStorage utilisée pour propager la déconnexion

    // ========== STATE ==========
    let inactivityTimer = null;
    let warningTimer = null;
    let warningVisible = false;

    // ========== UTIL: création d'une boîte modale simple ==========
    function createModal() {
        if (document.getElementById('gc-logout-modal')) return;

        const style = document.createElement('style');
        style.innerHTML = `
        #gc-logout-modal { position: fixed; inset: 0; display:flex; align-items:center; justify-content:center; z-index:9999; }
        #gc-logout-modal .gc-backdrop { position:absolute; inset:0; background: rgba(0,0,0,0.4); }
        #gc-logout-modal .gc-box { position:relative; background:#fff; padding:18px; border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,0.2); width:320px; max-width:90%; text-align:center; }
        #gc-logout-modal button { margin:8px 6px; padding:8px 12px; border-radius:6px; border:1px solid #ddd; cursor:pointer; }
        #gc-logout-modal .gc-stay { background:#2b7de9; color:#fff; border-color:#1a63d6; }
        #gc-logout-modal .gc-logout { background:#fff; color:#333; }
        #gc-logout-modal p { margin:12px 0 4px; font-size:14px; color:#222; }
        #gc-logout-modal small { color:#666; display:block; margin-top:6px; }
        `;
        document.head.appendChild(style);

        const modal = document.createElement('div');
        modal.id = 'gc-logout-modal';
        modal.style.display = 'none';
        modal.innerHTML = `
        <div class="gc-backdrop"></div>
        <div class="gc-box" role="dialog" aria-modal="true" aria-labelledby="gc-logout-title">
            <h3 id="gc-logout-title" style="margin:0 0 8px">Session presque expirée</h3>
            <p>Votre session va expirer dans <strong id="gc-logout-seconds">30</strong> secondes.</p>
            <small>Si vous restez inactif, vous serez redirigé vers la page de connexion.</small>
            <div style="margin-top:12px;">
            <button class="gc-stay">Je reste connecté</button>
            <button class="gc-logout">Déconnexion maintenant</button>
            </div>
        </div>
        `;
        document.body.appendChild(modal);

        // Buttons
        modal.querySelector('.gc-stay').addEventListener('click', () => {
        hideWarning();
        resetInactivityTimer();
        });
        modal.querySelector('.gc-logout').addEventListener('click', () => {
        performLogout();
        });
    }

    // ========== SHOW / HIDE warning ==========
    let countdownInterval = null;
    function showWarning(secondsLeft) {
        createModal();
        warningVisible = true;
        const modal = document.getElementById('gc-logout-modal');
        modal.style.display = 'flex';
        const secondsEl = modal.querySelector('#gc-logout-seconds');
        secondsEl.textContent = Math.ceil(secondsLeft / 1000);

        clearInterval(countdownInterval);
        let remaining = Math.ceil(secondsLeft / 1000);
        countdownInterval = setInterval(() => {
        remaining--;
        if (remaining < 0) {
            clearInterval(countdownInterval);
            // ensure logout happens by timers (no double)
            return;
        }
        secondsEl.textContent = remaining;
        }, 1000);
    }

    function hideWarning() {
        warningVisible = false;
        const modal = document.getElementById('gc-logout-modal');
        if (modal) modal.style.display = 'none';
        if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        }
    }

    // ========== LOGOUT ==========
    function performLogout() {
        // broadcast logout to other tabs
        try { localStorage.setItem(LOGOUT_KEY, Date.now().toString()); } catch (e) { /* ignore */ }

        // cleanup local/session storage (si tu utilises ces stockages pour le token)
        try { localStorage.removeItem('authToken'); } catch (e) {}
        try { sessionStorage.clear(); } catch (e) {}

        // rediriger vers la page login
        window.location.href = REDIRECT_PAGE;
    }

    // ========== TIMER management ==========
    function resetInactivityTimer() {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        if (warningTimer) clearTimeout(warningTimer);

        hideWarning();

        inactivityTimer = setTimeout(() => {
            performLogout();
        }, INACTIVITY_LIMIT);

        const warningDelay = Math.max(INACTIVITY_LIMIT - WARNING_BEFORE, 1000);

        warningTimer = setTimeout(() => {
            if (!warningVisible) {
                showWarning(WARNING_BEFORE);
            }
        }, warningDelay);
    }


    // ========== Activity listeners ==========
    function registerActivityListeners() {
        const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
        events.forEach(ev => {
        document.addEventListener(ev, throttle(resetInactivityTimer, 1000), true);
        });
    }

    // Simple throttle to avoid overflood of reset calls
    function throttle(fn, wait) {
        let last = 0;
        return function () {
        const now = Date.now();
        if (now - last >= wait) {
            last = now;
            fn.apply(this, arguments);
        }
        };
    }

    // ========== cross-tab logout propagation ==========
    window.addEventListener('storage', function (e) {
        if (!e) return;
        if (e.key === LOGOUT_KEY) {
        // another tab requested logout
        // do not clear localStorage here because we want other tabs to keep seeing the event
        // simply redirect to login
        window.location.href = REDIRECT_PAGE;
        }
    });

    // ========== Ignore page(s) where script should not run ==========
    // Optional: If you include the script on login.html, ensure it doesn't redirect immediately:
    if (window.location.pathname.endsWith('/' + REDIRECT_PAGE) || window.location.pathname === '/' + REDIRECT_PAGE) {
        // don't start timers on login page
        console.log('logout.js : sur la page de login — surveillance inactive.');
        return;
    }

    // ========== INIT ==========
    registerActivityListeners();
    resetInactivityTimer();
    console.log('logout.js : surveillance d\'inactivité activée (timeout=' + INACTIVITY_LIMIT + 'ms).');

    })();
