/**
 * GSA INDONESIA - PRODUCT DEFINITIONS & CONFIGURATION
 * Strict price requirements according to specification:
 * - ACP: Rp200.000/lembar
 * - WPC: Rp90.000/lembar
 * - SPC Flooring: Rp600.000/box
 * - Flexibel Stone: Rp300.000/lembar
 * - Sealant: Rp20.000/botol
 */

const GAME_PRODUCTS = {
  acp: {
    id: 'acp',
    name: 'ACP (Aluminium Composite)',
    shortName: 'ACP',
    unit: 'lembar',
    price: 200000,
    cost: 130000, // Kulakan restok
    restockPack: 10, // Jumlah restok per klik
    initialStock: 30,
    maxStock: 80,
    color: '#3b82f6', // Bright metallic blue
    hexColors: ['#2563eb', '#ef4444', '#f59e0b', '#10b981'],
    icon: '🏢',
    desc: 'Panel komposit aluminium modern anti karat, tahan cuaca & tahan api untuk fasad gedung dan ruko modern.'
  },
  wpc: {
    id: 'wpc',
    name: 'WPC Wall Panel',
    shortName: 'WPC',
    unit: 'lembar',
    price: 90000,
    cost: 58000,
    restockPack: 15,
    initialStock: 40,
    maxStock: 100,
    color: '#b45309', // Warm teak wood
    hexColors: ['#d97706', '#92400e', '#78350f'],
    icon: '🪵',
    desc: 'Kisi-kisi dinding komposit kayu estetik, anti rayap, anti lembap, favorit dekorasi interior rumah & kafe.'
  },
  spc: {
    id: 'spc',
    name: 'SPC Flooring',
    shortName: 'SPC Flooring',
    unit: 'box',
    price: 600000,
    cost: 400000,
    restockPack: 5,
    initialStock: 20,
    maxStock: 50,
    color: '#8b5cf6', // Elegant purple/wood grain box
    hexColors: ['#a78bfa', '#c084fc', '#e9d5ff'],
    icon: '📦',
    desc: 'Lantai vinyl batu SPC mewah bertekstur serat kayu alami, 100% tahan air, anti rayap & bersistem click interlock.'
  },
  flexibel_stone: {
    id: 'flexibel_stone',
    name: 'Flexibel Stone',
    shortName: 'Flex Stone',
    unit: 'lembar',
    price: 300000,
    cost: 195000,
    restockPack: 8,
    initialStock: 25,
    maxStock: 60,
    color: '#64748b', // Natural slate gray/sandstone
    hexColors: ['#475569', '#cbd5e1', '#d97706'],
    icon: '🪨',
    desc: 'Lembaran batu alam ultra-tipis elastis yang bisa ditekuk mengikuti kontur pilar, dinding lengkung, & backdrop TV.'
  },
  sealant: {
    id: 'sealant',
    name: 'Silicone Sealant',
    shortName: 'Sealant',
    unit: 'botol',
    price: 20000,
    cost: 13000,
    restockPack: 20,
    initialStock: 60,
    maxStock: 150,
    color: '#06b6d4', // Clean silicone cyan
    hexColors: ['#ffffff', '#06b6d4', '#1e293b'],
    icon: '🧴',
    desc: 'Lem silikon perekat kedap air & elastis kualitas prima untuk sambungan kaca, ACP, kusen jendela, & batu alam.'
  }
};

// Store Target Win Goal
const WIN_TARGET_REVENUE = 500000000; // Rp 500.000.000

// Indonesian Rupiah formatter
function formatRupiah(amount) {
  return 'Rp' + Math.floor(amount).toLocaleString('id-ID');
}

// Indonesian Customer Persona Names & Jobs
const CUSTOMER_PROFILES = [
  { name: 'Pak Budi', role: 'Mandor Proyek', avatar: '👷‍♂️' },
  { name: 'Bu Siska', role: 'Desainer Interior', avatar: '👩‍💼' },
  { name: 'Mas Kevin', role: 'Kontraktor Kafe', avatar: '👨‍🎨' },
  { name: 'Pak Haji Ridwan', role: 'Developer Ruko', avatar: '👳‍♂️' },
  { name: 'Bu Dewi', role: 'Pemilik Rumah Minimalis', avatar: '👩‍🍳' },
  { name: 'Doni', role: 'Aplikator ACP & Plafon', avatar: '🧑‍🔧' },
  { name: 'Siti Nurhaliza', role: 'Arsitek Lanskap', avatar: '🧕' },
  { name: 'Pak Hendra', role: 'Sultan Proyek Villa', avatar: '🤴' },
  { name: 'Mas Agus', role: 'Tukang Kayu Modern', avatar: '🧔' },
  { name: 'Mbak Rina', role: 'Owner Studio Estetik', avatar: '👱‍♀️' }
];

window.GAME_PRODUCTS = GAME_PRODUCTS;
window.WIN_TARGET_REVENUE = WIN_TARGET_REVENUE;
window.formatRupiah = formatRupiah;
window.CUSTOMER_PROFILES = CUSTOMER_PROFILES;
