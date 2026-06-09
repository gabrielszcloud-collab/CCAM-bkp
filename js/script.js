(() => {
  const AUTH_KEY = "ccam_auth";

  // Contas de demonstração
  const USERS = {
    "admin@ccam.com": { password: "1234", role: "admin" },
    "aluno@ccam.com": { password: "1234", role: "aluno" }
  };

  const getPath = () => (location.pathname || "").split("/").pop() || "index.html";

  // Supabase - cliente público (browser)
  const SUPABASE_URL = "https://peisigvtfgpndubdayse.supabase.co";
  const SUPABASE_KEY = "sb_publishable_tWOJaWSIV_KCY5FJNmIOEQ_iuUjjTRb";
  const supabaseClient =
    typeof window !== "undefined" && window.supabase
      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
      : null;

  const safeJsonParse = (raw) => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const getWindowNameSession = () => {
    const prefix = `${AUTH_KEY}=`;
    if (!window.name || !window.name.startsWith(prefix)) return null;
    return safeJsonParse(window.name.slice(prefix.length));
  };

  const setWindowNameSession = (session) => {
    try {
      window.name = `${AUTH_KEY}=${JSON.stringify(session)}`;
    } catch {
      // ignore
    }
  };

  const clearWindowNameSession = () => {
    const prefix = `${AUTH_KEY}=`;
    if (window.name && window.name.startsWith(prefix)) window.name = "";
  };

  const loadSession = () => {
    const fromSession = safeJsonParse(sessionStorage.getItem(AUTH_KEY) || "");
    if (fromSession?.logged) return fromSession;

    const fromName = getWindowNameSession();
    if (fromName?.logged) return fromName;

    return null;
  };

  const saveSession = (session) => {
    try {
      sessionStorage.setItem(AUTH_KEY, JSON.stringify(session));
    } catch {
      // ignore
    }
    setWindowNameSession(session);
  };

  const clearSession = () => {
    try {
      localStorage.removeItem(AUTH_KEY);
    } catch {
      // ignore
    }
    try {
      sessionStorage.removeItem(AUTH_KEY);
    } catch {
      // ignore
    }
    clearWindowNameSession();
  };

  const setActiveNav = () => {
    const path = getPath();
    const links = document.querySelectorAll("[data-nav] a[href]");
    for (const a of links) {
      const href = a.getAttribute("href") || "";
      const isActive = href === path || (path === "" && href === "index.html");
      if (isActive) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
  };

  const hideForStudent = (session) => {
    if (session.role !== "aluno") return;

    const restricted = ["cadastro.html", "dashboard.html", "crm.html", "empresa.html"];

    document.querySelectorAll("[data-nav] a[href]").forEach((link) => {
      const href = link.getAttribute("href") || "";
      if (restricted.includes(href)) link.style.display = "none";
    });

    const path = getPath();
    if (path === "index.html" || path === "") {
      document.querySelectorAll(".hero__actions a[href]").forEach((btn) => {
        const href = btn.getAttribute("href") || "";
        if (restricted.includes(href)) btn.style.display = "none";
      });

      document.querySelectorAll(".grid .card").forEach((card) => {
        const title = card.querySelector("h2")?.textContent?.toLowerCase() || "";
        if (title.includes("cadastro") || title.includes("empresa") || title.includes("crm")) {
          card.style.display = "none";
        }
      });
    }
  };

  const enforceAuth = () => {
    const path = getPath();
    const session = loadSession();
    const onLogin = path === "login.html";

    if (!session && !onLogin) {
      location.replace("login.html");
      return;
    }

    if (session) {
      if (session.role === "aluno") {
        const restricted = ["index.html", "cadastro.html", "dashboard.html", "crm.html", "empresa.html"];
        if (onLogin || path === "" || restricted.includes(path)) {
          location.replace("app-aluno.html");
          return;
        }
      } else {
        if (onLogin) {
          location.replace("index.html");
          return;
        }
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
      if (!(emailEl instanceof HTMLInputElement) || !(passEl instanceof HTMLInputElement)) {
        form.submit();
        return;
      }

      const email = emailEl.value.trim();
      const password = passEl.value.trim();
      const errorEl = document.getElementById("loginError");

      const user = USERS[email];
      if (user && user.password === password) {
        saveSession({ logged: true, email, role: user.role });
        if (user.role === "aluno") {
          location.replace("app-aluno.html");
        } else {
          location.replace("index.html");
        }
      } else {
        if (errorEl) errorEl.textContent = "Acesso negado. Verifique suas credenciais.";
      }
    });
  };

  const wireConfirmables = () => {
    document.addEventListener("click", (e) => {
      const el = e.target instanceof Element ? e.target.closest("[data-confirm]") : null;
      if (!el) return;
      const msg = el.getAttribute("data-confirm") || "Confirmar ação?";
      if (!confirm(msg)) e.preventDefault();
    });
  };

  const wireFormHints = () => {
    const forms = document.querySelectorAll("form[data-enhance]");
    for (const form of forms) {
      form.addEventListener("submit", (e) => {
        const required = form.querySelectorAll("[required]");
        for (const field of required) {
          if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) continue;
          if (field.value.trim() === "") {
            e.preventDefault();
            field.focus();
            alert("Preencha os campos obrigatórios antes de continuar.");
            return;
          }
        }
      });
    }
  };

  const wireLogout = () => {
    document.addEventListener("click", (e) => {
      const el = e.target instanceof Element ? e.target.closest("[data-logout]") : null;
      if (!el) return;
      e.preventDefault();
      clearSession();
      location.replace("login.html");
    });
  };

  const wireCadastroForm = () => {
    const form = document.getElementById("formCadastro");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btnSalvar = form.querySelector('button[type="submit"]');
      if (btnSalvar) { btnSalvar.textContent = "Salvando..."; btnSalvar.disabled = true; }

      const peso = parseFloat(document.getElementById("peso")?.value) || 0;
      const altura = parseFloat(document.getElementById("altura")?.value) || 0;
      const sexo = document.getElementById("sexo")?.value || "M";

      let categoriaImc = "Não calculado";
      if (altura > 0 && peso > 0) {
        const imc = peso / (altura * altura);
        if (imc < 18.5) categoriaImc = "Abaixo do peso";
        else if (imc < 24.9) categoriaImc = "Peso normal";
        else if (imc < 29.9) categoriaImc = "Sobrepeso";
        else categoriaImc = "Obesidade";
      }

      const dadosCliente = {
        nome: document.getElementById("nome")?.value.trim(),
        email: document.getElementById("email")?.value.trim(),
        cpf: document.getElementById("cpf")?.value.trim(),
        data_nascimento: document.getElementById("data_nascimento")?.value || null,
        sexo: document.getElementById("sexo")?.value || null,
        celular: document.getElementById("celular")?.value.trim(),
        telefone_fixo: document.getElementById("telefone_fixo")?.value.trim() || null,
        peso: peso || null,
        altura: altura || null,
        condicao_saude: document.getElementById("condicao_saude")?.value.trim() || null,
        role: "aluno",
      };

      try {
        const { error } = await supabaseClient.from("clientes").insert([dadosCliente]);
        if (error) throw error;
        alert(`Aluno cadastrado!\n\nAnálise do Sistema: ${categoriaImc}`);
        form.reset();
      } catch (err) {
        alert("Erro ao cadastrar: " + (err?.message || err));
      } finally {
        if (btnSalvar) { btnSalvar.textContent = "Salvar Cadastro"; btnSalvar.disabled = false; }
      }
    });
  };


  // --- LÓGICA DE TREINO (CATÁLOGO INTERATIVO) ---
  const wireTreinoForm = async () => {
    const selectAluno = document.getElementById("select-aluno");
    const formTreino = document.getElementById("formTreino");
    const catalogoContainer = document.getElementById("catalogo-container");
    const exercicioDisplay = document.getElementById("exercicio-display");

    if (!selectAluno || !formTreino || !catalogoContainer) return;

    let catalogoCompleto = [];
    let idExercicioSelecionado = null;

    // 1. Carregar lista de alunos
    try {
      const { data: alunos } = await supabaseClient.from('clientes').select('id, nome').order('nome');
      if (alunos) {
        selectAluno.innerHTML = '<option value="" disabled selected>Selecione um aluno...</option>';
        alunos.forEach(a => selectAluno.innerHTML += `<option value="${a.id}">${a.nome}</option>`);
      }
    } catch (err) { console.error("Erro alunos:", err); }

    // Evento para Limpar a Tela ao Trocar de Aluno
    selectAluno.addEventListener("change", () => {
      idExercicioSelecionado = null;

      if (exercicioDisplay) {
        exercicioDisplay.innerHTML = "Nenhum exercício selecionado (Clique no catálogo ao lado ➔)";
        exercicioDisplay.style.background = "rgba(0,0,0,0.2)";
        exercicioDisplay.style.borderColor = "rgba(255,255,255,0.2)";
      }

      document.querySelectorAll('.exercicio-item').forEach(el => el.classList.remove('selecionado'));

      // Fecha todas as categorias (tags details) da direita
      document.querySelectorAll('details').forEach(detail => detail.removeAttribute('open'));

      const seriesEl = document.getElementById("series");
      const repEl = document.getElementById("repeticoes");
      const cargaEl = document.getElementById("carga");
      const diaSelect = document.getElementById("dia_semana");

      if (seriesEl) seriesEl.value = "";
      if (repEl) repEl.value = "";
      if (cargaEl) cargaEl.value = "";
      if (diaSelect) diaSelect.selectedIndex = 0;
    });

    // 2. Carregar Catálogo
    try {
      const { data: catalogo } = await supabaseClient.from('catalogo_exercicios').select('*').order('grupo_muscular');
      if (catalogo) {
        catalogoCompleto = catalogo;
        catalogoContainer.innerHTML = '';

        const grupos = {};
        catalogo.forEach(ex => {
          if (!grupos[ex.grupo_muscular]) grupos[ex.grupo_muscular] = [];
          grupos[ex.grupo_muscular].push(ex);
        });

        for (const [grupo, exercicios] of Object.entries(grupos)) {
          let htmlGrupo = `
            <details>
              <summary> ${grupo.toUpperCase()}</summary>
              <ul style="list-style: none; padding: 0; margin: 0 0 10px 0;">
          `;

          exercicios.forEach(ex => {
            htmlGrupo += `<li class="exercicio-item" data-id="${ex.id}">▸ ${ex.nome}</li>`;
          });

          htmlGrupo += `</ul></details>`;
          catalogoContainer.innerHTML += htmlGrupo;
        }

        document.querySelectorAll('.exercicio-item').forEach(item => {
          item.addEventListener('click', (e) => {
            document.querySelectorAll('.exercicio-item').forEach(el => el.classList.remove('selecionado'));

            const elementoClicado = e.target;
            elementoClicado.classList.add('selecionado');

            idExercicioSelecionado = elementoClicado.getAttribute('data-id');
            const exData = catalogoCompleto.find(x => x.id === idExercicioSelecionado);

            if (exercicioDisplay) {
              exercicioDisplay.innerHTML = `<span style="color: #fff; font-style: normal;"><strong>[${exData.grupo_muscular}]</strong> ${exData.nome}</span>`;
              exercicioDisplay.style.background = "rgba(156, 39, 176, 0.1)";
              exercicioDisplay.style.borderColor = "#9c27b0";
            }
          });
        });
      }
    } catch (err) { console.error("Erro catálogo:", err); }

    // 3. Salvar Prescrição
    formTreino.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!idExercicioSelecionado) {
        alert("⚠️ Por favor, selecione um exercício do catálogo na coluna da direita.");
        return;
      }

      const btn = formTreino.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = "Salvando..."; }

      try {
        const dadosDoCatalogo = catalogoCompleto.find(ex => ex.id === idExercicioSelecionado);
        const diaSel = document.getElementById("dia_semana");

        const prescricao = {
          cliente_id: selectAluno.value,
          grupo_muscular: dadosDoCatalogo.grupo_muscular,
          nome_exercicio: dadosDoCatalogo.nome,
          imagem_url: dadosDoCatalogo.imagem_url,
          series: parseInt(document.getElementById("series").value) || 0,
          repeticoes: document.getElementById("repeticoes").value,
          carga: document.getElementById("carga").value,
          dia_semana: diaSel ? diaSel.value : "Geral"
        };

        const { error } = await supabaseClient.from('exercicios').insert([prescricao]);
        if (error) throw error;

        alert("✅ Exercício adicionado com sucesso à ficha do aluno!");

        document.getElementById("series").value = "";
        document.getElementById("repeticoes").value = "";
        document.getElementById("carga").value = "";

      } catch (err) {
        alert("Erro ao salvar: " + err.message);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = "Adicionar à Ficha do Aluno"; }
      }
    });
  };

  const loadCRMData = async () => {
    const kpiTotal = document.getElementById("kpi-total-alunos");
    if (!kpiTotal) return;
    try {
      const { data: clientes } = await supabaseClient.from("clientes").select("*");
      if (clientes) kpiTotal.textContent = clientes.length;
    } catch (err) { console.error("Erro CRM:", err); }
  };

  // --- LÓGICA: VISUALIZAR, EDITAR E DELETAR TREINOS ---
  const wireVisualizarTreinos = async () => {
    const selectView = document.getElementById("select-aluno-view");
    const displayDiv = document.getElementById("treino-aluno-display");

    if (!selectView || !displayDiv) return;

    try {
      const { data: alunos } = await supabaseClient.from('clientes').select('id, nome').order('nome');
      if (alunos) {
        selectView.innerHTML = '<option value="" disabled selected>Escolha um aluno para ver a ficha...</option>';
        alunos.forEach(a => selectView.innerHTML += `<option value="${a.id}">${a.nome}</option>`);
      }
    } catch (err) { console.error("Erro alunos visualização:", err); }

    selectView.addEventListener("change", async (e) => {
      const alunoId = e.target.value;
      displayDiv.innerHTML = '<p class="msg-info">Buscando ficha no banco de dados...</p>';

      try {
        const { data: treinos, error } = await supabaseClient.from('exercicios').select('*').eq('cliente_id', alunoId);
        if (error) throw error;

        if (!treinos || treinos.length === 0) {
          displayDiv.innerHTML = '<p class="msg-erro">Este aluno ainda não possui exercícios na ficha.</p>';
          return;
        }

        // NOVIDADE: Tabela de Agenda
        const agendaMap = {};
        const ordemDias = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo", "Rotativo (Ficha)", "Geral"];

        ordemDias.forEach(dia => agendaMap[dia] = new Set());

        treinos.forEach(ex => {
          const dia = ex.dia_semana || 'Geral';
          const grupo = ex.grupo_muscular || 'Geral';
          if (agendaMap[dia]) {
            agendaMap[dia].add(grupo);
          } else {
            if (!agendaMap['Geral']) agendaMap['Geral'] = new Set();
            agendaMap['Geral'].add(grupo);
          }
        });

        let htmlFicha = `
          <h3 class="ficha-titulo">📅 Visão Geral da Semana</h3>
          <table style="margin-bottom: 32px; width: 100%;">
            <thead>
              <tr>
                <th style="width: 35%;">Dia da Semana</th>
                <th>Foco do Treino</th>
              </tr>
            </thead>
            <tbody>
        `;

        ordemDias.forEach(dia => {
          if (agendaMap[dia] && agendaMap[dia].size > 0) {
            const gruposTexto = Array.from(agendaMap[dia]).join(", ");
            htmlFicha += `
              <tr>
                <td style="font-weight: 600; color: #fff;">${dia}</td>
                <td style="color: var(--brand-2); font-weight: 500;">${gruposTexto}</td>
              </tr>
            `;
          }
        });
        htmlFicha += `</tbody></table>`;

        // Cartões Detalhados
        const gruposDetalhados = {};
        treinos.forEach(ex => {
          const grupo = ex.grupo_muscular || 'Geral';
          if (!gruposDetalhados[grupo]) gruposDetalhados[grupo] = [];
          gruposDetalhados[grupo].push(ex);
        });

        htmlFicha += `<h3 class="ficha-titulo">🏋️‍♂️ Exercícios Detalhados</h3>`;

        for (const [grupo, exercicios] of Object.entries(gruposDetalhados)) {
          htmlFicha += `
            <div class="ficha-grupo" style="margin-top: 20px;">
              <h4 style="color: #aaa; margin: 0 0 10px 0;">▸ Categoria: ${grupo.toUpperCase()}</h4>
              <div class="grid grid--3">
          `;

          exercicios.forEach(ex => {
            // Gera as opções de dia da semana para o select de edição
            let optionsDia = '';
            ordemDias.forEach(d => {
              optionsDia += `<option value="${d}" ${ex.dia_semana === d ? 'selected' : ''}>${d}</option>`;
            });

            // O Card agora tem dois "lados": view-mode e edit-mode
            htmlFicha += `
              <div class="ficha-card" data-id="${ex.id}">
                
                <div class="view-mode">
                  <button class="btn-editar-ex" title="Editar exercício">✏️</button>
                  <span class="ficha-card-nome">${ex.nome_exercicio}</span>
                  <div class="ficha-card-detalhes">
                    <div style="color: #9c27b0; font-weight: bold;">📅 ${ex.dia_semana || 'Geral'}</div> 
                    <div>🔄 ${ex.series} séries de ${ex.repeticoes}</div>
                    <div>⚖️ Carga: ${ex.carga || 'Livre / Peso do corpo'}</div>
                  </div>
                </div>

                <div class="edit-mode" style="display: none;">
                  <span class="ficha-card-nome" style="color: var(--brand); font-size: 13px; margin-bottom: 8px; display: block;">Editando: ${ex.nome_exercicio}</span>
                  
                  <select class="input-edit edit-dia">${optionsDia}</select>
                  
                  <div class="row-edit">
                    <input type="number" class="input-edit edit-series" value="${ex.series || ''}" placeholder="Séries" style="width: 40%;">
                    <input type="text" class="input-edit edit-reps" value="${ex.repeticoes || ''}" placeholder="Repetições" style="width: 60%;">
                  </div>
                  
                  <input type="text" class="input-edit edit-carga" value="${ex.carga || ''}" placeholder="Carga (ex: 20kg)">
                  
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                    <button class="btn-deletar-in-edit" title="Excluir da ficha definitiva">🗑️</button>
                    <div>
                      <button class="btn-cancelar-ex">Cancelar</button>
                      <button class="btn-salvar-ex">Salvar</button>
                    </div>
                  </div>
                </div>

              </div>
            `;
          });

          htmlFicha += `</div></div>`;
        }

        displayDiv.innerHTML = htmlFicha;

        // ==========================================
        // ATIVAR AÇÕES DOS BOTÕES (EDITAR, SALVAR, DELETAR)
        // ==========================================
        const cards = displayDiv.querySelectorAll('.ficha-card');

        cards.forEach(card => {
          const idExercicio = card.getAttribute('data-id');
          const viewMode = card.querySelector('.view-mode');
          const editMode = card.querySelector('.edit-mode');

          // 1. Abrir modo edição (Esconde o view, mostra o edit)
          card.querySelector('.btn-editar-ex').addEventListener('click', () => {
            viewMode.style.display = 'none';
            editMode.style.display = 'block';
          });

          // 2. Cancelar edição
          card.querySelector('.btn-cancelar-ex').addEventListener('click', () => {
            editMode.style.display = 'none';
            viewMode.style.display = 'block';
          });

          // 3. Salvar alterações no Supabase (Update)
          card.querySelector('.btn-salvar-ex').addEventListener('click', async (e) => {
            const btnSalvar = e.target;
            const novoDia = card.querySelector('.edit-dia').value;
            const novaSerie = parseInt(card.querySelector('.edit-series').value) || 0;
            const novaRep = card.querySelector('.edit-reps').value;
            const novaCarga = card.querySelector('.edit-carga').value;

            btnSalvar.textContent = "...";
            btnSalvar.disabled = true;

            try {
              const { error } = await supabaseClient
                .from('exercicios')
                .update({
                  dia_semana: novoDia,
                  series: novaSerie,
                  repeticoes: novaRep,
                  carga: novaCarga
                })
                .eq('id', idExercicio);

              if (error) throw error;

              // Recarrega a ficha para mostrar os dados atualizados
              selectView.dispatchEvent(new Event('change'));
            } catch (err) {
              alert("Erro ao atualizar: " + err.message);
              btnSalvar.textContent = "Salvar";
              btnSalvar.disabled = false;
            }
          });

          // 4. Deletar (Agora fica escondido dentro da edição)
          card.querySelector('.btn-deletar-in-edit').addEventListener('click', async () => {
            if (confirm("Tem certeza que deseja remover este exercício da ficha do aluno?")) {
              try {
                const { error } = await supabaseClient.from('exercicios').delete().eq('id', idExercicio);
                if (error) throw error;
                // Recarrega a tela para sumir o card
                selectView.dispatchEvent(new Event('change'));
              } catch (err) {
                console.error("Erro ao excluir exercício: " + err.message);
                alert("Ocorreu um erro ao excluir o exercício. Tente novamente.");
              }
            }
          });
        });

      } catch (err) {
        displayDiv.innerHTML = `<p class="msg-erro">Erro ao carregar a ficha: ${err.message}</p>`;
      }
    });
  };
  // ==========================================
  // LÓGICA DO MURAL DE AVISOS
  // ==========================================
  const wireMural = async () => {
    const formMural = document.getElementById("formMural");
    const listaAvisos = document.getElementById("lista-avisos");

    if (!formMural || !listaAvisos) {
      console.error("Elementos do Mural não encontrados na tela.");
      return;
    }

    const carregarAvisos = async () => {
      try {
        const { data: avisos, error } = await supabaseClient.from("mural").select("*").order("data_publicacao", { ascending: false });
        if (error) throw error;

        listaAvisos.innerHTML = "";

        if (avisos && avisos.length > 0) {
          avisos.forEach(aviso => {
            const dataFormatada = new Date(aviso.data_publicacao).toLocaleDateString('pt-BR');

            listaAvisos.innerHTML += `
              <article class="card" style="position: relative;">
                <button class="btn-deletar-aviso" data-id="${aviso.id}" style="position: absolute; top: 12px; right: 12px; background: transparent; border: none; cursor: pointer; font-size: 16px;" title="Excluir">🗑️</button>
                <h2>${aviso.titulo}</h2>
                <p style="margin-top: 8px;">${aviso.mensagem}</p>
                <div class="spacer" style="margin: 16px 0;"></div>
                <span class="help">Publicado em: ${dataFormatada}</span>
              </article>
            `;
          });

          // Ativa os botões de lixeira
          document.querySelectorAll('.btn-deletar-aviso').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              if (confirm("Deseja mesmo excluir este aviso?")) {
                await supabaseClient.from("mural").delete().eq("id", e.currentTarget.getAttribute("data-id"));
                carregarAvisos();
              }
            });
          });
        } else {
          // Agora a mensagem de vazio fica dentro do grid bonitinha
          listaAvisos.innerHTML = "<p style='color: #aaa; grid-column: span 2;'>Nenhum aviso publicado no momento.</p>";
        }
      } catch (err) {
        console.error("Erro ao carregar mural:", err);
      }
    };

    formMural.addEventListener("submit", async (e) => {
      e.preventDefault(); // Impede a página de recarregar

      const titulo = document.getElementById("aviso_titulo").value;
      const mensagem = document.getElementById("aviso_mensagem").value;
      const btn = formMural.querySelector("button");

      btn.textContent = "Publicando...";
      btn.disabled = true;

      try {
        const { error } = await supabaseClient.from("mural").insert([{ titulo, mensagem }]);
        if (error) throw error; // Se o banco negar, ele joga o erro na tela!

        formMural.reset();
        carregarAvisos();
      } catch (err) {
        alert("Erro ao postar: " + err.message);
        console.error("Erro completo:", err);
      } finally {
        btn.textContent = "Publicar Aviso";
        btn.disabled = false;
      }
    });

    carregarAvisos();
  };
  // ==========================================
  // LÓGICA DO FINANCEIRO (FLUXO DE CAIXA)
  // ==========================================
  const wireFinanceiro = async () => {
    const formFin = document.getElementById("formFinanceiro");
    const tabelaFin = document.getElementById("tabela-financeiro");
    if (!formFin || !tabelaFin) return;

    // 1. Carregar Tabela
    const carregarMovimentacoes = async () => {
      try {
        const { data: movs, error } = await supabaseClient
          .from("fluxo_caixa")
          .select("*")
          .order("data_movimento", { ascending: false });

        if (error) throw error;

        tabelaFin.innerHTML = "";

        if (movs.length === 0) {
          tabelaFin.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">Nenhuma movimentação registrada.</td></tr>';
          return;
        }

        movs.forEach(mov => {
          // Lógica de Cores (Pills)
          const isEntrada = mov.tipo === 'entrada';
          const pillClass = isEntrada ? 'pill--in' : 'pill--out';
          const tipoLabel = isEntrada ? 'Entrada' : 'Saída';

          // Formatação de Data e Moeda
          const [ano, mes, dia] = mov.data_movimento.split('-');
          const dataFormatada = `${dia}/${mes}/${ano}`;
          const valorFormatado = parseFloat(mov.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

          tabelaFin.innerHTML += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
              <td style="padding: 12px 0;">${dataFormatada}</td>
              <td>${mov.descricao}</td>
              <td><span class="pill ${pillClass}">${tipoLabel}</span></td>
              <td style="font-weight: bold;">${valorFormatado}</td>
              <td>
                <button class="btn-deletar-ex btn-del-mov" data-id="${mov.id}" title="Excluir" style="background:transparent; border:none; cursor:pointer;">🗑️</button>
              </td>
            </tr>
          `;
        });

        // Lógica para deletar movimentação
        document.querySelectorAll('.btn-del-mov').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            if (confirm("Tem certeza que deseja excluir esta movimentação?")) {
              const id = e.currentTarget.getAttribute("data-id");
              await supabaseClient.from("fluxo_caixa").delete().eq("id", id);
              carregarMovimentacoes();
            }
          });
        });

      } catch (err) { console.error("Erro financeiro:", err); }
    };

    // 2. Salvar Nova Movimentação
    formFin.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = formFin.querySelector('button[type="submit"]');
      btn.textContent = "Salvando...";
      btn.disabled = true;

      const data_movimento = document.getElementById("fdata").value;
      const tipo = document.getElementById("ftipo").value;
      const descricao = document.getElementById("fdesc").value;

      // Tratamento rápido para aceitar vírgula ou ponto no valor
      let valorInput = document.getElementById("fvalor").value;
      const valorNumerico = parseFloat(valorInput.replace(',', '.'));

      try {
        const { error } = await supabaseClient.from("fluxo_caixa").insert([{
          data_movimento,
          tipo,
          descricao,
          valor: valorNumerico
        }]);

        if (error) throw error;

        formFin.reset();
        carregarMovimentacoes();
      } catch (err) {
        alert("Erro ao registrar: " + err.message);
      } finally {
        btn.textContent = "Salvar Movimentação";
        btn.disabled = false;
      }
    });

    carregarMovimentacoes(); // Roda ao abrir a tela
  };

  document.addEventListener("DOMContentLoaded", () => {
    enforceAuth();
    wireLoginForm();
    setActiveNav();
    wireConfirmables();
    wireFormHints();
    wireLogout();
    wireCadastroForm();
    wireTreinoForm();
    wireVisualizarTreinos();
    loadCRMData();
    wireMural();
    wireFinanceiro();
  });
})();