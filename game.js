// MOTORE DI GIOCO: Imperia: Giorno & Notte

const state = {
  victoryGoal: 15,
  boardSide: '4-8',
  round: 1,
  phase: 'DAY', // 'DAY' | 'NIGHT'
  players: [],
  turnOrder: [], // array di player index
  currentTurnPos: 0,
  territories: [],
  marketTiles: [],
  interactionMode: null, // null | 'monument' | 'move_from' | 'move_to' | 'recruit'
  selectedTerritoryId: null,
  moveStepsLeft: 0,
  battleContext: null
};

// INIZIALIZZAZIONE UI SETUP
document.addEventListener('DOMContentLoaded', () => {
  const playerCountEl = document.getElementById('player-count');
  playerCountEl.addEventListener('change', renderPlayerSetupSlots);
  renderPlayerSetupSlots();

  document.getElementById('start-game-btn').addEventListener('click', startGame);
  document.getElementById('btn-rules').addEventListener('click', showRulesModal);
  document.getElementById('close-info-modal').addEventListener('click', () => {
    document.getElementById('info-modal').classList.add('hidden');
  });
});

function renderPlayerSetupSlots() {
  const count = parseInt(document.getElementById('player-count').value, 10);
  const container = document.getElementById('players-config');
  container.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const civ = CIVILIZATIONS[i % CIVILIZATIONS.length];
    const isBotDefault = i > 0;
    const card = document.createElement('div');
    card.className = 'player-slot-card';
    card.innerHTML = `
      <h4 style="color:${civ.color}">Giocatore ${i + 1}</h4>
      <div class="form-group" style="margin-bottom:8px;">
        <label>Civiltà &amp; Comandante</label>
        <select id="civ-select-${i}">
          ${CIVILIZATIONS.map((c, idx) => `<option value="${idx}" ${idx === i ? 'selected' : ''}>${c.name} (${c.commander})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Controllo</label>
        <select id="type-select-${i}">
          <option value="human" ${!isBotDefault ? 'selected' : ''}>Umano (Passa e Gioca)</option>
          <option value="bot" ${isBotDefault ? 'selected' : ''}>Bot IA</option>
        </select>
      </div>
    `;
    container.appendChild(card);
  }
}

function startGame() {
  state.victoryGoal = parseInt(document.getElementById('victory-goal').value, 10);
  state.boardSide = document.getElementById('board-side').value;
  const count = parseInt(document.getElementById('player-count').value, 10);

  state.territories = createBoardTerritories(state.boardSide).map(t => ({
    ...t,
    ownerId: null,
    troops: 0,
    monument: null // { color: 'red'|'white'|'blue', level: 1..4 }
  }));

  state.players = [];
  const cityTerritories = state.territories.filter(t => t.type === 'city');

  for (let i = 0; i < count; i++) {
    const civIdx = parseInt(document.getElementById(`civ-select-${i}`).value, 10);
    const isBot = document.getElementById(`type-select-${i}`).value === 'bot';
    const civ = CIVILIZATIONS[civIdx];

    const player = {
      id: i,
      name: `G${i + 1} - ${civ.name}`,
      civ,
      isBot,
      gold: 4,
      permanentVP: 0,
      tokensLeft: 5,
      occupiedSlots: [], // slot id occupati nel giorno corrente
      occupiedLevels: new Set(), // 1, 2, 3
      tiles: [],
      battleHand: JSON.parse(JSON.stringify(BASE_BATTLE_CARDS))
    };

    // Assegna città iniziale con 3 unità
    if (cityTerritories[i]) {
      cityTerritories[i].ownerId = player.id;
      cityTerritories[i].troops = 3;
    }

    state.players.push(player);
  }

  state.marketTiles = JSON.parse(JSON.stringify(POWER_TILES));
  state.turnOrder = state.players.map(p => p.id);
  state.currentTurnPos = 0;
  state.round = 1;
  state.phase = 'DAY';

  document.getElementById('setup-screen').classList.remove('active');
  document.getElementById('game-screen').classList.add('active');

  addLog(`Partita iniziata! Obiettivo: ${state.victoryGoal} PV. Plancia Lato ${state.boardSide}.`);
  renderAll();
  checkBotTurn();
}

// CALCOLO PUNTI VITTORIA (Permanenti + Temporanei da Monumenti lv 4 + Bastioni)
function getPlayerTotalVP(player) {
  let tempVP = 0;
  state.territories.forEach(t => {
    if (t.ownerId === player.id) {
      if (t.type === 'bastion') tempVP += 1;
      if (t.monument && t.monument.level >= 4) tempVP += 1;
    }
  });
  return player.permanentVP + tempVP;
}

function getActivePlayer() {
  const id = state.turnOrder[state.currentTurnPos];
  return state.players[id];
}

// RENDERING COMPLETO
function renderAll() {
  const activePlayer = getActivePlayer();

  document.getElementById('round-badge').textContent = `Turno ${state.round}`;
  const phaseBadge = document.getElementById('phase-badge');
  phaseBadge.textContent = state.phase === 'DAY' ? 'FASE DI GIORNO' : 'FASE NOTTURNA';
  phaseBadge.className = `badge ${state.phase === 'DAY' ? 'badge-day' : 'badge-night'}`;
  document.getElementById('goal-badge').textContent = `Obiettivo: ${state.victoryGoal} PV`;

  // Barra ordine turno
  const turnBar = document.getElementById('turn-order-bar');
  turnBar.innerHTML = '<span style="font-size:0.78rem;color:#9aa5b8;">Ordine:</span>' +
    state.turnOrder.map((pid, idx) => {
      const p = state.players[pid];
      return `<span class="turn-pill ${idx === state.currentTurnPos ? 'active' : ''}" style="border-color:${p.civ.color}">${p.name} (${p.tokensLeft} seg.)</span>`;
    }).join('');

  renderActivePlayerPanel(activePlayer);
  renderMap();
  renderSidebar();
}

function renderActivePlayerPanel(player) {
  const header = document.getElementById('active-player-header');
  const totalVP = getPlayerTotalVP(player);
  header.style.borderLeftColor = player.civ.color;
  header.innerHTML = `
    <div style="font-weight:700;font-size:1rem;color:${player.civ.color}">${player.name} ${player.isBot ? '🤖' : '👤'}</div>
    <div style="font-size:0.78rem;color:#cbd5e1;margin-top:2px;">Comandante: <strong>${player.civ.commander}</strong> — ${player.civ.passive}</div>
    <div class="stats-row">
      <span class="stat-gold">🪙 Oro: ${player.gold}</span>
      <span class="stat-vp">🏆 PV: ${totalVP} (Perm: ${player.permanentVP})</span>
    </div>
  `;

  // Segnalini azione
  const tokensBar = document.getElementById('tokens-bar');
  let dots = '';
  for (let i = 0; i < 5; i++) {
    dots += `<span class="token-dot ${i >= player.tokensLeft ? 'used' : ''}"></span>`;
  }
  tokensBar.innerHTML = `<span>Segnalini rimasti: <strong>${player.tokensLeft}/5</strong></span> ${dots}`;

  // Plancia Azioni 3 Livelli
  const actionBoard = document.getElementById('action-board');
  actionBoard.innerHTML = '';

  ACTION_LEVELS.forEach(lvl => {
    const hasLevel = player.occupiedLevels.has(lvl.level);
    const mustForceLevel = mustPickMissingLevel(player, lvl.level);

    const lvlDiv = document.createElement('div');
    lvlDiv.className = `action-level ${hasLevel ? 'satisfied' : ''}`;
    lvlDiv.innerHTML = `
      <div class="level-header">
        <span>${lvl.name}</span>
        <span>${hasLevel ? '✅ Coperto' : '⚠️ Richiesto'}</span>
      </div>
      <div class="action-slots"></div>
    `;

    const slotsContainer = lvlDiv.querySelector('.action-slots');
    lvl.slots.forEach(slot => {
      const isOccupied = player.occupiedSlots.includes(slot.id);
      const disabled = isOccupied || player.tokensLeft <= 0 || player.isBot || state.phase !== 'DAY' || !mustForceLevel;

      const btn = document.createElement('button');
      btn.className = `action-slot ${isOccupied ? 'occupied' : ''}`;
      btn.disabled = disabled;
      btn.innerHTML = `
        <span class="slot-title">${slot.title}</span>
        <span class="slot-desc">${isOccupied ? 'Già occupata' : slot.desc}</span>
      `;
      btn.onclick = () => selectActionSlot(player, lvl.level, slot);
      slotsContainer.appendChild(btn);
    });

    actionBoard.appendChild(lvlDiv);
  });

  // Tessere possedute
  const ownedEl = document.getElementById('owned-tiles');
  if (player.tiles.length === 0) {
    ownedEl.innerHTML = '<span class="hint">Nessuna tessera potere acquistata.</span>';
  } else {
    ownedEl.innerHTML = player.tiles.map(t => `
      <div class="power-tile ${t.color}">
        <strong>${t.name}</strong> (Lv.${t.level} • ${t.phase === 'night' ? '🌙 Notte' : '☀️ Giorno'})<br/>
        <span style="color:#9aa5b8">${t.desc}</span>
      </div>
    `).join('');
  }
}

// Regola: dopo aver piazzato tutti e 5 i segnalini, ogni giocatore deve avere almeno 1 segnalino in ognuno dei 3 livelli
function mustPickMissingLevel(player, candidateLevel) {
  const missingLevels = [1, 2, 3].filter(l => !player.occupiedLevels.has(l));
  if (player.tokensLeft <= missingLevels.length) {
    return missingLevels.includes(candidateLevel);
  }
  return true;
}

function renderMap() {
  document.getElementById('board-title').textContent = `Plancia di Gioco — Lato ${state.boardSide}`;
  const container = document.getElementById('map-container');
  container.innerHTML = '';

  const activePlayer = getActivePlayer();

  state.territories.forEach(t => {
    const owner = t.ownerId !== null ? state.players[t.ownerId] : null;
    const card = document.createElement('div');
    card.className = 'territory-card';
    if (state.selectedTerritoryId === t.id) card.classList.add('selected');

    if (isTerritorySelectable(t, activePlayer)) {
      card.classList.add('selectable');
      card.onclick = () => handleTerritoryClick(t);
    }

    const typeLabel = { city: 'Città', monument: 'Zona Monumento', port: 'Porto', bastion: 'Bastione (+1 PV, +1 Oro)' }[t.type];
    const monHtml = t.monument
      ? `<div class="monument-tag mon-${t.monument.color}">Monumento ${colorNameIt(t.monument.color)} Lv.${t.monument.level}</div>`
      : '';

    card.innerHTML = `
      <div class="terr-top">
        <span class="terr-name">${t.name}</span>
        <span class="terr-type type-${t.type}">${typeLabel}</span>
      </div>
      <div class="terr-district">${t.district}</div>
      <div class="terr-owner" style="color:${owner ? owner.civ.color : '#64748b'}">
        ${owner ? `Controllo: ${owner.name}` : 'Territorio Neutrale'}
      </div>
      <div class="terr-troops">⚔️ Unità presenti: <strong>${t.troops}</strong></div>
      ${monHtml}
    `;
    container.appendChild(card);
  });
}

function renderSidebar() {
  const sb = document.getElementById('scoreboard');
  sb.innerHTML = state.players.map(p => `
    <div class="score-row">
      <span style="color:${p.civ.color};font-weight:700;">${p.name}</span>
      <span>🪙 ${p.gold} | 🏆 <strong>${getPlayerTotalVP(p)}/${state.victoryGoal}</strong></span>
    </div>
  `).join('');

  const market = document.getElementById('tile-market');
  const activePlayer = getActivePlayer();
  market.innerHTML = state.marketTiles.map(tile => {
    const canBuy = state.interactionMode === 'buy_tile' && canPlayerBuyTile(activePlayer, tile);
    return `
      <div class="power-tile ${tile.color}" style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
        <div>
          <strong>${tile.name}</strong> (${colorNameIt(tile.color)} Lv.${tile.level}) — 🪙 ${getTileCost(activePlayer, tile)}<br/>
          <span style="color:#9aa5b8">${tile.desc}</span>
        </div>
        ${canBuy ? `<button class="btn btn-gold btn-small" onclick="buyMarketTile('${tile.id}')">Compra</button>` : ''}
      </div>
    `;
  }).join('');
}

// AZIONI DEL GIOCATORE
function selectActionSlot(player, level, slot) {
  player.tokensLeft -= 1;
  player.occupiedSlots.push(slot.id);
  player.occupiedLevels.add(level);

  addLog(`${player.name} piazza un segnalino su "${slot.title}" (Livello ${level}).`);

  if (slot.type === 'tax') {
    player.gold += 2;
    addLog(`${player.name} riscuote 2 Oro.`);
    finishPlayerAction();
  } else if (slot.type === 'recruit') {
    state.interactionMode = 'recruit';
    setInstruction('Seleziona un territorio che controlli per reclutare unità (1 Oro ciascuna).');
    renderAll();
  } else if (slot.type === 'monument') {
    state.interactionMode = 'monument';
    setInstruction('Seleziona una Zona Monumento che controlli per costruirlo o elevarlo.');
    renderAll();
  } else if (slot.type === 'buy_tile') {
    state.interactionMode = 'buy_tile';
    setInstruction('Acquista una Tessera Potere dal Mercato a destra (oppure salta se non puoi/vuoi).');
    renderMapControls(`<button class="btn btn-secondary btn-small" onclick="cancelOrFinishAction()">Termina Azione</button>`);
    renderAll();
  } else if (slot.type === 'move_attack') {
    const bonusMove = player.tiles.filter(t => t.effect === 'move_bonus').reduce((s, t) => s + t.value, 0);
    state.moveStepsLeft = 1 + bonusMove;
    state.interactionMode = 'move_from';
    setInstruction(`Muovi & Attacca (Passi disponibili: ${state.moveStepsLeft}): seleziona un tuo territorio con truppe.`);
    renderMapControls(`<button class="btn btn-secondary btn-small" onclick="cancelOrFinishAction()">Termina Movimento</button>`);
    renderAll();
  }
}

function isTerritorySelectable(t, player) {
  if (player.isBot || state.phase !== 'DAY') return false;
  if (state.interactionMode === 'recruit') return t.ownerId === player.id;
  if (state.interactionMode === 'monument') return t.ownerId === player.id && t.type === 'monument';
  if (state.interactionMode === 'move_from') return t.ownerId === player.id && t.troops > 0;
  if (state.interactionMode === 'move_to') {
    const origin = state.territories.find(x => x.id === state.selectedTerritoryId);
    if (!origin) return false;
    // Regola: adiacente OPPURE da area con monumento ad area con porto
    const isNeighbor = origin.neighbors.includes(t.id);
    const monumentToPort = (origin.type === 'monument' || origin.monument) && t.type === 'port';
    return t.id !== origin.id && (isNeighbor || monumentToPort);
  }
  return false;
}

function handleTerritoryClick(t) {
  const player = getActivePlayer();

  if (state.interactionMode === 'recruit') {
    const maxRecruit = Math.min(3, player.gold);
    if (maxRecruit <= 0) {
      addLog(`${player.name} non ha abbastanza Oro per reclutare.`);
      return cancelOrFinishAction();
    }
    const bonus = player.civ.bonusType === 'recruit_bonus' ? player.civ.bonusValue : 0;
    player.gold -= maxRecruit;
    t.troops += maxRecruit + bonus;
    addLog(`${player.name} spende ${maxRecruit} Oro e recluta ${maxRecruit + bonus} unità a ${t.name}.`);
    return cancelOrFinishAction();
  }

  if (state.interactionMode === 'monument') {
    if (!t.monument) {
      renderMapControls(`
        <button class="btn btn-danger btn-small" onclick="buildOrUpgradeMonument('${t.id}', 'red')">Costruisci Rosso (Lv.1)</button>
        <button class="btn btn-secondary btn-small" onclick="buildOrUpgradeMonument('${t.id}', 'white')">Costruisci Bianco (Lv.1)</button>
        <button class="btn btn-primary btn-small" onclick="buildOrUpgradeMonument('${t.id}', 'blue')">Costruisci Blu (Lv.1)</button>
        <button class="btn btn-secondary btn-small" onclick="cancelOrFinishAction()">Annulla</button>
      `);
    } else if (t.monument.level < 4) {
      renderMapControls(`
        <button class="btn btn-gold btn-small" onclick="buildOrUpgradeMonument('${t.id}', '${t.monument.color}')">Eleva a Livello ${t.monument.level + 1}</button>
        <button class="btn btn-secondary btn-small" onclick="cancelOrFinishAction()">Annulla</button>
      `);
    } else {
      setInstruction('Questo Monumento è già al livello massimo (4).');
    }
    return;
  }

  if (state.interactionMode === 'move_from') {
    state.selectedTerritoryId = t.id;
    state.interactionMode = 'move_to';
    setInstruction(`Partenza: ${t.name} (${t.troops} unità). Clicca una destinazione adiacente o un Porto (se parti da Monumento).`);
    renderAll();
    return;
  }

  if (state.interactionMode === 'move_to') {
    const origin = state.territories.find(x => x.id === state.selectedTerritoryId);
    executeMoveOrAttack(player, origin, t);
  }
}

window.buildOrUpgradeMonument = function(terrId, color) {
  const player = getActivePlayer();
  const t = state.territories.find(x => x.id === terrId);
  const nextLevel = t.monument ? t.monument.level + 1 : 1;
  const discount = (player.civ.bonusType === 'monument_discount' ? 1 : 0) +
    player.tiles.filter(x => x.effect === 'monument_discount').reduce((s, x) => s + x.value, 0);
  const cost = Math.max(1, nextLevel - discount);

  if (player.gold < cost) {
    addLog(`${player.name} non ha ${cost} Oro per elevare il Monumento.`);
    return cancelOrFinishAction();
  }

  player.gold -= cost;
  t.monument = { color, level: nextLevel };
  addLog(`${player.name} eleva il Monumento ${colorNameIt(color)} a Livello ${nextLevel} a ${t.name} (costo ${cost} Oro).`);
  cancelOrFinishAction();
};

function getTileCost(player, tile) {
  const discount = player.civ.bonusType === 'tile_discount' ? 1 : 0;
  return Math.max(1, tile.cost - discount);
}

function canPlayerBuyTile(player, tile) {
  const cost = getTileCost(player, tile);
  if (player.gold < cost) return false;
  // Deve possedere un monumento dello stesso colore e livello >= livello tessera
  return state.territories.some(t =>
    t.ownerId === player.id && t.monument && t.monument.color === tile.color && t.monument.level >= tile.level
  );
}

window.buyMarketTile = function(tileId) {
  const player = getActivePlayer();
  const idx = state.marketTiles.findIndex(t => t.id === tileId);
  if (idx === -1) return;
  const tile = state.marketTiles[idx];
  const cost = getTileCost(player, tile);
  player.gold -= cost;
  player.tiles.push(tile);
  state.marketTiles.splice(idx, 1);
  addLog(`${player.name} acquista la tessera "${tile.name}" per ${cost} Oro.`);
  cancelOrFinishAction();
};

function executeMoveOrAttack(player, origin, target) {
  // Possibilità di lasciare 1 unità dietro se ha almeno 2 unità
  const movingTroops = origin.troops > 1 ? origin.troops - 1 : origin.troops;
  origin.troops -= movingTroops;
  if (origin.troops === 0) origin.ownerId = null;

  if (target.ownerId === null || target.ownerId === player.id) {
    target.ownerId = player.id;
    target.troops += movingTroops;
    addLog(`${player.name} sposta ${movingTroops} unità da ${origin.name} a ${target.name}.`);
    afterMoveStep(target);
  } else {
    // INVASIONE -> BATTAGLIA!
    const defender = state.players[target.ownerId];
    startBattle(player, defender, target, movingTroops);
  }
}

function afterMoveStep(newOrigin) {
  state.moveStepsLeft -= 1;
  if (state.moveStepsLeft > 0 && newOrigin.troops > 0) {
    state.selectedTerritoryId = newOrigin.id;
    state.interactionMode = 'move_to';
    setInstruction(`Passo extra disponibile! Puoi muovere ancora da ${newOrigin.name} o terminare.`);
    renderAll();
  } else {
    cancelOrFinishAction();
  }
}

// SISTEMA DI BATTAGLIA (Scelta 2 carte: 1 giocata, 1 scartata)
function startBattle(attacker, defender, territory, attackingTroops) {
  state.battleContext = {
    attacker,
    defender,
    territory,
    attackingTroops,
    attPicked: [], // [playedCard, discardedCard]
    defPicked: []
  };

  if (attacker.isBot) {
    state.battleContext.attPicked = pickBotBattleCards(attacker);
  }
  if (defender.isBot) {
    state.battleContext.defPicked = pickBotBattleCards(defender);
  }

  if (attacker.isBot && defender.isBot) {
    resolveBattle();
  } else {
    openBattleModal();
  }
}

function pickBotBattleCards(bot) {
  const hand = [...bot.battleHand].sort((a, b) => b.strength - a.strength);
  return [hand[0], hand[hand.length - 1]];
}

function openBattleModal() {
  const ctx = state.battleContext;
  const modal = document.getElementById('battle-modal');
  modal.classList.remove('hidden');

  document.getElementById('battle-summary').innerHTML = `
    <strong>${ctx.attacker.name}</strong> (${ctx.attackingTroops} unità) invade <strong>${ctx.territory.name}</strong> difeso da <strong>${ctx.defender.name}</strong> (${ctx.territory.troops} unità)!
  `;

  const stage = document.getElementById('battle-stage');
  const currentChooser = ctx.attPicked.length < 2 ? ctx.attacker : ctx.defender;
  const currentList = ctx.attPicked.length < 2 ? ctx.attPicked : ctx.defPicked;

  stage.innerHTML = `
    <p>Tocca a <strong>${currentChooser.name}</strong>: scegli <strong>2 carte</strong> (la 1ª sarà <u>GIOCATA</u>, la 2ª sarà <u>SCARTATA</u>).</p>
    <div class="battle-cards-grid">
      ${currentChooser.battleHand.map(c => {
        const idx = currentList.findIndex(x => x.id === c.id);
        const label = idx === 0 ? '✅ GIOCATA' : idx === 1 ? '🗑️ SCARTATA' : 'Clicca per scegliere';
        return `
          <div class="battle-card ${idx !== -1 ? 'picked' : ''}" onclick="selectBattleCard('${c.id}')">
            <strong>${c.name}</strong><br/>
            <span>⚔️ Forza: +${c.strength}</span><br/>
            <span>💥 Danno: ${c.damage} | 🛡️ Prot: ${c.shield}</span><br/>
            <small style="color:#f5b942">${label}</small>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

window.selectBattleCard = function(cardId) {
  const ctx = state.battleContext;
  const isAtt = ctx.attPicked.length < 2;
  const player = isAtt ? ctx.attacker : ctx.defender;
  const list = isAtt ? ctx.attPicked : ctx.defPicked;

  if (list.some(c => c.id === cardId)) return;
  const card = player.battleHand.find(c => c.id === cardId);
  list.push(card);

  if (ctx.attPicked.length === 2 && ctx.defPicked.length === 2) {
    document.getElementById('battle-modal').classList.add('hidden');
    resolveBattle();
  } else {
    openBattleModal();
  }
};

function resolveBattle() {
  const ctx = state.battleContext;
  const [attPlayed, attDiscarded] = ctx.attPicked;
  const [defPlayed, defDiscarded] = ctx.defPicked;

  // Rimuovi entrambe le carte scelte dalla mano (ricicla mano se finiscono)
  [ctx.attacker, ctx.defender].forEach((p, i) => {
    const used = i === 0 ? [attPlayed.id, attDiscarded.id] : [defPlayed.id, defDiscarded.id];
    p.battleHand = p.battleHand.filter(c => !used.includes(c.id));
    if (p.battleHand.length < 2) {
      p.battleHand = JSON.parse(JSON.stringify(BASE_BATTLE_CARDS));
    }
  });

  // Calcolo valore battaglia
  const attCivBonus = ctx.attacker.civ.bonusType === 'attack_strength' ? 1 : 0;
  const attTileBonus = ctx.attacker.tiles.filter(t => t.effect === 'attack_bonus').reduce((s, t) => s + t.value, 0);
  const attTotal = ctx.attackingTroops + attPlayed.strength + attCivBonus + attTileBonus;

  const defTotal = ctx.territory.troops + defPlayed.strength;

  // Perdite = differenza tra danno avversario e protezione propria
  const attExtraDmg = ctx.attacker.tiles.filter(t => t.effect === 'damage_bonus').reduce((s, t) => s + t.value, 0);
  const attShieldBonus = ctx.attacker.tiles.filter(t => t.effect === 'shield_bonus').reduce((s, t) => s + t.value, 0);
  const defShieldBonus = (ctx.defender.civ.bonusType === 'defense_shield' ? 1 : 0) +
    ctx.defender.tiles.filter(t => t.effect === 'shield_bonus').reduce((s, t) => s + t.value, 0);

  const attLosses = Math.max(0, defPlayed.damage - (attPlayed.shield + attShieldBonus));
  const defLosses = Math.max(0, (attPlayed.damage + attExtraDmg) - (defPlayed.shield + defShieldBonus));

  const survivingAtt = Math.max(0, ctx.attackingTroops - attLosses);
  const survivingDef = Math.max(0, ctx.territory.troops - defLosses);

  addLog(`BATTAGLIA a ${ctx.territory.name}: ${ctx.attacker.name} [${attTotal}] vs ${ctx.defender.name} [${defTotal}]. Perdite: Att -${attLosses}, Dif -${defLosses}.`);

  if (attTotal > defTotal && survivingAtt > 0) {
    ctx.territory.ownerId = ctx.attacker.id;
    ctx.territory.troops = survivingAtt;
    addLog(`🏆 ${ctx.attacker.name} conquista ${ctx.territory.name} con ${survivingAtt} unità superstiti!`);
  } else {
    ctx.territory.troops = survivingDef;
    if (survivingDef === 0) ctx.territory.ownerId = null;
    addLog(`🛡️ ${ctx.defender.name} respinge l’attacco a ${ctx.territory.name}!`);
  }

  state.battleContext = null;
  cancelOrFinishAction();
}

window.cancelOrFinishAction = function() {
  state.interactionMode = null;
  state.selectedTerritoryId = null;
  state.moveStepsLeft = 0;
  renderMapControls('');
  setInstruction('Seleziona un’azione sulla tua plancia.');
  finishPlayerAction();
};

function finishPlayerAction() {
  if (checkVictory()) return;

  // Passa al prossimo giocatore che ha ancora segnalini
  const totalPlayers = state.players.length;
  for (let step = 1; step <= totalPlayers; step++) {
    const nextPos = (state.currentTurnPos + step) % totalPlayers;
    const candidate = state.players[state.turnOrder[nextPos]];
    if (candidate.tokensLeft > 0) {
      state.currentTurnPos = nextPos;
      renderAll();
      checkBotTurn();
      return;
    }
  }

  // Tutti hanno piazzato i 5 segnalini -> Fine Giorno & Inizio Notte
  endDayPhase();
}

// FINE GIORNO -> RENDITE E FASE NOTTURNA
function endDayPhase() {
  addLog('--- FINE FASE DI GIORNO: Assegnazione rendite ---');
  state.players.forEach(p => {
    let bastions = 0;
    state.territories.forEach(t => {
      if (t.ownerId === p.id && t.type === 'bastion') bastions++;
    });
    if (bastions > 0) {
      p.gold += bastions;
      p.permanentVP += bastions;
      addLog(`${p.name} ottiene +${bastions} Oro e +${bastions} PV permanenti dai Bastioni.`);
    }
  });

  if (checkVictory()) return;
  startNightPhase();
}

function startNightPhase() {
  state.phase = 'NIGHT';
  addLog('=== INIZIO FASE NOTTURNA ===');

  // Ogni giocatore riceve 2 Oro base + 2 Oro da tessere potere + abilità Notte
  state.players.forEach(p => {
    const civNightGold = p.civ.bonusType === 'night_gold' ? p.civ.bonusValue : 0;
    let tileNightGold = 2; // 2 punti oro assegnati dalle tessere potere
    p.tiles.filter(t => t.phase === 'night').forEach(t => {
      if (t.effect === 'night_gold') tileNightGold += t.value;
      if (t.effect === 'night_vp') p.permanentVP += t.value;
      if (t.effect === 'night_vp_bastion') {
        const hasBastion = state.territories.some(terr => terr.ownerId === p.id && terr.type === 'bastion');
        if (hasBastion) p.permanentVP += t.value;
      }
      if (t.effect === 'night_troop') {
        const myCity = state.territories.find(terr => terr.ownerId === p.id);
        if (myCity) myCity.troops += t.value;
      }
    });

    p.gold += 2 + civNightGold + tileNightGold;
    p.tokensLeft = 5;
    p.occupiedSlots = [];
    p.occupiedLevels = new Set();
  });

  addLog('Tutti i giocatori ricevono +2 Oro notturno, +2 Oro dalle tessere e ripristinano i 5 segnalini.');

  if (checkVictory()) return;

  // Il giocatore con il minor numero di PV determina l'ordine del turno
  const sortedByLowestVP = [...state.players].sort((a, b) => getPlayerTotalVP(a) - getPlayerTotalVP(b));
  const chooser = sortedByLowestVP[0];

  if (chooser.isBot) {
    state.turnOrder = sortedByLowestVP.map(p => p.id);
    addLog(`${chooser.name} (meno PV) imposta l'ordine di turno per il nuovo Giorno.`);
    startNewDay();
  } else {
    openNightOrderModal(chooser, sortedByLowestVP);
  }
}

function openNightOrderModal(chooser, sortedPlayers) {
  const modal = document.getElementById('night-order-modal');
  modal.classList.remove('hidden');
  document.getElementById('night-order-desc').textContent =
    `${chooser.name} ha il minor numero di Punti Vittoria (${getPlayerTotalVP(chooser)} PV) e stabilisce l'ordine del nuovo Giorno.`;

  const controls = document.getElementById('night-order-controls');
  controls.innerHTML = `
    <button class="btn btn-primary" onclick="confirmNightOrder('asc')">Dal meno PV al più PV (Standard)</button>
    <button class="btn btn-secondary" onclick="confirmNightOrder('reverse')">Ordine Inverso</button>
  `;
  window._nightSorted = sortedPlayers;
}

window.confirmNightOrder = function(mode) {
  document.getElementById('night-order-modal').classList.add('hidden');
  const list = window._nightSorted;
  state.turnOrder = (mode === 'asc' ? list : [...list].reverse()).map(p => p.id);
  startNewDay();
};

function startNewDay() {
  state.round += 1;
  state.phase = 'DAY';
  state.currentTurnPos = 0;
  addLog(`☀️ INIZIO GIORNO ${state.round}!`);
  renderAll();
  checkBotTurn();
}

// IA BOT SEMPLICE MA STRATEGICA
function checkBotTurn() {
  const player = getActivePlayer();
  if (!player || !player.isBot || state.phase !== 'DAY') return;

  setTimeout(() => {
    const availableActions = [];
    ACTION_LEVELS.forEach(lvl => {
      if (!mustPickMissingLevel(player, lvl.level)) return;
      lvl.slots.forEach(slot => {
        if (!player.occupiedSlots.includes(slot.id)) {
          availableActions.push({ level: lvl.level, slot });
        }
      });
    });

    if (availableActions.length === 0) return;
    const chosen = availableActions[Math.floor(Math.random() * availableActions.length)];

    player.tokensLeft -= 1;
    player.occupiedSlots.push(chosen.slot.id);
    player.occupiedLevels.add(chosen.level);
    addLog(`🤖 ${player.name} gioca "${chosen.slot.title}" (Lv.${chosen.level}).`);

    const myTerrs = state.territories.filter(t => t.ownerId === player.id);

    if (chosen.slot.type === 'tax') {
      player.gold += 2;
      finishPlayerAction();
    } else if (chosen.slot.type === 'recruit' && myTerrs.length > 0 && player.gold > 0) {
      const qty = Math.min(2, player.gold);
      player.gold -= qty;
      myTerrs[0].troops += qty + (player.civ.bonusType === 'recruit_bonus' ? 1 : 0);
      finishPlayerAction();
    } else if (chosen.slot.type === 'monument') {
      const monTerr = myTerrs.find(t => t.type === 'monument' && (!t.monument || t.monument.level < 4));
      if (monTerr && player.gold >= 2) {
        const colors = ['red', 'white', 'blue'];
        const col = monTerr.monument ? monTerr.monument.color : colors[Math.floor(Math.random() * 3)];
        const nextLvl = monTerr.monument ? monTerr.monument.level + 1 : 1;
        player.gold -= 1;
        monTerr.monument = { color: col, level: nextLvl };
      }
      finishPlayerAction();
    } else if (chosen.slot.type === 'buy_tile') {
      const affordable = state.marketTiles.find(tile => canPlayerBuyTile(player, tile));
      if (affordable) {
        window.buyMarketTile(affordable.id);
      } else {
        finishPlayerAction();
      }
    } else if (chosen.slot.type === 'move_attack') {
      const armyTerr = myTerrs.find(t => t.troops >= 2);
      if (armyTerr) {
        const targetId = armyTerr.neighbors[Math.floor(Math.random() * armyTerr.neighbors.length)];
        const target = state.territories.find(t => t.id === targetId);
        if (target) {
          executeMoveOrAttack(player, armyTerr, target);
          return;
        }
      }
      finishPlayerAction();
    } else {
      finishPlayerAction();
    }
  }, 600);
}

// VITTORIA & UTILITÀ
function checkVictory() {
  const winner = state.players.find(p => getPlayerTotalVP(p) >= state.victoryGoal);
  if (!winner) return false;

  const modal = document.getElementById('info-modal');
  document.getElementById('info-modal-title').textContent = '🏆 VITTORIA!';
  document.getElementById('info-modal-body').innerHTML = `
    <p style="font-size:1.1rem;"><strong>${winner.name}</strong> guidato da <strong>${winner.civ.commander}</strong> raggiunge <strong>${getPlayerTotalVP(winner)} Punti Vittoria</strong> e trionfa!</p>
    <button class="btn btn-primary" style="margin-top:12px;" onclick="location.reload()">Nuova Partita</button>
  `;
  modal.classList.remove('hidden');
  return true;
}

function showRulesModal() {
  const modal = document.getElementById('info-modal');
  document.getElementById('info-modal-title').textContent = 'Regole Rapide — Imperia: Giorno & Notte';
  document.getElementById('info-modal-body').innerHTML = `
    <ul style="padding-left:18px;line-height:1.5;font-size:0.9rem;">
      <li><strong>Obiettivo:</strong> Raggiungere 15 PV (Breve) o 20 PV (Lunga).</li>
      <li><strong>Segnalini Azione (5 per Giorno):</strong> Si piazzano a turno. A fine Giorno devi avere almeno 1 segnalino in ciascuno dei 3 livelli.</li>
      <li><strong>Monumenti &amp; Porti:</strong> Elevare un Monumento (Rosso, Bianco, Blu) sblocca tessere potere dello stesso colore e livello pari o inferiore. Un Monumento Lv.4 vale +1 PV temporaneo. Le truppe possono viaggiare da un Monumento a un Porto.</li>
      <li><strong>Bastioni:</strong> Conferiscono +1 PV e +1 Oro a fine Giorno.</li>
      <li><strong>Battaglie:</strong> Entrambi scelgono 2 carte (1 giocata, 1 scartata). Vince chi ha Forza Totale maggiore (Unità + Carta + Bonus). Perdite = Danno avversario - Protezione propria.</li>
      <li><strong>Notte:</strong> +2 Oro base, +2 Oro da tessere potere, effetti Notte e ordine turno scelto da chi ha meno PV.</li>
    </ul>
  `;
  modal.classList.remove('hidden');
}

function setInstruction(text) {
  document.getElementById('map-instruction').textContent = text;
}

function renderMapControls(html) {
  document.getElementById('map-controls').innerHTML = html;
}

function addLog(msg) {
  const log = document.getElementById('game-log');
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.textContent = msg;
  log.prepend(entry);
}

function colorNameIt(c) {
  return { red: 'Rosso', white: 'Bianco', blue: 'Blu' }[c] || c;
}
