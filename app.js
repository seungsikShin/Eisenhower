// Firebase v9 모듈 임포트
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getDatabase, ref, set, get, child, push, remove, onValue, off } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";
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

// 전역 변수
let currentUser = null;
let userId = null;
let sharedAuditTasks = [];
let personalTasks = { 1: [], 2: [], 3: [], 4: [] };
let sharedCalendarEvents = [];
let currentFilter = '전체';
let selectedWorkForMatrix = null;
let selectedEvent = null;
let selectedEventColor = '#e53e3e';
let selectedEventBg = '#fed7d7';

// 캘린더 관련 변수
let currentCalendarDate = new Date();
let currentOverviewDate = new Date();
let currentMainCalendarDate = new Date();
let datesWithData = new Set();

// 색상 팔레트
const eventColors = [
    { name: '빨간색', value: '#e53e3e', bg: '#fed7d7' },
    { name: '파란색', value: '#3182ce', bg: '#bee3f8' },
    { name: '초록색', value: '#38a169', bg: '#c6f6d5' },
    { name: '주황색', value: '#ed8936', bg: '#fbd38d' },
    { name: '보라색', value: '#805ad5', bg: '#d6bcfa' },
    { name: '분홍색', value: '#d53f8c', bg: '#fed7e2' },
    { name: '회색', value: '#718096', bg: '#e2e8f0' },
    { name: '청록색', value: '#319795', bg: '#b2f5ea' }
];

// 드래그 앤 드롭 관련 변수
let draggedTask = null;

// =============================================
// 인증 관련 함수들
// =============================================

// 인증 상태 변화 감지
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        userId = user.uid;
        document.getElementById('user-email').textContent = user.email;
        showMainApp();
        loadSharedAuditTasks();
        loadPersonalTasks();
        loadDatesWithData();
        renderMiniCalendar();
        console.log('사용자 로그인됨:', user.email);
    } else {
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
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
        switchText.textContent = '계정이 없으신가요?';
        switchBtn.textContent = '회원가입';
    } else {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
        switchText.textContent = '이미 계정이 있으신가요?';
        switchBtn.textContent = '로그인';
    }
    
    document.getElementById('auth-message').innerHTML = '';
}

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

// =============================================
// 뷰 전환 관련 함수들
// =============================================

// 뷰 전환 함수
window.switchView = function(viewName) {
    // 탭 활성화 상태 변경
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');

    // 뷰 전환
    document.querySelectorAll('.dashboard-view, .matrix-view, .calendar-view').forEach(view => {
        view.classList.remove('active');
    });
    
    if (viewName === 'dashboard') {
        document.getElementById('dashboard-view').classList.add('active');
        loadSharedAuditTasks();
    } else if (viewName === 'calendar') {
        document.getElementById('calendar-view').classList.add('active');
        loadSharedCalendarEvents();
        renderMainCalendar();
    } else if (viewName === 'matrix') {
        document.getElementById('matrix-view').classList.add('active');
        loadPersonalTasks();
        renderMiniCalendar();
    }
};

// =============================================
// 공유 감사업무 관련 함수들
// =============================================

// 공유 감사업무 데이터 로드
function loadSharedAuditTasks() {
    const tasksRef = ref(database, 'shared-audit-tasks');
    
    onValue(tasksRef, (snapshot) => {
        sharedAuditTasks = [];
        if (snapshot.exists()) {
            const data = snapshot.val();
            Object.keys(data).forEach(key => {
                sharedAuditTasks.push({
                    id: key,
                    ...data[key]
                });
            });
        }
        renderSharedAuditTasks();
        updateDashboardStats();
    });
}

// 공유 감사업무 목록 렌더링
function renderSharedAuditTasks() {
    const tableBody = document.getElementById('work-table-body');
    
    if (sharedAuditTasks.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: #718096;">
                    등록된 업무가 없습니다. 새 업무를 등록해주세요.
                </td>
            </tr>
        `;
        return;
    }

    let filteredTasks = sharedAuditTasks;
    if (currentFilter !== '전체') {
        filteredTasks = sharedAuditTasks.filter(task => task.status === currentFilter);
    }

    tableBody.innerHTML = filteredTasks.map(task => `
        <tr>
            <td>${task.category || '-'}</td>
            <td style="font-weight: 600;">${task.workName || '-'}</td>
            <td>${task.targetDept || '-'}</td>
            <td>${formatDateRange(task.startDate, task.endDate)}</td>
            <td><span class="status-badge ${getStatusClass(task.status)}">${task.status || '-'}</span></td>
            <td>${task.responsiblePerson || '-'}</td>
            <td>
                <div class="action-btns">
                    <button class="btn-import" onclick="importToMatrix('${task.id}')">📥 가져오기</button>
                    <button class="btn-edit" onclick="editWork('${task.id}')">✏️ 수정</button>
                    <button class="btn-delete" onclick="deleteWork('${task.id}')">🗑️ 삭제</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// 업무 폼 표시/숨기기
window.showWorkForm = function() {
    document.getElementById('work-form').classList.add('show');
    document.getElementById('work-form').scrollIntoView({ behavior: 'smooth' });
};

window.hideWorkForm = function() {
    document.getElementById('work-form').classList.remove('show');
    document.getElementById('work-form-element').reset();
};

// 필터 함수
window.filterByStatus = function(status) {
    currentFilter = status;
    
    // 필터 버튼 활성화 상태 변경
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    renderSharedAuditTasks();
};

// 매트릭스로 가져오기
window.importToMatrix = function(workId) {
    const work = sharedAuditTasks.find(task => task.id === workId);
    if (!work) {
        showMessage('업무를 찾을 수 없습니다.', 'error');
        return;
    }

    selectedWorkForMatrix = work;
    document.getElementById('selected-work-name').textContent = work.workName;
    document.getElementById('quadrant-modal').classList.add('show');
};

// 공유 업무 수정
window.editWork = function(workId) {
    const work = sharedAuditTasks.find(task => task.id === workId);
    if (!work) {
        showMessage('업무를 찾을 수 없습니다.', 'error');
        return;
    }

    // 폼에 기존 데이터 채우기
    document.getElementById('work-category').value = work.category || '';
    document.getElementById('work-name').value = work.workName || '';
    document.getElementById('target-dept').value = work.targetDept || '';
    document.getElementById('responsible-person').value = work.responsiblePerson || '';
    document.getElementById('work-status').value = work.status || '';
    document.getElementById('start-date').value = work.startDate || '';
    document.getElementById('end-date').value = work.endDate || '';
    document.getElementById('work-description').value = work.description || '';
    document.getElementById('key-issues').value = work.keyIssues || '';

    showWorkForm();
    
    // 수정 모드 플래그 설정
    document.getElementById('work-form-element').dataset.editMode = 'true';
    document.getElementById('work-form-element').dataset.editId = workId;
};

// 공유 업무 삭제
window.deleteWork = function(workId) {
    if (!confirm('정말로 이 업무를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        return;
    }

    const work = sharedAuditTasks.find(task => task.id === workId);
    if (work && work.createdBy !== userId) {
        if (!confirm('다른 사용자가 등록한 업무입니다. 정말로 삭제하시겠습니까?')) {
            return;
        }
    }

    const workRef = ref(database, `shared-audit-tasks/${workId}`);
    remove(workRef)
        .then(() => {
            showMessage('업무가 삭제되었습니다.', 'success');
        })
        .catch((error) => {
            console.error('업무 삭제 실패:', error);
            showMessage('업무 삭제 중 오류가 발생했습니다.', 'error');
        });
};

// CSV 내보내기
window.exportToCSV = function() {
    if (sharedAuditTasks.length === 0) {
        showMessage('내보낼 데이터가 없습니다.', 'error');
        return;
    }

    const headers = ['업무분류', '업무명', '대상부서', '담당자', '진행상태', '시작일자', '종료일자', '업무설명', '주요지적사항', '등록자', '등록일시'];
    const csvContent = [
        headers.join(','),
        ...sharedAuditTasks.map(task => [
            task.category || '',
            `"${task.workName || ''}"`,
            task.targetDept || '',
            task.responsiblePerson || '',
            task.status || '',
            task.startDate || '',
            task.endDate || '',
            `"${task.description || ''}"`,
            `"${task.keyIssues || ''}"`,
            task.createdByEmail || '',
            task.createdAt ? new Date(task.createdAt).toLocaleString('ko-KR') : ''
        ].join(','))
    ].join('\n');

    // UTF-8 BOM 추가 (한글 깨짐 방지)
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `감사업무목록_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showMessage('CSV 파일이 다운로드되었습니다! 📄', 'success');
    }
};

// =============================================
// 개인 매트릭스 관련 함수들
// =============================================

// 개인 매트릭스 데이터 로드
function loadPersonalTasks() {
    if (!currentUser) return;
    
    const selectedDate = document.getElementById('task-date').value;
    const taskRef = ref(database, `eisenhower-tasks/${userId}/${selectedDate}`);
    
    get(taskRef).then((snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            personalTasks = data.tasks || { 1: [], 2: [], 3: [], 4: [] };
        } else {
            personalTasks = { 1: [], 2: [], 3: [], 4: [] };
        }
        renderPersonalTasks();
        updateMatrixStats();
    }).catch((error) => {
        console.error('개인 업무 로드 실패:', error);
        personalTasks = { 1: [], 2: [], 3: [], 4: [] };
        renderPersonalTasks();
    });
}

// 개인 업무 추가
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

    personalTasks[quadrant].push(task);
    input.value = '';
    renderPersonalTasks();
    updateMatrixStats();
    savePersonalTasks();
    
    showMessage('업무가 추가되었습니다.', 'success');
};

// 엔터키로 업무 추가
window.handleTaskInput = function(event, quadrant) {
    if (event.key === 'Enter') {
        addTask(quadrant);
    }
};

// 개인 업무 완료 토글
window.togglePersonalTask = function(quadrant, taskId) {
    const task = personalTasks[quadrant].find(t => t.id === taskId);
    if (task) {
        task.completed = !task.completed;
        renderPersonalTasks();
        updateMatrixStats();
        savePersonalTasks();
        
        if (task.completed) {
            showMessage(celebrateCompletion(), 'success');
        }
    }
};

// 개인 업무 삭제
window.deletePersonalTask = function(quadrant, taskId) {
    if (confirm('정말로 이 업무를 삭제하시겠습니까?')) {
        personalTasks[quadrant] = personalTasks[quadrant].filter(t => t.id !== taskId);
        renderPersonalTasks();
        updateMatrixStats();
        savePersonalTasks();
        loadDatesWithData();
        showMessage('업무가 삭제되었습니다.', 'success');
    }
};

// 개인 매트릭스 렌더링
function renderPersonalTasks() {
    for (let quadrant = 1; quadrant <= 4; quadrant++) {
        const taskList = document.getElementById(`tasks-${quadrant}`);
        const tasks = personalTasks[quadrant] || [];
        
        if (tasks.length === 0) {
            taskList.innerHTML = '<li style="text-align: center; padding: 20px; color: #718096;">등록된 업무가 없습니다.</li>';
            continue;
        }

        taskList.innerHTML = tasks.map(task => `
            <li class="task-item ${task.completed ? 'completed' : ''}" draggable="true" data-task-id="${task.id}" data-quadrant="${quadrant}">
                <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} 
                       onchange="togglePersonalTask(${quadrant}, '${task.id}')">
                <div style="flex: 1;">
                    <div class="task-text ${task.completed ? 'completed' : ''}">${task.text}</div>
                    ${task.isFromShared ? `<div class="task-meta">📋 ${task.originalCategory} | ${task.originalTargetDept}</div>` : ''}
                </div>
                <button class="delete-btn" onclick="deletePersonalTask(${quadrant}, '${task.id}')">삭제</button>
            </li>
        `).join('');
    }
    
    // 드래그 앤 드롭 이벤트 재설정
    setupDragAndDrop();
}

// 개인 업무 저장
function savePersonalTasks() {
    if (!currentUser) return;

    const selectedDate = document.getElementById('task-date').value;
    if (!selectedDate) {
        showMessage('날짜를 선택해주세요.', 'error');
        return;
    }

    const dataToSave = {
        date: selectedDate,
        tasks: personalTasks,
        lastUpdated: new Date().toISOString(),
        userId: userId
    };

    const taskRef = ref(database, `eisenhower-tasks/${userId}/${selectedDate}`);
    set(taskRef, dataToSave)
        .then(() => {
            loadDatesWithData();
        })
        .catch((error) => {
            console.error('개인 업무 저장 실패:', error);
            showMessage('저장 중 오류가 발생했습니다.', 'error');
        });
}

// 업무 저장 (버튼 클릭)
window.saveTasks = function() {
    savePersonalTasks();
    showMessage('클라우드에 저장되었습니다! 🎉', 'success');
};

// =============================================
// 캘린더 관련 함수들
// =============================================

// 캘린더 토글
window.toggleCalendar = function() {
    const modal = document.getElementById('calendar-modal');
    modal.classList.toggle('show');
    if (modal.classList.contains('show')) {
        renderCalendar();
    }
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

// 미니 캘린더 렌더링
function renderMiniCalendar() {
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
            loadPersonalTasks();
            renderMiniCalendar();
        });

        grid.appendChild(dayElement);
    }
}

// 캘린더 렌더링
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
            loadPersonalTasks();
            toggleCalendar();
        });

        grid.appendChild(dayElement);
    }
}

// 데이터가 있는 날짜들 로드
function loadDatesWithData() {
    if (!currentUser) return;
    
    const userTasksRef = ref(database, `eisenhower-tasks/${userId}`);
    get(userTasksRef)
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

// =============================================
// 검색 관련 함수들
// =============================================

// 검색 모달 토글
window.toggleSearchModal = function() {
    const modal = document.getElementById('search-modal');
    modal.classList.toggle('show');
};

// 업무 검색
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

    const userTasksRef = ref(database, `eisenhower-tasks/${userId}`);
    get(userTasksRef)
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

// 검색 결과 표시
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

// 특정 날짜로 이동
window.goToDate = function(date) {
    document.getElementById('task-date').value = date;
    loadPersonalTasks();
    toggleSearchModal();
    showMessage(`${formatDate(date)}로 이동했습니다.`, 'success');
};

// =============================================
// 팀 캘린더 관련 함수들
// =============================================

// 공유 캘린더 이벤트 로드
function loadSharedCalendarEvents() {
    const eventsRef = ref(database, 'shared-calendar-events');
    
    onValue(eventsRef, (snapshot) => {
        sharedCalendarEvents = [];
        if (snapshot.exists()) {
            const data = snapshot.val();
            Object.keys(data).forEach(key => {
                sharedCalendarEvents.push({
                    id: key,
                    ...data[key]
                });
            });
        }
        renderMainCalendar();
        updateCalendarStats();
    });
}

// 메인 캘린더 렌더링 (한국 시간 기준으로 수정)
function renderMainCalendar() {
    const year = currentMainCalendarDate.getFullYear();
    const month = currentMainCalendarDate.getMonth();
    
    // 월 제목 업데이트
    document.getElementById('calendar-month-title').textContent = `${year}년 ${month + 1}월`;
    
    const daysContainer = document.getElementById('calendar-days');
    daysContainer.innerHTML = '';
    
    // 첫째 날 계산 (한국 시간 기준)
    const firstDate = new Date(year, month, 1);
    const firstDayOfWeek = firstDate.getDay();
    const startDate = new Date(year, month, 1 - firstDayOfWeek);
    
    // 오늘 날짜 (한국 시간 기준)
    const today = new Date().toISOString().split('T')[0];
    
    // 42개 날짜 생성 (6주)
    for (let i = 0; i < 42; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        
        // 날짜 문자열 생성 (YYYY-MM-DD 형식)
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        
        // 날짜 텍스트
        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = currentDate.getDate();
        dayElement.appendChild(dayNumber);
        
        // 다른 달 날짜 스타일
        if (currentDate.getMonth() !== currentMainCalendarDate.getMonth()) {
            dayElement.classList.add('other-month');
        }
        
        // 오늘 날짜 표시
        if (dateStr === today) {
            dayElement.classList.add('today');
        }
        
        // 해당 날짜의 이벤트들 표시
        const dayEvents = sharedCalendarEvents.filter(event => {
            return event.startDate === dateStr || 
                   (event.endDate && dateStr >= event.startDate && dateStr <= event.endDate);
        });
        
        if (dayEvents.length > 0) {
            const eventsContainer = document.createElement('div');
            eventsContainer.className = 'day-events';
            
            dayEvents.slice(0, 3).forEach(event => {
                const eventElement = document.createElement('div');
                eventElement.className = 'day-event';
                eventElement.style.backgroundColor = event.backgroundColor || event.color;
                eventElement.style.color = getContrastColor(event.color);
                eventElement.textContent = event.title;
                eventElement.title = `${event.title} (${event.type})`;
                
                eventElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showEventDetail(event);
                });
                
                eventsContainer.appendChild(eventElement);
            });
            
            // 더 많은 이벤트가 있으면 표시
            if (dayEvents.length > 3) {
                const moreElement = document.createElement('div');
                moreElement.className = 'day-event more-events';
                moreElement.textContent = `+${dayEvents.length - 3}개 더`;
                eventsContainer.appendChild(moreElement);
            }
            
            dayElement.appendChild(eventsContainer);
        }
        
        // 클릭 이벤트 - 해당 날짜에 새 이벤트 추가
        dayElement.addEventListener('click', () => {
            showEventForm(dateStr);
        });
        
        daysContainer.appendChild(dayElement);
    }
}

// 캘린더 월 변경
window.changeCalendarMonth = function(direction) {
    currentMainCalendarDate.setMonth(currentMainCalendarDate.getMonth() + direction);
    renderMainCalendar();
};

// 오늘로 이동
window.goToToday = function() {
    currentMainCalendarDate = new Date();
    renderMainCalendar();
};

// 이벤트 폼 표시
window.showEventForm = function(selectedDate = null) {
    const modal = document.getElementById('event-modal');
    const form = document.getElementById('event-form');
    
    // 폼 초기화
    form.reset();
    selectedEvent = null;
    
    // 모달 제목 설정
    document.getElementById('event-modal-title').textContent = '새 일정 추가';
    
    // 선택된 날짜가 있으면 설정
    if (selectedDate) {
        document.getElementById('event-start-date').value = selectedDate;
        document.getElementById('event-end-date').value = selectedDate;
    } else {
        // 오늘 날짜로 기본 설정
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('event-start-date').value = today;
        document.getElementById('event-end-date').value = today;
    }
    
    // 기본 색상 선택
    selectEventColor('#e53e3e', '#fed7d7');
    
    modal.classList.add('show');
};

// 이벤트 폼 숨기기
window.hideEventModal = function() {
    const modal = document.getElementById('event-modal');
    modal.classList.remove('show');
    selectedEvent = null;
};

// 색상 선택 함수
function selectEventColor(color, backgroundColor) {
    selectedEventColor = color;
    selectedEventBg = backgroundColor;
    
    // 모든 색상 옵션에서 active 클래스 제거
    document.querySelectorAll('.color-option').forEach(option => {
        option.classList.remove('active');
    });
    
    // 선택된 색상에 active 클래스 추가
    const selectedOption = document.querySelector(`[data-color="${color}"]`);
    if (selectedOption) {
        selectedOption.classList.add('active');
    }
}

// 이벤트 상세보기
function showEventDetail(event) {
    selectedEvent = event;
    
    document.getElementById('event-detail-color').style.backgroundColor = event.color;
    document.getElementById('event-detail-title').textContent = event.title;
    document.getElementById('event-detail-type').textContent = event.type;
    document.getElementById('event-detail-date').textContent = formatEventDate(event);
    document.getElementById('event-detail-time').textContent = formatEventTime(event);
    document.getElementById('event-detail-creator').textContent = event.createdByName || event.createdByEmail || '알 수 없음';
    document.getElementById('event-detail-participants').textContent = event.participants || '-';
    document.getElementById('event-detail-desc').textContent = event.description || '상세 설명이 없습니다.';
    
    document.getElementById('event-detail-modal').classList.add('show');
}

// 이벤트 상세보기 모달 숨기기
window.hideEventDetailModal = function() {
    document.getElementById('event-detail-modal').classList.remove('show');
    selectedEvent = null;
};

// 이벤트 수정
window.editEvent = function() {
    if (!selectedEvent) return;
    
    hideEventDetailModal();
    
    // 폼에 기존 데이터 채우기
    document.getElementById('event-modal-title').textContent = '일정 수정';
    document.getElementById('event-title').value = selectedEvent.title;
    document.getElementById('event-type').value = selectedEvent.type;
    document.getElementById('event-start-date').value = selectedEvent.startDate;
    document.getElementById('event-start-time').value = selectedEvent.startTime || '';
    document.getElementById('event-end-date').value = selectedEvent.endDate || selectedEvent.startDate;
    document.getElementById('event-end-time').value = selectedEvent.endTime || '';
    document.getElementById('event-description').value = selectedEvent.description || '';
    document.getElementById('event-participants').value = selectedEvent.participants || '';
    
    // 색상 선택
    selectEventColor(selectedEvent.color, selectedEvent.backgroundColor);
    
    document.getElementById('event-modal').classList.add('show');
};

// 이벤트 삭제
window.deleteEvent = function() {
    if (!selectedEvent) return;
    
    if (!confirm('정말로 이 일정을 삭제하시겠습니까?')) {
        return;
    }
    
    const eventRef = ref(database, `shared-calendar-events/${selectedEvent.id}`);
    remove(eventRef)
        .then(() => {
            hideEventDetailModal();
            showMessage('일정이 삭제되었습니다.', 'success');
        })
        .catch((error) => {
            console.error('일정 삭제 실패:', error);
            showMessage('일정 삭제 중 오류가 발생했습니다.', 'error');
        });
};

// 캘린더 통계 업데이트
function updateCalendarStats() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const today = now.toISOString().split('T')[0];
    
    // 이번 달 일정 개수
    const monthEvents = sharedCalendarEvents.filter(event => {
        const eventDate = new Date(event.startDate);
        return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear;
    });
    
    // 오늘 일정 개수
    const todayEvents = sharedCalendarEvents.filter(event => {
        return event.startDate === today || 
               (event.endDate && today >= event.startDate && today <= event.endDate);
    });
    
    // 연차/휴가 개수
    const vacationEvents = sharedCalendarEvents.filter(event => 
        event.type === '연차' || event.type === '휴가'
    );
    
    // 업무 일정 개수
    const workEvents = sharedCalendarEvents.filter(event => 
        event.type === '업무'
    );
    
    // DOM 업데이트
    document.getElementById('month-events-count').textContent = monthEvents.length;
    document.getElementById('today-events-count').textContent = todayEvents.length;
    document.getElementById('vacation-events-count').textContent = vacationEvents.length;
    document.getElementById('work-events-count').textContent = workEvents.length;
}

// 날짜 포맷팅
function formatEventDate(event) {
    if (event.endDate && event.endDate !== event.startDate) {
        return `${event.startDate} ~ ${event.endDate}`;
    }
    return event.startDate;
}

// 시간 포맷팅
function formatEventTime(event) {
    if (event.startTime && event.endTime) {
        return `${event.startTime} - ${event.endTime}`;
    } else if (event.startTime) {
        return `${event.startTime}부터`;
    } else if (event.endTime) {
        return `${event.endTime}까지`;
    }
    return '종일';
}

// 색상 대비 계산 (텍스트 색상 결정)
function getContrastColor(hexColor) {
    // hex를 RGB로 변환
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    
    // 밝기 계산
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    return brightness > 128 ? '#000000' : '#ffffff';
}

// =============================================
// 사분면 선택 및 매트릭스 통합 함수들
// =============================================

// 사분면 선택 모달 숨기기
window.hideQuadrantModal = function() {
    document.getElementById('quadrant-modal').classList.remove('show');
    selectedWorkForMatrix = null;
};

// 매트릭스에 업무 추가
window.addToMatrix = function(quadrant) {
    if (!selectedWorkForMatrix || !currentUser) {
        showMessage('오류가 발생했습니다.', 'error');
        return;
    }

    const personalTask = {
        id: Date.now().toString(),
        text: selectedWorkForMatrix.workName,
        completed: false,
        createdAt: new Date().toISOString(),
        isFromShared: true,
        originalWorkId: selectedWorkForMatrix.id,
        originalCategory: selectedWorkForMatrix.category,
        originalTargetDept: selectedWorkForMatrix.targetDept,
        originalStatus: selectedWorkForMatrix.status,
        originalStartDate: selectedWorkForMatrix.startDate,
        originalEndDate: selectedWorkForMatrix.endDate
    };

    personalTasks[quadrant].push(personalTask);
    renderPersonalTasks();
    updateMatrixStats();
    savePersonalTasks();
    
    hideQuadrantModal();
    showMessage(`업무가 ${getQuadrantName(quadrant)} 사분면에 추가되었습니다! 🎯`, 'success');
    
    // 매트릭스 뷰로 전환
    switchView('matrix');
};

// =============================================
// 드래그 앤 드롭 관련 함수들
// =============================================

// 드래그 앤 드롭 설정
function setupDragAndDrop() {
    // 모든 task-item에 드래그 이벤트 리스너 추가
    document.querySelectorAll('.task-item').forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
    });

    // 모든 quadrant에 드롭 이벤트 리스너 추가
    document.querySelectorAll('.quadrant').forEach(quadrant => {
        quadrant.addEventListener('dragover', handleDragOver);
        quadrant.addEventListener('dragenter', handleDragEnter);
        quadrant.addEventListener('dragleave', handleDragLeave);
        quadrant.addEventListener('drop', handleDrop);
    });
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

// 업무 이동
function moveTask(fromQuadrant, toQuadrant, taskId) {
    const taskIndex = personalTasks[fromQuadrant].findIndex(t => t.id === taskId);
    if (taskIndex !== -1) {
        const task = personalTasks[fromQuadrant][taskIndex];
        
        personalTasks[fromQuadrant].splice(taskIndex, 1);
        personalTasks[toQuadrant].push(task);
        
        renderPersonalTasks();
        updateMatrixStats();
        savePersonalTasks();
        
        showMessage(`업무를 ${getQuadrantName(toQuadrant)} 사분면으로 이동했습니다.`, 'success');
    }
}

// =============================================
// 통계 및 업데이트 함수들
// =============================================

// 대시보드 통계 업데이트
function updateDashboardStats() {
    const totalCount = sharedAuditTasks.length;
    const completedCount = sharedAuditTasks.filter(task => task.status === '보고완료').length;
    const progressCount = totalCount - completedCount;
    
    // 내 업무 개수 계산
    const myTaskCount = Object.values(personalTasks).reduce((total, tasks) => total + tasks.length, 0);
    
    document.getElementById('total-work-count').textContent = totalCount;
    document.getElementById('progress-work-count').textContent = progressCount;
    document.getElementById('completed-work-count').textContent = completedCount;
    document.getElementById('my-work-count').textContent = myTaskCount;
}

// 매트릭스 통계 업데이트
function updateMatrixStats() {
    const stats = {
        total: 0,
        completed: 0,
        byQuadrant: { 1: 0, 2: 0, 3: 0, 4: 0 }
    };

    Object.keys(personalTasks).forEach(quadrant => {
        if (personalTasks[quadrant] && Array.isArray(personalTasks[quadrant])) {
            personalTasks[quadrant].forEach(task => {
                stats.total++;
                stats.byQuadrant[quadrant]++;
                if (task.completed) {
                    stats.completed++;
                }
            });
        }
    });

    const progress = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
    
    // 통계 표시 업데이트
    const totalTasksEl = document.getElementById('total-tasks');
    const completedTasksEl = document.getElementById('completed-tasks');
    const pendingTasksEl = document.getElementById('pending-tasks');
    const progressTextEl = document.getElementById('progress-text');
    
    if (totalTasksEl) totalTasksEl.textContent = stats.total;
    if (completedTasksEl) completedTasksEl.textContent = stats.completed;
    if (pendingTasksEl) pendingTasksEl.textContent = stats.total - stats.completed;
    if (progressTextEl) progressTextEl.textContent = `${progress}%`;
    
    // 사분면별 통계 업데이트
    document.getElementById('q1-count').textContent = stats.byQuadrant[1];
    document.getElementById('q2-count').textContent = stats.byQuadrant[2];
    document.getElementById('q3-count').textContent = stats.byQuadrant[3];
    document.getElementById('q4-count').textContent = stats.byQuadrant[4];
    
    // 진행률 원형 차트 업데이트
    const circle = document.getElementById('progress-circle');
    if (circle) {
        const circumference = 2 * Math.PI * 35;
        const offset = circumference - (progress / 100) * circumference;
        circle.style.strokeDasharray = circumference;
        circle.style.strokeDashoffset = offset;
    }
}

// =============================================
// 유틸리티 함수들
// =============================================

// 상태 메시지 표시
function showMessage(message, type = 'success') {
    const messageEl = document.getElementById('status-message');
    messageEl.textContent = message;
    messageEl.className = `status-message ${type} show`;
    
    setTimeout(() => {
        messageEl.classList.remove('show');
    }, 3000);
}

// 날짜 범위 포맷팅
function formatDateRange(startDate, endDate) {
    if (!startDate && !endDate) return '-';
    if (!endDate) return startDate || '-';
    if (!startDate) return endDate || '-';
    return `${startDate} ~ ${endDate}`;
}

// 상태 클래스 가져오기
function getStatusClass(status) {
    const statusClasses = {
        '계획수립중': 'status-planning',
        '자료수집중': 'status-collecting',
        '자료검토중': 'status-reviewing',
        '보고서작성중': 'status-writing',
        '보고대기중': 'status-waiting',
        '보고완료': 'status-completed'
    };
    return statusClasses[status] || '';
}

// 사분면 이름 가져오기
function getQuadrantName(quadrant) {
    const names = {
        1: 'DO (즉시 실행)',
        2: 'PLAN (계획 수립)', 
        3: 'DELEGATE (위임)',
        4: 'DELETE (제거)'
    };
    return names[quadrant];
}

// 날짜 포맷팅
function formatDate(dateStr) {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}년 ${month}월 ${day}일`;
}

// 검색어 하이라이트
function highlightSearchTerm(text, searchTerm) {
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<mark style="background: #fef3c7; padding: 2px 4px; border-radius: 4px;">$1</mark>');
}

// 완료 축하 메시지
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

// 팁 표시
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

// =============================================
// 이벤트 리스너 설정
// =============================================

// 인증 관련 이벤트 리스너
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

// 업무 폼 제출 처리
document.getElementById('work-form-element').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
        showMessage('로그인이 필요합니다.', 'error');
        return;
    }

    const form = e.target;
    const isEditMode = form.dataset.editMode === 'true';
    const editId = form.dataset.editId;

    const formData = {
        category: document.getElementById('work-category').value,
        workName: document.getElementById('work-name').value,
        targetDept: document.getElementById('target-dept').value,
        responsiblePerson: document.getElementById('responsible-person').value,
        status: document.getElementById('work-status').value,
        startDate: document.getElementById('start-date').value,
        endDate: document.getElementById('end-date').value,
        description: document.getElementById('work-description').value,
        keyIssues: document.getElementById('key-issues').value,
        lastUpdated: new Date().toISOString()
    };

    try {
        if (isEditMode && editId) {
            // 수정 모드
            const workRef = ref(database, `shared-audit-tasks/${editId}`);
            const existingData = sharedAuditTasks.find(task => task.id === editId);
            
            await set(workRef, { 
                ...existingData, 
                ...formData,
                updatedBy: userId,
                updatedByEmail: currentUser.email
            });
            showMessage('업무가 성공적으로 수정되었습니다! ✏️', 'success');
            
            // 편집 모드 해제
            form.removeAttribute('data-edit-mode');
            form.removeAttribute('data-edit-id');
        } else {
            // 새 업무 등록
            const tasksRef = ref(database, 'shared-audit-tasks');
            await push(tasksRef, {
                ...formData,
                createdBy: userId,
                createdByEmail: currentUser.email,
                createdAt: new Date().toISOString()
            });
            showMessage('업무가 성공적으로 등록되었습니다! 🎉', 'success');
        }
        
        hideWorkForm();
    } catch (error) {
        console.error('업무 저장 실패:', error);
        showMessage('업무 저장 중 오류가 발생했습니다.', 'error');
    }
});

// 검색 입력 이벤트
document.getElementById('search-tasks').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        searchTasks();
    }
});

// 날짜 변경 이벤트 리스너
document.getElementById('task-date').addEventListener('change', loadPersonalTasks);

// 모달 외부 클릭 시 닫기
document.getElementById('quadrant-modal').addEventListener('click', function(e) {
    if (e.target === this) {
        hideQuadrantModal();
    }
});

document.getElementById('calendar-modal').addEventListener('click', function(e) {
    if (e.target === this) {
        toggleCalendar();
    }
});

document.getElementById('search-modal').addEventListener('click', function(e) {
    if (e.target === this) {
        toggleSearchModal();
    }
});

// 새로 추가된 모달들
document.addEventListener('DOMContentLoaded', function() {
    const eventModal = document.getElementById('event-modal');
    const eventDetailModal = document.getElementById('event-detail-modal');
    
    if (eventModal) {
        eventModal.addEventListener('click', function(e) {
            if (e.target === this) {
                hideEventModal();
            }
        });
    }
    
    if (eventDetailModal) {
        eventDetailModal.addEventListener('click', function(e) {
            if (e.target === this) {
                hideEventDetailModal();
            }
        });
    }
});

// =============================================
// 초기화
// =============================================

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    const today = new Date().toISOString().split('T')[0];
    const taskDateInput = document.getElementById('task-date');
    const startDateInput = document.getElementById('start-date');
    
    if (taskDateInput) taskDateInput.value = today;
    if (startDateInput) startDateInput.value = today;
    
    console.log('🎯 통합 감사업무 매트릭스 시스템이 로드되었습니다!');
});

console.log('통합 감사업무 매트릭스 애플리케이션이 초기화되었습니다.');
