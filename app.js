// Global Toast Function
window.showToast = function(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const iconClass = type === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-exclamation';
  toast.innerHTML = `<i class="${iconClass}"></i><span>${message}</span>`;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    if (container.contains(toast)) {
      container.removeChild(toast);
    }
  }, 8000);
};

// Global Confirm Modal
window.showConfirm = function(message, onConfirm) {
  document.getElementById('confirm-modal-message').innerText = message;
  const modal = document.getElementById('confirm-modal');
  modal.classList.add('active');
  
  const okBtn = document.getElementById('confirm-modal-ok');
  const cancelBtn = document.getElementById('confirm-modal-cancel');
  
  // Clone to remove old event listeners
  const newOkBtn = okBtn.cloneNode(true);
  const newCancelBtn = cancelBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOkBtn, okBtn);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
  
  newOkBtn.addEventListener('click', () => {
    modal.classList.remove('active');
    if (onConfirm) onConfirm();
  });
  
  newCancelBtn.addEventListener('click', () => {
    modal.classList.remove('active');
  });
};

import { supabase } from './supabaseClient.js';

// State Management
window.State = {
  currentUser: null,
  db: {
    users: [],
    teams: [],
    tests: [],
    submissions: []
  }
};
// --- Anti-Cheating Mechanism ---
document.addEventListener('contextmenu', (e) => {
  if (State.currentUser && State.currentUser.role === 'STUDENT') {
    e.preventDefault();
    showToast('Ação bloqueada: Botão direito desativado durante a prova.', 'error');
  }
});

document.addEventListener('keydown', (e) => {
  if (State.currentUser && State.currentUser.role === 'STUDENT') {
    // Block Ctrl+C (Copy), Ctrl+V (Paste), Ctrl+P (Print), Ctrl+S (Save), F12 (DevTools)
    if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'p', 's'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      showToast('Ação bloqueada por segurança.', 'error');
    }
    if (e.key === 'F12' || e.key === 'PrintScreen') {
      e.preventDefault();
      showToast('Ação bloqueada por segurança.', 'error');
    }
  }
});

// Navigation Logic
window.showView = async function(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const viewEl = document.getElementById(viewId);
  if (viewEl) viewEl.classList.add('active');
  
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const activeNav = document.querySelector(`.nav-item[data-target="${viewId}"]`);
  if (activeNav) activeNav.classList.add('active');

  localStorage.setItem('be_education_active_view', viewId);

  // Refresh data based on view
  if (viewId === 'manage-users-view') renderUsers();
  if (viewId === 'manage-teams-view') renderTeams();
  if (viewId === 'manage-tests-view') renderTests();
  if (viewId === 'dashboard-view') renderEvaluatorDashboard();
  if (viewId === 'student-dashboard-view') renderStudentDashboard();
  if (viewId === 'student-history-view') renderStudentHistory();
  if (viewId === 'evaluate-view') renderEvaluateView();
  if (viewId === 'question-bank-view') renderQuestionBank();
  
  if (viewId === 'create-test-view') {
    const teamSelect = document.getElementById('test-target-team');
    if (teamSelect) {
      const { data: teams } = await supabase.from('teams').select('*');
      teamSelect.innerHTML = '<option value="TODOS">Todos os times</option>' + 
        (teams || []).map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    }
  }
  
  if (viewId === 'student-performance-view') {
    const studentDatalist = document.getElementById('perf-students-list');
    if (studentDatalist) {
      const { data: users } = await supabase.from('users').select('id, name, email, role, profile, level, team_id').eq('role', 'STUDENT').order('name', { ascending: true });
      window.perfStudents = users || [];
      
      studentDatalist.innerHTML = window.perfStudents.map(s => `<option value="${s.name} - ${s.profile}"></option>`).join('');
      // Reset view
      document.getElementById('perf-content-area').style.display = 'none';
      const searchInput = document.getElementById('perf-student-search');
      if (searchInput) searchInput.value = '';
    }
  }
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    showView(item.dataset.target);
  });
});

// Auth Logic
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app');

window.togglePasswordVisibility = function() {
  const pwdInput = document.getElementById('login-password');
  const toggleIcon = document.getElementById('toggle-password');
  if (pwdInput.type === 'password') {
    pwdInput.type = 'text';
    toggleIcon.classList.remove('fa-eye');
    toggleIcon.classList.add('fa-eye-slash');
  } else {
    pwdInput.type = 'password';
    toggleIcon.classList.remove('fa-eye-slash');
    toggleIcon.classList.add('fa-eye');
  }
};

let usersChannel = null;
function setupRealtime() {
  if (usersChannel) return;
  usersChannel = supabase.channel('public:users')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'users' },
      (payload) => {
        if (document.getElementById('manage-users-view').classList.contains('active')) {
          renderUsers();
        }
      }
    )
    .subscribe();
}

function handleLoginSuccess(user) {
  State.currentUser = user;
  loginScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  
  // Update Sidebar
  document.getElementById('user-name').innerText = user.name;
  document.getElementById('user-role').innerText = user.role === 'EVALUATOR' ? 'Gestor' : 'Aluno';
  document.getElementById('user-avatar').innerText = user.name.charAt(0).toUpperCase();

  if (State.currentUser.role === 'EVALUATOR') {
    document.getElementById('evaluator-nav').style.display = 'flex';
    document.getElementById('student-nav').style.display = 'none';
    document.body.classList.remove('no-copy');
    setupRealtime();
    const savedView = localStorage.getItem('be_education_active_view') || 'dashboard-view';
    const validEvaluatorViews = ['dashboard-view', 'manage-users-view', 'manage-teams-view', 'manage-tests-view', 'create-test-view', 'evaluate-view', 'student-performance-view', 'question-bank-view'];
    showView(validEvaluatorViews.includes(savedView) ? savedView : 'dashboard-view');
  } else {
    document.getElementById('evaluator-nav').style.display = 'none';
    document.getElementById('student-nav').style.display = 'flex';
    document.body.classList.add('no-copy');
    const savedView = localStorage.getItem('be_education_active_view') || 'student-dashboard-view';
    const validStudentViews = ['student-dashboard-view', 'student-history-view'];
    showView(validStudentViews.includes(savedView) ? savedView : 'student-dashboard-view');
  }
}

// Check for saved session (deferred to ensure all functions are defined)
setTimeout(() => {
  const savedSession = localStorage.getItem('be_education_user');
  if (savedSession) {
    let user = null;
    try {
      user = JSON.parse(savedSession);
    } catch(e) {
      localStorage.removeItem('be_education_user');
    }
    if (user) {
      handleLoginSuccess(user);
    }
  }
}, 0);

document.getElementById('real-login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('login-email').value;
  const pass = document.getElementById('login-password').value;
  
  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';
  btn.disabled = true;

  const { data: users, error } = await supabase.rpc('login_user', { p_email: email, p_password: pass }).select('id, name, email, role, profile, level, team_id');

  btn.innerHTML = originalText;
  btn.disabled = false;
  
  if (error) {
    console.error('Supabase Login Error:', error);
  }

  if (error || !users || users.length === 0) {
    showToast('Login ou senha incorretos.', 'error');
    return;
  }
  
  const user = users[0];
  localStorage.setItem('be_education_user', JSON.stringify(user));
  handleLoginSuccess(user);
});

document.getElementById('logout-btn').addEventListener('click', () => {
  State.currentUser = null;
  localStorage.removeItem('be_education_user');
  localStorage.removeItem('be_education_active_view');
  document.documentElement.classList.remove('has-session');
  appScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
});

// Modals
window.openModal = async function(id) {
  document.getElementById(id).classList.add('active');
  if (id === 'user-modal') {
    const teamSelect = document.getElementById('new-user-team');
    teamSelect.innerHTML = '<option value="">Sem time</option>';
    const { data: teams } = await supabase.from('teams').select('*');
    (teams || []).forEach(t => {
      teamSelect.innerHTML += `<option value="${t.id}">${t.name}</option>`;
    });
  }
}

window.closeModal = function(id) {
  document.getElementById(id).classList.remove('active');
}

// Fechar modal ao clicar fora (no background)
window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal') && e.target.classList.contains('active')) {
    e.target.classList.remove('active');
  }
});

// Fechar modal ao apertar a tecla Esc
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const activeModals = document.querySelectorAll('.modal.active');
    activeModals.forEach(modal => {
      modal.classList.remove('active');
    });
  }
});

document.getElementById('new-user-profile').addEventListener('change', (e) => {
  const levelSelect = document.getElementById('new-user-level');
  if (e.target.value === 'SDR') {
    levelSelect.innerHTML = '<option value="-">-</option>';
    levelSelect.value = '-';
    levelSelect.disabled = true;
  } else {
    levelSelect.innerHTML = '<option value="Pleno">Pleno</option><option value="Sênior">Sênior</option>';
    levelSelect.disabled = false;
  }
});

document.getElementById('new-user-role').addEventListener('change', (e) => {
  const profileGroup = document.getElementById('profile-group');
  const levelGroup = document.getElementById('level-group');
  if (e.target.value === 'EVALUATOR') {
    profileGroup.style.display = 'none';
    levelGroup.style.display = 'none';
  } else {
    profileGroup.style.display = '';
    levelGroup.style.display = '';
    document.getElementById('new-user-profile').dispatchEvent(new Event('change'));
  }
});

// Manage Users
let editingUserId = null;

window.openNewUserModal = function() {
  editingUserId = null;
  document.getElementById('user-form').reset();
  const submitBtn = document.querySelector('#user-form button[type="submit"]');
  if (submitBtn) submitBtn.innerText = 'Adicionar Usuário';
  document.getElementById('new-user-password').required = true;
  document.getElementById('new-user-role').dispatchEvent(new Event('change'));
  document.getElementById('new-user-profile').dispatchEvent(new Event('change'));
  openModal('user-modal');
};

document.getElementById('user-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const name = document.getElementById('new-user-name').value;
  const email = document.getElementById('new-user-email').value.trim();
  
  if (/\s/.test(email)) {
    showToast('O login não pode conter espaços em branco.', 'error');
    return;
  }
  
  const password = document.getElementById('new-user-password').value;
  const role = document.getElementById('new-user-role').value;
  let profile = document.getElementById('new-user-profile').value;
  let level = document.getElementById('new-user-level').value;
  const team_id = document.getElementById('new-user-team').value || null;

  if (role === 'EVALUATOR') {
    profile = '-';
    level = '-';
  }

  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.innerText;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
  btn.disabled = true;

  if (editingUserId) {
    const updateData = { name, email, role, profile, level, team_id };
    if (password) updateData.password = password;
    
    await supabase.from('users').update(updateData).eq('id', editingUserId);
    editingUserId = null;
  } else {
    // Verificar e-mail existente
    const { data: existing } = await supabase.from('users').select('id').eq('email', email).single();
    if (existing) {
      showToast('Login já cadastrado', 'error');
      btn.innerHTML = originalText;
      btn.disabled = false;
      return;
    }
    
    await supabase.from('users').insert({
      name, email, password, role, profile, level, team_id
    });
  }
  
  btn.innerHTML = originalText;
  btn.disabled = false;
  
  closeModal('user-modal');
  renderUsers();
});

window.editUser = async function(userId) {
  const { data: user } = await supabase.from('users').select('id, name, email, role, profile, level, team_id').eq('id', userId).single();
  if (!user) return;
  
  editingUserId = user.id;
  
  document.getElementById('new-user-name').value = user.name;
  document.getElementById('new-user-email').value = user.email;
  const passInput = document.getElementById('new-user-password');
  passInput.value = '';
  passInput.required = false;
  document.getElementById('new-user-role').value = user.role;
  
  const profileSelect = document.getElementById('new-user-profile');
  profileSelect.value = user.profile;
  profileSelect.dispatchEvent(new Event('change'));
  
  document.getElementById('new-user-level').value = user.level;
  document.getElementById('new-user-team').value = user.team_id || '';
  
  document.getElementById('new-user-role').dispatchEvent(new Event('change'));
  
  const submitBtn = document.querySelector('#user-form button[type="submit"]');
  if (submitBtn) submitBtn.innerText = 'Salvar Alterações';
  
  openModal('user-modal');
};

window.renderUsers = async function() {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> Carregando usuários...</td></tr>';
  
  const searchInput = document.getElementById('search-users');
  const roleSelect = document.getElementById('filter-users-role');
  const searchStr = searchInput ? searchInput.value.toLowerCase() : '';
  const roleFilter = roleSelect ? roleSelect.value : 'TODOS';
  
  let query = supabase.from('users').select('id, name, email, role, profile, level, team_id, teams(name)').order('name', { ascending: true });
  if (roleFilter !== 'TODOS') query = query.eq('role', roleFilter);
  if (searchStr) query = query.or(`name.ilike.%${searchStr}%,email.ilike.%${searchStr}%`);
  
  const { data: users, error } = await query;
  if (error) {
    tbody.innerHTML = '<tr><td colspan="6">Erro ao carregar usuários.</td></tr>';
    return;
  }
  
  users.sort((a, b) => a.name.localeCompare(b.name));
  
  tbody.innerHTML = '';
  users.forEach(u => {
    const teamName = u.teams ? u.teams.name : '-';
    tbody.innerHTML += `
      <tr>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td><span class="badge ${u.role === 'EVALUATOR' ? 'badge-purple' : 'badge-blue'}">${u.role === 'EVALUATOR' ? 'Gestor' : 'Aluno'}</span></td>
        <td>${u.level || '-'} - ${u.profile || '-'}</td>
        <td>${teamName}</td>
        <td style="display: flex; gap: 8px;">
          <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px;" onclick="editUser('${u.id}')">Editar</button>
          <button class="btn btn-danger" style="padding: 4px 8px; font-size: 12px;" onclick="deleteUser('${u.id}')" title="Excluir Usuário">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  });
};

// Student Performance View
let perfEvolChart = null;
let perfCompChart = null;

window.handleStudentSearch = function(value) {
  if (!value || !window.perfStudents) {
    document.getElementById('perf-content-area').style.display = 'none';
    return;
  }
  const user = window.perfStudents.find(s => `${s.name} - ${s.profile}` === value);
  if (user) {
    viewStudentPerformance(user.id);
  } else {
    document.getElementById('perf-content-area').style.display = 'none';
  }
};

window.deleteUser = function(userId) {
  showConfirm('Atenção: Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.', async () => {
    await supabase.from('submissions').delete().eq('student_id', userId);
    await supabase.from('users').delete().eq('id', userId);
    showToast('Usuário excluído com sucesso!', 'success');
    renderUsers();
  });
};

window.viewStudentPerformance = async function(userId) {
  if (!userId) {
    document.getElementById('perf-content-area').style.display = 'none';
    return;
  }
  
  const { data: user } = await supabase.from('users').select('id, name, email, role, profile, level, team_id').eq('id', userId).single();
  if (!user) return;
  
  document.getElementById('perf-content-area').style.display = 'block';
  
  const { data: teams } = await supabase.from('teams').select('*');
  const team = (teams || []).find(t => t.id === user.team_id);
  document.getElementById('perf-student-name').innerText = user.name;
  document.getElementById('perf-student-info').innerText = `${user.profile || '-'} / ${user.level || '-'} ${team ? '- ' + team.name : ''}`;
  
  // Submissions for this user
  const { data: subs } = await supabase.from('submissions').select('*').eq('student_id', userId);
  const submissions = subs || [];
  document.getElementById('perf-kpi-total').innerText = submissions.length;
  
  // Fetch all tests for reference
  const { data: allTests } = await supabase.from('tests').select('*');
  const tests = allTests || [];
  
  // Calculate average
  let totalScore = 0;
  let maxScore = 0;
  submissions.forEach(s => {
    const test = tests.find(t => t.id === s.test_id);
    if (test) {
      totalScore += s.score;
      maxScore += test.questions.length;
    }
  });
  
  const avg = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
  document.getElementById('perf-kpi-media').innerText = avg.toFixed(1) + '%';
  
  // Render History Table
  const tbody = document.getElementById('perf-history-tbody');
  tbody.innerHTML = '';
  submissions.forEach(s => {
    const test = tests.find(t => t.id === s.test_id);
    if (!test) return;
    const dateStr = new Date(s.submitted_at || s.submittedAt).toLocaleDateString('pt-BR');
    const isEvaluated = !s.needs_grading;
    
    tbody.innerHTML += `
      <tr>
        <td>${test.title}</td>
        <td>${dateStr}</td>
        <td>${s.score} / ${test.questions.length}</td>
        <td><span class="badge ${isEvaluated ? 'badge-blue' : 'badge-purple'}">${isEvaluated ? 'Corrigida' : 'Pendente'}</span></td>
        <td><button class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px;" onclick="viewStudentResult('${s.id}')">Ver Detalhes</button></td>
      </tr>
    `;
  });
  
  // Charts
  if (perfEvolChart) perfEvolChart.destroy();
  if (perfCompChart) perfCompChart.destroy();
  
  // Evolution Chart (Score % per submission over time)
  const sortedSubs = [...submissions].sort((a, b) => new Date(a.submitted_at || a.submittedAt) - new Date(b.submitted_at || b.submittedAt));
  const labels = sortedSubs.map(s => {
    const t = tests.find(t => t.id === s.test_id);
    return t ? t.title.substring(0, 10) + '...' : 'Prova';
  });
  const data = sortedSubs.map(s => {
    const t = tests.find(t => t.id === s.test_id);
    const m = t ? t.questions.length : 1;
    return (s.score / m) * 100;
  });
  
  const ctxEvol = document.getElementById('perf-evolution-chart').getContext('2d');
  perfEvolChart = new Chart(ctxEvol, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Nota (%)',
        data: data,
        borderColor: '#0070f3',
        backgroundColor: 'rgba(0, 112, 243, 0.1)',
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { min: 0, max: 100 } }
    }
  });
  
  // Comparison Chart (Student Avg vs Company Avg)
  const { data: allSubs } = await supabase.from('submissions').select('*');
  let cTotal = 0, cMax = 0;
  (allSubs || []).forEach(s => {
    const t = tests.find(t => t.id === s.test_id);
    if (t) {
      cTotal += s.score;
      cMax += t.questions.length;
    }
  });
  const companyAvg = cMax > 0 ? (cTotal / cMax) * 100 : 0;
  
  const ctxComp = document.getElementById('perf-comparison-chart').getContext('2d');
  perfCompChart = new Chart(ctxComp, {
    type: 'bar',
    data: {
      labels: ['Média do Aluno', 'Média da Empresa'],
      datasets: [{
        label: 'Nota Média (%)',
        data: [avg, companyAvg],
        backgroundColor: ['#0070f3', '#eaeaea'],
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { min: 0, max: 100 } },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// Manage Teams
document.getElementById('team-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('new-team-name').value;
  
  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.innerText;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
  btn.disabled = true;

  await supabase.from('teams').insert({ name });
  
  btn.innerHTML = originalText;
  btn.disabled = false;
  
  closeModal('team-modal');
  renderTeams();
});

window.renderTeams = async function() {
  const grid = document.getElementById('teams-grid');
  grid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> Carregando times...</p>';
  
  const { data: teams, error: tError } = await supabase.from('teams').select('*');
  const { data: users, error: uError } = await supabase.from('users').select('id, name, email, role, profile, level, team_id');
  
  if (tError || uError) {
    grid.innerHTML = '<p>Erro ao carregar times.</p>';
    return;
  }
  
  grid.innerHTML = '';
  teams.forEach(t => {
    const members = users.filter(u => u.team_id === t.id);
    grid.innerHTML += `
      <div class="glass-panel" style="position: relative;">
        <div style="position: absolute; top: 16px; right: 16px; display: flex; gap: 8px;">
          <button class="btn btn-secondary" style="padding: 6px 10px; font-size: 12px;" onclick="editTeam('${t.id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-danger" style="padding: 6px 10px; font-size: 12px;" onclick="deleteTeam('${t.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
        <h3 style="margin-right: 90px; margin-bottom: 8px;">${t.name}</h3>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <p style="margin: 0;">${members.length} membros</p>
          <button class="btn" style="padding: 4px 12px; font-size: 12px;" onclick="openAddMemberModal('${t.id}')">
            <i class="fa-solid fa-plus"></i> Adicionar
          </button>
        </div>
        
        <div>
          ${members.map(m => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: rgba(0,0,0,0.2); margin-bottom: 4px; border-radius: 4px; font-size: 14px;">
              <span>${m.name} <small style="color: var(--text-muted);">(${m.profile || '-'})</small></span>
              <button class="btn btn-danger" style="padding: 2px 6px; font-size: 10px; background: transparent; border: 1px solid var(--danger); color: var(--danger);" onclick="removeMember('${m.id}')" title="Remover do time"><i class="fa-solid fa-xmark"></i></button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });
};

window.openConfirmModal = function(title, message, callback) {
  showConfirm(message, callback);
};

window.deleteTeam = function(id) {
  openConfirmModal('Excluir Time', 'Tem certeza que deseja excluir este time? Membros deste time ficarão sem time.', async () => {
    // Graças ao ON DELETE SET NULL configurado no banco, apenas deletar o time já remove a referência nos usuários!
    await supabase.from('teams').delete().eq('id', id);
    showToast('Time excluído!', 'success');
    renderTeams();
  });
};

window.editTeam = async function(id) {
  const { data: team } = await supabase.from('teams').select('*').eq('id', id).single();
  if (!team) return;
  document.getElementById('edit-team-id').value = team.id;
  document.getElementById('edit-team-name-input').value = team.name;
  openModal('edit-team-modal');
};

document.getElementById('edit-team-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-team-id').value;
  const newName = document.getElementById('edit-team-name-input').value;
  
  if (newName.trim()) {
    await supabase.from('teams').update({ name: newName.trim() }).eq('id', id);
    renderTeams();
    closeModal('edit-team-modal');
  }
});

window.openAddMemberModal = async function(teamId) {
  const { data: team } = await supabase.from('teams').select('*').eq('id', teamId).single();
  if (!team) return;
  
  document.getElementById('add-member-team-id').value = team.id;
  const select = document.getElementById('add-member-select');
  select.innerHTML = '<option value="">Carregando...</option>';
  openModal('add-member-modal');
  
  const { data: availableUsers } = await supabase.from('users').select('id, name, email, role, profile, level, team_id').eq('role', 'STUDENT').neq('team_id', team.id);
  
  select.innerHTML = '';
  if (!availableUsers || availableUsers.length === 0) {
    select.innerHTML = '<option value="">Nenhum aluno disponível</option>';
  } else {
    availableUsers.forEach(u => {
      select.innerHTML += `<option value="${u.id}">${u.name} (${u.team_id ? 'Em outro time' : 'Sem time'})</option>`;
    });
  }
};

document.getElementById('add-member-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const teamId = document.getElementById('add-member-team-id').value;
  const userId = document.getElementById('add-member-select').value;
  
  if (teamId && userId) {
    await supabase.from('users').update({ team_id: teamId }).eq('id', userId);
    renderTeams();
    closeModal('add-member-modal');
  }
});

window.removeMember = function(userId) {
  openConfirmModal('Remover Membro', 'Deseja remover este aluno do time?', async () => {
    await supabase.from('users').update({ team_id: null }).eq('id', userId);
    renderTeams();
  });
};

// Toggle Sidebar
window.toggleSidebar = function() {
  const sidebar = document.querySelector('.sidebar');
  sidebar.classList.toggle('collapsed');
};

// Test Parser
let currentParsedData = null;

// File Upload Logic
const testFileInput = document.getElementById('test-file');
if (testFileInput) {
  testFileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    
    if (ext === 'txt') {
      const reader = new FileReader();
      reader.onload = function(evt) {
        document.getElementById('test-parser').value = evt.target.result;
      };
      reader.readAsText(file);
    } else if (ext === 'docx') {
      const reader = new FileReader();
      reader.onload = function(evt) {
        if (typeof mammoth === 'undefined') {
          showToast('Biblioteca Mammoth.js não carregada corretamente.', 'error');
          return;
        }
        mammoth.extractRawText({arrayBuffer: evt.target.result})
          .then(function(result) {
            document.getElementById('test-parser').value = result.value;
          })
          .catch(function(err) {
            showToast('Erro ao processar o arquivo Word: ' + err.message, 'error');
          });
      };
      reader.readAsArrayBuffer(file);
    } else {
      showToast('Formato de arquivo não suportado. Use .txt ou .docx', 'error');
    }
  });
}

document.getElementById('clear-test-btn').addEventListener('click', () => {
  document.getElementById('test-title').value = '';
  document.getElementById('test-file').value = '';
  document.getElementById('test-parser').value = '';
  document.getElementById('parsed-result').classList.add('hidden');
  currentParsedData = null;
});

document.getElementById('parse-test-btn').addEventListener('click', () => {
  const text = document.getElementById('test-parser').value;
  if (!text.trim()) return showToast('Cole o texto primeiro!', 'error');

  const lines = text.split('\n').filter(l => l.trim() !== '');
  const questions = [];
  let currentQ = null;

  lines.forEach(line => {
    const isQuestionMatch = line.match(/^(\d+[\.\)]\s*|Pergunta \d+:\s*)/i);
    if (isQuestionMatch) {
      if (currentQ) questions.push(currentQ);
      
      const isEssay = line.toLowerCase().includes('(dissertativa)');
      currentQ = {
        text: line.substring(isQuestionMatch[0].length).replace(/\(Dissertativa\)/i, '').trim(),
        type: isEssay ? 'ESSAY' : 'MULTIPLE_CHOICE',
        options: [],
        correctOptionIdx: null
      };
    } 
    else if (currentQ && currentQ.type === 'MULTIPLE_CHOICE' && line.match(/^(Resposta|Answer):\s*([a-e])/i)) {
      const match = line.match(/^(Resposta|Answer):\s*([a-e])/i);
      const letter = match[2].toUpperCase();
      const letterIdx = letter.charCodeAt(0) - 65; // A = 0, B = 1...
      currentQ.correctOptionIdx = letterIdx;
    }
    else if (currentQ && currentQ.type === 'MULTIPLE_CHOICE' && line.match(/^([a-e][\)\.]\s*|Resposta \d+\.[a-e]:\s*)/i)) {
      let optText = line.replace(/^([a-e][\)\.]\s*|Resposta \d+\.[a-e]:\s*)/i, '').trim();
      currentQ.options.push(optText);
    }
  });
  if (currentQ) questions.push(currentQ);

  currentParsedData = questions;
  renderParsedPreview();
});

function renderParsedPreview() {
  const container = document.getElementById('preview-container');
  container.innerHTML = '';
  
  if (!currentParsedData || currentParsedData.length === 0) {
    container.innerHTML = '<p>Nenhuma pergunta reconhecida. Verifique o formato.</p>';
    document.getElementById('parsed-result').classList.remove('hidden');
    return;
  }

  currentParsedData.forEach((q, idx) => {
    let optsHtml = '';
    if (q.type === 'MULTIPLE_CHOICE') {
      optsHtml = '<ul class="preview-options">' + q.options.map((o, oIdx) => `
        <li>
          <span>${o}</span>
          <label style="display: flex; align-items: center; cursor: pointer; color: var(--text-muted); font-size: 14px;">
            <span style="margin-right: 8px;">Correta</span>
            <input type="radio" name="correct_${idx}" value="${oIdx}" onchange="markCorrect(${idx}, ${oIdx})" ${q.correctOptionIdx === oIdx ? 'checked' : ''} style="accent-color: var(--success); width: 16px; height: 16px;">
          </label>
        </li>
      `).join('') + '</ul>';
    } else {
      optsHtml = '<p style="color: var(--warning); font-size: 14px; margin-top: 8px;"><i class="fa-solid fa-pen"></i> Campo dissertativo</p>';
    }

    let moduleBadge = '';
    if (q.moduleName) {
      moduleBadge = `<span class="badge badge-blue" style="margin-bottom: 8px; display: inline-block;">${q.moduleName}</span><br>`;
    }

    container.innerHTML += `
      <div class="preview-question">
        ${moduleBadge}
        <h4 style="display: inline;">${idx + 1}. ${q.text}</h4>
        ${optsHtml}
      </div>
    `;
  });

  document.getElementById('parsed-result').classList.remove('hidden');
}

window.markCorrect = function(qIdx, oIdx) {
  if (currentParsedData && currentParsedData[qIdx]) {
    currentParsedData[qIdx].correctOptionIdx = oIdx;
    renderParsedPreview(); // re-render to update UI
  }
};

document.getElementById('save-test-btn').addEventListener('click', async (e) => {
  const title = document.getElementById('test-title').value;
  if (!title) return showToast('Dê um título para a prova.', 'error');
  
  const target_level = document.getElementById('test-target-profile') ? document.getElementById('test-target-profile').value : 'TODOS';
  const target_team = document.getElementById('test-target-team') ? document.getElementById('test-target-team').value : 'TODOS';
  
  const btn = e.target;
  const originalText = btn.innerText;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
  btn.disabled = true;

  const newTest = {
    title,
    created_by: State.currentUser ? State.currentUser.id : null,
    questions: currentParsedData,
    status: 'active',
    target_level,
    target_team
  };
  
  await supabase.from('tests').insert(newTest);
  
  btn.innerHTML = originalText;
  btn.disabled = false;
  
  showToast('Prova salva com sucesso!', 'success');
  document.getElementById('test-title').value = '';
  document.getElementById('test-parser').value = '';
  document.getElementById('parsed-result').classList.add('hidden');
  currentParsedData = null;
});

// Evaluator Dashboard
let teamsChart = null;
let profileChart = null;
let historyChart = null;

window.renderEvaluatorDashboard = async function() {
  if (!State.currentUser) return;
  document.getElementById('evaluator-welcome-msg').innerText = `Seja bem vindo(a) ${State.currentUser.name}!`;

  // Time Filter
  const dateFilterVal = document.getElementById('dashboard-date-filter') ? document.getElementById('dashboard-date-filter').value : 'all';
  let cutoffDate = null;
  if (dateFilterVal !== 'all') {
    cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(dateFilterVal));
  }

  // Pegar as provas (agora todas as provas são visíveis para todos os gestores)
  const { data: myTests } = await supabase.from('tests').select('*');
  const myTestIds = myTests && myTests.length > 0 ? myTests.map(t => t.id) : [];
  
  // Pegar as submissões corrigidas
  let mySubmissions = [];
  if (myTestIds.length > 0) {
    const { data: subs } = await supabase.from('submissions').select('*').in('test_id', myTestIds).eq('needs_grading', false);
    if (subs) mySubmissions = subs;
  }
  
  // Pegar usuários e times para o chart
  const { data: allUsers } = await supabase.from('users').select('id, name, email, role, profile, level, team_id');
  const { data: allTeams } = await supabase.from('teams').select('*');
  
  if (cutoffDate) {
    mySubmissions = mySubmissions.filter(s => {
      const sDate = s.submitted_at ? new Date(s.submitted_at) : new Date(0);
      return sDate >= cutoffDate;
    });
  }

  // KPI: Média Geral
  let avgScore = 0;
  if (mySubmissions.length > 0) {
    let totalPercentage = 0;
    mySubmissions.forEach(sub => {
      const test = myTests.find(t => t.id === sub.test_id);
      const maxScore = test ? test.questions.length : 1;
      totalPercentage += (sub.score / maxScore) * 100;
    });
    avgScore = totalPercentage / mySubmissions.length;
  }
  document.getElementById('kpi-media').innerText = avgScore.toFixed(1) + '%';
  
  // ====== Top 5 Alunos & SDR vs Assessor ======
  const studentData = {};
  const profileData = { 'SDR': { sum: 0, count: 0 }, 'Assessor': { sum: 0, count: 0 } };
  
  mySubmissions.forEach(sub => {
    const student = allUsers.find(u => u.id === sub.student_id);
    if (!student) return;
    
    const test = myTests.find(t => t.id === sub.test_id);
    const maxScore = test ? test.questions.length : 1;
    const perc = (sub.score / maxScore) * 100;
    
    if (!studentData[student.id]) {
      studentData[student.id] = { name: student.name, level: student.level, sum: 0, count: 0 };
    }
    studentData[student.id].sum += perc;
    studentData[student.id].count += 1;
    
    if (student.profile && profileData[student.profile]) {
      profileData[student.profile].sum += perc;
      profileData[student.profile].count += 1;
    }
  });

  const topStudents = Object.values(studentData)
    .map(s => ({ name: s.name, level: s.level, avg: s.sum / s.count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5);
    
  const topListEl = document.getElementById('top-performers-list');
  topListEl.innerHTML = '';
  if (topStudents.length === 0) {
    topListEl.innerHTML = '<li><span style="color: var(--text-muted); font-size: 14px;">Sem dados no período</span></li>';
  } else {
    topStudents.forEach((s, idx) => {
      const isTop1 = idx === 0 ? 'color: gold;' : '';
      topListEl.innerHTML += `
        <li style="display: flex; justify-content: space-between; padding: 8px; background: rgba(255,255,255,0.02); border-radius: 4px;">
          <span><strong style="${isTop1}">${idx+1}. ${s.name}</strong> <span style="font-size: 12px; color: var(--text-muted);">(${s.level})</span></span>
          <span style="font-weight: bold; color: var(--success);">${s.avg.toFixed(1)}%</span>
        </li>
      `;
    });
  }

  // ====== Gargalos (Piores Provas) ======
  const testData = {};
  mySubmissions.forEach(sub => {
    const test = myTests.find(t => t.id === sub.test_id);
    if (!test) return;
    const perc = (sub.score / test.questions.length) * 100;
    if (!testData[test.id]) {
      testData[test.id] = { title: test.title, sum: 0, count: 0 };
    }
    testData[test.id].sum += perc;
    testData[test.id].count += 1;
  });
  
  const bottomTests = Object.values(testData)
    .map(t => ({ title: t.title, avg: t.sum / t.count }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 3);
    
  const botListEl = document.getElementById('bottleneck-tests-list');
  botListEl.innerHTML = '';
  if (bottomTests.length === 0) {
    botListEl.innerHTML = '<li><span style="color: var(--text-muted); font-size: 14px;">Sem dados no período</span></li>';
  } else {
    bottomTests.forEach((t, idx) => {
      botListEl.innerHTML += `
        <li style="display: flex; justify-content: space-between; padding: 8px; background: rgba(255,255,255,0.02); border-radius: 4px;">
          <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;">${idx+1}. ${t.title}</span>
          <span style="font-weight: bold; color: var(--danger);">${t.avg.toFixed(1)}%</span>
        </li>
      `;
    });
  }

  // ====== Chart: SDR vs Assessor ======
  const sdrAvg = profileData['SDR'].count > 0 ? (profileData['SDR'].sum / profileData['SDR'].count).toFixed(1) : 0;
  const assessorAvg = profileData['Assessor'].count > 0 ? (profileData['Assessor'].sum / profileData['Assessor'].count).toFixed(1) : 0;
  
  const ctxProfile = document.getElementById('profile-chart');
  if (ctxProfile) {
    if (profileChart) profileChart.destroy();
    profileChart = new Chart(ctxProfile.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['SDR', 'Assessor'],
        datasets: [{
          label: 'Média (%)',
          data: [sdrAvg, assessorAvg],
          backgroundColor: ['#00e676', '#9d4edd'],
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#a1a1aa' } }, x: { grid: { display: false }, ticks: { color: '#a1a1aa' } } },
        plugins: { legend: { display: false } }
      }
    });
  }

  // ====== Chart: Desempenho dos Times ======
  const teamsData = {};
  if (allTeams) allTeams.forEach(t => { teamsData[t.id] = { name: t.name, sum: 0, count: 0 }; });
  
  mySubmissions.forEach(sub => {
    const student = allUsers.find(u => u.id === sub.student_id);
    if (student && student.team_id && teamsData[student.team_id]) {
      const test = myTests.find(t => t.id === sub.test_id);
      const perc = (sub.score / (test ? test.questions.length : 1)) * 100;
      teamsData[student.team_id].sum += perc;
      teamsData[student.team_id].count += 1;
    }
  });
  
  const teamLabels = []; const teamDataArr = [];
  Object.values(teamsData).forEach(t => {
    if (t.count > 0) { teamLabels.push(t.name); teamDataArr.push((t.sum / t.count).toFixed(1)); }
  });
  
  const ctxTeams = document.getElementById('teams-chart');
  if (ctxTeams) {
    if (teamsChart) teamsChart.destroy();
    teamsChart = new Chart(ctxTeams.getContext('2d'), {
      type: 'bar',
      data: {
        labels: teamLabels,
        datasets: [{
          label: 'Média (%)',
          data: teamDataArr,
          backgroundColor: '#ffb703',
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#a1a1aa' } }, x: { grid: { display: false }, ticks: { color: '#a1a1aa' } } },
        plugins: { legend: { display: false } }
      }
    });
  }

  // ====== Chart: Evolução Histórica ======
  const historyData = {};
  mySubmissions.forEach(sub => {
    const sDate = sub.submitted_at ? new Date(sub.submitted_at) : new Date();
    // Agrupar por Mês/Ano
    const key = `${sDate.getFullYear()}-${String(sDate.getMonth() + 1).padStart(2, '0')}`;
    const test = myTests.find(t => t.id === sub.test_id);
    const perc = (sub.score / (test ? test.questions.length : 1)) * 100;
    
    if (!historyData[key]) historyData[key] = { sum: 0, count: 0 };
    historyData[key].sum += perc;
    historyData[key].count += 1;
  });
  
  // Sort keys (YYYY-MM)
  const sortedKeys = Object.keys(historyData).sort();
  const histLabels = sortedKeys.map(k => {
    const [y, m] = k.split('-');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${months[parseInt(m)-1]}/${y.substring(2)}`;
  });
  const histDataArr = sortedKeys.map(k => (historyData[k].sum / historyData[k].count).toFixed(1));

  const ctxHistory = document.getElementById('history-chart');
  if (ctxHistory) {
    if (historyChart) historyChart.destroy();
    historyChart = new Chart(ctxHistory.getContext('2d'), {
      type: 'line',
      data: {
        labels: histLabels,
        datasets: [{
          label: 'Média Mensal (%)',
          data: histDataArr,
          borderColor: '#00e676',
          backgroundColor: 'rgba(0, 230, 118, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#00e676',
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#a1a1aa' } }, x: { grid: { display: false }, ticks: { color: '#a1a1aa' } } },
        plugins: { legend: { display: false } }
      }
    });
  }
}

// Manage Tests
window.renderTests = async function() {
  const tbody = document.getElementById('tests-tbody');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> Carregando provas...</td></tr>';
  
  const { data: tests, error: tErr } = await supabase.from('tests').select('*').order('created_at', { ascending: false });
  const { data: submissions, error: sErr } = await supabase.from('submissions').select('*').eq('needs_grading', false);
  
  if (tErr || sErr) {
    tbody.innerHTML = '<tr><td colspan="6">Erro ao carregar provas.</td></tr>';
    return;
  }
  
  tbody.innerHTML = '';
  tests.forEach(t => {
    const dateStr = new Date(t.created_at).toLocaleDateString();
    
    // Calcula desempenho médio
    const testSubmissions = submissions.filter(s => s.test_id === t.id);
    let avgScore = 0;
    if (testSubmissions.length > 0) {
      const totalScore = testSubmissions.reduce((acc, sub) => acc + sub.score, 0);
      avgScore = Math.round((totalScore / testSubmissions.length) * 10) / 10;
    }
    
    // Assume max score is questions length for now
    const maxScore = t.questions.length;
    let avgPercent = testSubmissions.length > 0 ? Math.round((avgScore / maxScore) * 100) : 0;

    tbody.innerHTML += `
      <tr>
        <td>${t.title}</td>
        <td>${t.questions.length}</td>
        <td>${dateStr}</td>
        <td>${testSubmissions.length > 0 ? avgPercent + '%' : 'Sem dados'}</td>
        <td><span class="badge ${t.status === 'inactive' ? 'badge-gray' : 'badge-green'}">${t.status === 'inactive' ? 'Inativa' : 'Ativa'}</span></td>
        <td style="display: flex; gap: 8px;">
          <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px;" onclick="viewTestDetails('${t.id}')">Ver</button>
          <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px;" onclick="downloadTestAsDoc('${t.id}')" title="Baixar Prova (Word)">
            <i class="fa-solid fa-download"></i>
          </button>
          <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px;" onclick="editTestName('${t.id}')" title="Editar Nome da Prova">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn ${t.status === 'inactive' ? 'btn-success' : 'btn-warning'}" style="padding: 4px 8px; font-size: 12px;" onclick="toggleTestStatus('${t.id}')" title="${t.status === 'inactive' ? 'Ativar' : 'Desativar'}">
            <i class="fa-solid ${t.status === 'inactive' ? 'fa-play' : 'fa-pause'}"></i>
          </button>
          <button class="btn btn-danger" style="padding: 4px 8px; font-size: 12px;" onclick="deleteTest('${t.id}')" title="Excluir Prova">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  });
};

window.deleteTest = function(id) {
  showConfirm('Atenção: Tem certeza que deseja excluir esta prova DEFINITIVAMENTE? Esta ação não pode ser desfeita.', async () => {
    await supabase.from('submissions').delete().eq('test_id', id);
    await supabase.from('tests').delete().eq('id', id);
    showToast('Prova excluída com sucesso!', 'success');
    renderTests();
  });
};

window.editTestName = async function(id) {
  const { data: test } = await supabase.from('tests').select('id, title').eq('id', id).single();
  if (!test) return;
  document.getElementById('edit-test-id').value = test.id;
  document.getElementById('edit-test-title-input').value = test.title;
  openModal('edit-test-modal');
};

document.getElementById('edit-test-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-test-id').value;
  const newTitle = document.getElementById('edit-test-title-input').value;
  
  if (newTitle.trim()) {
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
    btn.disabled = true;

    await supabase.from('tests').update({ title: newTitle.trim() }).eq('id', id);
    
    btn.innerHTML = originalText;
    btn.disabled = false;
    
    renderTests();
    closeModal('edit-test-modal');
    showToast('Nome da prova atualizado!', 'success');
  }
});

window.viewTestDetails = async function(id) {
  const { data: test } = await supabase.from('tests').select('*').eq('id', id).single();
  if (!test) return;
  
  document.getElementById('details-test-title').innerText = test.title;
  const container = document.getElementById('test-details-content');
  container.innerHTML = '';
  
  test.questions.forEach((q, idx) => {
    let optsHtml = '';
    if (q.type === 'MULTIPLE_CHOICE') {
      optsHtml = '<ul class="preview-options">' + q.options.map((o, oIdx) => `
        <li>
          <span>${o}</span>
          ${q.correctOptionIdx === oIdx ? '<span style="color: var(--success); font-size: 12px;"><i class="fa-solid fa-check"></i> Correta</span>' : ''}
        </li>
      `).join('') + '</ul>';
    } else {
      optsHtml = '<p style="color: var(--warning); font-size: 14px; margin-top: 8px;"><i class="fa-solid fa-pen"></i> Campo dissertativo</p>';
    }
    
    container.innerHTML += `
      <div class="question-card" style="margin-bottom: 24px; padding: 16px; background: rgba(255, 255, 255, 0.02); border-radius: 8px;">
        <h4 style="margin-bottom: 12px;">${idx + 1}. ${q.text}</h4>
        ${optsHtml}
      </div>
    `;
  });
  
  openModal('test-details-modal');
};

window.deleteTest = function(id) {
  showConfirm('Tem certeza que deseja excluir esta prova?', async () => {
    await supabase.from('tests').delete().eq('id', id);
    renderTests();
  });
};

window.downloadTestAsDoc = async function(id) {
  const { data: test } = await supabase.from('tests').select('*').eq('id', id).single();
  if (!test) {
    showToast('Prova não encontrada.', 'error');
    return;
  }

  let docContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>${test.title}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12pt; }
        h1 { font-size: 16pt; text-align: center; margin-bottom: 5px; }
        .question { margin-top: 24px; font-weight: bold; }
        .options { list-style-type: upper-alpha; margin-top: 12px; margin-bottom: 24px; }
        .options li { margin-bottom: 8px; }
        .lines { margin-top: 20px; margin-bottom: 30px; }
        .line { border-bottom: 1px solid #000; width: 100%; height: 30px; }
      </style>
    </head>
    <body>
      <h1>${test.title}</h1>
      <p style="text-align: center;"><strong>Data de Criação:</strong> ${new Date(test.created_at).toLocaleDateString()}</p>
      <hr>
  `;

  test.questions.forEach((q, idx) => {
    docContent += `<div class="question">${idx + 1}. ${q.text}</div>`;
    if (q.type === 'MULTIPLE_CHOICE') {
      docContent += `<ul class="options">`;
      q.options.forEach((opt) => {
        docContent += `<li>${opt}</li>`;
      });
      docContent += `</ul>`;
    } else {
      docContent += `
        <div class="lines">
          <p>R: _________________________________________________________________________</p>
          <p>   _________________________________________________________________________</p>
          <p>   _________________________________________________________________________</p>
        </div>
      `;
    }
  });

  docContent += `</body></html>`;

  const blob = new Blob(['\ufeff', docContent], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Prova_${test.title.replace(/\s+/g, '_')}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

window.toggleTestStatus = async function(id) {
  const { data: test } = await supabase.from('tests').select('status').eq('id', id).single();
  if (test) {
    const newStatus = test.status === 'inactive' ? 'active' : 'inactive';
    await supabase.from('tests').update({ status: newStatus }).eq('id', id);
    renderTests();
  }
};

// Student Dashboard
window.renderStudentDashboard = async function() {
  const grid = document.getElementById('available-tests-grid');
  grid.innerHTML = '<p><i class="fa-solid fa-spinner fa-spin"></i> Buscando provas...</p>';
  
  const { data: tests } = await supabase.from('tests').select('*').eq('status', 'active');
  const { data: subs } = await supabase.from('submissions').select('test_id').eq('student_id', State.currentUser.id);
  
  grid.innerHTML = '';
  
  if (!tests || tests.length === 0) {
    grid.innerHTML = '<p>Nenhuma prova disponível no momento.</p>';
    return;
  }

  const takenTestIds = subs ? subs.map(s => s.test_id) : [];

  tests.forEach(t => {
    if (t.target_level && t.target_level !== 'TODOS' && t.target_level !== State.currentUser.profile) return;
    if (t.target_team && t.target_team !== 'TODOS' && t.target_team !== State.currentUser.team_id) return;
    
    if (!takenTestIds.includes(t.id)) {
      grid.innerHTML += `
        <div class="glass-panel stat-card" style="flex-direction: column; align-items: flex-start; gap: 16px;">
          <div>
            <h3>${t.title}</h3>
            <p>${t.questions.length} Questões</p>
          </div>
          <button class="btn" onclick="startTest('${t.id}')">Iniciar Prova</button>
        </div>
      `;
    }
  });
};

// Take Test Logic
let currentTakingTestId = null;

window.startTest = async function(testId) {
  currentTakingTestId = testId;
  const { data: test } = await supabase.from('tests').select('*').eq('id', testId).single();
  if (!test) return showToast('Prova não encontrada.', 'error');
  
  document.getElementById('taking-test-title').innerText = test.title;
  
  const container = document.getElementById('taking-test-container');
  container.innerHTML = '';
  
  test.questions.forEach((q, idx) => {
    let inputHtml = '';
    
    if (q.type === 'MULTIPLE_CHOICE') {
      inputHtml = q.options.map((opt, oIdx) => `
        <label class="option-label">
          <input type="radio" name="q_${idx}" value="${oIdx}" required>
          ${opt}
        </label>
      `).join('');
    } else {
      inputHtml = `<textarea name="q_${idx}" class="parser-area" style="height: 120px;" placeholder="Sua resposta..." required></textarea>`;
    }
    
    container.innerHTML += `
      <div class="question-card" data-idx="${idx}">
        <h4>${idx + 1}. ${q.text}</h4>
        <div style="margin-top: 16px;">
          ${inputHtml}
        </div>
      </div>
    `;
  });
  
  container.innerHTML += `<button class="btn" id="submit-test-btn" style="width: 100%; justify-content: center; margin-top: 24px;">Entregar Prova</button>`;
  
  // Submit logic
  document.getElementById('submit-test-btn').addEventListener('click', () => submitTest(test));
  
  showView('take-test-view');
}

async function submitTest(test) {
  const answers = [];
  let allAnswered = true;
  let needsGrading = false;
  let score = 0;

  test.questions.forEach((q, idx) => {
    if (q.type === 'MULTIPLE_CHOICE') {
      const selected = document.querySelector(`input[name="q_${idx}"]:checked`);
      if (selected) {
        const val = parseInt(selected.value, 10);
        answers.push({ questionIdx: idx, value: val, type: 'MULTIPLE_CHOICE' });
        if (q.correctOptionIdx === val) {
          score += 1;
        }
      } else {
        allAnswered = false;
      }
    } else {
      const textVal = document.querySelector(`textarea[name="q_${idx}"]`).value;
      if (textVal.trim()) {
        answers.push({ questionIdx: idx, value: textVal, type: 'ESSAY' });
        needsGrading = true;
      } else {
        allAnswered = false;
      }
    }
  });

  if (!allAnswered) {
    return showToast('Por favor, responda todas as questões antes de entregar.', 'error');
  }
  
  const btn = document.getElementById('submit-test-btn');
  const originalText = btn.innerText;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entregando...';
  btn.disabled = true;

  const submission = {
    test_id: test.id,
    student_id: State.currentUser.id,
    answers,
    needs_grading: needsGrading,
    score
  };

  await supabase.from('submissions').insert(submission);
  
  btn.innerHTML = originalText;
  btn.disabled = false;
  
  showToast('Prova entregue com sucesso!', 'success');
  showView('student-dashboard-view');
}

document.getElementById('back-to-tests-btn').addEventListener('click', () => {
  if(confirm('Se sair agora, seu progresso será perdido. Tem certeza?')) {
    showView('student-dashboard-view');
  }
});

// Student History
window.renderStudentHistory = async function() {
  const tbody = document.getElementById('student-history-tbody');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> Carregando histórico...</td></tr>';
  
  const { data: mySubmissions } = await supabase.from('submissions').select('*, tests(title, questions)').eq('student_id', State.currentUser.id);
  
  if (!mySubmissions) {
    tbody.innerHTML = '<tr><td colspan="6">Erro ao carregar histórico.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  mySubmissions.forEach(sub => {
    const test = sub.tests;
    const dateStr = new Date(sub.submitted_at).toLocaleDateString();
    const maxScore = test ? test.questions.length : 0;
    
    tbody.innerHTML += `
      <tr>
        <td>${test ? test.title : 'Prova Removida'}</td>
        <td>${dateStr}</td>
        <td>${sub.needs_grading ? '-' : sub.score}</td>
        <td>${maxScore}</td>
        <td>
          <span class="badge ${sub.needs_grading ? 'badge-yellow' : 'badge-green'}">
            ${sub.needs_grading ? 'Aguardando Avaliação' : 'Concluída'}
          </span>
        </td>
        <td>
          ${sub.needs_grading ? '-' : `<button class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px;" onclick="viewStudentResult('${sub.id}')">Ver Correção</button>`}
        </td>
      </tr>
    `;
  });
};

window.viewStudentResult = async function(subId) {
  const { data: sub } = await supabase.from('submissions').select('*, tests(title, questions), users(name)').eq('id', subId).single();
  if (!sub) return;
  const test = sub.tests;
  const student = sub.users;

  document.getElementById('result-test-title').innerText = `Resultado: ${test.title} (${student ? student.name : ''})`;
  const container = document.getElementById('student-result-content');
  container.innerHTML = '';
  
  let hasPendingEssays = false;

  test.questions.forEach((q, idx) => {
    const studentAns = sub.answers.find(a => a.questionIdx === idx);
    let optsHtml = '';
    
    if (q.type === 'MULTIPLE_CHOICE') {
      optsHtml = '<ul class="preview-options">' + q.options.map((o, oIdx) => {
        const isCorrectOption = (q.correctOptionIdx === oIdx);
        const didStudentChoose = (studentAns && studentAns.value === oIdx);
        
        let style = '';
        let icon = '';
        
        if (didStudentChoose && isCorrectOption) {
          style = 'color: var(--success); font-weight: bold;';
          icon = '<i class="fa-solid fa-check"></i>';
        } else if (didStudentChoose && !isCorrectOption) {
          style = 'color: var(--danger); text-decoration: line-through;';
          icon = '<i class="fa-solid fa-xmark"></i>';
        } else if (isCorrectOption) {
          style = 'color: var(--success);';
          icon = '<i class="fa-solid fa-check"></i> (Correta)';
        }

        return `
          <li style="${style}">
            <span>${o}</span>
            <span style="font-size: 12px; margin-left: 8px;">${icon}</span>
          </li>
        `;
      }).join('') + '</ul>';
    } else {
      if (State.currentUser && State.currentUser.role === 'EVALUATOR' && sub.needs_grading) {
        hasPendingEssays = true;
        optsHtml = `
          <div style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: 4px; margin-top: 8px; font-size: 14px;">
            <strong>Resposta do Aluno:</strong><br>
            <p style="margin-top: 8px;">${studentAns ? studentAns.value : 'Sem resposta'}</p>
            <div style="margin-top: 16px; display: flex; align-items: center; gap: 8px;">
              <label>Atribuir nota (0 ou 1):</label>
              <input type="number" id="grade_${idx}" class="input-control" style="width: 80px;" min="0" max="1" step="1">
            </div>
          </div>
        `;
      } else {
        optsHtml = `
          <div style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: 4px; margin-top: 8px; font-size: 14px;">
            <strong>${State.currentUser && State.currentUser.role === 'EVALUATOR' ? 'Resposta do Aluno' : 'Sua resposta'}:</strong><br>
            ${studentAns ? studentAns.value : 'Sem resposta'}
          </div>
        `;
      }
    }
    
    container.innerHTML += `
      <div class="question-card" style="margin-bottom: 24px; padding: 16px; background: rgba(255, 255, 255, 0.02); border-radius: 8px;">
        <h4 style="margin-bottom: 12px;">${idx + 1}. ${q.text}</h4>
        ${optsHtml}
      </div>
    `;
  });
  
  if (hasPendingEssays) {
    container.innerHTML += `<button class="btn" style="width: 100%; justify-content: center; margin-top: 16px;" onclick="saveGrades('${sub.id}', '${sub.test_id}', ${sub.score})">Salvar Correção</button>`;
  }

  openModal('student-result-modal');
};

window.saveGrades = async function(subId, testId, currentScore) {
  const { data: test } = await supabase.from('tests').select('questions').eq('id', testId).single();
  if (!test) return;

  let extraScore = 0;
  test.questions.forEach((q, idx) => {
    if (q.type === 'ESSAY') {
      const input = document.getElementById(`grade_${idx}`);
      if (input && input.value) {
        extraScore += parseInt(input.value, 10);
      }
    }
  });

  await supabase.from('submissions').update({
    score: currentScore + extraScore,
    needs_grading: false
  }).eq('id', subId);
  
  closeModal('student-result-modal');
  viewTestSubmissions(testId);
};

window.renderEvaluateView = async function() {
  document.getElementById('evaluate-tests-grid').style.display = 'grid';
  document.getElementById('evaluate-submissions-list').classList.add('hidden');
  document.getElementById('back-to-evaluate-tests-btn').classList.add('hidden');
  
  const grid = document.getElementById('evaluate-tests-grid');
  grid.innerHTML = '<p><i class="fa-solid fa-spinner fa-spin"></i> Carregando...</p>';
  
  const { data: myTests } = await supabase.from('tests').select('*');
  const { data: mySubmissions } = await supabase.from('submissions').select('test_id, needs_grading');
  
  grid.innerHTML = '';
  if (!myTests || myTests.length === 0) {
    grid.innerHTML = '<p>Nenhuma prova cadastrada no sistema ainda.</p>';
    return;
  }

  myTests.forEach(t => {
    const submissions = mySubmissions ? mySubmissions.filter(s => s.test_id === t.id) : [];
    const pendingCount = submissions.filter(s => s.needs_grading).length;
    
    grid.innerHTML += `
      <div class="glass-panel stat-card" style="flex-direction: column; align-items: flex-start; gap: 16px; cursor: pointer;" onclick="viewTestSubmissions('${t.id}')">
        <div>
          <h3>${t.title}</h3>
          <p>${t.questions.length} Questões | ${submissions.length} Respostas</p>
          ${pendingCount > 0 ? `<p style="color: var(--warning); margin-top: 8px;"><i class="fa-solid fa-clock"></i> ${pendingCount} pendentes de correção</p>` : ''}
        </div>
        <button class="btn btn-secondary" style="width: 100%; justify-content: center;">Ver Respostas</button>
      </div>
    `;
  });
};

window.viewTestSubmissions = async function(testId) {
  const { data: test } = await supabase.from('tests').select('*').eq('id', testId).single();
  if (!test) return;

  document.getElementById('evaluate-tests-grid').style.display = 'none';
  document.getElementById('evaluate-submissions-list').classList.remove('hidden');
  document.getElementById('back-to-evaluate-tests-btn').classList.remove('hidden');
  document.getElementById('evaluate-test-title').innerText = `Respostas: ${test.title}`;
  
  const tbody = document.getElementById('evaluate-submissions-tbody');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> Carregando respostas...</td></tr>';
  
  const { data: submissions } = await supabase.from('submissions').select('*, users(name, level)').eq('test_id', testId);
  
  tbody.innerHTML = '';
  if (!submissions || submissions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">Nenhum aluno respondeu ainda.</td></tr>';
    return;
  }

  submissions.forEach(sub => {
    const student = sub.users;
    if (!student) return;
    tbody.innerHTML += `
      <tr>
        <td><a href="#" style="color: var(--primary-light); text-decoration: underline;" onclick="event.preventDefault(); viewStudentResult('${sub.id}')">${student.name}</a></td>
        <td>${student.level}</td>
        <td>${sub.score}</td>
        <td>${test.questions.length}</td>
        <td>
          <span class="badge ${sub.needs_grading ? 'badge-yellow' : 'badge-green'}">
            ${sub.needs_grading ? 'Pendente' : 'Avaliada'}
          </span>
        </td>
      </tr>
    `;
  });
};

window.backToEvaluateTests = function() {
  renderEvaluateView();
};

// --- Question Bank Logic ---
window.renderQuestionBank = async function() {
  const { data: questions, error } = await supabase.from('question_bank').select('*, modules(name)').order('created_at', { ascending: false });
  if (error) {
    console.error("Fetch question_bank error:", error);
    showToast("Erro DB: " + error.message, "error");
  }

  const { data: modulesData, error: modulesError } = await supabase.from('modules').select('*').order('name');
  if (modulesError) {
    console.error("Fetch modules error:", modulesError);
    showToast("Erro DB Módulos: " + modulesError.message, "error");
  }
  
  window.qbQuestions = questions || [];
  window.qbModules = modulesData || [];

  // Update new question dropdown
  const datalist = document.getElementById('bank-module');
  if (datalist) {
    datalist.innerHTML = '<option value="">Selecione um módulo</option>' + window.qbModules.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  }

  // Count questions per module
  const counts = { 'sem_modulo': { name: 'Sem Módulo', count: 0 } };
  window.qbModules.forEach(m => {
    counts[m.id] = { name: m.name, count: 0 };
  });

  window.qbQuestions.forEach(q => {
    if (q.module_id && counts[q.module_id]) {
      counts[q.module_id].count++;
    } else {
      counts['sem_modulo'].count++;
    }
  });

  // Render Module Grid
  const grid = document.getElementById('qb-modules-grid');
  if (grid) {
    let gridHTML = '';
    
    // Total Geral Card
    gridHTML += `
      <div class="glass-panel stat-card" style="cursor: pointer; background: rgba(56, 189, 248, 0.1); border-color: var(--primary-color);" onclick="openModuleQuestions('TODOS', 'Total Geral')">
        <div class="stat-icon" style="color: var(--primary-color);"><i class="fa-solid fa-layer-group"></i></div>
        <div class="stat-info">
          <h4>Total Geral</h4>
          <div class="value" style="font-size: 24px;">${window.qbQuestions.length} questões</div>
        </div>
      </div>
    `;

    // Individual Modules
    window.qbModules.forEach(m => {
      gridHTML += `
        <div class="glass-panel stat-card" style="cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'" onclick="openModuleQuestions('${m.id}', '${m.name.replace(/'/g, "\\'")}')">
          <div class="stat-icon"><i class="fa-solid fa-folder"></i></div>
          <div class="stat-info">
            <h4>${m.name}</h4>
            <div class="value" style="font-size: 24px;">${counts[m.id].count} questões</div>
          </div>
        </div>
      `;
    });

    // Sem Módulo (se tiver)
    if (counts['sem_modulo'].count > 0) {
      gridHTML += `
        <div class="glass-panel stat-card" style="cursor: pointer;" onclick="openModuleQuestions('sem_modulo', 'Sem Módulo')">
          <div class="stat-icon" style="color: var(--text-muted);"><i class="fa-solid fa-folder-open"></i></div>
          <div class="stat-info">
            <h4 style="color: var(--text-muted);">Sem Módulo</h4>
            <div class="value" style="font-size: 24px;">${counts['sem_modulo'].count} questões</div>
          </div>
        </div>
      `;
    }

    grid.innerHTML = gridHTML;
  }

  // If already in a specific module view, update that view too
  if (window.currentModuleFilter) {
    renderModuleQuestions();
  }
};

window.openModuleQuestions = function(moduleId, moduleName) {
  window.currentModuleFilter = moduleId;
  
  document.getElementById('qb-modules-grid').style.display = 'none';
  document.getElementById('qb-questions-list').style.display = 'block';
  document.getElementById('qb-module-title').innerText = moduleName === 'Total Geral' ? 'Todas as Questões' : `Módulo: ${moduleName}`;
  document.getElementById('search-questions').value = '';
  
  // Set default module for new questions
  const datalist = document.getElementById('bank-module');
  if (datalist && moduleId !== 'TODOS' && moduleId !== 'sem_modulo') {
    datalist.value = moduleId;
  }
  
  renderModuleQuestions();
};

window.closeModuleQuestions = function() {
  window.currentModuleFilter = null;
  document.getElementById('qb-modules-grid').style.display = 'grid';
  document.getElementById('qb-questions-list').style.display = 'none';
};

window.renderModuleQuestions = function() {
  const tbody = document.getElementById('questions-tbody');
  if(!tbody) return;
  
  const searchInput = document.getElementById('search-questions');
  const search = searchInput ? searchInput.value.toLowerCase() : '';
  const moduleId = window.currentModuleFilter;

  const filtered = (window.qbQuestions || []).filter(q => {
    // Filter by module
    let matchModule = false;
    if (moduleId === 'TODOS') matchModule = true;
    else if (moduleId === 'sem_modulo') matchModule = !q.module_id;
    else matchModule = q.module_id === moduleId;

    // Filter by search
    const matchSearch = q.question_text.toLowerCase().includes(search);
    
    return matchModule && matchSearch;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="2" style="text-align: center; padding: 24px; color: var(--text-muted);">Nenhuma questão encontrada neste módulo.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(q => `
    <tr>
      <td style="max-width: 500px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${q.question_text.replace(/"/g, '&quot;')}">${q.question_text}</td>
      <td>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-icon btn-secondary" onclick="editQuestionBank('${q.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-icon btn-danger" onclick="deleteQuestionBank('${q.id}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
};

document.getElementById('module-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('new-module-name').value;
  if (!name || !name.trim()) return;
  
  const btn = e.target.querySelector('button[type="submit"]');
  const original = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  btn.disabled = true;

  try {
    const res = await supabase.from('modules').insert({ name: name.trim() }).select();
    const { error, data } = res;
    
    btn.innerHTML = original;
    btn.disabled = false;
    
    if (error) {
      showToast('Erro Supabase Insert: ' + error.message, 'error');
    } else {
      showToast('Módulo criado com sucesso!', 'success');
      document.getElementById('new-module-name').value = '';
      openManageModules(); // refresh the list
      renderQuestionBank();
      if (document.getElementById('auto-creation-tab')?.style.display === 'block') {
        renderAutoModules();
      }
    }
  } catch(err) {
    btn.innerHTML = original;
    btn.disabled = false;
    showToast('Exceção ao inserir: ' + err.message, 'error');
  }
});

window.openManageModules = async function() {
  const container = document.getElementById('manage-modules-list');
  container.innerHTML = '<div style="text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Carregando...</div>';
  openModal('module-modal');

  const { data: modulesData, error } = await supabase.from('modules').select('*').order('name');
  
  if (error) {
    container.innerHTML = '<div style="color: var(--danger);">Erro ao carregar módulos</div>';
    return;
  }

  if (!modulesData || modulesData.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted);">Nenhum módulo cadastrado.</div>';
    return;
  }

  container.innerHTML = modulesData.map(m => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
      <span style="font-weight: 500;">${m.name}</span>
      <button class="btn btn-icon btn-danger" style="padding: 6px; min-width: unset; width: 32px; height: 32px;" onclick="deleteModule('${m.id}')" title="Excluir Módulo"><i class="fa-solid fa-trash"></i></button>
    </div>
  `).join('');
};

window.deleteModule = function(id) {
  showConfirm('Tem certeza? Se este módulo possuir questões vinculadas, a exclusão será bloqueada pelo banco de dados.', async () => {
    const { error } = await supabase.from('modules').delete().eq('id', id);
    if (error) {
      if (error.message.includes('foreign key constraint') || error.code === '23503') {
        showToast('Não é possível excluir. Existem questões vinculadas a este módulo.', 'error');
      } else {
        showToast('Erro ao excluir: ' + error.message, 'error');
      }
    } else {
      showToast('Módulo excluído com sucesso!', 'success');
      openManageModules(); // refresh the list
      renderQuestionBank();
      if (document.getElementById('auto-creation-tab')?.style.display === 'block') {
        renderAutoModules();
      }
    }
  });
};

window.editQuestionBank = async function(id) {
  const { data, error } = await supabase.from('question_bank').select('*').eq('id', id).single();
  if (error || !data) return showToast('Erro ao carregar questão', 'error');

  const { data: modulesData } = await supabase.from('modules').select('*').order('name');
  const modSelect = document.getElementById('edit-question-module');
  modSelect.innerHTML = (modulesData || []).map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  
  document.getElementById('edit-question-id').value = data.id;
  modSelect.value = data.module_id;
  document.getElementById('edit-question-text').value = data.question_text;
  document.getElementById('edit-question-answer').value = data.correct_answer;

  const optContainer = document.getElementById('edit-question-options-container');
  optContainer.innerHTML = '';
  
  const options = data.options || [];
  const letters = ['A', 'B', 'C', 'D', 'E'];
  
  for(let i=0; i<5; i++) {
    const val = options[i] || '';
    optContainer.innerHTML += `
      <div style="display: flex; gap: 8px; align-items: center;">
        <span style="font-weight: bold; width: 20px;">${letters[i]})</span>
        <input type="text" class="input-control edit-opt" style="flex: 1;" placeholder="Alternativa ${letters[i]}" value="${val.replace(/"/g, '&quot;')}">
      </div>
    `;
  }
  
  openModal('edit-question-modal');
};

document.getElementById('edit-question-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-question-id').value;
  const moduleId = document.getElementById('edit-question-module').value;
  const text = document.getElementById('edit-question-text').value;
  const answer = document.getElementById('edit-question-answer').value;
  
  const optInputs = document.querySelectorAll('.edit-opt');
  const options = Array.from(optInputs).map(inp => inp.value.trim()).filter(v => v !== '');
  
  if (options.length < 2) return showToast('Preencha pelo menos duas alternativas', 'warning');

  const btn = e.target.querySelector('button[type="submit"]');
  const original = btn.innerText;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
  btn.disabled = true;

  const { error } = await supabase.from('question_bank').update({
    module_id: moduleId,
    question_text: text,
    options: options,
    correct_answer: answer
  }).eq('id', id);

  btn.innerText = original;
  btn.disabled = false;

  if (error) {
    showToast('Erro ao atualizar questão', 'error');
  } else {
    showToast('Questão atualizada com sucesso', 'success');
    closeModal('edit-question-modal');
    renderQuestionBank();
  }
});

window.deleteQuestionBank = function(id) {
  showConfirm('Deseja excluir esta questão do banco?', async () => {
    await supabase.from('question_bank').delete().eq('id', id);
    showToast('Questão excluída.', 'success');
    renderQuestionBank();
  });
};

document.getElementById('question-bank-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const moduleId = document.getElementById('bank-module').value;
  const text = document.getElementById('bank-parser').value;
  
  if (!moduleId) return showToast('Selecione um módulo.', 'error');
  if (!text.trim()) return showToast('Cole as questões primeiro.', 'error');
  
  const lines = text.split('\n').filter(l => l.trim() !== '');
  const questions = [];
  let currentQ = null;

  lines.forEach(line => {
    const isQuestionMatch = line.match(/^(\d+[\.\)]\s*|Pergunta \d+:\s*)/i);
    if (isQuestionMatch) {
      if (currentQ) questions.push(currentQ);
      currentQ = {
        module_id: moduleId,
        question_text: line.substring(isQuestionMatch[0].length).trim(),
        type: 'MULTIPLE_CHOICE',
        options: [],
        correct_answer: ''
      };
    } 
    else if (currentQ && line.match(/^(Resposta|Answer):\s*([a-e])/i)) {
      const match = line.match(/^(Resposta|Answer):\s*([a-e])/i);
      currentQ.correct_answer = match[2].toUpperCase();
    }
    else if (currentQ && line.match(/^([a-e][\)\.]\s*|Resposta \d+\.[a-e]:\s*)/i)) {
      let optText = line.replace(/^([a-e][\)\.]\s*|Resposta \d+\.[a-e]:\s*)/i, '').trim();
      currentQ.options.push(optText);
    }
  });
  if (currentQ) questions.push(currentQ);

  const validQs = questions.filter(q => q.options.length > 0 && q.correct_answer !== '');
  if (validQs.length === 0) return showToast('Nenhuma questão válida encontrada. Lembre-se do formato correto.', 'error');

  const btn = document.getElementById('save-bank-btn');
  const original = btn.innerText;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...';
  btn.disabled = true;

  const { error } = await supabase.from('question_bank').insert(validQs);
  
  btn.innerText = original;
  btn.disabled = false;
  
  if (error) {
    console.error(error);
    showToast('Erro ao salvar no banco de questões.', 'error');
  } else {
    showToast(`${validQs.length} questão(ões) salva(s) com sucesso!`, 'success');
    closeModal('question-bank-modal');
    document.getElementById('bank-parser').value = '';
    renderQuestionBank();
  }
});

// --- Tab Logic for Create Test ---
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const tabId = e.target.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('active');
      b.style.borderBottom = 'none';
      b.style.color = 'var(--text-muted)';
    });
    e.target.classList.add('active');
    e.target.style.borderBottom = '2px solid var(--primary-color)';
    e.target.style.color = 'var(--primary-light)';

    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    document.getElementById(`${tabId}-tab`).style.display = 'block';
    
    if (tabId === 'auto-creation') {
      renderAutoModules();
    }
  });
});

async function renderAutoModules() {
  const container = document.getElementById('auto-modules-container');
  if (container.children.length > 0) container.innerHTML = '';
  
  const { data: modulesData } = await supabase.from('modules').select('*').order('name');
  window.availableModules = modulesData || [];
  
  addAutoModuleRow();
}

window.addAutoModuleRow = function() {
  const container = document.getElementById('auto-modules-container');
  const rowId = 'mod-row-' + Date.now();
  
  const options = (window.availableModules || []).map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  
  const rowHTML = `
    <div id="${rowId}" style="display: flex; flex-direction: row; gap: 16px; align-items: flex-end; margin-bottom: 12px; max-width: 600px;">
      <div class="input-group" style="flex: 2; margin-bottom: 0;">
        <label>Módulo</label>
        <select class="input-control auto-module-select">
          ${options}
        </select>
      </div>
      <div class="input-group" style="flex: 1; margin-bottom: 0;">
        <label>Qtd. Questões</label>
        <input type="number" class="input-control auto-module-qtd" min="1" value="1">
      </div>
      <div style="margin-bottom: 0;">
        <button class="btn btn-icon btn-danger" style="height: 42px;" onclick="document.getElementById('${rowId}').remove()"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', rowHTML);
}
document.getElementById('add-module-row-btn')?.addEventListener('click', addAutoModuleRow);

document.getElementById('generate-auto-test-btn')?.addEventListener('click', async () => {
  const rows = document.querySelectorAll('.auto-module-select');
  const qtds = document.querySelectorAll('.auto-module-qtd');
  
  if (rows.length === 0) return showToast('Adicione pelo menos um módulo.', 'error');
  
  const request = [];
  for(let i=0; i<rows.length; i++) {
    request.push({ module: rows[i].value, limit: parseInt(qtds[i].value) });
  }
  
  const btn = document.getElementById('generate-auto-test-btn');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando...';
  btn.disabled = true;
  
  let allQuestions = [];
  
  for(const req of request) {
    const { data: qBank } = await supabase.from('question_bank').select('*, modules(name)').eq('module_id', req.module);
    if (qBank && qBank.length > 0) {
      // Shuffle
      const shuffled = qBank.sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, req.limit);
      
      const mapped = selected.map(q => {
        const letterIdx = q.correct_answer.charCodeAt(0) - 65;
        return {
          text: q.question_text,
          moduleName: q.modules ? q.modules.name : '?',
          type: 'MULTIPLE_CHOICE',
          options: q.options,
          correctOptionIdx: letterIdx >= 0 && letterIdx < q.options.length ? letterIdx : 0
        };
      });
      allQuestions = allQuestions.concat(mapped);
    }
  }
  
  btn.innerHTML = originalText;
  btn.disabled = false;
  
  if (allQuestions.length === 0) {
    return showToast('Nenhuma questão encontrada para os módulos selecionados.', 'error');
  }
  
  currentParsedData = allQuestions;
  renderParsedPreview();
  showToast('Prova gerada com sucesso! Revise abaixo.', 'success');
  document.getElementById('parsed-result').classList.remove('hidden');
});

document.getElementById('clear-auto-preview-btn')?.addEventListener('click', () => {
  currentParsedData = [];
  document.getElementById('parsed-result').classList.add('hidden');
  document.getElementById('preview-container').innerHTML = '';
});
