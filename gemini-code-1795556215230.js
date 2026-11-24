import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ==========================================
// 1. CONFIGURAÇÃO DO BANCO DE DADOS (FIREBASE)
// ==========================================
// Substitua pelos dados do seu projeto no Firebase Console
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:000000000000"
};

let db = null;
let useLocalFallback = false;

try {
  if (firebaseConfig.apiKey === "SUA_API_KEY") {
    throw new Error("Credenciais padrão detectadas. Ativando modo LocalStorage.");
  }
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  updateDbStatus(true, "Conectado ao Firebase Firestore");
} catch (error) {
  console.warn(error.message);
  useLocalFallback = true;
  updateDbStatus(true, "Modo Demonstração (LocalStorage)");
}

// ==========================================
// 2. INICIALIZAÇÃO DE ÍCONES E UI
// ==========================================
lucide.createIcons();

const mobileToggle = document.getElementById("mobileToggle");
const navLinks = document.getElementById("navLinks");
const adminModal = document.getElementById("adminModal");
const btnOpenAdmin = document.getElementById("btnOpenAdmin");
const btnCloseAdmin = document.getElementById("btnCloseAdmin");

mobileToggle.addEventListener("click", () => navLinks.classList.toggle("active"));
btnOpenAdmin.addEventListener("click", () => adminModal.classList.add("open"));
btnCloseAdmin.addEventListener("click", () => adminModal.classList.remove("open"));
adminModal.addEventListener("click", (e) => {
  if (e.target === adminModal) adminModal.classList.remove("open");
});

// Filtro do Portfólio
const filterBtns = document.querySelectorAll(".filter-btn");
const projectCards = document.querySelectorAll(".project-card");

filterBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    filterBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const filter = btn.dataset.filter;
    projectCards.forEach(card => {
      if (filter === "all" || card.dataset.category === filter) {
        card.classList.remove("hidden");
      } else {
        card.classList.add("hidden");
      }
    });
  });
});

// ==========================================
// 3. OPERAÇÕES DE BANCO DE DADOS (CRUD)
// ==========================================
const leadForm = document.getElementById("leadForm");
const leadsTableBody = document.getElementById("leadsTableBody");
const leadCountBadge = document.getElementById("leadCountBadge");

// CREATE: Salvar novo orçamento
leadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btnSubmit = document.getElementById("btnSubmit");
  btnSubmit.disabled = true;

  const novoLead = {
    nome: document.getElementById("nome").value.trim(),
    email: document.getElementById("email").value.trim(),
    empresa: document.getElementById("empresa").value.trim() || "Não informada",
    servico: document.getElementById("servico").value,
    orcamento: document.getElementById("orcamento").value,
    descricao: document.getElementById("descricao").value.trim(),
    status: "Novo"
  };

  try {
    if (!useLocalFallback) {
      await addDoc(collection(db, "leads"), {
        ...novoLead,
        criadoEm: serverTimestamp()
      });
    } else {
      const leadsLocais = getLocalLeads();
      leadsLocais.unshift({ id: Date.now().toString(), ...novoLead });
      localStorage.setItem("nexustech_leads", JSON.stringify(leadsLocais));
      renderLeads(leadsLocais);
    }

    leadForm.reset();
    showToast("Solicitação enviada e salva no banco de dados!");
  } catch (err) {
    console.error("Erro ao salvar:", err);
    showToast("Erro ao salvar solicitação. Verifique o console.");
  } finally {
    btnSubmit.disabled = false;
  }
});

// READ: Escutar registros em tempo real
function iniciarEscutaBanco() {
  if (!useLocalFallback) {
    const q = query(collection(db, "leads"), orderBy("criadoEm", "desc"));
    onSnapshot(q, (snapshot) => {
      const leads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderLeads(leads);
    });
  } else {
    renderLeads(getLocalLeads());
  }
}

// UPDATE: Atualizar status do lead
window.atualizarStatus = async (id, novoStatus) => {
  if (!useLocalFallback) {
    await updateDoc(doc(db, "leads", id), { status: novoStatus });
  } else {
    const leads = getLocalLeads().map(l => l.id === id ? { ...l, status: novoStatus } : l);
    localStorage.setItem("nexustech_leads", JSON.stringify(leads));
    renderLeads(leads);
  }
  showToast(`Status alterado para "${novoStatus}"`);
};

// DELETE: Excluir lead
window.excluirLead = async (id) => {
  if (!confirm("Deseja realmente excluir este registro do banco de dados?")) return;

  if (!useLocalFallback) {
    await deleteDoc(doc(db, "leads", id));
  } else {
    const leads = getLocalLeads().filter(l => l.id !== id);
    localStorage.setItem("nexustech_leads", JSON.stringify(leads));
    renderLeads(leads);
  }
  showToast("Registro removido com sucesso.");
};

// ==========================================
// 4. FUNÇÕES AUXILIARES
// ==========================================
function renderLeads(leads) {
  leadCountBadge.textContent = leads.length;

  if (leads.length === 0) {
    leadsTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a3b8;">Nenhum orçamento cadastrado ainda.</td></tr>`;
    return;
  }

  leadsTableBody.innerHTML = leads.map(lead => `
    <tr>
      <td>
        <strong>${escapeHTML(lead.nome)}</strong><br>
        <small style="color:#94a3b8">${escapeHTML(lead.empresa)} • ${escapeHTML(lead.email)}</small>
      </td>
      <td>${escapeHTML(lead.servico)}</td>
      <td>${escapeHTML(lead.orcamento)}</td>
      <td>
        <select class="status-select" onchange="atualizarStatus('${lead.id}', this.value)">
          <option value="Novo" ${lead.status === "Novo" ? "selected" : ""}>Novo</option>
          <option value="Em Análise" ${lead.status === "Em Análise" ? "selected" : ""}>Em Análise</option>
          <option value="Proposta Enviada" ${lead.status === "Proposta Enviada" ? "selected" : ""}>Proposta Enviada</option>
          <option value="Fechado" ${lead.status === "Fechado" ? "selected" : ""}>Fechado</option>
        </select>
      </td>
      <td>
        <button class="btn-delete" onclick="excluirLead('${lead.id}')" title="Excluir">
          Excluir
        </button>
      </td>
    </tr>
  `).join("");
}

function getLocalLeads() {
  return JSON.parse(localStorage.getItem("nexustech_leads") || "[]");
}

function updateDbStatus(isOnline, text) {
  const statusEl = document.getElementById("dbStatus");
  if (isOnline) statusEl.classList.add("online");
  statusEl.innerHTML = `<span class="status-dot"></span> ${text}`;
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3500);
}

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&', '<': '<', '>': '>', '"': '"', "'": '''
  }[m]));
}

// Iniciar leitura dos dados ao carregar
iniciarEscutaBanco();