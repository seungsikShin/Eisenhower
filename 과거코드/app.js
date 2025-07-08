// Firebase v9 모듈 임포트
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

// Firebase 설정
const firebaseConfig = {
    apiKey: "AIzaSyDRVj5-ve2Q-zu6PwzE-R7G1JNyG4E8YVM",
    authDomain: "eisenhower-1589b.firebaseapp.com",
    databaseURL: "https://eisenhower-1589b-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "eisenhower-1589b",
    storageBucket: "eisenhower-1589b.firebasestorage.app",
    messagingSenderId: "191550460422",
    appId: "1:191550460422:web:376099924e466a00932987"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);
const dbRef = ref(database);

// 전역 변수 설정
window.firebaseDB = database;
window.firebaseRef = ref;
window.firebaseSet = set;
window.firebaseGet = get;
window.firebaseChild = child;
window.firebaseAuth = auth;

// 현재 사용자 정보
let currentUser = null;
let userId = null;

// 데이터 구조
let tasks = {
    1: [],
    2: [],
    3: [],
    4: []
};

// 캘린더 관련 변수
let currentCalendarDate = new Date();
let currentOverviewDate = new Date();
let datesWithData = new Set();

// 드래그 앤 드롭 관련 변수
let draggedTask = null;

// 인증 상태 변화 감지
onAuthStateChanged(auth, (user) => {
    if (user) {
        // 로그인 상태
        currentUser = user;
        userId = user.uid;
        document.getElementById('user-email').textContent = user.email;
        showMainApp();
        loadTasks();
        loadDatesWithData();
        renderMiniCalendar();
        console.log('사용자 로그인됨:', user.email);
    } else {
        // 로그아웃 상태
        currentUser = null;
        userId = null;
        showAuthScreen();
        console.log('사용자 로그아웃됨');
    }
});

// 화면 전환 함수들
function showAuthScreen() {
    document.getElementById('auth-container').style.display = 'flex';
    document.getElementById('main-app').classList.remove('show');
}

function showMainApp() {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('main-app').classList.add('show');
}

// 인증 메시지 표시
function showAuthMessage(message, type) {
    const messageEl = document.getElementById('auth-message');
    messageEl.innerHTML = `<div class="${type}-message">${message}</div>`;
    setTimeout(() => {
        messageEl.innerHTML = '';
    }, 5000);
}

// 로딩 상태 표시
function setButtonLoading(buttonId, isLoading) {
    const button = document.getElementById(buttonId);
    const btnText = button.querySelector('.btn-text');
    
    if (isLoading) {
        button.disabled = true;
        btnText.innerHTML = '<span class="loading-spinner"></span>처리 중...';
    } else {
        button.disabled = false;
        btnText.textContent = buttonId.includes('login') ? '로그인' : '회원가입';
    }
}

// 폼 전환
function toggleAuthForm() {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const switchText = document.getElementById('switch-text');
    const switchBtn = document.getElementById('switch-btn');
    
    if (loginForm.style.display === 'none') {
        // 회원가입 → 로그인
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
        switchText.textContent = '계정이 없으신가요?';
        switchBtn.textContent = '회원가입';
    } else {
        // 로그인 → 회원가입
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
        switchText.textContent = '이미 계정이 있으신가요?';
        switchBtn.textContent = '로그인';
    }
    
    // 에러 메시지 초기화
    document.getElementById('auth-message').innerHTML = '';
}

// 이벤트 리스너 설정
document.getElementById('switch-btn').addEventListener('click', toggleAuthForm);

// 로그인 폼 처리
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showAuthMessage('이메일과 비밀번호를 입력해주세요.', 'error');
        return;
    }
    
    setButtonLoading('login-btn', true);
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
        showAuthMessage('로그인 성공! 환영합니다! 🎉', 'success');
    } catch (error) {
        console.error('로그인 오류:', error);
        let errorMessage = '로그인에 실패했습니다.';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = '등록되지 않은 이메일입니다.';
                break;
            case 'auth/wrong-password':
                errorMessage = '비밀번호가 올바르지 않습니다.';
                break;
            case 'auth/invalid-email':
                errorMessage = '올바른 이메일 형식이 아닙니다.';
                break;
            case 'auth/too-many-requests':
                errorMessage = '너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요.';
                break;
        }
        
        showAuthMessage(errorMessage, 'error');
    } finally {
        setButtonLoading('login-btn', false);
    }
});

// 회원가입 폼 처리
document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm').value;
    
    if (!email || !password || !confirmPassword) {
        showAuthMessage('모든 필드를 입력해주세요.', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showAuthMessage('비밀번호가 일치하지 않습니다.', 'error');
        return;
    }
    
    if (password.length < 6) {
        showAuthMessage('비밀번호는 6자 이상이어야 합니다.', 'error');
        return;
    }
    
    setButtonLoading('signup-btn', true);
    
    try {
        await createUserWithEmailAndPassword(auth, email, password);
        showAuthMessage('회원가입 성공! 환영합니다! 🎉', 'success');
    } catch (error) {
        console.error('회원가입 오류:', error);
        let errorMessage = '회원가입에 실패했습니다.';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = '이미 사용 중인 이메일입니다.';
                break;
            case 'auth/invalid-email':
                errorMessage = '올바른 이메일 형식이 아닙니다.';
                break;
            case 'auth/weak-password':
                errorMessage = '비밀번호가 너무 약합니다. 6자 이상 입력해주세요.';
                break;
        }
        
        showAuthMessage(errorMessage, 'error');
    } finally {
        setButtonLoading('signup-btn', false);
    }
});

// 로그아웃 함수
window.logout = async function() {
    try {
        await signOut(auth);
        showMessage('로그아웃 되었습니다.', 'success');
    } catch (error) {
        console.error('로그아웃 오류:', error);
        showMessage('로그아웃 중 오류가 발생했습니다.', 'error');
    }
};

// 전역 함수들을 window 객체에 등록
window.handleTaskInput = function(event, quadrant) {
    if (event.key === 'Enter') {
        addTask(quadrant);
    }
};

// 검색 입력 이벤트
document.getElementById('search-tasks').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        searchTasks();
    }
});

// 캘린더 토글
window.toggleCalendar = function() {
    const modal = document.getElementById('calendar-modal');
    modal.classList.toggle('show');
    if (modal.classList.contains('show')) {
        renderCalendar();
    }
};

// 검색 모달 토글
window.toggleSearchModal = function() {
    const modal = document.getElementById('search-modal');
    modal.classList.toggle('show');
};

// 미니 캘린더 월 변경
window.changeOverviewMonth = function(direction) {
    currentOverviewDate.setMonth(currentOverviewDate.getMonth() + direction);
    renderMiniCalendar();
};

// 캘린더 월 변경
window.changeMonth = function(direction) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    renderCalendar();
};

// 미니 캘린더 렌더링 (한국 시간 기준)
function renderMiniCalendar() {
    // 디버깅용 콘솔 로그 추가
    console.log('현재 날짜:', new Date().toISOString().split('T')[0]);
    console.log('선택된 날짜:', document.getElementById('task-date').value);
    console.log('데이터가 있는 날짜들:', Array.from(datesWithData));

    const grid = document.getElementById('mini-calendar');
    const title = document.getElementById('overview-title');
    const year = currentOverviewDate.getFullYear();
    const month = currentOverviewDate.getMonth();

    title.textContent = `${year}년 ${month + 1}월`;
    grid.innerHTML = '';

    const dayHeaders = ['일', '월', '화', '수', '목', '금', '토'];
    dayHeaders.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'mini-day-header';
        dayHeader.textContent = day;
        grid.appendChild(dayHeader);
    });

    const firstDate = new Date(year, month, 1);
    const firstDayOfWeek = firstDate.getDay();
    const startDate = new Date(year, month, 1 - firstDayOfWeek);

    // 날짜 비교 로직 수정
    const today = new Date().toISOString().split('T')[0];
    const selectedDate = document.getElementById('task-date').value;

    for (let i = 0; i < 42; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        const dayElement = document.createElement('div');
        dayElement.className = 'mini-day';
        dayElement.textContent = currentDate.getDate();

        if (currentDate.getMonth() !== month) {
            dayElement.classList.add('other-month');
        }
        if (dateStr === today) {
            dayElement.classList.add('today');
        }
        if (dateStr === selectedDate) {
            dayElement.classList.add('selected');
        }
        if (datesWithData.has(dateStr)) {
            dayElement.classList.add('has-data');
        }

        dayElement.addEventListener('click', () => {
            document.getElementById('task-date').value = dateStr;
            loadTasks();
            renderMiniCalendar(); // 선택 상태 업데이트
        });

        grid.appendChild(dayElement);
    }
}

// 캘린더 렌더링 (한국 시간 기준)
function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const title = document.getElementById('calendar-title');
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    title.textContent = `${year}년 ${month + 1}월`;
    grid.innerHTML = '';

    const dayHeaders = ['일', '월', '화', '수', '목', '금', '토'];
    dayHeaders.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day-header';
        dayHeader.textContent = day;
        grid.appendChild(dayHeader);
    });

    const firstDate = new Date(year, month, 1);
    const firstDayOfWeek = firstDate.getDay();
    const startDate = new Date(year, month, 1 - firstDayOfWeek);

    // 날짜 비교 로직 수정
    const today = new Date().toISOString().split('T')[0];
    const selectedDate = document.getElementById('task-date').value;

    for (let i = 0; i < 42; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = currentDate.getDate();

        if (currentDate.getMonth() !== month) {
            dayElement.classList.add('other-month');
        }
        if (dateStr === today) {
            dayElement.classList.add('today');
        }
        if (dateStr === selectedDate) {
            dayElement.classList.add('selected');
        }
        if (datesWithData.has(dateStr)) {
            dayElement.classList.add('has-data');
        }

        dayElement.addEventListener('click', () => {
            document.getElementById('task-date').value = dateStr;
            loadTasks();
            toggleCalendar();
        });

        grid.appendChild(dayElement);
    }
}

window.addTask = function(quadrant) {
    if (!currentUser) {
        showMessage('로그인이 필요합니다.', 'error');
        return;
    }

    const input = document.querySelector(`[data-quadrant="${quadrant}"] .task-input`);
    const taskText = input.value.trim();
    
    if (taskText === '') {
        showMessage('업무 내용을 입력해주세요.', 'error');
        return;
    }

    const task = {
        id: Date.now().toString(),
        text: taskText,
        completed: false,
        createdAt: new Date().toISOString()
    };

    tasks[quadrant].push(task);
    input.value = '';
    renderTasks(quadrant);
    
    saveTasks();
    loadDatesWithData();
    
    showMessage('업무가 추가되었습니다.', 'success');
};

window.toggleTask = function(quadrant, taskId) {
    const task = tasks[quadrant].find(t => t.id === taskId);
    if (task) {
        task.completed = !task.completed;
        
        if (task.completed) {
            showMessage(celebrateCompletion(), 'success');
        }
        
        renderTasks(quadrant);
        updateTaskStats();
        saveTasks();
    }
};

window.deleteTask = function(quadrant, taskId) {
    tasks[quadrant] = tasks[quadrant].filter(t => t.id !== taskId);
    renderTasks(quadrant);
    saveTasks();
    loadDatesWithData();
    showMessage('업무가 삭제되었습니다.', 'success');
};

// 3. renderTasks 함수 수정 (방어 코드 추가)
function renderTasks(quadrant) {
    const taskList = document.getElementById(`tasks-${quadrant}`);
    taskList.innerHTML = '';

    // 안전성 체크
    if (!tasks[quadrant] || !Array.isArray(tasks[quadrant])) {
        tasks[quadrant] = [];
    }

    if (tasks[quadrant].length === 0) {
        const emptyMessage = document.createElement('li');
        emptyMessage.className = 'loading';
        emptyMessage.textContent = '등록된 업무가 없습니다.';
        taskList.appendChild(emptyMessage);
        return;
    }

    tasks[quadrant].forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
        li.draggable = true;
        li.dataset.taskId = task.id;
        li.dataset.quadrant = quadrant;
        
        li.innerHTML = `
            <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} 
                   onchange="toggleTask(${quadrant}, '${task.id}')">
            <span class="task-text ${task.completed ? 'completed' : ''}">${task.text}</span>
            <button class="delete-btn" onclick="deleteTask(${quadrant}, '${task.id}')">삭제</button>
        `;
        
        li.addEventListener('dragstart', handleDragStart);
        li.addEventListener('dragend', handleDragEnd);
        
        taskList.appendChild(li);
    });
}

// 4. saveTasks 함수 수정 (모든 사분면 저장)
window.saveTasks = function() {
    if (!currentUser) {
        showMessage('로그인이 필요합니다.', 'error');
        return;
    }

    const selectedDate = document.getElementById('task-date').value;
    if (!selectedDate) {
        showMessage('날짜를 선택해주세요.', 'error');
        return;
    }

    // 모든 사분면을 포함하여 저장 (빈 배열도 포함)
    const tasksToSave = {
        1: tasks[1] || [],
        2: tasks[2] || [],
        3: tasks[3] || [],
        4: tasks[4] || []
    };

    const dataToSave = {
        date: selectedDate,
        tasks: tasksToSave,
        lastUpdated: new Date().toISOString(),
        userId: userId
    };

    console.log('저장할 데이터:', dataToSave); // 디버깅용

    const taskRef = window.firebaseRef(window.firebaseDB, `eisenhower-tasks/${userId}/${selectedDate}`);
    window.firebaseSet(taskRef, dataToSave)
        .then(() => {
            loadDatesWithData();
            showMessage('클라우드에 저장되었습니다! 🎉', 'success');
        })
        .catch((error) => {
            console.error('Firebase 저장 실패:', error);
            showMessage('저장 중 오류가 발생했습니다.', 'error');
        });
};

// 2. loadTasks 함수 수정 (누락된 사분면 처리)
function loadTasks() {
    if (!currentUser) return;
    
    const selectedDate = document.getElementById('task-date').value;
    
    // Firebase에서 사용자별 데이터 불러오기
    const taskRef = window.firebaseRef(window.firebaseDB, `eisenhower-tasks/${userId}/${selectedDate}`);
    window.firebaseGet(taskRef)
        .then((snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                // 모든 사분면을 빈 배열로 초기화
                tasks = { 1: [], 2: [], 3: [], 4: [] };
                // Firebase에서 불러온 데이터로 덮어쓰기 (누락된 사분면은 빈 배열 유지)
                if (data.tasks) {
                    Object.keys(data.tasks).forEach(quadrant => {
                        if (tasks[quadrant] !== undefined) {
                            tasks[quadrant] = data.tasks[quadrant] || [];
                        }
                    });
                }
                console.log('불러온 데이터:', tasks); // 디버깅용
                showMessage('데이터를 불러왔습니다.', 'success');
            } else {
                // 데이터가 없는 경우 모든 사분면을 빈 배열로 초기화
                tasks = { 1: [], 2: [], 3: [], 4: [] };
                console.log('새로운 날짜 - 빈 데이터로 초기화');
            }
            renderAllTasks();
        })
        .catch((error) => {
            console.error('Firebase 불러오기 실패:', error);
            // 에러 발생 시에도 안전하게 초기화
            tasks = { 1: [], 2: [], 3: [], 4: [] };
            renderAllTasks();
        });
}

function renderAllTasks() {
    for (let i = 1; i <= 4; i++) {
        renderTasks(i);
    }
    updateTaskStats();
    renderMiniCalendar();
}

function loadDatesWithData() {
    if (!currentUser) return;
    
    // Firebase에서 사용자별 데이터가 있는 날짜들 로드
    const userTasksRef = window.firebaseRef(window.firebaseDB, `eisenhower-tasks/${userId}`);
    window.firebaseGet(userTasksRef)
        .then((snapshot) => {
            datesWithData.clear();
            if (snapshot.exists()) {
                const data = snapshot.val();
                Object.keys(data).forEach(date => {
                    const dayTasks = data[date].tasks;
                    const hasAnyTask = Object.values(dayTasks).some(quadrant => quadrant.length > 0);
                    if (hasAnyTask) {
                        datesWithData.add(date);
                    }
                });
            }
            renderMiniCalendar();
        })
        .catch((error) => {
            console.error('Firebase 날짜 데이터 로드 실패:', error);
            renderMiniCalendar();
        });
}

window.searchTasks = function() {
    if (!currentUser) {
        showMessage('로그인이 필요합니다.', 'error');
        return;
    }

    const searchTerm = document.getElementById('search-tasks').value.trim().toLowerCase();
    if (!searchTerm) {
        showMessage('검색어를 입력해주세요.', 'error');
        return;
    }

    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '<div class="loading">검색 중...</div>';
    toggleSearchModal();

    // Firebase에서 사용자별 검색
    const userTasksRef = window.firebaseRef(window.firebaseDB, `eisenhower-tasks/${userId}`);
    window.firebaseGet(userTasksRef)
        .then((snapshot) => {
            const results = [];
            
            if (snapshot.exists()) {
                const allData = snapshot.val();
                
                Object.keys(allData).forEach(date => {
                    const dayData = allData[date];
                    if (dayData.tasks) {
                        Object.keys(dayData.tasks).forEach(quadrant => {
                            dayData.tasks[quadrant].forEach(task => {
                                if (task.text.toLowerCase().includes(searchTerm)) {
                                    results.push({
                                        date: date,
                                        quadrant: quadrant,
                                        task: task,
                                        quadrantName: getQuadrantName(quadrant)
                                    });
                                }
                            });
                        });
                    }
                });
            }
            
            displaySearchResults(results, searchTerm);
        })
        .catch((error) => {
            console.error('Firebase 검색 실패:', error);
            displaySearchResults([], searchTerm);
        });
};

function getQuadrantName(quadrant) {
    const names = {
        '1': '🚨 DO (즉시 실행)',
        '2': '📋 PLAN (계획 수립)',
        '3': '🤝 DELEGATE (위임)',
        '4': '🗑️ DELETE (제거)'
    };
    return names[quadrant] || '';
}

function displaySearchResults(results, searchTerm) {
    const container = document.getElementById('search-results');
    
    if (results.length === 0) {
        container.innerHTML = `<div class="no-results">"${searchTerm}"에 대한 검색 결과가 없습니다.</div>`;
        return;
    }

    results.sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = results.map(result => `
        <div class="search-result-item" onclick="goToDate('${result.date}')">
            <div class="search-result-date">${formatDate(result.date)}</div>
            <div class="search-result-task">${highlightSearchTerm(result.task.text, searchTerm)}</div>
            <div class="search-result-quadrant">${result.quadrantName}</div>
        </div>
    `).join('');
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}년 ${month}월 ${day}일`;
}

function highlightSearchTerm(text, searchTerm) {
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<mark style="background: #fef3c7; padding: 2px 4px; border-radius: 4px;">$1</mark>');
}

window.goToDate = function(date) {
    document.getElementById('task-date').value = date;
    loadTasks();
    toggleSearchModal();
    showMessage(`${formatDate(date)}로 이동했습니다.`, 'success');
};

function showMessage(message, type) {
    const messageEl = document.getElementById('status-message');
    messageEl.textContent = message;
    messageEl.className = `status-message ${type} show`;
    
    setTimeout(() => {
        messageEl.classList.remove('show');
    }, 3000);
}

function handleDragStart(e) {
    draggedTask = {
        id: e.target.dataset.taskId,
        fromQuadrant: e.target.dataset.quadrant,
        element: e.target
    };
    e.target.classList.add('dragging');
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    
    document.querySelectorAll('.quadrant').forEach(quad => {
        quad.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    e.preventDefault();
}

function handleDragEnter(e) {
    if (e.target.classList.contains('quadrant')) {
        e.target.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    if (e.target.classList.contains('quadrant')) {
        e.target.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    const dropQuadrant = e.currentTarget.dataset.quadrant;
    
    if (draggedTask && dropQuadrant && draggedTask.fromQuadrant !== dropQuadrant) {
        moveTask(draggedTask.fromQuadrant, dropQuadrant, draggedTask.id);
    }
    
    e.currentTarget.classList.remove('drag-over');
}

// 7. moveTask 함수 수정 (안전성 체크)
function moveTask(fromQuadrant, toQuadrant, taskId) {
    // 안전성 체크
    if (!tasks[fromQuadrant] || !Array.isArray(tasks[fromQuadrant])) {
        tasks[fromQuadrant] = [];
    }
    if (!tasks[toQuadrant] || !Array.isArray(tasks[toQuadrant])) {
        tasks[toQuadrant] = [];
    }

    const taskIndex = tasks[fromQuadrant].findIndex(t => t.id === taskId);
    if (taskIndex !== -1) {
        const task = tasks[fromQuadrant][taskIndex];
        
        tasks[fromQuadrant].splice(taskIndex, 1);
        tasks[toQuadrant].push(task);
        
        renderTasks(fromQuadrant);
        renderTasks(toQuadrant);
        updateTaskStats();
        
        saveTasks();
        
        const quadrantNames = {
            '1': '긴급+중요',
            '2': '중요',
            '3': '긴급', 
            '4': '제거 대상'
        };
        showMessage(`업무를 ${quadrantNames[toQuadrant]} 사분면으로 이동했습니다.`, 'success');
    }
}

// 5. updateTaskStats 함수 수정 (안전성 체크)
function updateTaskStats() {
    const stats = {
        total: 0,
        completed: 0,
        byQuadrant: { 1: 0, 2: 0, 3: 0, 4: 0 }
    };

    Object.keys(tasks).forEach(quadrant => {
        // 안전성 체크
        if (tasks[quadrant] && Array.isArray(tasks[quadrant])) {
            tasks[quadrant].forEach(task => {
                stats.total++;
                stats.byQuadrant[quadrant]++;
                if (task.completed) {
                    stats.completed++;
                }
            });
        }
    });

    const progress = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
    
    document.getElementById('total-tasks').textContent = stats.total;
    document.getElementById('completed-tasks').textContent = stats.completed;
    document.getElementById('pending-tasks').textContent = stats.total - stats.completed;
    document.getElementById('progress-text').textContent = `${progress}%`;
    
    document.getElementById('q1-count').textContent = stats.byQuadrant[1];
    document.getElementById('q2-count').textContent = stats.byQuadrant[2];
    document.getElementById('q3-count').textContent = stats.byQuadrant[3];
    document.getElementById('q4-count').textContent = stats.byQuadrant[4];
    
    const circle = document.getElementById('progress-circle');
    const circumference = 2 * Math.PI * 35;
    const offset = circumference - (progress / 100) * circumference;
    circle.style.strokeDashoffset = offset;
}

function celebrateCompletion() {
    const celebrations = [
        "🎉 훌륭해요! 하나 더 완료!",
        "✨ 잘하고 있어요!",
        "🌟 계속 이런 식으로!",
        "🚀 멋져요! 다음 업무도 화이팅!",
        "👏 완료! 성취감이 느껴지네요!",
        "💪 대단해요! 계속 진행하세요!",
        "🔥 불타는 열정이네요!",
        "⭐ 완벽한 진행입니다!"
    ];
    
    return celebrations[Math.floor(Math.random() * celebrations.length)];
}

window.showTip = function() {
    const tips = [
        "💡 제2사분면(중요하지만 긴급하지 않은 일)에 집중하세요!",
        "🎯 제1사분면의 업무가 너무 많다면 계획을 재검토해보세요.",
        "🤝 제3사분면의 업무는 적극적으로 위임하거나 거절하세요.",
        "🗑️ 제4사분면의 업무는 과감히 제거하거나 최소화하세요.",
        "📅 매일 아침 우선순위를 재검토하는 습관을 만드세요!",
        "🕐 시간 블록킹을 활용해 집중 시간을 확보하세요.",
        "🎨 드래그 앤 드롭으로 업무를 다른 사분면으로 쉽게 이동할 수 있어요!",
        "🔍 검색 기능을 활용해 과거 업무를 빠르게 찾아보세요!"
    ];
    
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    showMessage(randomTip, 'success');
};

// 드래그 앤 드롭 이벤트 리스너 설정
document.querySelectorAll('.quadrant').forEach(quadrant => {
    quadrant.addEventListener('dragover', handleDragOver);
    quadrant.addEventListener('dragenter', handleDragEnter);
    quadrant.addEventListener('dragleave', handleDragLeave);
    quadrant.addEventListener('drop', handleDrop);
});

// 날짜 변경 이벤트 리스너
document.getElementById('task-date').addEventListener('change', loadTasks);

console.log('아이젠하워 매트릭스 애플리케이션이 초기화되었습니다.');

// 5. 초기 날짜 설정 및 DOMContentLoaded 이벤트 리스너 교체
document.addEventListener('DOMContentLoaded', function() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('task-date').value = today;
    console.log('오늘 날짜 설정:', today);
});
