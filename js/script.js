(() => {
  const AUTH_KEY = "ccam_auth";
  const USERS = {
    "admin@ccam.com": { password: "1234", role: "admin" },
    "aluno@ccam.com": { password: "1234", role: "aluno" }
  };
  const getPath = () => (location.pathname || "").split("/").pop() || "index.html";

  // API LOCAL DO JAVA
  const API_URL = "http://localhost:8081/api";

  const safeJsonParse = (raw) => { try { return JSON.parse(raw); } catch { return null; } };
  const getWindowNameSession = () => {
    const prefix = `${AUTH_KEY}=`;
    if (!window.name || !window.name.startsWith(prefix)) return null;
    return safeJsonParse(window.name.slice(prefix.length));
  };
  const setWindowNameSession = (session) => { try { window.name = `${AUTH_KEY}=${JSON.stringify(session)}`; } catch {} };
  const clearWindowNameSession = () => { const prefix = `${AUTH_KEY}=`; if (window.name && window.name.startsWith(prefix)) window.name = ""; };
  const loadSession = () => {
    const fromSession = safeJsonParse(sessionStorage.getItem(AUTH_KEY) || "");
    if (fromSession?.logged) return fromSession;
    const fromName = getWindowNameSession();
    if (fromName?.logged) return fromName;
    return null;
  };
  const saveSession = (session) => {
    try { sessionStorage.setItem(AUTH_KEY, JSON.stringify(session)); } catch {}
    setWindowNameSession(session);
  };
  const clearSession = () => {
    try { localStorage.removeItem(AUTH_KEY); } catch {}
    try { sessionStorage.removeItem(AUTH_KEY); } catch {}
    clearWindowNameSession();
  };

  const setActiveNav = () => {
    const path = getPath();
    const links = document.querySelectorAll("[data-nav] a[href]");
    for (const a of links) {
      const href = a.getAttribute("href") || "";
      if (href === path || (path === "" && href === "index.html")) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
  };

  const hideForStudent = (session) => {
    if (session.role !== "aluno") return;
    const restricted = ["cadastro.html", "dashboard.html", "crm.html", "empresa.html"];
    document.querySelectorAll("[data-nav] a[href]").forEach((link) => {
      if (restricted.includes(link.getAttribute("href") || "")) link.style.display = "none";
    });
    const path = getPath();
    if (path === "index.html" || path === "") {
      document.querySelectorAll(".hero__actions a[href]").forEach((btn) => {
        if (restricted.includes(btn.getAttribute("href") || "")) btn.style.display = "none";
      });
      document.querySelectorAll(".grid .card").forEach((card) => {
        const title = card.querySelector("h2")?.textContent?.toLowerCase() || "";
        if (title.includes("cadastro") || title.includes("empresa") || title.includes("crm")) card.style.display = "none";
      });
    }
  };

  const enforceAuth = () => {
    const path = getPath();
    const session = loadSession();
    const onLogin = path === "login.html";
    if (!session && !onLogin) { location.replace("login.html"); return; }
    if (session) {
      if (session.role === "aluno") {
        const restricted = ["index.html", "cadastro.html", "dashboard.html", "crm.html", "empresa.html"];
        if (onLogin || path === "" || restricted.includes(path)) { location.replace("app-aluno.html"); return; }
      } else {
        if (onLogin) { location.replace("index.html"); return; }
      }
      hideForStudent(session);
    }
  };

  const wireLoginForm = () => {
    const form = document.getElementById("loginForm");
    if (!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const emailEl = document.getElementById("email");
      const passEl = document.getElementById("password");
      if (!(emailEl instanceof HTMLInputElement) || !(passEl instanceof HTMLInputElement)) { form.submit(); return; }
      const email = emailEl.value.trim();
      const password = passEl.value.trim();
      const errorEl = document.getElementById("loginError");
      const user = USERS[email];
      if (user && user.password === password) {
        saveSession({ logged: true, email, role: user.role });
        if (user.role === "aluno") location.replace("app-aluno.html");
        else location.replace("index.html");
      } else {
        if (errorEl) errorEl.textContent = "Acesso negado. Verifique suas credenciais.";
      }
    });
  };

  const wireConfirmables = () => {
    document.addEventListener("click", (e) => {
      const el = e.target instanceof Element ? e.target.closest("[data-confirm]") : null;
      if (!el) return;
      if (!confirm(el.getAttribute("data-confirm") || "Confirmar ação?")) e.preventDefault();
    });
  };

  const wireFormHints = () => {
    document.querySelectorAll("form[data-enhance]").forEach(form => {
      form.addEventListener("submit", (e) => {
        for (const field of form.querySelectorAll("[required]")) {
          if (field.value.trim() === "") {
            e.preventDefault();
            field.focus();
            alert("Preencha os campos obrigatórios antes de continuar.");
            return;
          }
        }
      });
    });
  };

  const wireLogout = () => {
    document.addEventListener("click", (e) => {
      if (!e.target.closest("[data-logout]")) return;
      e.preventDefault();
      clearSession();
      location.replace("login.html");
    });
  };

  // --- INTEGRAÇÃO JAVA: CADASTRO DE ALUNOS ---
  const wireCadastroForm = () => {
    const form = document.getElementById("formCadastro");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btnSalvar = form.querySelector('button[type="submit"]');
      if (btnSalvar) { btnSalvar.textContent = "Salvando..."; btnSalvar.disabled = true; }

      const peso = parseFloat(document.getElementById("peso")?.value) || 0;
      
      const dadosCliente = {
        nome: document.getElementById("nome")?.value.trim(),
        email: document.getElementById("email")?.value.trim(),
        cpf: document.getElementById("cpf")?.value.trim(),
        telefone: document.getElementById("celular")?.value.trim(),
        peso: peso || null
      };

      try {
        const resposta = await fetch(`${API_URL}/clientes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dadosCliente)
        });

        if (!resposta.ok) {
          const erro = await resposta.json();
          throw new Error(erro.erro || "Erro desconhecido ao cadastrar");
        }

        alert("Aluno cadastrado com sucesso no banco local PostgreSQL!");
        form.reset();
      } catch (err) {
        alert("Erro ao cadastrar: " + err.message);
      } finally {
        if (btnSalvar) { btnSalvar.textContent = "Salvar Cadastro"; btnSalvar.disabled = false; }
      }
    });
  };

  // --- INTEGRAÇÃO JAVA: MURAL DE AVISOS ---
  const wireMural = async () => {
    const formMural = document.getElementById("formMural");
    const listaAvisos = document.getElementById("lista-avisos");
    if (!formMural || !listaAvisos) return;

    const carregarAvisos = async () => {
      try {
        const resposta = await fetch(`${API_URL}/mural`);
        const avisos = await resposta.json();
        listaAvisos.innerHTML = "";

        if (avisos && avisos.length > 0) {
          avisos.forEach(aviso => {
            const dataFormatada = new Date(aviso.dataPublicacao).toLocaleDateString('pt-BR');
            listaAvisos.innerHTML += `
              <article class="card">
                <h2>${aviso.titulo}</h2>
                <p style="margin-top: 8px;">${aviso.mensagem}</p>
                <div class="spacer" style="margin: 16px 0;"></div>
                <span class="help">Publicado em: ${dataFormatada}</span>
              </article>
            `;
          });
        } else {
          listaAvisos.innerHTML = "<p style='color: #aaa; grid-column: span 2;'>Nenhum aviso publicado.</p>";
        }
      } catch (err) { console.error("Erro ao carregar mural:", err); }
    };

    formMural.addEventListener("submit", async (e) => {
      e.preventDefault();
      const titulo = document.getElementById("aviso_titulo").value;
      const mensagem = document.getElementById("aviso_mensagem").value;
      const btn = formMural.querySelector("button");

      btn.textContent = "Publicando..."; btn.disabled = true;

      try {
        await fetch(`${API_URL}/mural`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ titulo, mensagem })
        });
        formMural.reset();
        carregarAvisos();
      } catch (err) {
        alert("Erro ao postar: " + err.message);
      } finally {
        btn.textContent = "Publicar Aviso"; btn.disabled = false;
      }
    });

    carregarAvisos();
  };

  // --- INTEGRAÇÃO JAVA: DASHBOARD (CRM) ---
  const loadCRMData = async () => {
    const kpiTotal = document.getElementById("kpi-total-alunos");
    if (!kpiTotal) return;
    try {
      const resposta = await fetch(`${API_URL}/clientes`);
      const clientes = await resposta.json();
      if (clientes) kpiTotal.textContent = clientes.length;
    } catch (err) { console.error("Erro CRM:", err); }
  };

  document.addEventListener("DOMContentLoaded", () => {
    enforceAuth();
    wireLoginForm();
    setActiveNav();
    wireConfirmables();
    wireFormHints();
    wireLogout();
    
    // As funções conectadas na nova API:
    wireCadastroForm();
    wireMural();
    loadCRMData();
  });
})();