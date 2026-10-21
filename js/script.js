(() => {
  const AUTH_KEY = "ccam_auth";
  const USERS = {
    "admin@ccam.com": { password: "1234", role: "admin" },
    "aluno@ccam.com": { password: "1234", role: "aluno" }
  };
  const getPath = () => (location.pathname || "").split("/").pop() || "index.html";

  // API: local no seu PC, nuvem (Render) quando o site está publicado
  const API_URL = (["localhost", "127.0.0.1", ""].includes(location.hostname))
    ? "http://localhost:8081/api"
    : "https://ccam-2-0.onrender.com/api";

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

      const valor = (id) => document.getElementById(id)?.value.trim() || null;
      const numero = (id) => parseFloat(document.getElementById(id)?.value) || null;

      const dadosCliente = {
        nome: valor("nome"),
        email: valor("email"),
        cpf: valor("cpf"),
        telefone: valor("celular"),
        telefoneFixo: valor("telefone_fixo"),
        dataNascimento: valor("data_nascimento"), // "AAAA-MM-DD" ou null
        peso: numero("peso"),
        altura: numero("altura"),
        sexo: valor("sexo"),
        condicaoSaude: valor("condicao_saude")
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

  // --- INTEGRAÇÃO JAVA: TREINO (CATÁLOGO) ---
  const wireTreinoForm = async () => {
    const selectAluno = document.getElementById("select-aluno");
    const formTreino = document.getElementById("formTreino");
    const catalogoContainer = document.getElementById("catalogo-container");
    const exercicioDisplay = document.getElementById("exercicio-display");
    if (!selectAluno || !formTreino || !catalogoContainer) return;

    let catalogoCompleto = [];
    let idExercicioSelecionado = null;

    // 1. Carregar Alunos
    try {
      const res = await fetch(`${API_URL}/clientes`);
      const alunos = await res.json();
      selectAluno.innerHTML = '<option value="" disabled selected>Selecione um aluno...</option>';
      alunos.forEach(a => selectAluno.innerHTML += `<option value="${a.id}">${a.nome}</option>`);
    } catch (err) { console.error("Erro alunos:", err); }

    // 2. Carregar Catálogo
    try {
      const res = await fetch(`${API_URL}/catalogo`);
      const catalogo = await res.json();
      catalogoCompleto = catalogo;
      catalogoContainer.innerHTML = '';
      
      const grupos = {};
      catalogo.forEach(ex => {
        if (!grupos[ex.grupoMuscular]) grupos[ex.grupoMuscular] = [];
        grupos[ex.grupoMuscular].push(ex);
      });

      for (const [grupo, exercicios] of Object.entries(grupos)) {
        let htmlGrupo = `<details><summary> ${grupo.toUpperCase()}</summary><ul style="list-style: none; padding: 0; margin: 0 0 10px 0;">`;
        exercicios.forEach(ex => {
          htmlGrupo += `<li class="exercicio-item" data-id="${ex.id}">▸ ${ex.nome}</li>`;
        });
        catalogoContainer.innerHTML += htmlGrupo + `</ul></details>`;
      }

      document.querySelectorAll('.exercicio-item').forEach(item => {
        item.addEventListener('click', (e) => {
          document.querySelectorAll('.exercicio-item').forEach(el => el.classList.remove('selecionado'));
          e.target.classList.add('selecionado');
          idExercicioSelecionado = e.target.getAttribute('data-id');
          const exData = catalogoCompleto.find(x => x.id == idExercicioSelecionado);
          if (exercicioDisplay) {
            exercicioDisplay.innerHTML = `<span style="color: #fff;"><strong>[${exData.grupoMuscular}]</strong> ${exData.nome}</span>`;
            exercicioDisplay.style.background = "rgba(156, 39, 176, 0.1)";
          }
        });
      });
    } catch (err) { console.error("Erro catálogo:", err); }

    // 3. Salvar Prescrição
    formTreino.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!idExercicioSelecionado) return alert("⚠️ Selecione um exercício do catálogo.");

      const btn = formTreino.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = "Salvando...";

      try {
        const dadosCat = catalogoCompleto.find(ex => ex.id == idExercicioSelecionado);
        const prescricao = {
          clienteId: selectAluno.value,
          grupoMuscular: dadosCat.grupoMuscular,
          nomeExercicio: dadosCat.nome,
          imagemUrl: dadosCat.imagemUrl,
          series: parseInt(document.getElementById("series").value) || 0,
          repeticoes: document.getElementById("repeticoes").value,
          carga: document.getElementById("carga").value,
          diaSemana: document.getElementById("dia_semana")?.value || "Geral"
        };

        const res = await fetch(`${API_URL}/exercicios`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(prescricao)
        });
        
        if (!res.ok) throw new Error("Erro no servidor");
        alert("✅ Exercício adicionado à ficha!");
        formTreino.reset();
      } catch (err) {
        alert("Erro ao salvar: " + err.message);
      } finally {
        btn.disabled = false; btn.textContent = "Adicionar à Ficha do Aluno";
      }
    });
  };

  // --- INTEGRAÇÃO JAVA: VISUALIZAR TREINOS (PARTE INFERIOR DA TELA) ---
  const wireVisualizarTreinos = async () => {
    const selectView = document.getElementById("select-aluno-view");
    const displayDiv = document.getElementById("treino-aluno-display");

    if (!selectView || !displayDiv) return;

    // 1. Carregar alunos no select de baixo
    try {
      const res = await fetch(`${API_URL}/clientes`);
      const alunos = await res.json();
      if (alunos && alunos.length > 0) {
        selectView.innerHTML = '<option value="" disabled selected>Escolha um aluno para ver a ficha...</option>';
        alunos.forEach(a => selectView.innerHTML += `<option value="${a.id}">${a.nome}</option>`);
      } else {
        selectView.innerHTML = '<option value="" disabled>Nenhum aluno cadastrado no sistema</option>';
      }
    } catch (err) { 
      console.error("Erro alunos visualização:", err); 
      selectView.innerHTML = '<option value="" disabled>Erro ao carregar alunos.</option>';
    }

    // 2. Buscar ficha ao selecionar o aluno
    selectView.addEventListener("change", async (e) => {
      const alunoId = e.target.value;
      displayDiv.innerHTML = '<p class="msg-info">Buscando ficha no banco de dados local...</p>';

      try {
        const res = await fetch(`${API_URL}/exercicios/aluno/${alunoId}`);
        if (!res.ok) throw new Error("Erro ao buscar a ficha");
        
        const treinos = await res.json();

        if (!treinos || treinos.length === 0) {
          displayDiv.innerHTML = '<p class="msg-erro">Este aluno ainda não possui exercícios na ficha.</p>';
          return;
        }

        // Agrupando exercícios por Categoria (Grupo Muscular) como era no Supabase
        const gruposDetalhados = {};
        treinos.forEach(ex => {
          const grupo = ex.grupoMuscular || 'Geral';
          if (!gruposDetalhados[grupo]) gruposDetalhados[grupo] = [];
          gruposDetalhados[grupo].push(ex);
        });

        // Aplicando as classes do seu CSS original
        let htmlFicha = `<h3 class="ficha-titulo">Ficha do Aluno</h3>`;

        for (const [grupo, exercicios] of Object.entries(gruposDetalhados)) {
          htmlFicha += `
            <div class="ficha-grupo">
              <h4 class="muted" style="margin: 0 0 10px 0;">▸ Categoria: ${grupo.toUpperCase()}</h4>
              <div class="grid grid--3">
          `;

          exercicios.forEach(ex => {
            htmlFicha += `
              <div class="ficha-card" data-id="${ex.id}">
                <div class="view-mode">
                  <span class="ficha-card-nome">${ex.nomeExercicio}</span>
                  <div class="ficha-card-detalhes">
                    <div>📅 ${ex.diaSemana || 'Geral'}</div> 
                    <div>🔄 ${ex.series} séries de ${ex.repeticoes}</div>
                    <div>⚖️ Carga: ${ex.carga || 'Livre'}</div>
                  </div>
                </div>
              </div>
            `;
          });
          htmlFicha += `</div></div>`;
        }

        displayDiv.innerHTML = htmlFicha;

      } catch (err) {
        displayDiv.innerHTML = `<p class="msg-erro">Erro ao carregar a ficha: ${err.message}</p>`;
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
    
    // Ativando a tela de treinos!
    wireTreinoForm();
    wireVisualizarTreinos();
  });
})();