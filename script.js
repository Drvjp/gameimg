// 共用的JavaScript代码

// 全局变量
let games = [];
let filteredGames = [];
let loadedCount = 0;
let pageSize = 50;
let isAdmin = false;
let editingIndex = null;
let selectedGames = [];
const ADMIN_PASSWORD = 'Wcs160520';

// 生成有序ID
let gameIdCounter = 1;
function generateId() {
  // 从现有游戏中获取最大ID值作为起始值
  if (games && games.length > 0) {
    const maxId = Math.max(...games.map(game => {
      // 尝试将现有ID转换为数字，如果失败则返回0
      const num = parseInt(game.id);
      return isNaN(num) ? 0 : num;
    }));
    if (maxId >= gameIdCounter) {
      gameIdCounter = maxId + 1;
    }
  }
  // 返回字符串格式的ID，确保与现有ID格式一致
  return gameIdCounter++ + '';
}

// 加载数据
async function loadData() {
  const status = document.getElementById("status");
  const container = document.getElementById("gamesContainer");
  if (container) container.innerHTML = "";
  if (status) status.textContent = "加载中...";

  try {
    // 首先尝试从localStorage加载数据（适用于管理页面的即时更新）
    const localStorageData = localStorage.getItem('gamesData');
    let data, gamesFromStorage = [];
    
    if (localStorageData) {
      try {
        const parsed = JSON.parse(localStorageData);
        if (parsed.games && Array.isArray(parsed.games)) {
          gamesFromStorage = parsed.games;
          // 读取公告 - 兼容不同页面的元素ID
          const announceEl = document.getElementById("announcement") || document.getElementById("announcementText");
          if (announceEl && parsed.announcement) {
            announceEl.textContent = parsed.announcement;
          }
          
          // 如果是管理页面，直接使用localStorage的数据
          if (isAdmin) {
            games = gamesFromStorage;
            games.forEach(g => {
              if (!g.id) g.id = generateId(); // 为没有id的游戏添加唯一id
              if (g.newRelease === undefined) g.newRelease = false;
              if (g.tag === undefined) g.tag = '';
              if (g.link === undefined) g.link = '';
              // 移除banner属性以彻底禁用顶部推荐Banner功能
              delete g.banner;
            });
            
            if (status) status.textContent = `✅ 从本地存储加载 ${games.length} 个游戏`;
            return true;
          }
        }
      } catch (e) {
        console.warn('localStorage数据解析失败:', e);
      }
    }
    
    // 如果不是管理页面或者localStorage没有数据，则从games.json加载
    const response = await fetch('games.json?' + new Date().getTime());
    data = await response.json();
    
    // 读取公告（如果还没有从localStorage设置）
    const announceEl = document.getElementById("announcement") || document.getElementById("announcementText");
    if (announceEl && data.announcement) {
      announceEl.textContent = data.announcement;
    }

    // 读取游戏列表
    games = Array.isArray(data.games) ? data.games : [];
    games.forEach(g => {
      if (!g.id) g.id = generateId(); // 为没有id的游戏添加唯一id
      if (g.newRelease === undefined) g.newRelease = false;
      if (g.tag === undefined) g.tag = '';
      if (g.link === undefined) g.link = '';
      // 移除banner属性以彻底禁用顶部推荐Banner功能
      delete g.banner;
    });

    if (status) status.textContent = `✅ 成功加载 ${games.length} 个游戏`;
    return true;
  } catch (err) {
    if (status) status.textContent = `❌ 加载失败：${err.message}`;
    games = [];
    return false;
  }
}

// 设置无限滚动
function setupInfiniteScroll() {
  window.addEventListener('scroll', () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
      loadMore();
    }
  });
}

// 过滤并排序
function filterAndSort() {
  const query = document.getElementById("searchInput")?.value.trim().toLowerCase() || '';
  const sort = document.getElementById("sortSelect")?.value || 'default';

  let filtered = [...games];
  // 只移除已选中的游戏
  filtered = filtered.filter(g => !selectedGames.some(s => s.name === g.name));
  
  // 在首页底下列表中过滤掉标记为'即将上新'的游戏，这些游戏只显示在上新区域
  if (!isAdmin) {
    filtered = filtered.filter(g => !g.newRelease);
  }

  if (query) {
    filtered = filtered.filter(g => g.name.toLowerCase().includes(query));
  }

  if (sort === 'name-asc') {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === 'name-desc') {
    filtered.sort((a, b) => b.name.localeCompare(a.name));
  } else if (sort === 'drag-sort') {
      // 应用保存的拖拽排序（仅管理员可用）
    if (isAdmin && localStorage.getItem('dragSortOrder')) {
      const dragSortOrder = JSON.parse(localStorage.getItem('dragSortOrder'));
      filtered.sort((a, b) => {
        const indexA = dragSortOrder.indexOf(a.id);
        const indexB = dragSortOrder.indexOf(b.id);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
    } else {
        // 非管理员用户选择了拖拽排序，自动切换回默认排序
        if (document.getElementById("sortSelect")) {
          document.getElementById("sortSelect").value = "default";
        }
      }
    }

  filteredGames = filtered;
  loadedCount = 0;
  if (document.getElementById("gamesContainer")) {
    document.getElementById("gamesContainer").innerHTML = "";
    loadMore(); // 加载第一页
  }
  if (document.getElementById("selectedList")) {
    updateSelectedList();
  }
  renderNewReleases();
}

// 设置拖拽排序
function setupDragSort() {
  const container = document.getElementById("gamesContainer");
  if (!container) return;
  
  let draggedItem = null;
  let currentDropTarget = null;
  
  // 监听拖拽相关事件
  container.addEventListener('dragstart', function(e) {
    // 优化：让整个卡片都可以触发拖拽
    let cardElement = null;
    if (e.target.classList.contains('game-card')) {
      cardElement = e.target;
    } else {
      // 如果点击的是卡片内的元素，找到父级卡片
      cardElement = e.target.closest('.game-card');
    }
    
    if (isAdmin && cardElement) {
      draggedItem = cardElement;
      // 添加拖拽样式
      setTimeout(() => {
        cardElement.classList.add('dragging');
        cardElement.style.opacity = '0.5';
      }, 0);
    }
  });
  
  container.addEventListener('dragend', function(e) {
    // 优化：让整个卡片都可以触发拖拽结束
    let cardElement = null;
    if (e.target.classList.contains('game-card')) {
      cardElement = e.target;
    } else {
      cardElement = e.target.closest('.game-card');
    }
    
    if (isAdmin && cardElement) {
      // 移除拖拽样式
      cardElement.classList.remove('dragging');
      cardElement.style.opacity = '1';
      cardElement.style.transform = 'none';
      draggedItem = null;
      
      // 移除所有临时样式
      document.querySelectorAll('.game-card.drag-over').forEach(el => {
        el.classList.remove('drag-over');
        el.style.border = 'none';
      });
      
      currentDropTarget = null;
      
      // 保存拖拽排序结果
      const cards = Array.from(container.querySelectorAll('.game-card'));
      const order = cards.map(card => {
        // 获取游戏id（从卡片的data-id属性）
        return card.dataset.id || '';
      }).filter(id => id);
      
      if (order.length > 0) {
        localStorage.setItem('dragSortOrder', JSON.stringify(order));
        // 自动选择拖拽排序选项，确保下次加载时应用保存的排序
        if (document.getElementById("sortSelect")) {
          document.getElementById("sortSelect").value = "drag-sort";
        }
        // 移除弹窗提醒，保持操作流畅
      }
    }
  });
  
  container.addEventListener('dragover', function(e) {
    if (isAdmin) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  });
  
  container.addEventListener('dragenter', function(e) {
    // 优化：让整个卡片都可以作为放置目标
    let cardElement = null;
    if (e.target.classList.contains('game-card')) {
      cardElement = e.target;
    } else {
      cardElement = e.target.closest('.game-card');
    }
    
    if (isAdmin && cardElement && cardElement !== draggedItem) {
      e.preventDefault();
      
      // 更新当前放置目标
      if (currentDropTarget) {
        currentDropTarget.classList.remove('drag-over');
        currentDropTarget.style.border = 'none';
      }
      
      currentDropTarget = cardElement;
      currentDropTarget.classList.add('drag-over');
      currentDropTarget.style.border = '2px dashed #0066cc';
      
      // 实时插入（视觉效果）
      const cards = Array.from(container.querySelectorAll('.game-card:not(.dragging)'));
      const currentTarget = cardElement;
      
      cards.forEach(card => {
        if (card === currentTarget) {
          // 计算鼠标位置，决定插入到上方还是下方
          const rect = card.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          
          if (draggedItem && draggedItem.parentNode === container) {
            // 获取当前卡片和拖拽卡片的索引
            const cardIndex = cards.indexOf(card);
            const draggedIndex = cards.indexOf(draggedItem);
            
            // 如果卡片不是拖拽中的卡片且位置合适，则移动
            if (card !== draggedItem) {
              if (e.clientY < midY && draggedIndex > cardIndex) {
                // 插入到卡片上方
                container.insertBefore(draggedItem, card);
              } else if (e.clientY >= midY && draggedIndex < cardIndex) {
                // 插入到卡片下方
                container.insertBefore(draggedItem, card.nextSibling);
              }
            }
          }
        }
      });
    }
  });
  
  container.addEventListener('dragleave', function(e) {
    // 优化：让整个卡片都可以触发拖拽离开
    let cardElement = null;
    if (e.target.classList.contains('game-card')) {
      cardElement = e.target;
    } else {
      cardElement = e.target.closest('.game-card');
    }
    
    if (isAdmin && cardElement && cardElement === currentDropTarget) {
      cardElement.classList.remove('drag-over');
      cardElement.style.border = 'none';
      currentDropTarget = null;
    }
  });
  
  container.addEventListener('drop', function(e) {
    // 优化：让整个卡片都可以作为放置目标
    let cardElement = null;
    if (e.target.classList.contains('game-card')) {
      cardElement = e.target;
    } else {
      cardElement = e.target.closest('.game-card');
    }
    
    if (isAdmin) {
      e.preventDefault();
      
      if (cardElement) {
        cardElement.classList.remove('drag-over');
        cardElement.style.border = 'none';
        currentDropTarget = null;
      }
    }
  });
}

// 清除拖拽排序（仅管理员可用）
function clearDragSort() {
  if (!isAdmin) return;
  localStorage.removeItem('dragSortOrder');
  if (document.getElementById("sortSelect")) {
    document.getElementById("sortSelect").value = "default";
  }
  filterAndSort();
  alert('拖拽排序已清除！');
}

// 加载更多
function loadMore() {
  const container = document.getElementById("gamesContainer");
  if (!container) return;
  
  const start = loadedCount;
  const end = start + pageSize;
  const batch = filteredGames.slice(start, end);

  if (batch.length === 0) {
    if (document.getElementById("loadMore")) {
      document.getElementById("loadMore").style.display = "none";
    }
    return;
  }

  renderGames(batch);
  loadedCount = end;
  if (document.getElementById("loadMore")) {
    document.getElementById("loadMore").style.display = end < filteredGames.length ? "block" : "none";
  }
}

// 查重
function isDuplicate(newName, existingGames) {
  const noiseWords = [
    'v', 'ver', 'version', '加强版', '豪华版', '终极版', '重制版', '典藏版', '特别版', '限定版', '年度版',
    '数字版', '光盘版', '实体版', '中文版', '英文版', '日版', '美版', '欧版',
    'pc', 'ns', 'switch', 'ps4', 'ps5', 'xbox', 'epic', 'steam',
    '第?\\d+[部集]', '第?[一二三四五六七八九十]+[部集]',
    '[【】\\[\\](){}<>«»]',
    '\\s+'
  ];

  function normalize(str) {
    let s = str.trim().toLowerCase();
    noiseWords.forEach(pattern => {
      const regex = new RegExp(pattern, 'gi');
      s = s.replace(regex, '');
    });
    s = s.replace(/(\d+)/g, (_, num) => {
      const map = { '1':'一','2':'二','3':'三','4':'四','5':'五','6':'六','7':'七','8':'八','9':'九','0':'零' };
      return num.split('').map(d => map[d] || d).join('');
    });
    return s.replace(/[^a-z\u4e00-\u9fa5]/g, '');
  }

  function getCoreWords(str) {
    const words = str.match(/[\u4e00-\u9fa5]+|[a-z]+/gi) || [];
    return words.sort((a, b) => b.length - a.length).slice(0, 2);
  }

  const normNew = normalize(newName);
  const coreNew = getCoreWords(normNew);

  return existingGames.some(game => {
    const normExist = normalize(game.name);
    const coreExist = getCoreWords(normExist);
    const byNorm = (normNew.includes(normExist) && normExist.length > 3) || 
                   (normExist.includes(normNew) && normNew.length > 3);
    const byCore = coreNew.some(w => normExist.includes(w)) || 
                   coreExist.some(w => normNew.includes(w));
    return byNorm || byCore;
  });
}

// 渲染游戏
function renderGames(gamesToRender) {
  const container = document.getElementById("gamesContainer");
  if (!container) return;

  gamesToRender.forEach((game) => {
    const card = document.createElement("div");
    card.className = "game-card";
    card.draggable = isAdmin;
    card.dataset.id = game.id; // 添加data-id属性，用于拖拽排序

    let actionsHtml = '';
    if (isAdmin) {
      actionsHtml = `
        <div class="card-actions">
          <button class="btn btn-edit" onclick="openEditModal(${games.indexOf(game)})">编辑</button>
          <button class="btn btn-delete" onclick="deleteGame(${games.indexOf(game)})">删除</button>
        </div>
      `;
    } else {
      // 非管理员：显示“加入清单”按钮
      actionsHtml = `<button class="btn btn-add" onclick="addToSelected(${games.indexOf(game)})">➕ 加入清单</button>`;
    }

    const tagHtml = game.tag ? `<div class="game-tag">${game.tag}</div>` : '';
    const topHtml = game.banner ? '<div class="top-left-badge">TOP</div>' : '';

    let content = `
      <div class="game-image-container">
        <img src="${game.image}" alt="${game.name}" class="game-image" onerror="this.src='data:image/svg+xml;charset=UTF-8,%3csvg xmlns%3d%22http%3a%2f%2fwww.w3.org%2f2000%2fsvg%22 width%3d%22280%22 height%3d%22200%22 viewBox%3d%220 0 280 200%22 fill%3d%22none%22%3e%3crect width%3d%22280%22 height%3d%22200%22 fill%3d%22%23f0f0f0%22%2f%3e%3ctext x%3d%22140%22 y%3d%22100%22 dominant-baseline%3d%22middle%22 text-anchor%3d%22middle%22 font-family%3d%22Arial%22 font-size%3d%2212%22 fill%3d%22%23666%22%3e${encodeURIComponent(game.name)}%3c%2ftext%3e%3c%2fsvg%3e'">
        ${topHtml}
        ${tagHtml}
      </div>
      <div class="game-info">
        <h3 class="game-title">${game.name}</h3>
        <p class="game-format">${game.format}</p>
        ${actionsHtml}
      </div>
    `;

    card.innerHTML = content;
    
    // 如果游戏有链接，只在点击图片时添加确认跳转功能
    if (game.link && game.link.trim() !== '') {
      // 修复链接：确保有协议
      let link = game.link.trim();
      if (!/^https?:\/\//i.test(link)) {
        link = 'https://' + link;
      }
      
      // 获取图片元素并添加点击事件
      const imgElement = card.querySelector('.game-image');
      if (imgElement) {
        imgElement.style.cursor = 'pointer';
        imgElement.onclick = function() {
          if (confirm(`确定要跳转到 "${game.name}" 的链接吗？`)) {
            window.open(link, '_blank');
          }
        };
      }
    }

    container.appendChild(card);
  });
}



// 渲染即将上新游戏
function renderNewReleases() {
  const newReleaseContainer = document.getElementById("newReleaseContainer");
  if (!newReleaseContainer) return;
  
  // 直接设置内联样式，确保网格布局正常工作
  newReleaseContainer.style.cssText = '';
  newReleaseContainer.style.display = 'grid';
  newReleaseContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
  newReleaseContainer.style.gridAutoFlow = 'dense';
  newReleaseContainer.style.gap = '20px';
  newReleaseContainer.style.width = '100%';
  newReleaseContainer.style.boxSizing = 'border-box';
  newReleaseContainer.style.minHeight = '200px';
  
  newReleaseContainer.innerHTML = "";
  const newReleaseGames = games.filter(g => g.newRelease);
  
  if (newReleaseGames.length === 0) {
    newReleaseContainer.innerHTML = "<p style='text-align: center; padding: 20px;'>暂无即将上新游戏</p>";
    return;
  }
  
  // 渲染即将上新的游戏卡片，恢复图片显示
  newReleaseGames.forEach((game) => {
    const card = document.createElement("div");
    // 为卡片设置内联样式，确保它不会干扰网格布局
    card.style.width = '100%';
    card.style.boxSizing = 'border-box';
    card.style.margin = '0';
    card.style.padding = '0';
    card.style.backgroundColor = '#fff';
    card.style.border = '1px solid #e0e0e0';
    card.style.borderRadius = '8px';
    card.style.overflow = 'hidden';
    card.style.transition = 'all 0.3s ease';
    
    // 格式化发售日期
    let releaseDateHtml = '';
    if (game.releaseDate) {
      const date = new Date(game.releaseDate);
      // 检查日期是否有效
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        releaseDateHtml = `<div style="position: absolute; top: 10px; left: 70px; background-color: #f39c12; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
          ${year}/${month}/${day}日发售
        </div>`;
      }
    }
    
    // 创建带图片的内容结构
    let content = `
      <div style="position: relative;">
        <img src="${game.image}" alt="${game.name}" style="width: 100%; height: 200px; object-fit: cover;" onerror="this.src='data:image/svg+xml;charset=UTF-8,%3csvg xmlns%3d%22http%3a%2f%2fwww.w3.org%2f2000%2fsvg%22 width%3d%22280%22 height%3d%22200%22 viewBox%3d%220 0 280 200%22 fill%3d%22none%22%3e%3crect width%3d%22280%22 height%3d%22200%22 fill%3d%22%23f0f0f0%22%2f%3e%3ctext x%3d%22140%22 y%3d%22100%22 dominant-baseline%3d%22middle%22 text-anchor%3d%22middle%22 font-family%3d%22Arial%22 font-size%3d%2212%22 fill%3d%22%23666%22%3e${encodeURIComponent(game.name)}%3c%2ftext%3e%3c%2fsvg%3e'">
        <div style="position: absolute; top: 10px; left: 10px; background-color: #e74c3c; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
          即将上新
        </div>
        ${releaseDateHtml}
        ${game.tag ? `<div style="position: absolute; top: 10px; right: 10px; background-color: #3498db; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${game.tag}</div>` : ''}
      </div>
      <div style="padding: 12px;">
        <h3 style="margin: 0 0 6px 0; font-size: 16px;">${game.name}</h3>
        <p style="margin: 0; font-size: 14px; color: #666;">${game.format}</p>
      </div>
    `;

    card.innerHTML = content;
    newReleaseContainer.appendChild(card);
  });
}

// 加入清单
function addToSelected(index) {
  const game = games[index];
  if (selectedGames.some(g => g.name === game.name)) {
    alert("该游戏已在清单中");
    return;
  }

  if (selectedGames.length >= 4) {
    const proceed = confirm("亲亲，当前订单一般最多四款游戏哦，是否继续加入供你呢最后挑选决策呢？");
    if (!proceed) return;
  }

  selectedGames.push(game);
  filterAndSort();
}

function updateSelectedList() {
  const list = document.getElementById("selectedList");
  if (!list) return;
  
  list.innerHTML = "";

  selectedGames.forEach((game, i) => {
    const item = document.createElement("div");
    item.className = "selected-item";
    item.innerHTML = `
      <img src="${game.image}" alt="${game.name}">
      <div class="selected-item-info">
        <p class="selected-item-title">${game.name}</p>
        <p class="selected-item-format">${game.format}</p>
      </div>
      <button class="selected-item-remove" onclick="removeFromSelected(${i})">×</button>
    `;
    list.appendChild(item);
  });

  const btn = document.getElementById("selectedBtn");
  if (btn) {
    if (selectedGames.length > 0) {
      btn.textContent = `📋 选单 (${selectedGames.length})`;
      btn.style.display = "block";
    } else {
      btn.style.display = "none";
    }
  }
}

function removeFromSelected(index) {
  selectedGames.splice(index, 1);
  filterAndSort();
}

function clearSelected() {
  if (confirm("确定清空已选列表？")) {
    selectedGames = [];
    filterAndSort();
    closeSelectedPanel();
  }
}

function copySelected() {
  if (selectedGames.length === 0) {
    alert("当前没有选中游戏");
    return;
  }
  const names = selectedGames.map(g => g.name).join('\n');
  navigator.clipboard.writeText(names).then(() => {
    alert("✅ 已复制选中游戏名称：\n\n" + names);
  });
}

function toggleSelectedPanel() {
  const panel = document.getElementById("selectedPanel");
  const overlay = document.getElementById("overlay");
  if (!panel || !overlay) return;
  
  if (panel.classList.contains("active")) {
    closeSelectedPanel();
  } else {
    panel.classList.add("active");
    overlay.style.display = "block";
  }
}

function closeSelectedPanel() {
  const panel = document.getElementById("selectedPanel");
  const overlay = document.getElementById("overlay");
  if (!panel || !overlay) return;
  
  panel.classList.remove("active");
  overlay.style.display = "none";
}

// 管理员登录
function adminLogin() {
  const pwd = prompt("请输入管理员密码：");
  if (pwd === ADMIN_PASSWORD) {
    isAdmin = true;
    location.href = 'admin.html';
  } else {
    alert("❌ 密码错误！");
  }
}

// 导出数据（包含 announcement 和 games）
function exportDataFunc() {
  if (games.length === 0) {
    alert("当前没有数据可导出！");
    return;
  }

  const announceText = document.getElementById("announcementText").innerText.trim();
  const dataStr = JSON.stringify({
    announcement: announceText,
    games: games
  }, null, 2);

  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "games.json";
  a.click();
  URL.revokeObjectURL(url);
  alert("✅ 文件已生成，请上传覆盖 GitHub 上的 games.json");
}
