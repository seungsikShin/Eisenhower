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

// 관리자 권한 설정
const ADMIN_USERS = [
    'admin@company.com',
    'sssblack87@gmail.com',  // 현재 사용자
    'manager@company.com',
    'supervisor@company.com'
];

// =============================================
// 권한 관리 함수들
// =============================================

// 관리자 권한 확인
function isAdmin(userEmail) {
    return ADMIN_USERS.includes(userEmail?.toLowerCase());
}

// 편집 권한 확인 (본인 또는 관리자)
function hasEditPermission(itemCreatorId, itemCreatorEmail) {
    const currentUserEmail = currentUser?.email;
    
    // 본인이 작성한 경우
    if (itemCreatorId === userId || itemCreatorEmail === currentUserEmail) {
        return true;
    }
    
    // 관리자인 경우
    if (isAdmin(currentUserEmail)) {
        return true;
    }
    
    return false;
}

// 사용자 권한 표시
function getUserRoleDisplay(userEmail) {
    if (isAdmin(userEmail)) {
        return '👑 관리자';
    }
    return '👤 일반';
}

// =============================================
// 인증 관련 함수들
// =============================================

// 인증 상태 변화 감지
onAuthStateChanged(auth, (user) => {
    console.log('인증 상태 변화 감지:', user ? user.email : '로그아웃');
    
    if (user) {
        currentUser = user;
        userId = user.uid;
        
        // 사용자 데이터 로드 후 메인 화면 표시
        loadUserData(user.uid).then(() => {
            showMainApp();
            
            // 데이터 로드
            setTimeout(() => {
                loadSharedAuditTasks();
                loadPersonalTasks();
                loadDatesWithData();
                renderMiniCalendar();
                console.log('모든 데이터 로드 완료');
            }, 100);
        }).catch((error) => {
            console.error('사용자 데이터 로드 실패:', error);
            showMainApp(); // 에러가 있어도 메인 화면은 표시
        });
        
        console.log('사용자 로그인됨:', user.email);
    } else {
        currentUser = null;
        userId = null;
        showAuthScreen();
        console.log('사용자 로그아웃됨');
    }
});

// 사용자 데이터 로드 함수
async function loadUserData(uid) {
    try {
        const userRef = ref(database, `users/${uid}`);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
            const userData = snapshot.val();
            const userNameEl = document.getElementById('user-name');
            if (userNameEl) {
                userNameEl.textContent = userData.name || currentUser.email;
            }
            currentUser.displayName = userData.name;
        } else {
            const userNameEl = document.getElementById('user-name');
            if (userNameEl) {
                userNameEl.textContent = currentUser.email;
            }
        }
        console.log('사용자 데이터 로드 성공');
        return Promise.resolve();
    } catch (error) {
        console.error('사용자 데이터 로드 오류:', error);
        const userNameEl = document.getElementById('user-name');
        if (userNameEl) {
            userNameEl.textContent = currentUser.email;
        }
        return Promise.resolve(); // 에러가 있어도 resolve
    }
}

// 화면 전환 함수들
function showAuthScreen() {
    const authContainer = document.getElementById('auth-container');
    const mainApp = document.getElementById('main-app');
    
    if (authContainer) authContainer.style.display = 'flex';
    if (mainApp) {
        mainApp.classList.remove('show');
        mainApp.style.display = 'none';
    }
    console.log('인증 화면 표시됨');
}

function showMainApp() {
    const authContainer = document.getElementById('auth-container');
    const mainApp = document.getElementById('main-app');
    
    if (authContainer) authContainer.style.display = 'none';
    if (mainApp) {
        mainApp.classList.add('show');
        mainApp.style.display = 'block';
    }
    
    // 데이터 로드
    loadSharedAuditTasks();
    loadPersonalTasks();
    loadSharedCalendarEvents();
    
    // 차트 초기화 (Chart.js가 로드된 경우에만)
    setTimeout(() => {
        if (window.Chart && typeof initializeCharts === 'function') {
            initializeCharts();
        }
    }, 500);
    
    console.log('메인 앱 화면 표시됨');
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
    
    // 클릭된 버튼에 active 클래스 추가
    const clickedButton = Array.from(document.querySelectorAll('.nav-tab')).find(tab => 
        tab.textContent.includes(viewName === 'dashboard' ? '대시보드' : 
                                  viewName === 'calendar' ? '일정' : '매트릭스')
    );
    if (clickedButton) {
        clickedButton.classList.add('active');
    }

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
    
    console.log(`뷰 전환됨: ${viewName}`);
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

    tableBody.innerHTML = filteredTasks.map(task => {
        // 편집 권한 확인
        const canEdit = hasEditPermission(task.createdBy, task.createdByEmail);
        
        return `
        <tr>
            <td>${task.category || '-'}</td>
            <td style="font-weight: 600;">
                <span class="work-name-clickable" onclick="showWorkQuickView('${task.id}')" title="클릭하여 상세정보 및 댓글 보기">
                    ${task.workName || '-'}
                </span>
            </td>
            <td>${task.targetDept || '-'}</td>
            <td>${formatDateRange(task.startDate, task.endDate)}</td>
            <td><span class="status-badge ${getStatusClass(task.status)}">${task.status || '-'}</span></td>
            <td>
                ${task.responsiblePerson || '-'}
                ${isAdmin(currentUser?.email) ? '<br><small style="color: #6b7280;">👑 관리자 권한</small>' : ''}
            </td>
            <td>
                <div class="action-btns">
                    <button class="btn-comment" onclick="showWorkComments('${task.id}')">💬 댓글</button>
                    <button class="btn-import" onclick="importToMatrix('${task.id}')">📥 가져오기</button>
                    ${canEdit ? `<button class="btn-edit" onclick="editWork('${task.id}')">✏️ 수정</button>` : ''}
                    ${canEdit ? `<button class="btn-delete" onclick="deleteWork('${task.id}')">🗑️ 삭제</button>` : ''}
                </div>
            </td>
        </tr>
        `;
    }).join('');
}

// 업무 폼 표시/숨기기
window.showWorkForm = function() {
    document.getElementById('work-form').classList.add('show');
    document.getElementById('work-form').scrollIntoView({ behavior: 'smooth' });
    
    // 담당자 필드에 현재 사용자 이름 자동 입력
    if (currentUser) {
        const userName = currentUser.displayName || currentUser.email;
        document.getElementById('responsible-person').value = userName;
    }
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

// =============================================
// 댓글 및 업무 이력 관리 기능
// =============================================

// 댓글 관련 변수
let currentWorkComments = [];
let currentWorkHistory = [];
let selectedWorkId = null;
let currentWorkId = null;

// 댓글 모달 표시
window.showWorkComments = function(workId) {
    console.log('💬 댓글 모달 표시:', workId);
    
    const work = sharedAuditTasks.find(task => task.id === workId);
    if (!work) {
        showMessage('업무를 찾을 수 없습니다.', 'error');
        return;
    }
    
    selectedWorkId = workId;
    
    // 모달 제목 설정
    document.getElementById('comment-work-title').textContent = `${work.workName} - 댓글`;
    
    // 댓글과 이력 로드
    loadWorkComments(workId);
    loadWorkHistory(workId);
    
    // 모달 표시
    document.getElementById('comment-modal').classList.add('show');
};

// 댓글 모달 숨기기
window.hideCommentModal = function() {
    document.getElementById('comment-modal').classList.remove('show');
    document.getElementById('comment-input').value = '';
    selectedWorkId = null;
    currentWorkComments = [];
    currentWorkHistory = [];
};

// 사용자 표시 이름 가져오기 (이름 우선, 없으면 이메일)
async function getUserDisplayName(email) {
    if (!email) return '익명';
    
    // 이메일에서 @ 앞부분을 이름으로 사용
    const namePart = email.split('@')[0];
    
    // 한글 이름 패턴인지 확인 (간단한 방법)
    const koreanPattern = /[가-힣]/;
    if (koreanPattern.test(namePart)) {
        return namePart;
    }
    
    // 영문이면 첫 글자만 대문자로
    return namePart.charAt(0).toUpperCase() + namePart.slice(1);
}

// 시간 전 표시 함수
function getTimeAgo(dateString) {
    const now = new Date();
    const past = new Date(dateString);
    const diff = now - past;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}일 전`;
    if (hours > 0) return `${hours}시간 전`;
    if (minutes > 0) return `${minutes}분 전`;
    return '방금 전';
}

// 업무 퀵뷰 모달 표시
window.showWorkQuickView = async function(workId) {
    console.log('👁️ 업무 퀵뷰 표시 중:', workId);
    
    try {
        currentWorkId = workId;
        
        // 업무 정보 가져오기
        const work = sharedAuditTasks.find(task => task.id === workId);
        if (!work) {
            showMessage('업무를 찾을 수 없습니다.', 'error');
            return;
        }
        
        // 업무 정보 표시
        document.getElementById('quickview-work-title').textContent = work.workName || '업무명 없음';
        document.getElementById('quickview-category').textContent = work.category || '-';
        document.getElementById('quickview-target-dept').textContent = work.targetDept || '-';
        document.getElementById('quickview-period').textContent = formatDateRange(work.startDate, work.endDate);
        document.getElementById('quickview-responsible').textContent = work.responsiblePerson || '-';
        
        // 상태 배지
        const statusElement = document.getElementById('quickview-status');
        statusElement.textContent = work.status || '-';
        statusElement.className = `status-badge ${getStatusClass(work.status)}`;
        
        // 등록자 이름 표시
        const creatorName = await getUserDisplayName(work.createdByEmail);
        document.getElementById('quickview-creator').textContent = creatorName;
        
        // 설명 및 지적사항 (있는 경우)
        const descSection = document.getElementById('quickview-description-section');
        const issuesSection = document.getElementById('quickview-issues-section');
        
        if (work.description && work.description.trim()) {
            document.getElementById('quickview-description').textContent = work.description;
            descSection.style.display = 'block';
        } else {
            descSection.style.display = 'none';
        }
        
        if (work.keyIssues && work.keyIssues.trim()) {
            document.getElementById('quickview-issues').textContent = work.keyIssues;
            issuesSection.style.display = 'block';
        } else {
            issuesSection.style.display = 'none';
        }
        
        // 댓글 로드 및 표시
        await loadQuickViewComments(workId);
        
        // 모달 표시
        document.getElementById('work-quickview-modal').style.display = 'block';
        
    } catch (error) {
        console.error('퀵뷰 모달 표시 오류:', error);
        showMessage('업무 정보 로드 중 오류가 발생했습니다.', 'error');
    }
};

// 퀵뷰 모달 숨기기
window.hideWorkQuickView = function() {
    document.getElementById('work-quickview-modal').style.display = 'none';
    currentWorkId = null;
};

// 퀵뷰 댓글 로드
async function loadQuickViewComments(workId) {
    try {
        const commentsRef = ref(database, `work-comments/${workId}`);
        const snapshot = await get(commentsRef);
        
        const commentsList = document.getElementById('quickview-comments-list');
        const commentsCount = document.getElementById('quickview-comments-count');
        
        if (!snapshot.exists()) {
            commentsList.innerHTML = '<div class="no-comments">아직 댓글이 없습니다.</div>';
            commentsCount.textContent = '0개';
            return;
        }
        
        const comments = Object.entries(snapshot.val() || {})
            .map(([id, comment]) => ({ id, ...comment }))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        commentsCount.textContent = `${comments.length}개`;
        
        if (comments.length === 0) {
            commentsList.innerHTML = '<div class="no-comments">아직 댓글이 없습니다.</div>';
            return;
        }
        
        // 최근 3개 댓글만 표시
        const recentComments = comments.slice(0, 3);
        
        const commentsHTML = await Promise.all(recentComments.map(async comment => {
            const authorName = await getUserDisplayName(comment.authorEmail);
            const timeAgo = getTimeAgo(comment.createdAt);
            
            return `
                <div class="comment-item-compact">
                    <div class="comment-header-compact">
                        <span class="comment-author-compact">${authorName}</span>
                        <span class="comment-date-compact">${timeAgo}</span>
                    </div>
                    <div class="comment-content-compact">${escapeHtml(comment.content)}</div>
                </div>
            `;
        }));
        
        commentsList.innerHTML = commentsHTML.join('');
        
        if (comments.length > 3) {
            commentsList.innerHTML += `<div style="text-align: center; margin-top: 8px; color: #6b7280; font-size: 11px;">+${comments.length - 3}개 더 보기</div>`;
        }
        
    } catch (error) {
        console.error('퀵뷰 댓글 로드 오류:', error);
    }
}

// 퀵뷰에서 댓글 추가
window.addQuickViewComment = async function() {
    const content = document.getElementById('quickview-comment-input').value.trim();
    
    if (!content) {
        showMessage('댓글 내용을 입력하세요.', 'error');
        return;
    }
    
    if (!currentWorkId) {
        showMessage('업무 정보를 찾을 수 없습니다.', 'error');
        return;
    }
    
    try {
        if (!currentUser) {
            showMessage('로그인이 필요합니다.', 'error');
            return;
        }
        
        const commentData = {
            content: content,
            authorId: userId,
            authorName: currentUser.displayName || null,
            authorEmail: currentUser.email,
            createdAt: new Date().toISOString(),
            workId: currentWorkId
        };
        
        const commentRef = push(ref(database, `work-comments/${currentWorkId}`));
        await set(commentRef, commentData);
        
        // 댓글 입력창 초기화
        document.getElementById('quickview-comment-input').value = '';
        
        // 댓글 목록 새로고침
        await loadQuickViewComments(currentWorkId);
        
        showMessage('댓글이 등록되었습니다.', 'success');
        
    } catch (error) {
        console.error('퀵뷰 댓글 추가 오류:', error);
        showMessage('댓글 등록 중 오류가 발생했습니다.', 'error');
    }
};

// 퀵뷰에서 상세댓글 보기로 이동
window.openFullComments = function() {
    hideWorkQuickView();
    showWorkComments(currentWorkId);
};

// 퀵뷰에서 수정하기
window.editWorkFromQuickView = function() {
    hideWorkQuickView();
    editWork(currentWorkId);
};

// 댓글 로드
function loadWorkComments(workId) {
    const commentsRef = ref(database, `work-comments/${workId}`);
    
    onValue(commentsRef, (snapshot) => {
        currentWorkComments = [];
        if (snapshot.exists()) {
            const data = snapshot.val();
            Object.keys(data).forEach(key => {
                currentWorkComments.push({
                    id: key,
                    ...data[key]
                });
            });
        }
        
        // 시간순 정렬 (최신 댓글이 아래로)
        currentWorkComments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        renderComments();
    });
}

// 업무 변경 이력 로드
function loadWorkHistory(workId) {
    const historyRef = ref(database, `work-history/${workId}`);
    
    onValue(historyRef, (snapshot) => {
        currentWorkHistory = [];
        if (snapshot.exists()) {
            const data = snapshot.val();
            Object.keys(data).forEach(key => {
                currentWorkHistory.push({
                    id: key,
                    ...data[key]
                });
            });
        }
        
        // 시간순 정렬 (최신 이력이 위로)
        currentWorkHistory.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        renderWorkHistory();
    });
}

// 댓글 렌더링
async function renderComments() {
    const commentsList = document.getElementById('comments-list');
    
    if (currentWorkComments.length === 0) {
        commentsList.innerHTML = '<div class="no-comments">아직 댓글이 없습니다. 첫 번째 댓글을 남겨보세요!</div>';
        return;
    }
    
    const commentsHTML = await Promise.all(currentWorkComments.map(async comment => {
        const authorName = await getUserDisplayName(comment.authorEmail);
        
        return `
            <div class="comment-item">
                <div class="comment-header">
                    <span class="comment-author">${authorName}</span>
                    <span class="comment-time">${formatCommentTime(comment.createdAt)}</span>
                </div>
                <div class="comment-content">${escapeHtml(comment.content)}</div>
            </div>
        `;
    }));
    
    commentsList.innerHTML = commentsHTML.join('');
    
    // 스크롤을 아래로
    commentsList.scrollTop = commentsList.scrollHeight;
}

// 업무 변경 이력 렌더링
async function renderWorkHistory() {
    const historyList = document.getElementById('work-history-list');
    
    if (currentWorkHistory.length === 0) {
        historyList.innerHTML = '<div class="no-history">아직 변경 이력이 없습니다.</div>';
        return;
    }
    
    const historyHTML = await Promise.all(currentWorkHistory.map(async history => {
        const userName = await getUserDisplayName(history.userEmail);
        
        return `
            <div class="history-item">
                <div class="history-header">
                    <span class="history-action">${history.action}</span>
                    <span class="history-time">${formatCommentTime(history.createdAt)}</span>
                </div>
                <div class="history-details">
                    <strong>${userName}</strong>이(가) 
                    ${history.details || '업무를 변경했습니다.'}
                    ${history.changes ? renderHistoryChanges(history.changes) : ''}
                </div>
            </div>
        `;
    }));
    
    historyList.innerHTML = historyHTML.join('');
}

// 이력 변경사항 렌더링
function renderHistoryChanges(changes) {
    if (!changes || typeof changes !== 'object') return '';
    
    return Object.entries(changes).map(([field, change]) => {
        if (change.from === change.to) return '';
        return `<div class="history-change">
            <strong>${getFieldDisplayName(field)}:</strong> 
            "${change.from || '없음'}" → "${change.to || '없음'}"
        </div>`;
    }).filter(Boolean).join('');
}

// 필드명 한글 변환
function getFieldDisplayName(field) {
    const fieldNames = {
        'workName': '업무명',
        'category': '업무분류',
        'targetDept': '대상부서',
        'responsiblePerson': '담당자',
        'status': '진행상태',
        'startDate': '시작일자',
        'endDate': '종료일자',
        'description': '업무설명',
        'keyIssues': '주요지적사항'
    };
    return fieldNames[field] || field;
}

// 댓글 추가 (이름 저장)
window.addComment = function() {
    if (!selectedWorkId || !currentUser) {
        showMessage('로그인이 필요합니다.', 'error');
        return;
    }
    const commentInput = document.getElementById('comment-input');
    const content = commentInput.value.trim();
    if (!content) {
        showMessage('댓글 내용을 입력해주세요.', 'error');
        return;
    }
    const submitBtn = document.querySelector('.btn-comment-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = '등록 중...';
    const commentData = {
        content: content,
        authorId: userId,
        authorName: currentUser.displayName || null,
        authorEmail: currentUser.email,
        createdAt: new Date().toISOString(),
        workId: selectedWorkId
    };
    const commentsRef = ref(database, `work-comments/${selectedWorkId}`);
    const newCommentRef = push(commentsRef);
    set(newCommentRef, commentData)
        .then(() => {
            console.log('✅ 댓글 추가 성공');
            commentInput.value = '';
            showMessage('댓글이 추가되었습니다! 💬', 'success');
        })
        .catch((error) => {
            console.error('❌ 댓글 추가 실패:', error);
            showMessage('댓글 추가 중 오류가 발생했습니다.', 'error');
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = '댓글 등록';
        });
};

// 업무 변경 이력 추가
function addWorkHistory(workId, action, details, changes = null) {
    if (!currentUser) return;
    
    const historyData = {
        action: action,
        details: details,
        changes: changes,
        userId: userId,
        userName: currentUser.displayName || null,
        userEmail: currentUser.email,
        createdAt: new Date().toISOString(),
        workId: workId
    };
    
    const historyRef = ref(database, `work-history/${workId}`);
    const newHistoryRef = push(historyRef);
    
    set(newHistoryRef, historyData)
        .then(() => {
            console.log('✅ 업무 이력 추가 성공:', action);
        })
        .catch((error) => {
            console.error('❌ 업무 이력 추가 실패:', error);
        });
}

// 시간 포맷팅
function formatCommentTime(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
        return '방금 전';
    } else if (diffInSeconds < 3600) {
        return `${Math.floor(diffInSeconds / 60)}분 전`;
    } else if (diffInSeconds < 86400) {
        return `${Math.floor(diffInSeconds / 3600)}시간 전`;
    } else if (diffInSeconds < 604800) {
        return `${Math.floor(diffInSeconds / 86400)}일 전`;
    } else {
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// HTML 이스케이프
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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
        updateCreatorFilter(); // 등록자 필터 업데이트
        renderMainCalendar();
        updateCalendarStats();
    });
}

// 필터링 변수
let calendarFilters = {
    creator: '',
    type: '',
    dateRange: ''
};

let filteredCalendarEvents = [];

// 필터링된 이벤트 반환
function getFilteredEvents() {
    let events = [...sharedCalendarEvents];
    
    // 등록자별 필터
    if (calendarFilters.creator) {
        events = events.filter(event => 
            event.createdByName === calendarFilters.creator || 
            event.createdByEmail === calendarFilters.creator
        );
    }
    
    // 일정 유형별 필터
    if (calendarFilters.type) {
        events = events.filter(event => event.type === calendarFilters.type);
    }
    
    // 날짜 범위 필터
    if (calendarFilters.dateRange) {
        const today = new Date();
        const koreaToday = new Date(today.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
        const todayStr = koreaToday.toISOString().split('T')[0];
        
        switch (calendarFilters.dateRange) {
            case 'today':
                events = events.filter(event => 
                    event.startDate === todayStr || 
                    (event.endDate && todayStr >= event.startDate && todayStr <= event.endDate)
                );
                break;
            case 'this-week':
                const startOfWeek = new Date(koreaToday);
                startOfWeek.setDate(koreaToday.getDate() - koreaToday.getDay());
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getDate() + 6);
                
                const weekStart = startOfWeek.toISOString().split('T')[0];
                const weekEnd = endOfWeek.toISOString().split('T')[0];
                
                events = events.filter(event => 
                    (event.startDate >= weekStart && event.startDate <= weekEnd) ||
                    (event.endDate && event.endDate >= weekStart && event.startDate <= weekEnd)
                );
                break;
            case 'this-month':
                const year = koreaToday.getFullYear();
                const month = koreaToday.getMonth();
                const monthStart = new Date(year, month, 1).toISOString().split('T')[0];
                const monthEnd = new Date(year, month + 1, 0).toISOString().split('T')[0];
                
                events = events.filter(event => 
                    (event.startDate >= monthStart && event.startDate <= monthEnd) ||
                    (event.endDate && event.endDate >= monthStart && event.startDate <= monthEnd)
                );
                break;
            case 'next-week':
                const nextWeekStart = new Date(koreaToday);
                nextWeekStart.setDate(koreaToday.getDate() + (7 - koreaToday.getDay()));
                const nextWeekEnd = new Date(nextWeekStart);
                nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
                
                const nextStart = nextWeekStart.toISOString().split('T')[0];
                const nextEnd = nextWeekEnd.toISOString().split('T')[0];
                
                events = events.filter(event => 
                    (event.startDate >= nextStart && event.startDate <= nextEnd) ||
                    (event.endDate && event.endDate >= nextStart && event.startDate <= nextEnd)
                );
                break;
        }
    }
    
    return events;
}

// 등록자 목록 업데이트
function updateCreatorFilter() {
    const creatorFilter = document.getElementById('creator-filter');
    if (!creatorFilter) return;
    
    const creators = [...new Set(sharedCalendarEvents.map(event => event.createdByName || event.createdByEmail).filter(Boolean))];
    
    // 기존 옵션 제거 (첫 번째 "모든 등록자" 옵션 제외)
    while (creatorFilter.children.length > 1) {
        creatorFilter.removeChild(creatorFilter.lastChild);
    }
    
    // 새로운 등록자 옵션 추가
    creators.forEach(creator => {
        const option = document.createElement('option');
        option.value = creator;
        option.textContent = creator;
        creatorFilter.appendChild(option);
    });
}

// 필터 적용
window.applyCalendarFilters = function() {
    console.log('🔍 필터 적용 중...');
    
    // 필터 값 읽기
    const creatorFilter = document.getElementById('creator-filter');
    const typeFilter = document.getElementById('type-filter');
    const dateFilter = document.getElementById('date-filter');
    
    calendarFilters.creator = creatorFilter ? creatorFilter.value : '';
    calendarFilters.type = typeFilter ? typeFilter.value : '';
    calendarFilters.dateRange = dateFilter ? dateFilter.value : '';
    
    console.log('적용된 필터:', calendarFilters);
    
    // 필터링된 이벤트 업데이트
    filteredCalendarEvents = getFilteredEvents();
    
    console.log(`전체 이벤트: ${sharedCalendarEvents.length}, 필터링된 이벤트: ${filteredCalendarEvents.length}`);
    
    // 캘린더 다시 렌더링
    renderMainCalendar();
    updateCalendarStats();
};

// 필터 초기화
window.resetCalendarFilters = function() {
    console.log('🔄 필터 초기화');
    
    calendarFilters = {
        creator: '',
        type: '',
        dateRange: ''
    };
    
    // UI 초기화
    const creatorFilter = document.getElementById('creator-filter');
    const typeFilter = document.getElementById('type-filter');
    const dateFilter = document.getElementById('date-filter');
    
    if (creatorFilter) creatorFilter.value = '';
    if (typeFilter) typeFilter.value = '';
    if (dateFilter) dateFilter.value = '';
    
    // 필터링 해제하고 캘린더 재렌더링
    filteredCalendarEvents = [];
    renderMainCalendar();
    updateCalendarStats();
};

// 필터 패널 토글
window.toggleFilterPanel = function() {
    const filterPanel = document.querySelector('.calendar-filters');
    const toggleBtn = document.querySelector('.btn-filter-toggle');
    
    if (filterPanel && toggleBtn) {
        filterPanel.classList.toggle('collapsed');
        
        if (filterPanel.classList.contains('collapsed')) {
            toggleBtn.innerHTML = '🔽 필터';
        } else {
            toggleBtn.innerHTML = '🔼 필터';
        }
    }
};

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
    const koreaToday = new Date();
    koreaToday.setHours(koreaToday.getHours() + 9); // UTC+9 (한국 시간)
    const today = koreaToday.toISOString().split('T')[0];
    
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
        
        // 해당 날짜의 이벤트들 표시 (필터링 적용)
        const eventsToShow = filteredCalendarEvents.length > 0 ? filteredCalendarEvents : sharedCalendarEvents;
        const dayEvents = eventsToShow.filter(event => {
            return event.startDate === dateStr || 
                   (event.endDate && dateStr >= event.startDate && dateStr <= event.endDate);
        });
        
        if (dayEvents.length > 0) {
            const eventsContainer = document.createElement('div');
            eventsContainer.className = 'day-events';
            
            dayEvents.slice(0, 4).forEach(event => {
                const eventElement = document.createElement('div');
                eventElement.className = 'day-event';
                
                // 배경색과 텍스트 색상 설정
                const bgColor = event.backgroundColor || event.color || '#3182ce';
                const textColor = getContrastColor(bgColor);
                
                eventElement.style.backgroundColor = bgColor;
                eventElement.style.color = textColor;
                eventElement.textContent = event.title;
                eventElement.title = `${event.title} (${event.type})`;
                
                // 드래그 앤 드롭 기능 (편집 권한이 있는 경우에만)
                const canEdit = hasEditPermission(event.createdBy, event.createdByEmail);
                if (canEdit) {
                    eventElement.draggable = true;
                    eventElement.dataset.eventId = event.id;
                    eventElement.dataset.originalDate = event.startDate;
                    eventElement.classList.add('draggable-event');
                    eventElement.title += ' (드래그하여 이동 가능)';
                    
                    // 드래그 이벤트 핸들러
                    eventElement.addEventListener('dragstart', handleEventDragStart);
                    eventElement.addEventListener('dragend', handleEventDragEnd);
                }
                
                // 이벤트 클릭 시 상세보기
                eventElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    console.log('일정 클릭됨:', event);
                    showEventDetail(event);
                });
                
                eventsContainer.appendChild(eventElement);
            });
            
            // 더 많은 이벤트가 있으면 표시
            if (dayEvents.length > 4) {
                const moreElement = document.createElement('div');
                moreElement.className = 'day-event more-events';
                moreElement.textContent = `+${dayEvents.length - 4}개 더`;
                eventsContainer.appendChild(moreElement);
            }
            
            dayElement.appendChild(eventsContainer);
        }
        
        // 드롭 존 설정
        dayElement.dataset.dateStr = dateStr;
        dayElement.addEventListener('dragover', handleCalendarDragOver);
        dayElement.addEventListener('dragenter', handleCalendarDragEnter);
        dayElement.addEventListener('dragleave', handleCalendarDragLeave);
        dayElement.addEventListener('drop', handleCalendarDrop);
        
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

// 이벤트 폼 표시 (한국 시간 기준으로 수정)
window.showEventForm = function(selectedDate = null) {
    console.log('showEventForm 호출됨, 새 일정 추가');
    const modal = document.getElementById('event-modal');
    const form = document.getElementById('event-form');
    
    // 폼 초기화 (새 일정 추가일 때만)
    form.reset();
    selectedEvent = null; // 새 일정 추가 시에만 null로 설정
    
    // 모달 제목 설정
    document.getElementById('event-modal-title').textContent = '새 일정 추가';
    
    // 선택된 날짜가 있으면 설정
    if (selectedDate) {
        document.getElementById('event-start-date').value = selectedDate;
        document.getElementById('event-end-date').value = selectedDate;
    } else {
        // 한국 시간 기준 오늘 날짜로 기본 설정
        const koreaToday = new Date();
        koreaToday.setHours(koreaToday.getHours() + 9); // UTC+9 (한국 시간)
        const today = koreaToday.toISOString().split('T')[0];
        document.getElementById('event-start-date').value = today;
        document.getElementById('event-end-date').value = today;
    }
    
    // 참석자 필드에 현재 사용자 이름 자동 입력
    if (currentUser) {
        const userName = currentUser.displayName || currentUser.email;
        document.getElementById('event-participants').value = userName;
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
    console.log('showEventDetail 호출됨:', event);
    selectedEvent = { ...event }; // 깊은 복사로 안전하게 저장
    
    document.getElementById('event-detail-color').style.backgroundColor = event.color || event.backgroundColor || '#3182ce';
    document.getElementById('event-detail-title').textContent = event.title || '제목 없음';
    document.getElementById('event-detail-type').textContent = event.type || '업무';
    document.getElementById('event-detail-date').textContent = formatEventDate(event);
    document.getElementById('event-detail-time').textContent = formatEventTime(event);
    
    // 작성자 표시 (관리자 권한 표시 포함)
    const creatorText = event.createdByName || event.createdByEmail || '알 수 없음';
    const isCreatorAdmin = isAdmin(event.createdByEmail);
    document.getElementById('event-detail-creator').innerHTML = 
        `${creatorText}${isCreatorAdmin ? ' <span style="color: #f59e0b;">👑</span>' : ''}`;
    
    document.getElementById('event-detail-participants').textContent = event.participants || '-';
    document.getElementById('event-detail-desc').textContent = event.description || '상세 설명이 없습니다.';
    
    // 수정/삭제 버튼 권한 확인 및 이벤트 리스너 설정
    const editBtn = document.querySelector('.btn-edit-event');
    const deleteBtn = document.querySelector('.btn-delete-event');
    
    // 편집 권한 확인 (본인 또는 관리자)
    const canEdit = hasEditPermission(event.createdBy, event.createdByEmail);
    
    if (currentUser && canEdit) {
        // 본인이 작성한 일정이거나 관리자인 경우 수정/삭제 가능
        if (editBtn) {
            editBtn.style.display = 'inline-block';
            // 기존 이벤트 리스너 제거 후 새로 추가
            editBtn.replaceWith(editBtn.cloneNode(true));
            const newEditBtn = document.querySelector('.btn-edit-event');
            newEditBtn.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('🔧 수정 버튼 클릭됨 (addEventListener)');
                editEvent();
            });
        }
        
        if (deleteBtn) {
            deleteBtn.style.display = 'inline-block';
            // 기존 이벤트 리스너 제거 후 새로 추가
            deleteBtn.replaceWith(deleteBtn.cloneNode(true));
            const newDeleteBtn = document.querySelector('.btn-delete-event');
            newDeleteBtn.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('🗑️ 삭제 버튼 클릭됨 (addEventListener)');
                deleteEvent();
            });
        }
    } else {
        // 다른 사람이 작성한 일정인 경우 버튼 숨김
        if (editBtn) editBtn.style.display = 'none';
        if (deleteBtn) deleteBtn.style.display = 'none';
    }
    
    document.getElementById('event-detail-modal').classList.add('show');
    console.log('selectedEvent 저장됨:', selectedEvent);
    console.log('현재 사용자:', userId, '일정 작성자:', event.createdBy);
}

// 이벤트 상세보기 모달 숨기기
window.hideEventDetailModal = function() {
    document.getElementById('event-detail-modal').classList.remove('show');
    selectedEvent = null;
};

// 이벤트 수정
window.editEvent = function() {
    console.log('🔧 editEvent 함수 호출됨');
    console.log('📋 selectedEvent:', selectedEvent);
    
    if (!selectedEvent) {
        console.error('❌ selectedEvent가 없습니다');
        showMessage('일정 정보를 찾을 수 없습니다.', 'error');
        return;
    }
    
    if (!currentUser) {
        console.error('❌ 로그인이 필요합니다');
        showMessage('로그인이 필요합니다.', 'error');
        return;
    }
    
    if (selectedEvent.createdBy !== userId) {
        console.error('❌ 권한이 없습니다', '작성자:', selectedEvent.createdBy, '현재사용자:', userId);
        showMessage('본인이 작성한 일정만 수정할 수 있습니다.', 'error');
        return;
    }
    
    try {
        hideEventDetailModal();
        
        // 폼에 기존 데이터 채우기
        console.log('📝 폼 데이터 설정 중...');
        document.getElementById('event-modal-title').textContent = '일정 수정';
        document.getElementById('event-title').value = selectedEvent.title || '';
        document.getElementById('event-type').value = selectedEvent.type || '업무';
        document.getElementById('event-start-date').value = selectedEvent.startDate || '';
        document.getElementById('event-start-time').value = selectedEvent.startTime || '';
        document.getElementById('event-end-date').value = selectedEvent.endDate || selectedEvent.startDate || '';
        document.getElementById('event-end-time').value = selectedEvent.endTime || '';
        document.getElementById('event-description').value = selectedEvent.description || '';
        document.getElementById('event-participants').value = selectedEvent.participants || '';
        
        // 색상 선택
        const eventColor = selectedEvent.color || '#e53e3e';
        const eventBg = selectedEvent.backgroundColor || '#fed7d7';
        console.log('🎨 색상 설정:', eventColor, eventBg);
        selectEventColor(eventColor, eventBg);
        
        // 모달 표시
        const modal = document.getElementById('event-modal');
        if (modal) {
            modal.classList.add('show');
            console.log('✅ 일정 수정 모달 표시됨');
        } else {
            console.error('❌ 모달 요소를 찾을 수 없습니다');
        }
        
    } catch (error) {
        console.error('❌ editEvent 오류:', error);
        showMessage('일정 수정 중 오류가 발생했습니다.', 'error');
    }
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

// 캘린더 통계 업데이트 (한국 시간 기준으로 수정)
function updateCalendarStats() {
    // 한국 시간 기준 오늘 날짜
    const koreaToday = new Date();
    koreaToday.setHours(koreaToday.getHours() + 9); // UTC+9 (한국 시간)
    const currentMonth = koreaToday.getMonth();
    const currentYear = koreaToday.getFullYear();
    const today = koreaToday.toISOString().split('T')[0];
    
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
    if (!hexColor || hexColor === '') {
        return '#ffffff';
    }
    
    // # 제거
    const color = hexColor.replace('#', '');
    
    // RGB 값 추출
    const r = parseInt(color.substr(0, 2), 16);
    const g = parseInt(color.substr(2, 2), 16);
    const b = parseInt(color.substr(4, 2), 16);
    
    // 상대적 휘도 계산 (WCAG 기준)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // 명암비가 높은 색상 반환
    return luminance > 0.6 ? '#000000' : '#ffffff';
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
    
    // 차트 업데이트
    updateDashboardCharts();
}

// =============================================
// 차트 관련 함수들
// =============================================

let categoryChart = null;
let statusChart = null;
let monthlyChart = null;

// 차트 초기화
function initializeCharts() {
    console.log('📊 차트 초기화 시작');
    
    try {
        // 업무 분류별 차트
        initCategoryChart();
        
        // 진행 상태별 차트
        initStatusChart();
        
        // 월별 추이 차트
        initMonthlyChart();
        
        console.log('✅ 차트 초기화 완료');
    } catch (error) {
        console.error('❌ 차트 초기화 실패:', error);
    }
}

// 업무 분류별 원형 차트
function initCategoryChart() {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;
    
    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['일상감사', '특별감사', '특정감사', '정기감사', '기타'],
            datasets: [{
                data: [0, 0, 0, 0, 0],
                backgroundColor: [
                    '#5b9df9',  // 파스텔 블루
                    '#6ee7b7',  // 파스텔 그린
                    '#fbbf24',  // 파스텔 오렌지
                    '#fda4af',  // 파스텔 핑크
                    '#a78bfa'   // 파스텔 퍼플
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? Math.round((context.parsed / total) * 100) : 0;
                            return `${context.label}: ${context.parsed}개 (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// 진행 상태별 막대 차트
function initStatusChart() {
    const ctx = document.getElementById('statusChart');
    if (!ctx) return;
    
    statusChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['계획수립중', '자료수집중', '자료검토중', '보고서작성중', '보고대기중', '보고완료'],
            datasets: [{
                label: '업무 수',
                data: [0, 0, 0, 0, 0, 0],
                backgroundColor: [
                    '#5b9df9',  // 파스텔 블루
                    '#fbbf24',  // 파스텔 오렌지
                    '#a78bfa',  // 파스텔 퍼플
                    '#6ee7b7',  // 파스텔 그린
                    '#fda4af',  // 파스텔 핑크
                    '#67e8f9'   // 파스텔 시안
                ],
                borderRadius: 6,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.parsed.y}개`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    },
                    grid: {
                        color: '#f3f4f6'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 45,
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

// 월별 업무 추이 라인 차트
function initMonthlyChart() {
    const ctx = document.getElementById('monthlyChart');
    if (!ctx) return;
    
    // 최근 6개월 레이블 생성
    const labels = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        labels.push(`${date.getFullYear()}년 ${date.getMonth() + 1}월`);
    }
    
    monthlyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '등록된 업무',
                data: [0, 0, 0, 0, 0, 0],
                borderColor: '#5b9df9',
                backgroundColor: 'rgba(91,157,249,0.12)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#5b9df9',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.parsed.y}개`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    },
                    grid: {
                        color: '#f3f4f6'
                    }
                },
                x: {
                    grid: {
                        color: '#f3f4f6'
                    },
                    ticks: {
                        font: {
                            size: 11
                        }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// 차트 데이터 업데이트
function updateDashboardCharts() {
    if (!sharedAuditTasks || sharedAuditTasks.length === 0) {
        console.log('📊 업무 데이터가 없어 차트를 초기화합니다.');
        resetCharts();
        return;
    }
    
    console.log('📊 차트 데이터 업데이트 중...', sharedAuditTasks.length, '개 업무');
    
    try {
        updateCategoryChartData();
        updateStatusChartData();
        updateMonthlyChartData();
    } catch (error) {
        console.error('❌ 차트 업데이트 실패:', error);
    }
}

// 업무 분류별 차트 데이터 업데이트
function updateCategoryChartData() {
    if (!categoryChart) return;
    
    const categories = ['일상감사', '특별감사', '특정감사', '정기감사', '기타'];
    const data = categories.map(category => 
        sharedAuditTasks.filter(task => task.category === category).length
    );
    
    categoryChart.data.datasets[0].data = data;
    categoryChart.update('active');
    
    console.log('📊 분류별 차트 업데이트:', data);
}

// 진행 상태별 차트 데이터 업데이트
function updateStatusChartData() {
    if (!statusChart) return;
    
    const statuses = ['계획수립중', '자료수집중', '자료검토중', '보고서작성중', '보고대기중', '보고완료'];
    const data = statuses.map(status => 
        sharedAuditTasks.filter(task => task.status === status).length
    );
    
    statusChart.data.datasets[0].data = data;
    statusChart.update('active');
    
    console.log('📊 상태별 차트 업데이트:', data);
}

// 월별 추이 차트 데이터 업데이트
function updateMonthlyChartData() {
    if (!monthlyChart) return;
    
    const now = new Date();
    const monthlyData = [];
    
    // 최근 6개월 데이터 계산
    for (let i = 5; i >= 0; i--) {
        const targetMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const count = sharedAuditTasks.filter(task => {
            if (!task.createdAt) return false;
            const taskDate = new Date(task.createdAt);
            return taskDate.getFullYear() === targetMonth.getFullYear() &&
                   taskDate.getMonth() === targetMonth.getMonth();
        }).length;
        monthlyData.push(count);
    }
    
    monthlyChart.data.datasets[0].data = monthlyData;
    monthlyChart.update('active');
    
    console.log('📊 월별 차트 업데이트:', monthlyData);
}

// 차트 초기화 (데이터 없을 때)
function resetCharts() {
    if (categoryChart) {
        categoryChart.data.datasets[0].data = [0, 0, 0, 0, 0];
        categoryChart.update('none');
    }
    
    if (statusChart) {
        statusChart.data.datasets[0].data = [0, 0, 0, 0, 0, 0];
        statusChart.update('none');
    }
    
    if (monthlyChart) {
        monthlyChart.data.datasets[0].data = [0, 0, 0, 0, 0, 0];
        monthlyChart.update('none');
    }
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
        console.log('로그인 시도 중...', email);
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log('Firebase 로그인 성공:', userCredential.user.uid);
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
    
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm').value;
    
    if (!name || !email || !password || !confirmPassword) {
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
        // Firebase Authentication으로 계정 생성
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // 사용자 정보를 Realtime Database에 저장
        const userRef = ref(database, `users/${user.uid}`);
        await set(userRef, {
            name: name,
            email: email,
            createdAt: new Date().toISOString()
        });
        
        showAuthMessage('회원가입 성공! 환영합니다! 🎉', 'success');
        
        // 회원가입 성공 후 잠깐 대기 후 자동으로 로그인 폼으로 전환
        setTimeout(() => {
            if (document.getElementById('signup-form').style.display !== 'none') {
                toggleAuthForm();
            }
        }, 1500);
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
                errorMessage = '비밀번호가 너무 약습니다. 6자 이상 입력해주세요.';
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
            
            // 변경사항 감지
            const changes = {};
            const fieldsToCheck = ['category', 'workName', 'targetDept', 'responsiblePerson', 'status', 'startDate', 'endDate', 'description', 'keyIssues'];
            
            fieldsToCheck.forEach(field => {
                const oldValue = existingData[field] || '';
                const newValue = formData[field] || '';
                if (oldValue !== newValue) {
                    changes[field] = {
                        from: oldValue,
                        to: newValue
                    };
                }
            });
            
            // 업무 데이터 업데이트 (이름도 함께 저장)
            await set(workRef, { 
                ...existingData, 
                ...formData,
                updatedBy: userId,
                updatedByEmail: currentUser.email,
                updatedByName: currentUser.displayName || null
            });
            
            // 변경사항이 있으면 이력 추가
            if (Object.keys(changes).length > 0) {
                const changeDetails = Object.keys(changes).map(field => getFieldDisplayName(field)).join(', ');
                addWorkHistory(editId, '업무 수정', `${changeDetails} 항목을 수정했습니다.`, changes);
            }
            
            showMessage('업무가 성공적으로 수정되었습니다! ✏️', 'success');
            
            // 편집 모드 해제
            form.removeAttribute('data-edit-mode');
            form.removeAttribute('data-edit-id');
        } else {
            // 새 업무 등록 (이름도 함께 저장)
            const tasksRef = ref(database, 'shared-audit-tasks');
            const newWorkRef = await push(tasksRef, {
                ...formData,
                createdBy: userId,
                createdByEmail: currentUser.email,
                createdByName: currentUser.displayName || null,
                createdAt: new Date().toISOString()
            });
            // 업무 등록 이력 추가
            const newWorkId = newWorkRef.key;
            addWorkHistory(newWorkId, '업무 등록', `새로운 감사업무 "${formData.workName}"을(를) 등록했습니다.`);
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
    const commentModal = document.getElementById('comment-modal');
    const quickviewModal = document.getElementById('work-quickview-modal');
    
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
    
    if (commentModal) {
        commentModal.addEventListener('click', function(e) {
            if (e.target === this) {
                hideCommentModal();
            }
        });
    }
    
    if (quickviewModal) {
        quickviewModal.addEventListener('click', function(e) {
            if (e.target === this) {
                hideWorkQuickView();
            }
        });
    }
    
    // 댓글 입력창에서 Ctrl+Enter로 댓글 등록
    const commentInput = document.getElementById('comment-input');
    if (commentInput) {
        commentInput.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                addComment();
            }
        });
    }
    
    // 퀵뷰 댓글 입력창에서 Ctrl+Enter로 댓글 등록
    const quickviewCommentInput = document.getElementById('quickview-comment-input');
    if (quickviewCommentInput) {
        quickviewCommentInput.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                addQuickViewComment();
            }
        });
    }
});

// 일정 폼 제출 처리
document.getElementById('event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
        showMessage('로그인이 필요합니다.', 'error');
        return;
    }

    const formData = {
        title: document.getElementById('event-title').value,
        type: document.getElementById('event-type').value,
        startDate: document.getElementById('event-start-date').value,
        endDate: document.getElementById('event-end-date').value || document.getElementById('event-start-date').value,
        startTime: document.getElementById('event-start-time').value,
        endTime: document.getElementById('event-end-time').value,
        description: document.getElementById('event-description').value,
        participants: document.getElementById('event-participants').value,
        color: selectedEventColor || '#3182ce',
        backgroundColor: selectedEventBg || '#bee3f8',
        createdBy: userId,
        createdByName: currentUser.displayName || currentUser.email,
        createdByEmail: currentUser.email,
        createdAt: new Date().toISOString()
    };
    
    console.log('일정 저장 데이터:', formData);

    try {
        if (selectedEvent) {
            // 수정 모드
            const eventRef = ref(database, `shared-calendar-events/${selectedEvent.id}`);
            await set(eventRef, { 
                ...selectedEvent, 
                ...formData,
                updatedAt: new Date().toISOString(),
                updatedBy: userId,
                updatedByName: currentUser.displayName || currentUser.email
            });
            showMessage('일정이 성공적으로 수정되었습니다! ✏️', 'success');
        } else {
            // 새 일정 등록
            const eventsRef = ref(database, 'shared-calendar-events');
            await push(eventsRef, formData);
            showMessage('일정이 성공적으로 등록되었습니다! 🎉', 'success');
        }
        
        hideEventModal();
    } catch (error) {
        console.error('일정 저장 실패:', error);
        showMessage('일정 저장 중 오류가 발생했습니다.', 'error');
    }
});

// =============================================
// 초기화
// =============================================

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 통합 감사업무 매트릭스 시스템 초기화 시작');
    
    // 기본적으로 인증 화면 표시
    showAuthScreen();
    
    const today = new Date().toISOString().split('T')[0];
    const taskDateInput = document.getElementById('task-date');
    const startDateInput = document.getElementById('start-date');
    
    if (taskDateInput) taskDateInput.value = today;
    if (startDateInput) startDateInput.value = today;
    
    // 색상 선택기 이벤트 리스너 추가
    document.querySelectorAll('.color-option').forEach(option => {
        option.addEventListener('click', function() {
            const color = this.getAttribute('data-color');
            const backgroundColor = this.getAttribute('data-bg');
            selectEventColor(color, backgroundColor);
        });
    });
    
    // 차트 초기화 (로그인 후에 실행되도록 지연)
    setTimeout(() => {
        if (window.Chart) {
            initializeCharts();
        }
    }, 1000);
    
    console.log('🎯 통합 감사업무 매트릭스 시스템이 로드되었습니다!');
});

console.log('통합 감사업무 매트릭스 애플리케이션이 초기화되었습니다.');

// =============================================
// 캘린더 드래그 앤 드롭 관련 함수들
// =============================================

let draggedEvent = null;
let draggedEventElement = null;

// 일정 드래그 시작
function handleEventDragStart(e) {
    const eventId = e.target.dataset.eventId;
    const originalDate = e.target.dataset.originalDate;
    
    draggedEvent = {
        id: eventId,
        originalDate: originalDate,
        element: e.target
    };
    
    draggedEventElement = e.target;
    
    // 드래그 중인 요소 스타일
    e.target.classList.add('dragging');
    e.target.style.opacity = '0.5';
    
    // 드래그 데이터 설정
    e.dataTransfer.setData('text/plain', eventId);
    e.dataTransfer.effectAllowed = 'move';
    
    console.log('📅 일정 드래그 시작:', eventId, originalDate);
}

// 일정 드래그 종료
function handleEventDragEnd(e) {
    // 드래그 중인 스타일 제거
    e.target.classList.remove('dragging');
    e.target.style.opacity = '1';
    
    // 모든 드롭 존에서 하이라이트 제거
    document.querySelectorAll('.calendar-day').forEach(day => {
        day.classList.remove('drag-over');
    });
    
    console.log('📅 일정 드래그 종료');
}

// 캘린더 날짜 위로 드래그
function handleCalendarDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

// 캘린더 날짜 진입
function handleCalendarDragEnter(e) {
    e.preventDefault();
    if (draggedEvent) {
        e.currentTarget.classList.add('drag-over');
    }
}

// 캘린더 날짜 이탈
function handleCalendarDragLeave(e) {
    // 자식 요소로 이동하는 경우가 아닐 때만 하이라이트 제거
    if (!e.currentTarget.contains(e.relatedTarget)) {
        e.currentTarget.classList.remove('drag-over');
    }
}

// 캘린더 날짜에 드롭
function handleCalendarDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const targetDate = e.currentTarget.dataset.dateStr;
    e.currentTarget.classList.remove('drag-over');
    
    if (!draggedEvent || !targetDate) {
        console.log('❌ 드래그된 일정 또는 대상 날짜가 없음');
        return;
    }
    
    // 같은 날짜로 드롭하는 경우 무시
    if (draggedEvent.originalDate === targetDate) {
        console.log('📅 같은 날짜로 이동 - 무시');
        return;
    }
    
    // 일정 이동 실행
    moveCalendarEvent(draggedEvent.id, draggedEvent.originalDate, targetDate);
    
    // 드래그 상태 초기화
    draggedEvent = null;
    draggedEventElement = null;
}

// 일정 이동 함수
async function moveCalendarEvent(eventId, originalDate, newDate) {
    try {
        console.log('📅 일정 이동 시작:', eventId, originalDate, '->', newDate);
        
        // 이동할 일정 찾기
        const event = sharedCalendarEvents.find(e => e.id === eventId);
        if (!event) {
            showMessage('이동할 일정을 찾을 수 없습니다.', 'error');
            return;
        }
        
        // 권한 확인
        if (!hasEditPermission(event.createdBy, event.createdByEmail)) {
            showMessage('일정을 이동할 권한이 없습니다.', 'error');
            return;
        }
        
        // 날짜 계산
        const originalStartDate = new Date(event.startDate);
        const originalEndDate = event.endDate ? new Date(event.endDate) : originalStartDate;
        const daysDiff = Math.floor((originalEndDate - originalStartDate) / (1000 * 60 * 60 * 24));
        
        const newStartDate = new Date(newDate);
        const newEndDate = new Date(newStartDate);
        newEndDate.setDate(newEndDate.getDate() + daysDiff);
        
        // 업데이트할 데이터
        const updatedEvent = {
            ...event,
            startDate: newStartDate.toISOString().split('T')[0],
            endDate: newEndDate.toISOString().split('T')[0],
            lastModified: new Date().toISOString(),
            lastModifiedBy: userId,
            lastModifiedByEmail: currentUser.email
        };
        
        // Firebase 업데이트
        const eventRef = ref(database, `shared-calendar-events/${eventId}`);
        await set(eventRef, updatedEvent);
        
        // 성공 메시지
        const dateStr = newDate === updatedEvent.endDate ? 
            newDate : 
            `${newDate} ~ ${updatedEvent.endDate}`;
        showMessage(`일정이 ${dateStr}로 이동되었습니다. ✅`, 'success');
        
        console.log('✅ 일정 이동 완료');
        
    } catch (error) {
        console.error('❌ 일정 이동 실패:', error);
        showMessage('일정 이동 중 오류가 발생했습니다.', 'error');
    }
}

// 댓글 작성 시 이름 표시 (userProfiles에서 이름, 없으면 이메일 앞부분)
function getDisplayNameByEmail(email) {
  if (window.userProfiles && window.userProfiles[email] && window.userProfiles[email].name) {
    return window.userProfiles[email].name;
  }
  return email.split('@')[0];
}

// 댓글 렌더링 시 이름 표시
function renderCommentsForWork(workId, comments) {
  // 업무 목록 테이블에서 각 업무 행 아래에 최근 댓글 1~2개를 표시
  const workRow = document.querySelector(`[data-work-id="${workId}"]`);
  if (!workRow) return;
  let commentHtml = '';
  comments.slice(0,2).forEach(comment => {
    const name = getDisplayNameByEmail(comment.authorEmail);
    commentHtml += `<div class="work-comment-preview"><b>${name}</b>: ${escapeHtml(comment.content)} <span class="comment-time">${formatCommentTime(comment.createdAt)}</span></div>`;
  });
  let previewRow = workRow.nextElementSibling;
  if (!previewRow || !previewRow.classList.contains('work-comment-row')) {
    previewRow = document.createElement('tr');
    previewRow.className = 'work-comment-row';
    previewRow.innerHTML = `<td colspan="7">${commentHtml}</td>`;
    workRow.parentNode.insertBefore(previewRow, workRow.nextSibling);
  } else {
    previewRow.innerHTML = `<td colspan="7">${commentHtml}</td>`;
  }
}

// 업무 목록 렌더링 시 각 업무별로 댓글 프리뷰 표시
function renderWorkTableWithComments(workList, commentsByWorkId) {
  const tbody = document.getElementById('work-table-body');
  tbody.innerHTML = '';
  workList.forEach(work => {
    // 업무 행 생성
    const tr = document.createElement('tr');
    tr.setAttribute('data-work-id', work.id);
    tr.innerHTML = `
      <td>${work.category}</td>
      <td>${work.name}</td>
      <td>${work.targetDept}</td>
      <td>${work.period}</td>
      <td>${work.status}</td>
      <td>${work.responsible}</td>
      <td><!-- 관리 버튼 등 --></td>
    `;
    tbody.appendChild(tr);
    // 댓글 미리보기 row 생성
    const comments = commentsByWorkId[work.id] || [];
    let commentHtml = '';
    comments.slice(0,2).forEach(comment => {
      const name = getDisplayNameByEmail(comment.authorEmail);
      commentHtml += `<div class="work-comment-preview"><b>${name}</b>: ${escapeHtml(comment.content)} <span class="comment-time">${formatCommentTime(comment.createdAt)}</span></div>`;
    });
    const commentTr = document.createElement('tr');
    commentTr.className = 'work-comment-row';
    commentTr.innerHTML = `<td colspan="7">${commentHtml}</td>`;
    tbody.appendChild(commentTr);
  });
}
