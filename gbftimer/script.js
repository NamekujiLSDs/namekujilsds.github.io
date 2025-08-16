document.addEventListener('DOMContentLoaded', () => {
    const clockElement = document.getElementById('clock');
    const timersContainer = document.getElementById('timers-container');
    const addTimerButton = document.getElementById('add-timer');

    let timers = [];
    let timerIntervals = {};

    function updateClock() {
        const now = new Date();
        clockElement.textContent = now.toLocaleTimeString('ja-JP');
    }
    setInterval(updateClock, 1000);
    updateClock();

    // --- BUG FIX 1: `loadTimers`関数を修正 ---
    // 保存されたデータからタイマーを読み込む際に、`remainingTime`を初期化する
    function loadTimers() {
        const savedTimersJSON = localStorage.getItem('timers');
        if (savedTimersJSON) {
            let loadedTimers = JSON.parse(savedTimersJSON);
            if (loadedTimers.length > 0) {
                timers = loadedTimers.map(timer => ({
                    ...timer,
                    remainingTime: timer.initialTime,
                    isActive: false
                }));
            } else {
                createDefaultTimer();
            }
        } else {
            createDefaultTimer();
        }
        renderTimers();
    }

    function createDefaultTimer() {
        timers = [{
            id: Date.now(),
            title: '作業',
            initialTime: 1500,
            remainingTime: 1500,
            isActive: false
        }];
    }

    // `saveTimers`は変更なし (残り時間や動作中の状態は保存しない仕様)
    function saveTimers() {
        const timersToSave = timers.map(({ id, title, initialTime }) => ({
            id, title, initialTime
        }));
        localStorage.setItem('timers', JSON.stringify(timersToSave));
    }

    function renderTimers() {
        timersContainer.innerHTML = '';
        timers.forEach(timer => {
            const timerElement = createTimerElement(timer);
            timersContainer.appendChild(timerElement);
        });
        updateAllDisplays();
    }

    function createTimerElement(timer) {
        const timerDiv = document.createElement('div');
        timerDiv.className = 'timer';
        timerDiv.dataset.id = timer.id;

        const initialHours = Math.floor(timer.initialTime / 3600);
        const initialMinutes = Math.floor((timer.initialTime % 3600) / 60);
        const initialSeconds = timer.initialTime % 60;

        timerDiv.innerHTML = `
                <div class="timer-header">
                    <input type="text" class="timer-title" value="${timer.title}">
                    <button class="delete-btn">×</button>
                </div>
                <div class="timer-main">
                    <div class="time-display">00:00:00</div>
                    <div class="timer-controls">
                        <button class="start-btn">▶</button>
                        <button class="stop-btn">■</button>
                        <button class="reset-btn">⟳</button>
                    </div>
                </div>
                <div class="time-inputs">
                    <label><input type="number" class="hours-input" min="0" max="99" value="${initialHours}">H</label>
                    <label><input type="number" class="minutes-input" min="0" max="59" value="${initialMinutes}">M</label>
                    <label><input type="number" class="seconds-input" min="0" max="59" value="${initialSeconds}">S</label>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar"></div>
                </div>
            `;

        // イベントリスナーは変更なし
        const titleInput = timerDiv.querySelector('.timer-title');
        titleInput.addEventListener('change', (e) => {
            const timerData = timers.find(t => t.id === timer.id);
            if (timerData) {
                timerData.title = e.target.value;
                saveTimers();
            }
        });

        const inputs = timerDiv.querySelectorAll('.time-inputs input');
        inputs.forEach(input => {
            input.addEventListener('change', () => updateInitialTime(timer.id));
        });

        timerDiv.querySelector('.start-btn').addEventListener('click', () => startTimer(timer.id));
        timerDiv.querySelector('.stop-btn').addEventListener('click', () => stopTimer(timer.id));
        timerDiv.querySelector('.reset-btn').addEventListener('click', () => resetTimer(timer.id));
        timerDiv.querySelector('.delete-btn').addEventListener('click', () => deleteTimer(timer.id));

        return timerDiv;
    }

    function getTimerElements(id) {
        const timerElement = document.querySelector(`.timer[data-id='${id}']`);
        if (!timerElement) return null;
        return {
            timerElement,
            display: timerElement.querySelector('.time-display'),
            progressBar: timerElement.querySelector('.progress-bar'),
            hoursInput: timerElement.querySelector('.hours-input'),
            minutesInput: timerElement.querySelector('.minutes-input'),
            secondsInput: timerElement.querySelector('.seconds-input'),
        };
    }

    // --- BUG FIX 2: 表示更新系の関数を修正 ---
    // `id`に基づいて正しいタイマー要素を操作するように修正
    function updateInitialTime(id) {
        const timer = timers.find(t => t.id === id);
        const elements = getTimerElements(id);
        if (timer && elements) {
            const hours = parseInt(elements.hoursInput.value) || 0;
            const minutes = parseInt(elements.minutesInput.value) || 0;
            const seconds = parseInt(elements.secondsInput.value) || 0;

            timer.initialTime = (hours * 3600) + (minutes * 60) + seconds;
            if (!timer.isActive) {
                timer.remainingTime = timer.initialTime;
                updateTimerDisplay(id);
            }
            saveTimers();
        }
    }

    function updateTimerDisplay(id) {
        const timer = timers.find(t => t.id === id);
        const elements = getTimerElements(id);
        if (timer && elements && elements.display) {
            const hours = String(Math.floor(timer.remainingTime / 3600)).padStart(2, '0');
            const minutes = String(Math.floor((timer.remainingTime % 3600) / 60)).padStart(2, '0');
            const seconds = String(timer.remainingTime % 60).padStart(2, '0');
            elements.display.textContent = `${hours}:${minutes}:${seconds}`;
            updateProgressBar(id);
        }
    }

    function updateProgressBar(id) {
        const timer = timers.find(t => t.id === id);
        const elements = getTimerElements(id);
        if (timer && elements && elements.progressBar) {
            const progress = timer.initialTime > 0 ? ((timer.initialTime - timer.remainingTime) / timer.initialTime) * 100 : 0;
            elements.progressBar.style.width = `${progress}%`;
        }
    }

    function updateAllDisplays() {
        timers.forEach(timer => updateTimerDisplay(timer.id));
    }

    // --- 以下のロジックは音声再生を削除した以外、大きな変更なし ---
    function startTimer(id) {
        const timer = timers.find(t => t.id === id);
        if (!timer || timer.isActive || timer.remainingTime <= 0) return;

        timer.isActive = true;
        timerIntervals[id] = setInterval(() => {
            if (timer.remainingTime > 0) {
                timer.remainingTime--;
                updateTimerDisplay(id);
            } else {
                stopTimer(id);
                alert(`「${timer.title}」のタイマーが終了しました！`);
            }
        }, 1000);
    }

    function stopTimer(id) {
        if (timerIntervals[id]) {
            const timer = timers.find(t => t.id === id);
            if (timer) timer.isActive = false;
            clearInterval(timerIntervals[id]);
            delete timerIntervals[id];
        }
    }

    function resetTimer(id) {
        stopTimer(id);
        const timer = timers.find(t => t.id === id);
        if (timer) {
            timer.remainingTime = timer.initialTime;
            updateTimerDisplay(id);
        }
    }

    function deleteTimer(id) {
        if (confirm('このタイマーを削除しますか？')) {
            stopTimer(id);
            timers = timers.filter(t => t.id !== id);
            saveTimers();
            renderTimers();
        }
    }

    addTimerButton.addEventListener('click', () => {
        const newTimer = {
            id: Date.now(),
            title: '新しいタイマー',
            initialTime: 600, // 10分
            remainingTime: 600,
            isActive: false
        };
        timers.push(newTimer);
        saveTimers();
        renderTimers();
    });

    loadTimers();
});
