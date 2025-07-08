// 업무 보드 애플리케이션 JavaScript

// 전역 변수
let workData = [];
let currentFilter = '전체';

// DOM 요소들
const workForm = document.getElementById('workForm');
const detailModal = document.getElementById('detailModal');
const confirmModal = document.getElementById('confirmModal');

// 초기화 함수
document.addEventListener('DOMContentLoaded', function() {
    console.log('업무 보드 스크립트가 로드되었습니다.');
    initializeApp();
});

// 앱 초기화
function initializeApp() {
    setupEventListeners();
    loadWorkData();
    updateStats();
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 필터 버튼 이벤트
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            setActiveFilter(this);
            filterWorkList(this.textContent);
        });
    });

    // 신규 등록 버튼
    const newBtn = document.querySelector('.btn-new');
    if (newBtn) {
        newBtn.addEventListener('click', showWorkForm);
    }

    // CSV 버튼
    const csvBtn = document.querySelector('.btn-csv');
    if (csvBtn) {
        csvBtn.addEventListener('click', exportToCSV);
    }

    // 폼 버튼들
    const cancelBtn = document.querySelector('.btn-cancel');
    const saveBtn = document.querySelector('.btn-save');
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', hideWorkForm);
    }
    
    if (saveBtn) {
        saveBtn.addEventListener('click', saveWork);
    }

    // 모달 닫기 버튼
    const closeBtn = document.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', hideDetailModal);
    }

    // 탭 버튼들
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            setActiveTab(this);
        });
    });
}

// 필터 활성화 설정
function setActiveFilter(activeBtn) {
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => btn.classList.remove('active'));
    activeBtn.classList.add('active');
}

// 업무 목록 필터링
function filterWorkList(filter) {
    currentFilter = filter;
    console.log(`필터 적용: ${filter}`);
    // 실제 필터링 로직 구현
    renderWorkList();
}

// 업무 등록 폼 표시
function showWorkForm() {
    if (workForm) {
        workForm.style.display = 'block';
        workForm.scrollIntoView({ behavior: 'smooth' });
    }
}

// 업무 등록 폼 숨기기
function hideWorkForm() {
    if (workForm) {
        workForm.style.display = 'none';
        clearForm();
    }
}

// 폼 초기화
function clearForm() {
    const inputs = workForm.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.value = '';
    });
}

// 업무 저장
function saveWork() {
    const formData = getFormData();
    
    if (validateFormData(formData)) {
        workData.push({
            id: Date.now(),
            ...formData,
            createdAt: new Date().toISOString()
        });
        
        console.log('업무 저장됨:', formData);
        hideWorkForm();
        updateStats();
        renderWorkList();
        showMessage('업무가 성공적으로 등록되었습니다.', 'success');
    }
}

// 폼 데이터 수집
function getFormData() {
    const inputs = workForm.querySelectorAll('input, select, textarea');
    const data = {};
    
    inputs.forEach(input => {
        if (input.name) {
            data[input.name] = input.value;
        }
    });
    
    return data;
}

// 폼 데이터 유효성 검사
function validateFormData(data) {
    // 기본적인 유효성 검사 로직
    if (!data.workName || data.workName.trim() === '') {
        showMessage('업무명을 입력해주세요.', 'error');
        return false;
    }
    
    if (!data.targetDept || data.targetDept.trim() === '') {
        showMessage('대상 부서를 입력해주세요.', 'error');
        return false;
    }
    
    return true;
}

// CSV 내보내기
function exportToCSV() {
    console.log('CSV 내보내기 실행');
    
    if (workData.length === 0) {
        showMessage('내보낼 데이터가 없습니다.', 'warning');
        return;
    }
    
    // CSV 생성 로직
    const csvContent = generateCSV(workData);
    downloadCSV(csvContent, 'work_data.csv');
}

// CSV 생성
function generateCSV(data) {
    const headers = ['업무분류', '업무명', '대상부서', '진행상태', '시작일자', '종료일자'];
    const csvRows = [headers.join(',')];
    
    data.forEach(item => {
        const row = [
            item.category || '',
            item.workName || '',
            item.targetDept || '',
            item.status || '',
            item.startDate || '',
            item.endDate || ''
        ];
        csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
}

// CSV 다운로드
function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// 업무 데이터 로드
function loadWorkData() {
    // 로컬 스토리지나 서버에서 데이터 로드
    const savedData = localStorage.getItem('workData');
    if (savedData) {
        workData = JSON.parse(savedData);
    }
    
    renderWorkList();
}

// 업무 목록 렌더링
function renderWorkList() {
    // 실제 업무 목록 렌더링 로직
    console.log('업무 목록 렌더링:', workData);
    
    // 데이터를 로컬 스토리지에 저장
    localStorage.setItem('workData', JSON.stringify(workData));
}

// 통계 업데이트
function updateStats() {
    const totalCount = workData.length;
    const inProgressCount = workData.filter(item => 
        item.status && item.status !== '보고완료'
    ).length;
    const completedCount = workData.filter(item => 
        item.status === '보고완료'
    ).length;
    
    // DOM 업데이트
    const statCards = document.querySelectorAll('.stat-card .count');
    if (statCards.length >= 3) {
        statCards[0].textContent = `${totalCount}건`;
        statCards[1].textContent = `${inProgressCount}건`;
        statCards[2].textContent = `${completedCount}건`;
    }
}

// 상세 모달 표시
function showDetailModal(workId) {
    const work = workData.find(item => item.id === workId);
    if (work && detailModal) {
        // 모달 내용 설정
        populateDetailModal(work);
        detailModal.style.display = 'flex';
    }
}

// 상세 모달 숨기기
function hideDetailModal() {
    if (detailModal) {
        detailModal.style.display = 'none';
    }
}

// 상세 모달 내용 설정
function populateDetailModal(work) {
    const modalBody = detailModal.querySelector('.modal-body');
    if (modalBody) {
        modalBody.innerHTML = `
            <div class="detail-info">
                <h4>업무 정보</h4>
                <p><strong>업무명:</strong> ${work.workName || '-'}</p>
                <p><strong>대상부서:</strong> ${work.targetDept || '-'}</p>
                <p><strong>진행상태:</strong> ${work.status || '-'}</p>
                <p><strong>시작일자:</strong> ${work.startDate || '-'}</p>
                <p><strong>종료일자:</strong> ${work.endDate || '-'}</p>
                <p><strong>주요 지적사항:</strong> ${work.issues || '-'}</p>
            </div>
        `;
    }
}

// 탭 활성화 설정
function setActiveTab(activeTab) {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    activeTab.classList.add('active');
    
    // 탭 내용 변경 로직
    const tabName = activeTab.textContent;
    console.log(`탭 변경: ${tabName}`);
}

// 삭제 확인 모달 표시
function showConfirmModal(workId) {
    if (confirmModal) {
        confirmModal.style.display = 'flex';
        confirmModal.dataset.workId = workId;
    }
}

// 삭제 확인 모달 숨기기
function hideConfirmModal() {
    if (confirmModal) {
        confirmModal.style.display = 'none';
        delete confirmModal.dataset.workId;
    }
}

// 업무 삭제
function deleteWork(workId) {
    workData = workData.filter(item => item.id !== workId);
    updateStats();
    renderWorkList();
    hideConfirmModal();
    showMessage('업무가 삭제되었습니다.', 'success');
}

// 메시지 표시
function showMessage(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // 실제 토스트 메시지 구현
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// 전역 함수들 (HTML에서 호출)
window.showWorkForm = showWorkForm;
window.hideWorkForm = hideWorkForm;
window.saveWork = saveWork;
window.showDetailModal = showDetailModal;
window.hideDetailModal = hideDetailModal;
window.showConfirmModal = showConfirmModal;
window.hideConfirmModal = hideConfirmModal;
window.deleteWork = deleteWork;
window.exportToCSV = exportToCSV;
