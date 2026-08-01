/* Dokion Community Playbook Hub — Complete Application Logic & Interactive State Manager */

let catalogData = [];
let currentCategory = "all";
let currentView = "grid";
let currentHeroPreset = "amElnagdy/ui-review-loop";
let currentModalTab = "overview";
let currentInspectPackageId = null;

const HERO_PRESETS = {
  "ui-review-loop": "dokion hub pull amElnagdy/ui-review-loop",
  "web-fullstack": "dokion hub pull dokion/web-fullstack",
  "api-service": "dokion hub pull dokion/api-service"
};

document.addEventListener("DOMContentLoaded", async () => {
  await loadCatalog();
  setupEventListeners();
  render();
});

async function loadCatalog() {
  try {
    const res = await fetch("catalog.json");
    catalogData = await res.json();
    updateStatsHeader();
    updateCategoryCounts();
  } catch (err) {
    console.error("Failed to load catalog.json:", err);
  }
}

function updateStatsHeader() {
  const totalDownloads = catalogData.reduce((acc, p) => acc + p.stats.downloads, 0);
  const avgSuccessRate = catalogData.length
    ? (catalogData.reduce((acc, p) => acc + p.stats.successRate, 0) / catalogData.length).toFixed(1)
    : "99.1";

  const elPlaybooks = document.getElementById("stat-total-playbooks");
  const elDownloads = document.getElementById("stat-total-downloads");
  const elSuccess = document.getElementById("stat-avg-success");

  if (elPlaybooks) elPlaybooks.textContent = catalogData.length;
  if (elDownloads) elDownloads.textContent = totalDownloads.toLocaleString();
  if (elSuccess) elSuccess.textContent = `${avgSuccessRate}%`;
}

function updateCategoryCounts() {
  const counts = {
    all: catalogData.length,
    "ui-ux": 0,
    security: 0,
    backend: 0,
    "ai-slop-remediation": 0,
    testing: 0,
    devops: 0
  };

  catalogData.forEach((p) => {
    if (counts[p.category] !== undefined) {
      counts[p.category]++;
    }
  });

  Object.keys(counts).forEach((cat) => {
    const el = document.getElementById(`count-${cat}`);
    if (el) el.textContent = counts[cat];
  });
}

function setupEventListeners() {
  const searchInput = document.getElementById("search-input");
  const sortSelect = document.getElementById("sort-select");
  const categoryPills = document.querySelectorAll("#category-pills .pill");
  const btnGridView = document.getElementById("view-grid");
  const btnTableView = document.getElementById("view-table");
  const modalOverlay = document.getElementById("inspect-modal");

  if (searchInput) searchInput.addEventListener("input", () => render());
  if (sortSelect) sortSelect.addEventListener("change", () => render());

  categoryPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      categoryPills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentCategory = pill.dataset.category;
      render();
    });
  });

  if (btnGridView) {
    btnGridView.addEventListener("click", () => {
      btnGridView.classList.add("active");
      if (btnTableView) btnTableView.classList.remove("active");
      currentView = "grid";
      render();
    });
  }

  if (btnTableView) {
    btnTableView.addEventListener("click", () => {
      btnTableView.classList.add("active");
      if (btnGridView) btnGridView.classList.remove("active");
      currentView = "table";
      render();
    });
  }

  // Close modal when clicking overlay outside modal box
  if (modalOverlay) {
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeModal();
    });
  }

  // Keyboard Navigation
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
    } else if (e.key === "/" && document.activeElement !== searchInput) {
      e.preventDefault();
      if (searchInput) searchInput.focus();
    }
  });
}

function switchHeroPreset(presetKey, tabBtn) {
  if (HERO_PRESETS[presetKey]) {
    currentHeroPreset = HERO_PRESETS[presetKey];
    const cmdEl = document.getElementById("hero-terminal-cmd");
    if (cmdEl) cmdEl.textContent = currentHeroPreset;

    const tabs = document.querySelectorAll(".terminal-tab");
    tabs.forEach((t) => t.classList.remove("active"));
    if (tabBtn) tabBtn.classList.add("active");
  }
}

function copyCurrentHeroCommand() {
  const cmdEl = document.getElementById("hero-terminal-cmd");
  const cmd = cmdEl ? cmdEl.textContent : currentHeroPreset;
  copyToClipboard(cmd, `Copied terminal command: "${cmd}"`);
}

function getFilteredData() {
  const searchEl = document.getElementById("search-input");
  const sortEl = document.getElementById("sort-select");

  const query = searchEl ? searchEl.value.toLowerCase().trim() : "";
  const sortBy = sortEl ? sortEl.value : "score";

  let filtered = catalogData.filter((p) => {
    const matchesCategory = currentCategory === "all" || p.category === currentCategory;
    const matchesQuery =
      !query ||
      p.id.toLowerCase().includes(query) ||
      p.name.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query) ||
      p.publisher.handle.toLowerCase().includes(query) ||
      (p.tags && p.tags.some((t) => t.toLowerCase().includes(query)));

    return matchesCategory && matchesQuery;
  });

  // Calculate Composite Quality Score
  filtered.forEach((p) => {
    p.compositeScore =
      Math.round(
        (25 * Math.log10(p.stats.downloads + 1) +
          15 * p.stats.rating +
          40 * (p.stats.successRate / 100) +
          (p.publisher.verified ? 20 : 0)) *
          10
      ) / 10;
  });

  filtered.sort((a, b) => {
    if (sortBy === "downloads") return b.stats.downloads - a.stats.downloads;
    if (sortBy === "rating") return b.stats.rating - a.stats.rating;
    if (sortBy === "successRate") return b.stats.successRate - a.stats.successRate;
    return b.compositeScore - a.compositeScore;
  });

  return filtered;
}

function render() {
  const data = getFilteredData();
  const gridContainer = document.getElementById("playbook-grid");
  const tableWrapper = document.getElementById("table-wrapper");

  if (!gridContainer || !tableWrapper) return;

  if (currentView === "grid") {
    gridContainer.style.display = "grid";
    tableWrapper.style.display = "none";
    renderGrid(data, gridContainer);
  } else {
    gridContainer.style.display = "none";
    tableWrapper.style.display = "block";
    renderTable(data);
  }
}

function renderGrid(data, container) {
  if (data.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-xl); border: 1px solid var(--border-color);">
        <p style="font-size: 18px; font-weight: 700; margin-bottom: 8px;">No verified playbooks found</p>
        <p style="font-size: 14px; color: var(--text-dim);">Try clearing your search query or choosing another domain category.</p>
      </div>`;
    return;
  }

  container.innerHTML = data
    .map((p) => {
      const verifiedBadge = p.publisher.verified ? `<span class="verified-badge">✓ Verified</span>` : "";
      const tagsHtml = p.tags ? p.tags.slice(0, 4).map((t) => `<span class="tag-item">#${t}</span>`).join("") : "";
      const shortDigest = p.digest ? p.digest.substring(0, 18) + "..." : "sha256:verified";

      return `
        <div class="playbook-card">
          <div>
            <div class="card-header">
              <div class="card-title">${p.id}</div>
              ${verifiedBadge}
            </div>
            <p class="card-description">${p.description}</p>

            <!-- Execution Success Meter Bar -->
            <div class="success-meter-container">
              <div class="meter-header">
                <span>Execution Success</span>
                <span style="color: var(--accent-green);">${p.stats.successRate}%</span>
              </div>
              <div class="meter-bar">
                <div class="meter-fill" style="width: ${p.stats.successRate}%;"></div>
              </div>
            </div>

            <div class="tag-list">${tagsHtml}</div>
          </div>

          <div>
            <div class="card-meta">
              <span class="meta-item" title="Star Rating">⭐ ${p.stats.rating}</span>
              <span class="meta-item" title="Total Downloads">📥 ${p.stats.downloads.toLocaleString()}</span>
              <span class="meta-item digest-pill" title="SHA-256 Digest">${shortDigest}</span>
            </div>
            <div class="card-footer">
              <button class="btn btn-primary" onclick="copyPullCommand('${p.id}')">Copy Cmd</button>
              <button class="btn btn-secondary" onclick="openInspectModal('${p.id}')">Inspect</button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderTable(data) {
  const tbody = document.querySelector("#leaderboard-table tbody");
  if (!tbody) return;

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-dim);">No playbooks matching search filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = data
    .map((p, idx) => {
      const rankClass = idx === 0 ? "rank-1" : idx === 1 ? "rank-2" : idx === 2 ? "rank-3" : "rank-other";
      const verified = p.publisher.verified ? "✅" : "";
      return `
        <tr>
          <td><span class="rank-badge ${rankClass}">${idx + 1}</span></td>
          <td><strong>${p.id}</strong> ${verified}</td>
          <td><span class="pill" style="min-height: 28px; padding: 2px 10px; font-size: 11px;">${p.category}</span></td>
          <td><strong style="color: var(--accent-cyan);">${p.compositeScore}</strong></td>
          <td>⭐ ${p.stats.rating}</td>
          <td>${p.stats.downloads.toLocaleString()}</td>
          <td style="color: var(--accent-green); font-weight: 700;">${p.stats.successRate}%</td>
          <td>
            <button class="btn btn-secondary" style="min-height: 34px; padding: 4px 12px; font-size: 12px;" onclick="openInspectModal('${p.id}')">Inspect</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function copyPullCommand(packageId) {
  const cmd = `dokion hub pull ${packageId}`;
  copyToClipboard(cmd, `Copied command: "${cmd}"`);
}

function openInspectModal(packageId) {
  currentInspectPackageId = packageId;
  const p = catalogData.find((item) => item.id === packageId);
  if (!p) return;

  const modalOverlay = document.getElementById("inspect-modal");
  const modalContent = document.getElementById("modal-content");
  if (!modalOverlay || !modalContent) return;

  currentModalTab = "overview";
  renderInspectModalBody(p);
  modalOverlay.classList.add("active");
}

function renderInspectModalBody(p) {
  const modalContent = document.getElementById("modal-content");
  if (!modalContent) return;

  const stagesHtml = p.stages
    ? p.stages.map((s, idx) => `
        <li style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; background: rgba(255, 255, 255, 0.03); padding: 8px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
          <span><strong>Stage ${idx + 1}:</strong> ${s.name}</span>
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; background: rgba(0, 242, 254, 0.1); color: var(--accent-cyan); padding: 2px 8px; border-radius: var(--radius-xs);">${s.steps} steps</span>
        </li>`).join("")
    : "<li>Standard Playbook Stages</li>";

  let tabBodyHtml = "";

  if (currentModalTab === "overview") {
    tabBodyHtml = `
      <div class="code-block">
        <span>dokion hub pull ${p.id}</span>
        <button class="btn btn-secondary" style="min-height: 34px; padding: 4px 12px; font-size: 12px;" onclick="copyPullCommand('${p.id}')">Copy</button>
      </div>

      <h4 style="font-size: 15px; font-weight: 700; margin-top: 20px; margin-bottom: 12px;">Declared Pipeline Stages:</h4>
      <ul style="list-style: none; padding: 0; color: var(--text-muted); font-size: 14px;">
        ${stagesHtml}
      </ul>
    `;
  } else if (currentModalTab === "json") {
    tabBodyHtml = `
      <div class="code-block" style="flex-direction: column; align-items: flex-start; max-height: 320px; overflow-y: auto;">
        <pre style="color: var(--accent-blue); font-size: 12px; line-height: 1.5;">${JSON.stringify(p, null, 2)}</pre>
      </div>
      <button class="btn btn-secondary" style="min-height: 34px; padding: 4px 12px; font-size: 12px;" onclick="copyToClipboard(\`${JSON.stringify(p, null, 2).replace(/`/g, '\\`')}\`, 'Copied playbook JSON spec')">Copy JSON</button>
    `;
  } else if (currentModalTab === "cli") {
    tabBodyHtml = `
      <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 12px;">Customize command options:</p>
      <div class="cli-flags-grid">
        <label class="flag-checkbox"><input type="checkbox" id="flag-force" onchange="updateCliCommandPreview('${p.id}')"> --force</label>
        <label class="flag-checkbox"><input type="checkbox" id="flag-digest" checked onchange="updateCliCommandPreview('${p.id}')"> --verify-digest</label>
        <label class="flag-checkbox"><input type="checkbox" id="flag-dry" onchange="updateCliCommandPreview('${p.id}')"> --dry-run</label>
      </div>
      <div class="code-block">
        <span id="cli-command-output">dokion hub pull ${p.id} --verify-digest</span>
        <button class="btn btn-secondary" style="min-height: 34px; padding: 4px 12px; font-size: 12px;" onclick="copyCustomCliCommand()">Copy</button>
      </div>
    `;
  }

  modalContent.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
      <h2 style="font-size: 24px; font-weight: 800;">${p.id}</h2>
      ${p.publisher.verified ? '<span class="verified-badge">✓ Verified</span>' : ''}
    </div>
    <p style="color: var(--text-muted); margin-bottom: 16px;">${p.description}</p>
    
    <div style="display: flex; gap: 16px; font-size: 13px; color: var(--text-dim); margin-bottom: 16px; flex-wrap: wrap;">
      <span>Publisher: <strong style="color: var(--text-main);">${p.publisher.name}</strong></span>
      <span>Category: <strong style="color: var(--text-main);">${p.category}</strong></span>
      <span>SHA-256 Digest: <code style="color: var(--accent-cyan);">${p.digest.substring(0, 20)}...</code></span>
    </div>

    <!-- Modal Tabs Navigation -->
    <div class="modal-tabs">
      <button class="modal-tab-btn ${currentModalTab === "overview" ? "active" : ""}" onclick="switchModalTab('overview')">Overview & Stages</button>
      <button class="modal-tab-btn ${currentModalTab === "json" ? "active" : ""}" onclick="switchModalTab('json')">JSON Spec</button>
      <button class="modal-tab-btn ${currentModalTab === "cli" ? "active" : ""}" onclick="switchModalTab('cli')">CLI Builder</button>
    </div>

    <div id="modal-tab-body">
      ${tabBodyHtml}
    </div>
  `;
}

function switchModalTab(tabKey) {
  currentModalTab = tabKey;
  if (currentInspectPackageId) {
    const p = catalogData.find((item) => item.id === currentInspectPackageId);
    if (p) renderInspectModalBody(p);
  }
}

function updateCliCommandPreview(packageId) {
  const force = document.getElementById("flag-force")?.checked;
  const digest = document.getElementById("flag-digest")?.checked;
  const dry = document.getElementById("flag-dry")?.checked;

  let cmd = `dokion hub pull ${packageId}`;
  if (digest) cmd += " --verify-digest";
  if (force) cmd += " --force";
  if (dry) cmd += " --dry-run";

  const outputEl = document.getElementById("cli-command-output");
  if (outputEl) outputEl.textContent = cmd;
}

function copyCustomCliCommand() {
  const outputEl = document.getElementById("cli-command-output");
  if (outputEl) copyToClipboard(outputEl.textContent, `Copied CLI command: "${outputEl.textContent}"`);
}

function openPublishModal() {
  const modalOverlay = document.getElementById("inspect-modal");
  const modalContent = document.getElementById("modal-content");
  if (!modalOverlay || !modalContent) return;

  modalContent.innerHTML = `
    <h2 style="font-size: 24px; font-weight: 800; margin-bottom: 8px;">✨ Publish Your Playbook</h2>
    <p style="color: var(--text-muted); margin-bottom: 18px;">Publish your custom hardening playbook to the Dokion GitHub Native Decentralized Registry.</p>
    
    <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; margin-bottom: 20px;">
      <h4 style="font-size: 14px; font-weight: 700; color: var(--accent-cyan); margin-bottom: 6px;">Option 1: Publish via Dokion CLI</h4>
      <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 10px;">Run this command in your repository to sign and publish:</p>
      <div class="code-block" style="margin: 0;">
        <span>dokion hub publish .dokion/playbook.json --handle myusername</span>
        <button class="btn btn-secondary" style="min-height: 32px; padding: 4px 10px; font-size: 12px;" onclick="copyToClipboard('dokion hub publish .dokion/playbook.json --handle myusername', 'Copied publish command')">Copy</button>
      </div>
    </div>

    <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px;">
      <h4 style="font-size: 14px; font-weight: 700; color: var(--accent-green); margin-bottom: 6px;">Option 2: Submit via GitHub Pull Request</h4>
      <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">Add your playbook JSON definition to <code>playbooks/reference/</code> in <a href="https://github.com/imMamdouhaboammar/dokion" target="_blank" style="color: var(--accent-cyan);">imMamdouhaboammar/dokion</a> and submit a PR for automated verification.</p>
      
      <div class="form-group">
        <label class="form-label">Playbook Package ID (e.g. username/my-playbook)</label>
        <input type="text" class="form-input" id="pub-id-input" placeholder="myusername/security-audit">
      </div>
      <div class="form-group">
        <label class="form-label">Brief Description</label>
        <textarea class="form-textarea" id="pub-desc-input" rows="2" placeholder="Hardening playbook for..."></textarea>
      </div>
      <button class="btn btn-primary" style="width: 100%;" onclick="draftPublishPrPreview()">Draft PR JSON Preview</button>
    </div>
  `;

  modalOverlay.classList.add("active");
}

function draftPublishPrPreview() {
  const id = document.getElementById("pub-id-input")?.value.trim();
  const desc = document.getElementById("pub-desc-input")?.value.trim();

  if (!id || !desc) {
    showToast("Please fill in Package ID and Description.");
    return;
  }

  const draftJson = {
    id: id,
    name: id.split("/")[1] || id,
    version: "1.0.0",
    description: desc,
    category: "community",
    publisher: { handle: id.split("/")[0] || "user", name: "Community Contributor", verified: false }
  };

  copyToClipboard(JSON.stringify(draftJson, null, 2), "Draft JSON copied to clipboard! Ready for Pull Request.");
}

function openCliBuilderModal() {
  openInspectModal("amElnagdy/ui-review-loop");
  switchModalTab("cli");
}

function closeModal() {
  const modalOverlay = document.getElementById("inspect-modal");
  if (modalOverlay) modalOverlay.classList.remove("active");
}

function copyToClipboard(text, successMessage) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text);
  }
  showToast(successMessage || "Copied to clipboard!");
}

function showToast(message) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<span>📋 ${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(120%)";
    setTimeout(() => toast.remove(), 350);
  }, 2500);
}

// Global Window Function Exports
window.openPublishModal = openPublishModal;
window.openInspectModal = openInspectModal;
window.openCliBuilderModal = openCliBuilderModal;
window.closeModal = closeModal;
window.copyPullCommand = copyPullCommand;
window.switchHeroPreset = switchHeroPreset;
window.copyCurrentHeroCommand = copyCurrentHeroCommand;
window.switchModalTab = switchModalTab;
window.updateCliCommandPreview = updateCliCommandPreview;
window.copyCustomCliCommand = copyCustomCliCommand;
window.draftPublishPrPreview = draftPublishPrPreview;
window.copyToClipboard = copyToClipboard;
window.showToast = showToast;
