// DATI DI GIOCO: Civiltà, Comandanti, Carte Battaglia, Tessere Potere e Plance

const CIVILIZATIONS = [
  {
    id: 'solari',
    name: 'Impero Solare',
    color: '#ef4444',
    commander: 'Aurelio il Conquistatore',
    passive: '+1 Forza totale in tutte le battaglie in cui sei l’Attaccante.',
    bonusType: 'attack_strength',
    bonusValue: 1
  },
  {
    id: 'marittimi',
    name: 'Repubblica Marittima',
    color: '#3b82f6',
    commander: 'Ammiraglio Nerissa',
    passive: '+1 Oro extra all’inizio di ogni Fase Notturna.',
    bonusType: 'night_gold',
    bonusValue: 1
  },
  {
    id: 'pietra',
    name: 'Ordine della Pietra',
    color: '#10b981',
    commander: 'Custode Thrain',
    passive: '+1 Protezione in battaglia quando difendi un territorio.',
    bonusType: 'defense_shield',
    bonusValue: 1
  },
  {
    id: 'ombra',
    name: 'Legione d’Ombra',
    color: '#a855f7',
    commander: 'Vespera la Stratega',
    passive: 'Sconto di 1 Oro quando acquisti Tessere Potere.',
    bonusType: 'tile_discount',
    bonusValue: 1
  },
  {
    id: 'aurore',
    name: 'Regno dell’Aurora',
    color: '#f59e0b',
    commander: 'Regina Lyra',
    passive: 'Sconto di 1 Oro quando elevi un Monumento.',
    bonusType: 'monument_discount',
    bonusValue: 1
  },
  {
    id: 'ferro',
    name: 'Cittadella di Ferro',
    color: '#94a3b8',
    commander: 'Generale Kael',
    passive: 'Recluti +1 unità bonus ogni volta che usi l’azione Reclutamento.',
    bonusType: 'recruit_bonus',
    bonusValue: 1
  }
];

// Carte battaglia: ogni giocatore ha una mano identica da cui sceglierne 2 (1 giocata, 1 scartata)
const BASE_BATTLE_CARDS = [
  { id: 'c1', name: 'Assalto Furioso', strength: 4, damage: 3, shield: 0 },
  { id: 'c2', name: 'Falange Corazzata', strength: 2, damage: 1, shield: 3 },
  { id: 'c3', name: 'Carica Equilibrata', strength: 3, damage: 2, shield: 1 },
  { id: 'c4', name: 'Agguato Rapido', strength: 3, damage: 3, shield: 0 },
  { id: 'c5', name: 'Muro di Scudi', strength: 1, damage: 0, shield: 3 },
  { id: 'c6', name: 'Manovra Tattica', strength: 2, damage: 2, shield: 2 }
];

// Tessere Potere (Rosso = Guerra, Bianco = Economia/Monumenti, Blu = Movimento/Strategia)
const POWER_TILES = [
  { id: 't_r1', name: 'Furia Bellica', color: 'red', level: 1, cost: 2, phase: 'day', effect: 'attack_bonus', value: 2, desc: 'Giorno: +2 Forza quando attacchi.' },
  { id: 't_r2', name: 'Lame d’Acciaio', color: 'red', level: 2, cost: 3, phase: 'day', effect: 'damage_bonus', value: 1, desc: 'Giorno: +1 Danno inflitto in battaglia.' },
  { id: 't_r3', name: 'Egemone della Guerra', color: 'red', level: 3, cost: 4, phase: 'night', effect: 'night_vp_bastion', value: 1, desc: 'Notte: +1 PV se controlli almeno 1 Bastione.' },

  { id: 't_w1', name: 'Decima Reale', color: 'white', level: 1, cost: 2, phase: 'night', effect: 'night_gold', value: 2, desc: 'Notte: Ottieni +2 Oro extra.' },
  { id: 't_w2', name: 'Architetti Sacri', color: 'white', level: 2, cost: 3, phase: 'day', effect: 'monument_discount', value: 1, desc: 'Giorno: Elevare Monumenti costa 1 Oro in meno.' },
  { id: 't_w3', name: 'Gloria Eterna', color: 'white', level: 3, cost: 5, phase: 'night', effect: 'night_vp', value: 1, desc: 'Notte: Ottieni +1 PV permanente.' },

  { id: 't_b1', name: 'Venti Favorevoli', color: 'blue', level: 1, cost: 2, phase: 'day', effect: 'move_bonus', value: 1, desc: 'Giorno: +1 passo extra durante Muovi & Attacca.' },
  { id: 't_b2', name: 'Armatura Runica', color: 'blue', level: 2, cost: 3, phase: 'day', effect: 'shield_bonus', value: 1, desc: 'Giorno: +1 Protezione in ogni battaglia.' },
  { id: 't_b3', name: 'Flotta Imperiale', color: 'blue', level: 3, cost: 4, phase: 'night', effect: 'night_troop', value: 1, desc: 'Notte: Genera +1 unità gratuita nella tua città.' }
];

// Struttura della Plancia Azioni del Giocatore (3 livelli, 2 caselle per livello = 6 caselle totali per 5 segnalini)
const ACTION_LEVELS = [
  {
    level: 1,
    name: 'Livello I — Base',
    slots: [
      { id: 'tax_1', type: 'tax', title: 'Riscuoti Tasse', desc: 'Ottieni immediatamente +2 Oro.' },
      { id: 'recruit_1', type: 'recruit', title: 'Reclutamento', desc: 'Paga 1 Oro per unità (max 3).' }
    ]
  },
  {
    level: 2,
    name: 'Livello II — Sviluppo',
    slots: [
      { id: 'monument_2', type: 'monument', title: 'Eleva Monumento', desc: 'Alza un Monumento (costo = nuovo livello).' },
      { id: 'tile_2', type: 'buy_tile', title: 'Acquista Tessera Potere', desc: 'Richiede Monumento stesso colore e livello >= tessera.' }
    ]
  },
  {
    level: 3,
    name: 'Livello III — Guerra & Comando',
    slots: [
      { id: 'move_3', type: 'move_attack', title: 'Muovi & Attacca', desc: 'Sposta truppe (anche Monumento -> Porto) e invadi.' },
      { id: 'tax_move_3', type: 'move_attack', title: 'Marcia Forzata', desc: 'Sposta truppe e invadi territori adiacenti.' }
    ]
  }
];

// Definizione Territori Plancia Bifacciale
function createBoardTerritories(side) {
  const sideA = [
    // Distretto Nord
    { id: 'd1_city', name: 'Città di Solis', district: 'Distretto Nord', type: 'city', neighbors: ['d1_mon', 'd1_port', 'bastion_n'] },
    { id: 'd1_mon', name: 'Santuario Nord', district: 'Distretto Nord', type: 'monument', neighbors: ['d1_city', 'd1_port', 'bastion_c'] },
    { id: 'd1_port', name: 'Porto Boreale', district: 'Distretto Nord', type: 'port', neighbors: ['d1_city', 'd1_mon', 'd2_port'] },

    // Distretto Est
    { id: 'd2_city', name: 'Città di Aurelia', district: 'Distretto Est', type: 'city', neighbors: ['d2_mon', 'd2_port', 'bastion_n'] },
    { id: 'd2_mon', name: 'Obelisco d’Oriente', district: 'Distretto Est', type: 'monument', neighbors: ['d2_city', 'd2_port', 'bastion_c'] },
    { id: 'd2_port', name: 'Porto del Levante', district: 'Distretto Est', type: 'port', neighbors: ['d2_city', 'd2_mon', 'd1_port', 'd3_port'] },

    // Distretto Sud-Ovest
    { id: 'd3_city', name: 'Città di Vespera', district: 'Distretto Sud', type: 'city', neighbors: ['d3_mon', 'd3_port', 'bastion_s'] },
    { id: 'd3_mon', name: 'Altare Meridionale', district: 'Distretto Sud', type: 'monument', neighbors: ['d3_city', 'd3_port', 'bastion_c'] },
    { id: 'd3_port', name: 'Porto Occidentale', district: 'Distretto Sud', type: 'port', neighbors: ['d3_city', 'd3_mon', 'd2_port'] },

    // Bastioni & Città Extra per 4° giocatore
    { id: 'd4_city', name: 'Città di Ferrum', district: 'Distretto Ovest', type: 'city', neighbors: ['bastion_s', 'bastion_c', 'd3_port'] },
    { id: 'bastion_n', name: 'Bastione del Nord', district: 'Frontiera', type: 'bastion', neighbors: ['d1_city', 'd2_city', 'bastion_c'] },
    { id: 'bastion_c', name: 'Bastione Centrale', district: 'Cuore dell’Impero', type: 'bastion', neighbors: ['d1_mon', 'd2_mon', 'd3_mon', 'd4_city', 'bastion_n', 'bastion_s'] },
    { id: 'bastion_s', name: 'Bastione del Sud', district: 'Frontiera', type: 'bastion', neighbors: ['d3_city', 'd4_city', 'bastion_c'] }
  ];

  if (side === '4-8') return sideA;

  // Lato B (6-10 Giocatori): aggiunge territori extra
  const extraB = [
    { id: 'd5_city', name: 'Città di Thalassa', district: 'Distretto Insulare', type: 'city', neighbors: ['d5_mon', 'bastion_e'] },
    { id: 'd5_mon', name: 'Templi Sommersi', district: 'Distretto Insulare', type: 'monument', neighbors: ['d5_city', 'd2_port'] },
    { id: 'd6_city', name: 'Città di Ignis', district: 'Distretto Vulcanico', type: 'city', neighbors: ['d6_mon', 'bastion_e'] },
    { id: 'd6_mon', name: 'Forja Antica', district: 'Distretto Vulcanico', type: 'monument', neighbors: ['d6_city', 'bastion_s'] },
    { id: 'bastion_e', name: 'Bastione d’Oriente', district: 'Frontiera Est', type: 'bastion', neighbors: ['d5_city', 'd6_city', 'bastion_c'] }
  ];

  return [...sideA, ...extraB];
}
