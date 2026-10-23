/**
 * GSA INDONESIA - 3D ISOMETRIC STORE ENGINE (Three.js)
 * Semi-3D Isometric view, low-poly cute cartoon graphics, animated characters,
 * responsive mobile touch & desktop mouse controls.
 */

class StoreScene3D {
  constructor(canvasContainerId) {
    this.container = document.getElementById(canvasContainerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    
    // Camera settings: High-angle isometric view into shop interior
    this.cameraTarget = new THREE.Vector3(0, 1.2, 0.5);
    this.baseDist = 26;
    this.camAngle = Math.PI / 3.4; // ~53 deg angled isometric
    this.camElevation = Math.PI / 4.0; // ~45 deg elevated isometric looking down into shop
    this.zoomLevel = 1.0;
    
    // Interactive Raycasting
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.clickableObjects = [];

    // Animated objects
    this.customers3D = new Map(); // id -> { mesh, targetPos, state, ... }
    this.floatingTexts = [];
    this.staffMesh = null;
    this.deliveryTruck = null;
    this.productDisplays = {};
    this.upgradeVisuals = {
      luxuryDecor: null,
      warehouseExp: null,
      fastRestock: null,
      marketing: null,
      vipLoyalty: null
    };

    // Touch & Drag state
    this.isDragging = false;
    this.prevPointerPos = { x: 0, y: 0 };
    this.touchStartDist = 0;

    // Clock
    this.clock = new THREE.Clock();
    
    this.init();
  }

  init() {
    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffedd5); // Warm cartoon sunset peach
    this.scene.fog = new THREE.Fog(0xffedd5, 75, 200);

    // 2. Camera: Semi-3D Isometric Perspective
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const aspect = width / height;
    const initialFov = aspect < 1.0 ? Math.min(52, Math.max(38, 34 / Math.sqrt(aspect))) : 34;
    this.camera = new THREE.PerspectiveCamera(initialFov, aspect, 0.1, 300);
    if (aspect < 1.0) {
      this.zoomLevel = 1.4; // Proporsional dan nyaman di layar HP saat pertama kali buka
    }
    this.updateCameraPosition();

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById('canvas-3d'),
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // mobile optimized
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. Lighting (Warm & Vibrant Cartoon Sunlight)
    const ambientLight = new THREE.AmbientLight(0xfff7ed, 0.85); // warm daylight
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffae0, 1.25);
    sunLight.position.set(20, 35, 18);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 70;
    const d = 18;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    this.scene.add(sunLight);

    // Fill rim light
    const rimLight = new THREE.DirectionalLight(0xfed7aa, 0.4);
    rimLight.position.set(-15, 20, -20);
    this.scene.add(rimLight);

    // 5. Build 3D World
    this.buildStoreEnvironment();
    this.buildProductDisplays();
    this.buildCheckoutCounter();
    this.buildStaff();
    this.buildDeliveryTruck();

    // 6. Event Listeners
    window.addEventListener('resize', () => this.onWindowResize());
    this.setupInteractions();

    // 7. Start render loop
    this.animate();
  }

  // --- BUILD STORE ENVIRONMENT ---
  buildStoreEnvironment() {
    // Ground / Outside Road & Sidewalk
    const groundGeo = new THREE.PlaneGeometry(60, 60);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x93c5fd });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Sidewalk & Asphalt Road in front
    const roadGeo = new THREE.BoxGeometry(28, 0.2, 10);
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x475569 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.position.set(0, 0.05, 13);
    road.receiveShadow = true;
    this.scene.add(road);

    // Zebra Cross stripes
    for (let i = -8; i <= 8; i += 2.5) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.22, 3),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      stripe.position.set(i, 0.06, 13);
      this.scene.add(stripe);
    }

    // Sidewalk Pavement
    const sidewalk = new THREE.Mesh(
      new THREE.BoxGeometry(26, 0.35, 4),
      new THREE.MeshLambertMaterial({ color: 0xe2e8f0 })
    );
    sidewalk.position.set(0, 0.15, 6.5);
    sidewalk.receiveShadow = true;
    this.scene.add(sidewalk);

    // Store Foundation & Flooring (Cozy Checkered Tiles)
    const floorGeo = new THREE.BoxGeometry(18, 0.4, 14);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0xf8fafc });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, 0.2, -1.5);
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Checkerboard accent tiles
    for (let x = -8; x <= 8; x += 2) {
      for (let z = -7.5; z <= 4.5; z += 2) {
        if ((Math.abs(x) + Math.abs(z)) % 4 === 0) {
          const tile = new THREE.Mesh(
            new THREE.PlaneGeometry(1.9, 1.9),
            new THREE.MeshLambertMaterial({ color: 0xffedd5 })
          );
          tile.rotation.x = -Math.PI / 2;
          tile.position.set(x, 0.41, z);
          tile.receiveShadow = true;
          this.scene.add(tile);
        }
      }
    }

    // Back & Left Walls
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const wallTrimMat = new THREE.MeshLambertMaterial({ color: 0xea580c });

    // Back Wall
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(18.2, 5, 0.5), wallMat);
    backWall.position.set(0, 2.7, -8.75);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    // Left Wall
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 14.5), wallMat);
    leftWall.position.set(-9.1, 2.7, -1.5);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    this.scene.add(leftWall);

    // Wall baseboard trims
    const trim1 = new THREE.Mesh(new THREE.BoxGeometry(18.2, 0.3, 0.6), wallTrimMat);
    trim1.position.set(0, 0.55, -8.65);
    this.scene.add(trim1);

    const trim2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 14.5), wallTrimMat);
    trim2.position.set(-8.95, 0.55, -1.5);
    this.scene.add(trim2);

    // Front Glass Facade & Pillars
    const pillarMat = new THREE.MeshLambertMaterial({ color: 0xea580c });
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5, 0.6), pillarMat);
    p1.position.set(-8.8, 2.7, 5.2);
    p1.castShadow = true;
    this.scene.add(p1);

    const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5, 0.6), pillarMat);
    p2.position.set(8.8, 2.7, 5.2);
    p2.castShadow = true;
    this.scene.add(p2);

    // Glass Windows
    const glassMat = new THREE.MeshLambertMaterial({
      color: 0xfed7aa,
      transparent: true,
      opacity: 0.25
    });
    const glassL = new THREE.Mesh(new THREE.BoxGeometry(5.5, 4.2, 0.1), glassMat);
    glassL.position.set(-5.5, 2.7, 5.2);
    this.scene.add(glassL);

    const glassR = new THREE.Mesh(new THREE.BoxGeometry(5.5, 4.2, 0.1), glassMat);
    glassR.position.set(5.5, 2.7, 5.2);
    this.scene.add(glassR);

    // Glass Door Arch (Center entrance)
    const doorFrameMat = new THREE.MeshLambertMaterial({ color: 0xf59e0b });
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.25, 0.4), doorFrameMat);
    doorFrame.position.set(0, 4.5, 5.2);
    this.scene.add(doorFrame);

    // Welcome Door Mat
    const doorMat = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.05, 1.8),
      new THREE.MeshLambertMaterial({ color: 0xef4444 })
    );
    doorMat.position.set(0, 0.42, 5.2);
    this.scene.add(doorMat);

    // STORE SIGNBOARD ON TOP: "GSA INDONESIA"
    this.buildSignboard();

    // Cute Potted Plants
    this.buildPottedPlant(-8, 0.4, 4);
    this.buildPottedPlant(8, 0.4, 4);
    this.buildPottedPlant(-8, 0.4, -7.5);
  }

  // --- STORE SIGNBOARD ---
  buildSignboard() {
    const signGroup = new THREE.Group();
    signGroup.position.set(0, 5.8, 5.4);

    // Main Board
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(14, 1.8, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xea580c })
    );
    board.castShadow = true;
    signGroup.add(board);

    // Gold Trim Border
    const border = new THREE.Mesh(
      new THREE.BoxGeometry(14.3, 2.0, 0.3),
      new THREE.MeshLambertMaterial({ color: 0xf59e0b })
    );
    border.position.z = -0.1;
    signGroup.add(border);

    // Red & White Indonesian Flag Accent
    const flagRed = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.5, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    flagRed.position.set(-5.6, 0.35, 0.28);
    signGroup.add(flagRed);

    const flagWhite = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.5, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    flagWhite.position.set(-5.6, -0.15, 0.28);
    signGroup.add(flagWhite);

    // Text Canvas for "GSA INDONESIA - TOKO MATERIAL"
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // Background gradient for text
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(0, 0, 1024, 256);
    
    // Bold Cute Text
    ctx.font = '900 84px "Fredoka", "Arial Black", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowOffsetY = 6;
    ctx.shadowBlur = 10;
    ctx.fillText('GSA INDONESIA', 540, 110);

    ctx.font = '800 42px "Fredoka", sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('TOKO MATERIAL & INTERIOR TERLENGKAP', 540, 190);

    const signTexture = new THREE.CanvasTexture(canvas);
    const signFront = new THREE.Mesh(
      new THREE.PlaneGeometry(10.5, 1.6),
      new THREE.MeshBasicMaterial({ map: signTexture, transparent: true })
    );
    signFront.position.set(0.6, 0, 0.28);
    signGroup.add(signFront);

    // Cute Roof Light Bulbs
    for (let x = -6.5; x <= 6.5; x += 1.3) {
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xfef08a })
      );
      bulb.position.set(x, 0.95, 0.28);
      signGroup.add(bulb);
    }

    this.scene.add(signGroup);
  }

  // --- POTTED PLANT ---
  buildPottedPlant(x, y, z) {
    const plantGroup = new THREE.Group();
    plantGroup.position.set(x, y, z);

    // Pot
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.25, 0.6, 12),
      new THREE.MeshLambertMaterial({ color: 0xd97706 })
    );
    pot.position.y = 0.3;
    pot.castShadow = true;
    plantGroup.add(pot);

    // Soil
    const soil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.33, 0.33, 0.05, 12),
      new THREE.MeshLambertMaterial({ color: 0x3f2e1a })
    );
    soil.position.y = 0.6;
    plantGroup.add(soil);

    // Foliage Spheres
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x22c55e });
    const leaf1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4), leafMat);
    leaf1.position.set(0, 0.9, 0);
    leaf1.castShadow = true;
    plantGroup.add(leaf1);

    const leaf2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28), leafMat);
    leaf2.position.set(0.2, 1.15, -0.1);
    plantGroup.add(leaf2);

    this.scene.add(plantGroup);
  }

  // --- BUILD 5 PRODUCT DISPLAYS ---
  buildProductDisplays() {
    // 1. ACP (Aluminium Composite Panels) - Position: Left back
    this.buildACPRack(-6, 0.4, -6);

    // 2. WPC (Wood Plastic Composite) - Position: Center back
    this.buildWPCRack(-0.5, 0.4, -6.5);

    // 3. SPC Flooring - Position: Right back
    this.buildSPCRack(5.5, 0.4, -6);

    // 4. Flexibel Stone - Position: Left middle
    this.buildFlexStoneRack(-6, 0.4, -1);

    // 5. Sealant - Position: Right middle
    this.buildSealantRack(6, 0.4, -1);
  }

  // 1. ACP DISPLAY RACK
  buildACPRack(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.userData = { productId: 'acp', type: 'rack' };

    // Metal Frame Rack
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.3, 2), frameMat);
    base.position.y = 0.15;
    base.castShadow = true;
    group.add(base);

    // Vertical Frame Uprights
    const u1 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.2, 0.15), frameMat);
    u1.position.set(-1.6, 1.6, -0.8);
    group.add(u1);
    const u2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.2, 0.15), frameMat);
    u2.position.set(1.6, 1.6, -0.8);
    group.add(u2);

    // ACP Panels displayed in vibrant metallic colors (Blue, Red, Gold, Green)
    const colors = [0x2563eb, 0xef4444, 0xf59e0b, 0x10b981, 0xe2e8f0];
    colors.forEach((col, idx) => {
      const panelMat = new THREE.MeshStandardMaterial({
        color: col,
        roughness: 0.2,
        metalness: 0.6
      });
      const panel = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.6, 0.06), panelMat);
      panel.position.set(0, 1.6, -0.6 + idx * 0.32);
      panel.castShadow = true;
      group.add(panel);
    });

    // Floating 3D Text Label
    this.createFloatingRackLabel(group, '🏢 ACP (Rp200k)', 3.6, '#2563eb');

    this.scene.add(group);
    this.clickableObjects.push(base);
    this.productDisplays.acp = group;
  }

  // 2. WPC WALL PANEL DISPLAY
  buildWPCRack(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.userData = { productId: 'wpc', type: 'rack' };

    // Wooden Base Plinth
    const baseMat = new THREE.MeshLambertMaterial({ color: 0x78350f });
    const base = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.3, 1.8), baseMat);
    base.position.y = 0.15;
    base.castShadow = true;
    group.add(base);

    // Realistic Fluted Vertical Slats (Teak & Oak Wood)
    const woodMatLight = new THREE.MeshLambertMaterial({ color: 0xd97706 });
    const woodMatDark = new THREE.MeshLambertMaterial({ color: 0x92400e });

    for (let i = -1.8; i <= 1.8; i += 0.25) {
      const slat = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 3.4, 0.12),
        Math.abs(i) % 0.5 === 0 ? woodMatDark : woodMatLight
      );
      slat.position.set(i, 1.8, -0.4);
      slat.castShadow = true;
      group.add(slat);
    }

    // Backing Board
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(4.0, 3.4, 0.08),
      new THREE.MeshLambertMaterial({ color: 0x451a03 })
    );
    back.position.set(0, 1.8, -0.5);
    group.add(back);

    this.createFloatingRackLabel(group, '🪵 WPC Panel (Rp90k)', 3.8, '#b45309');

    this.scene.add(group);
    this.clickableObjects.push(base);
    this.productDisplays.wpc = group;
  }

  // 3. SPC FLOORING DISPLAY
  buildSPCRack(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.userData = { productId: 'spc', type: 'rack' };

    // Wooden Pallet
    const palletMat = new THREE.MeshLambertMaterial({ color: 0xa16207 });
    const pallet = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.25, 2.2), palletMat);
    pallet.position.y = 0.12;
    pallet.castShadow = true;
    group.add(pallet);

    // Stacked SPC Flooring Cartons / Boxes with branding
    const boxMat = new THREE.MeshLambertMaterial({ color: 0x8b5cf6 });
    const boxMat2 = new THREE.MeshLambertMaterial({ color: 0x7c3aed });

    // Layer 1
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const b = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, 0.45, 1.8),
          col % 2 === 0 ? boxMat : boxMat2
        );
        b.position.set(-1.0 + col * 1.0, 0.45 + row * 0.48, 0);
        b.castShadow = true;
        group.add(b);
      }
    }

    // Top Layer
    const topBox = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 0.9), boxMat);
    topBox.position.set(0, 1.45, 0);
    topBox.castShadow = true;
    group.add(topBox);

    // Laid out SPC sample plank in front
    const sampleFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 0.8),
      new THREE.MeshLambertMaterial({ color: 0xc4b5fd })
    );
    sampleFloor.rotation.x = -Math.PI / 2;
    sampleFloor.position.set(0, 0.05, 1.6);
    group.add(sampleFloor);

    this.createFloatingRackLabel(group, '📦 SPC Flooring (Rp600k)', 2.6, '#7c3aed');

    this.scene.add(group);
    this.clickableObjects.push(pallet);
    this.productDisplays.spc = group;
  }

  // 4. FLEXIBEL STONE DISPLAY
  buildFlexStoneRack(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.userData = { productId: 'flexibel_stone', type: 'rack' };

    // Stone Pedestal
    const baseMat = new THREE.MeshLambertMaterial({ color: 0x475569 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.35, 2.0), baseMat);
    base.position.y = 0.17;
    base.castShadow = true;
    group.add(base);

    // Curved Flexible Stone Sheets (Curved slate/granite surface)
    const stoneColors = [0x64748b, 0xd97706, 0x334155];
    stoneColors.forEach((col, idx) => {
      // Cylindrical slice / curved geometry for flexible veneer
      const curveGeo = new THREE.CylinderGeometry(1.2, 1.2, 2.2, 16, 1, true, 0, Math.PI * 0.7);
      const stoneMat = new THREE.MeshStandardMaterial({
        color: col,
        roughness: 0.85,
        side: THREE.DoubleSide
      });
      const sheet = new THREE.Mesh(curveGeo, stoneMat);
      sheet.rotation.y = Math.PI * 0.15 + idx * 0.4;
      sheet.position.set(-0.4 + idx * 0.4, 1.3, -0.2);
      sheet.castShadow = true;
      group.add(sheet);
    });

    this.createFloatingRackLabel(group, '🪨 Flex Stone (Rp300k)', 2.8, '#475569');

    this.scene.add(group);
    this.clickableObjects.push(base);
    this.productDisplays.flexibel_stone = group;
  }

  // 5. SEALANT DISPLAY RACK
  buildSealantRack(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.userData = { productId: 'sealant', type: 'rack' };

    // White Metal Wire Stand
    const standMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.3, 1.8), standMat);
    base.position.y = 0.15;
    base.castShadow = true;
    group.add(base);

    // Rows of Silicone Sealant Cartridge Tubes with nozzles
    const tubeGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.75, 12);
    const nozzleGeo = new THREE.ConeGeometry(0.06, 0.3, 12);
    const sealColors = [0x06b6d4, 0xffffff, 0x0f172a, 0xef4444];

    for (let shelf = 0; shelf < 2; shelf++) {
      const shelfPlank = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 1.2), standMat);
      shelfPlank.position.set(0, 0.7 + shelf * 0.9, 0);
      group.add(shelfPlank);

      for (let r = -0.35; r <= 0.35; r += 0.4) {
        for (let c = -0.9; c <= 0.9; c += 0.36) {
          const col = sealColors[Math.abs(Math.floor(c * 5)) % sealColors.length];
          const tubeMat = new THREE.MeshLambertMaterial({ color: col });
          const nozzleMat = new THREE.MeshLambertMaterial({ color: 0xf8fafc });

          const tube = new THREE.Mesh(tubeGeo, tubeMat);
          const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
          nozzle.position.y = 0.45;
          tube.add(nozzle);

          tube.position.set(c, 1.1 + shelf * 0.9, r);
          tube.castShadow = true;
          group.add(tube);
        }
      }
    }

    this.createFloatingRackLabel(group, '🧴 Sealant (Rp20k)', 2.9, '#0891b2');

    this.scene.add(group);
    this.clickableObjects.push(base);
    this.productDisplays.sealant = group;
  }

  // --- FLOATING TEXT SPRITES ON RACKS ---
  createFloatingRackLabel(parentGroup, text, yPos, bgColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Rounded tag background
    ctx.fillStyle = bgColor;
    this.roundRect(ctx, 16, 16, 480, 96, 48);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Text
    ctx.font = 'bold 44px "Fredoka", Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(2.4, 0.6, 1);
    sprite.position.set(0, yPos, 0);
    parentGroup.add(sprite);
  }

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // --- DYNAMIC UPGRADE VISUAL TRANSFORMATIONS IN 3D ---
  createSidewalkBannerMesh(text, bgColor, textColor) {
    const bannerGroup = new THREE.Group();

    // Standing metal base
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 0.1, 16),
      new THREE.MeshLambertMaterial({ color: 0x334155 })
    );
    base.position.y = 0.05;
    bannerGroup.add(base);

    // Vertical pole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 3.4, 8),
      new THREE.MeshLambertMaterial({ color: 0x94a3b8 })
    );
    pole.position.y = 1.7;
    bannerGroup.add(pole);

    // Canvas banner blade
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Rounded blade banner shape
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.moveTo(16, 16);
    ctx.lineTo(240, 16);
    ctx.lineTo(240, 430);
    ctx.quadraticCurveTo(128, 500, 16, 430);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 10;
    ctx.stroke();

    // Vertical text lines
    ctx.font = 'bold 40px "Fredoka", sans-serif';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const words = text.split(' ');
    words.forEach((w, idx) => {
      ctx.fillText(w, 128, 120 + idx * 75);
    });

    const bannerTex = new THREE.CanvasTexture(canvas);
    const blade = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 2.6),
      new THREE.MeshBasicMaterial({ map: bannerTex, side: THREE.DoubleSide, transparent: true })
    );
    blade.position.set(0.7, 2.1, 0);
    blade.rotation.y = Math.PI / 4;
    bannerGroup.add(blade);

    return bannerGroup;
  }

  updateUpgradesVisual(upgrades) {
    if (!upgrades) return;

    // 1. VIP LOYALTY (Karpet Merah VIP, Plakat Emas Kasir, Mahkota Emas Berputar)
    if (this.upgradeVisuals.vipLoyalty) {
      this.scene.remove(this.upgradeVisuals.vipLoyalty);
      this.upgradeVisuals.vipLoyalty = null;
    }
    const vipLvl = upgrades.vipLoyalty ? upgrades.vipLoyalty.level : 0;
    if (vipLvl > 0) {
      const vipGroup = new THREE.Group();

      // Red Velvet Carpet leading from front entrance to counter
      const carpetGeo = new THREE.PlaneGeometry(2.4, 4.4);
      const carpetMat = new THREE.MeshLambertMaterial({ color: 0x991b1b });
      const carpet = new THREE.Mesh(carpetGeo, carpetMat);
      carpet.rotation.x = -Math.PI / 2;
      carpet.position.set(0, 0.42, 3.4);
      vipGroup.add(carpet);

      // Gold Trim Borders on Carpet sides
      const trimGeo = new THREE.BoxGeometry(0.12, 0.02, 4.4);
      const goldTrimMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.85, roughness: 0.2 });
      const trimL = new THREE.Mesh(trimGeo, goldTrimMat);
      trimL.position.set(-1.22, 0.43, 3.4);
      vipGroup.add(trimL);
      const trimR = new THREE.Mesh(trimGeo, goldTrimMat);
      trimR.position.set(1.22, 0.43, 3.4);
      vipGroup.add(trimR);

      // Gold VIP Plaque on front of checkout desk
      const plaque = new THREE.Mesh(
        new THREE.BoxGeometry(2.0, 0.4, 0.08),
        goldTrimMat
      );
      plaque.position.set(0, 1.1, 2.45);
      vipGroup.add(plaque);

      // Floating 3D Gold Crown above counter
      const crown = new THREE.Group();
      crown.position.set(0, 2.6, 1.8);
      const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.28, 0.25, 8), goldTrimMat);
      crown.add(crownBase);
      for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 6), goldTrimMat);
        const ang = (i / 5) * Math.PI * 2;
        spike.position.set(Math.cos(ang) * 0.3, 0.22, Math.sin(ang) * 0.3);
        crown.add(spike);
      }
      vipGroup.add(crown);
      vipGroup.userData = { crown };

      this.scene.add(vipGroup);
      this.upgradeVisuals.vipLoyalty = vipGroup;
    }

    // 2. FAST RESTOCK (Truk Ekspedisi Kilat)
    if (this.upgradeVisuals.fastRestock) {
      if (this.deliveryTruck) this.deliveryTruck.remove(this.upgradeVisuals.fastRestock);
      this.upgradeVisuals.fastRestock = null;
    }
    const truckLvl = upgrades.fastRestock ? upgrades.fastRestock.level : 0;
    if (truckLvl > 0 && this.deliveryTruck) {
      const truckAddons = new THREE.Group();
      const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.9, roughness: 0.1 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8, roughness: 0.2 });

      // Dual Chrome Vertical Exhaust Stacks
      const pipeGeo = new THREE.CylinderGeometry(0.09, 0.09, 1.8, 12);
      const pipeL = new THREE.Mesh(pipeGeo, chromeMat);
      pipeL.position.set(0.3, 2.3, 0.95);
      truckAddons.add(pipeL);
      const pipeR = new THREE.Mesh(pipeGeo, chromeMat);
      pipeR.position.set(0.3, 2.3, -0.95);
      truckAddons.add(pipeR);

      // Aerodynamic Cab Roof Spoiler / Wind Deflector
      const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 1.6), goldMat);
      spoiler.position.set(1.3, 2.3, 0);
      spoiler.rotation.z = -Math.PI / 16;
      truckAddons.add(spoiler);

      // Front Bull-Bar Bumper Grill
      const grill = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 1.8), chromeMat);
      grill.position.set(2.5, 0.7, 0);
      truckAddons.add(grill);

      // Glowing LED Headlights
      const ledMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
      const ledL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), ledMat);
      ledL.position.set(2.48, 0.85, 0.7);
      truckAddons.add(ledL);
      const ledR = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), ledMat);
      ledR.position.set(2.48, 0.85, -0.7);
      truckAddons.add(ledR);

      // Neon Chassis Underglow
      const underglowMat = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.6 });
      const underglow = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.4), underglowMat);
      underglow.rotation.x = -Math.PI / 2;
      underglow.position.set(0, 0.1, 0);
      truckAddons.add(underglow);

      this.deliveryTruck.add(truckAddons);
      this.upgradeVisuals.fastRestock = truckAddons;
    }

    // 3. MARKETING (Spanduk Iklan Trotoar & Billboard Neon Atap Toko)
    if (this.upgradeVisuals.marketing) {
      this.scene.remove(this.upgradeVisuals.marketing);
      this.upgradeVisuals.marketing = null;
    }
    const mktLvl = upgrades.marketing ? upgrades.marketing.level : 0;
    if (mktLvl > 0) {
      const mktGroup = new THREE.Group();

      // Sidewalk Standing Banners (Bendera Promosi Teardrop di depan toko)
      const b1 = this.createSidewalkBannerMesh('PROMO SPESIAL', '#ef4444', '#ffffff');
      b1.position.set(-6.5, 0.35, 6.5);
      mktGroup.add(b1);

      const b2 = this.createSidewalkBannerMesh('DISTRIBUTOR RESMI', '#ea580c', '#fbbf24');
      b2.position.set(6.5, 0.35, 6.5);
      mktGroup.add(b2);

      // Rooftop Animated Neon Marquee Sign
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 512, 128);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 6;
      ctx.strokeRect(6, 6, 500, 116);
      ctx.font = 'bold 36px "Fredoka", sans-serif';
      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ HARGA KONTRAKTOR ⚡', 256, 55);
      ctx.font = 'bold 26px "Fredoka", sans-serif';
      ctx.fillStyle = '#fdba74';
      ctx.fillText('DISTRIBUTOR RESMI GSA', 256, 95);

      const billboardTex = new THREE.CanvasTexture(canvas);
      const billboardMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(6.5, 1.6),
        new THREE.MeshBasicMaterial({ map: billboardTex })
      );
      billboardMesh.position.set(0, 7.3, 5.5);
      mktGroup.add(billboardMesh);

      this.scene.add(mktGroup);
      this.upgradeVisuals.marketing = mktGroup;
    }

    // 4. LUXURY DECOR (Lampu Sorot Showroom, Stanchions Emas, Underglow Rak)
    if (this.upgradeVisuals.luxuryDecor) {
      this.scene.remove(this.upgradeVisuals.luxuryDecor);
      this.upgradeVisuals.luxuryDecor = null;
    }
    const decLvl = upgrades.luxuryDecor ? upgrades.luxuryDecor.level : 0;
    if (decLvl > 0) {
      const decGroup = new THREE.Group();

      // Showroom Spotlights from Ceiling beaming onto product racks
      const spotLocations = [
        [-6, 6.0, -6],
        [-0.5, 6.0, -6.5],
        [5.5, 6.0, -6],
        [-6, 6.0, -1],
        [6, 6.0, -1]
      ];

      const lampMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });
      const lightBeamMat = new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide
      });

      spotLocations.forEach(pos => {
        const lamp = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.5, 12), lampMat);
        lamp.position.set(pos[0], pos[1], pos[2]);
        lamp.rotation.x = Math.PI;
        decGroup.add(lamp);

        const beam = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4.5, 16, 1, true), lightBeamMat);
        beam.position.set(pos[0], pos[1] - 2.25, pos[2]);
        beam.rotation.x = Math.PI;
        decGroup.add(beam);
      });

      // Gold Stanchions flanking entrance
      const stanchionMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.85, roughness: 0.15 });

      [-2.8, 2.8].forEach(x => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.2, 12), stanchionMat);
        post.position.set(x, 0.95, 5.0);
        decGroup.add(post);

        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), stanchionMat);
        ball.position.set(x, 1.6, 5.0);
        decGroup.add(ball);
      });

      // Luxury Racks Neon Underglow Ribbons
      const rackGlowMat = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.45 });
      const glow1 = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 2.2), rackGlowMat);
      glow1.rotation.x = -Math.PI / 2;
      glow1.position.set(-6, 0.42, -6);
      decGroup.add(glow1);

      const glow2 = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.0), rackGlowMat);
      glow2.rotation.x = -Math.PI / 2;
      glow2.position.set(-0.5, 0.42, -6.5);
      decGroup.add(glow2);

      const glow3 = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.4), rackGlowMat);
      glow3.rotation.x = -Math.PI / 2;
      glow3.position.set(5.5, 0.42, -6);
      decGroup.add(glow3);

      this.scene.add(decGroup);
      this.upgradeVisuals.luxuryDecor = decGroup;
    }

    // 5. WAREHOUSE EXPANSION (Gudang Kapasitas Jumbo)
    if (this.upgradeVisuals.warehouseExp) {
      this.scene.remove(this.upgradeVisuals.warehouseExp);
      this.upgradeVisuals.warehouseExp = null;
    }
    const whLvl = upgrades.warehouseExp ? upgrades.warehouseExp.level : 0;
    if (whLvl > 0) {
      const whGroup = new THREE.Group();

      // Heavy duty industrial steel storage rack at back
      const steelMat = new THREE.MeshLambertMaterial({ color: 0xf97316 }); // Industrial safety orange

      // Steel Uprights
      const upGeo = new THREE.BoxGeometry(0.12, 4.0, 0.12);
      [[-7.8, -4], [-7.8, -1.5], [-5.2, -4], [-5.2, -1.5]].forEach(pos => {
        const up = new THREE.Mesh(upGeo, steelMat);
        up.position.set(pos[0], 2.2, pos[1] - 3.5);
        whGroup.add(up);
      });

      // Storage Shelf Beams
      const beamGeo = new THREE.BoxGeometry(2.8, 0.12, 2.6);
      [1.5, 3.0].forEach(y => {
        const shelf = new THREE.Mesh(beamGeo, steelMat);
        shelf.position.set(-6.5, y, -6.25);
        whGroup.add(shelf);

        // Stacked wrapped material inventory on shelf
        const invBox = new THREE.Mesh(
          new THREE.BoxGeometry(2.2, 0.7, 2.0),
          new THREE.MeshLambertMaterial({ color: 0x94a3b8 })
        );
        invBox.position.set(-6.5, y + 0.42, -6.25);
        whGroup.add(invBox);
      });

      // Yellow/Black Warehouse floor safety hazard stripes
      const stripeGeo = new THREE.BoxGeometry(4.0, 0.02, 0.2);
      const stripeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
      const stripe1 = new THREE.Mesh(stripeGeo, stripeMat);
      stripe1.position.set(-6.5, 0.42, -4.6);
      whGroup.add(stripe1);

      this.scene.add(whGroup);
      this.upgradeVisuals.warehouseExp = whGroup;
    }
  }

  // --- CHECKOUT COUNTER ---
  buildCheckoutCounter() {
    const counterGroup = new THREE.Group();
    counterGroup.position.set(0, 0.4, 1.8);

    // L-shaped Counter Desk
    const woodMat = new THREE.MeshLambertMaterial({ color: 0xea580c });
    const topMat = new THREE.MeshLambertMaterial({ color: 0xffffff });

    // Front Desk
    const desk = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.2, 1.2), woodMat);
    desk.position.y = 0.6;
    desk.castShadow = true;
    desk.receiveShadow = true;
    counterGroup.add(desk);

    // Marble Top
    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.15, 1.4), topMat);
    deskTop.position.y = 1.25;
    deskTop.castShadow = true;
    counterGroup.add(deskTop);

    // Cute Cash Register
    const regGroup = new THREE.Group();
    regGroup.position.set(-0.8, 1.35, 0);

    const baseReg = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.25, 0.6),
      new THREE.MeshLambertMaterial({ color: 0x334155 })
    );
    regGroup.add(baseReg);

    // Screen
    const screen = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.4, 0.08),
      new THREE.MeshLambertMaterial({ color: 0x0f172a })
    );
    screen.position.set(0, 0.35, -0.15);
    screen.rotation.x = -Math.PI / 10;
    regGroup.add(screen);

    // Barcode Scanner
    const scanner = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.3, 0.15),
      new THREE.MeshLambertMaterial({ color: 0xf59e0b })
    );
    scanner.position.set(0.6, 0.15, 0);
    regGroup.add(scanner);

    // Service Bell
    const bell = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.8, roughness: 0.2 })
    );
    bell.position.set(0.8, 1.4, 0.2);
    counterGroup.add(bell);

    counterGroup.add(regGroup);
    this.scene.add(counterGroup);
  }

  // --- STAFF MEMBER (GSA CLERK) ---
  buildStaff() {
    this.staffMesh = this.createHumanoidCharacter({
      shirtColor: 0xea580c, // GSA Orange
      pantsColor: 0x1e293b,
      hatColor: 0xfbbf24, // Yellow Hard Hat
      hasHelmet: true
    });
    this.staffMesh.position.set(0, 0.4, 0.6); // Behind counter
    this.scene.add(this.staffMesh);
  }

  // --- DELIVERY TRUCK (GSA LOGISTIK) ---
  buildDeliveryTruck() {
    const truck = new THREE.Group();
    truck.position.set(8, 0.3, 13); // Parked outside on road
    truck.rotation.y = -Math.PI / 2;

    // Cabin
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 1.8, 1.8),
      new THREE.MeshLambertMaterial({ color: 0xea580c })
    );
    cabin.position.set(1.4, 1.2, 0);
    cabin.castShadow = true;
    truck.add(cabin);

    // Windshield
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.8, 1.5),
      new THREE.MeshLambertMaterial({ color: 0xfed7aa })
    );
    glass.position.set(2.45, 1.4, 0);
    truck.add(glass);

    // Cargo Box
    const cargo = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 2.2, 2.0),
      new THREE.MeshLambertMaterial({ color: 0xf8fafc })
    );
    cargo.position.set(-1.4, 1.4, 0);
    cargo.castShadow = true;
    truck.add(cargo);

    // GSA Logistik Text on Truck Cargo
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 512, 256);
    ctx.font = 'bold 58px "Fredoka", sans-serif';
    ctx.fillStyle = '#ea580c';
    ctx.textAlign = 'center';
    ctx.fillText('GSA LOGISTIK', 256, 110);
    ctx.font = '700 36px "Fredoka", sans-serif';
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('TRUK MATERIAL KILAT', 256, 180);

    const cargoTexture = new THREE.CanvasTexture(canvas);
    const cargoSide = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 1.6),
      new THREE.MeshBasicMaterial({ map: cargoTexture })
    );
    cargoSide.position.set(-1.4, 1.4, 1.02);
    truck.add(cargoSide);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const wheelPositions = [
      [1.4, 0.4, 0.95], [1.4, 0.4, -0.95],
      [-0.8, 0.4, 0.95], [-0.8, 0.4, -0.95],
      [-2.4, 0.4, 0.95], [-2.4, 0.4, -0.95]
    ];
    wheelPositions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(...pos);
      wheel.castShadow = true;
      truck.add(wheel);
    });

    this.deliveryTruck = truck;
    this.scene.add(truck);
  }

  // --- TRUCK HONK & RESTOCK ANIMATION ---
  animateDeliveryArrival() {
    if (!this.deliveryTruck) return;
    const truck = this.deliveryTruck;
    truck.position.x = 20; // drive in from offscreen
    let progress = 0;
    const driveInterval = setInterval(() => {
      progress += 0.05;
      truck.position.x = 20 - (20 - 8) * Math.min(progress, 1);
      if (progress >= 1) {
        clearInterval(driveInterval);
      }
    }, 16);
  }

  // --- HUMANOID CARTOON CHARACTER BUILDER ---
  createHumanoidCharacter(options = {}) {
    const charGroup = new THREE.Group();

    const skinColor = options.skinColor || 0xfcd34d;
    const shirtColor = options.shirtColor || 0xef4444;
    const pantsColor = options.pantsColor || 0x1e293b;

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 16, 16),
      new THREE.MeshLambertMaterial({ color: skinColor })
    );
    head.position.y = 1.35;
    head.castShadow = true;
    charGroup.add(head);

    // Cute Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
    eyeL.position.set(-0.1, 1.38, 0.3);
    charGroup.add(eyeL);

    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
    eyeR.position.set(0.1, 1.38, 0.3);
    charGroup.add(eyeR);

    // Hat / Hair
    if (options.hasHelmet) {
      const helmet = new THREE.Mesh(
        new THREE.SphereGeometry(0.36, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5),
        new THREE.MeshLambertMaterial({ color: options.hatColor || 0xfbbf24 })
      );
      helmet.position.set(0, 1.42, 0);
      charGroup.add(helmet);
      const brim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 0.05, 16),
        new THREE.MeshLambertMaterial({ color: options.hatColor || 0xfbbf24 })
      );
      brim.position.set(0, 1.42, 0);
      charGroup.add(brim);
    } else {
      // Hair Bun / Cap
      const hair = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 12, 12),
        new THREE.MeshLambertMaterial({ color: options.hairColor || 0x451a03 })
      );
      hair.position.set(0, 1.44, -0.06);
      charGroup.add(hair);
    }

    // Torso / Shirt
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.6, 0.35),
      new THREE.MeshLambertMaterial({ color: shirtColor })
    );
    torso.position.y = 0.85;
    torso.castShadow = true;
    charGroup.add(torso);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.2, 0.5, 0.22);
    const legMat = new THREE.MeshLambertMaterial({ color: pantsColor });
    
    const legL = new THREE.Mesh(legGeo, legMat);
    legL.position.set(-0.16, 0.3, 0);
    legL.castShadow = true;
    charGroup.add(legL);

    const legR = new THREE.Mesh(legGeo, legMat);
    legR.position.set(0.16, 0.3, 0);
    legR.castShadow = true;
    charGroup.add(legR);

    charGroup.userData = {
      head,
      torso,
      legL,
      legR,
      walkPhase: Math.random() * Math.PI * 2
    };

    return charGroup;
  }

  // --- CUSTOMER MANAGEMENT IN 3D ---
  spawnCustomer3D(customerData) {
    const shirtColors = [0xef4444, 0x10b981, 0xf59e0b, 0x8b5cf6, 0x06b6d4, 0xec4899];
    const col = shirtColors[Math.floor(Math.random() * shirtColors.length)];

    const charMesh = this.createHumanoidCharacter({
      shirtColor: col,
      pantsColor: 0x334155,
      hasHelmet: Math.random() > 0.6
    });

    // Start outside on sidewalk
    charMesh.position.set(-2 - Math.random() * 4, 0.4, 9 + Math.random() * 2);
    this.scene.add(charMesh);

    // Create 3D Order Floating Bubble
    const bubble = this.createSpeechBubbleMesh(customerData.order);
    bubble.position.set(0, 2.3, 0);
    charMesh.add(bubble);

    const customerObj = {
      id: customerData.id,
      data: customerData,
      mesh: charMesh,
      bubble: bubble,
      targetPos: new THREE.Vector3(0, 0.4, 3.2), // Front of checkout counter
      state: 'walking_in', // walking_in -> waiting -> served -> walking_out
      speed: 4.5
    };

    this.customers3D.set(customerData.id, customerObj);
    return customerObj;
  }

  removeCustomer3D(id) {
    const cust = this.customers3D.get(id);
    if (!cust) return;
    cust.state = 'walking_out';
    cust.targetPos = new THREE.Vector3(12, 0.4, 12); // Walk out to road
  }

  // --- 3D FLOATING SPEECH BUBBLE WITH PRODUCTS ---
  createSpeechBubbleMesh(order) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Speech bubble background
    ctx.fillStyle = '#ffffff';
    this.roundRect(ctx, 8, 8, 240, 100, 24);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ea580c';
    ctx.stroke();

    // Bubble pointer down
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(116, 108);
    ctx.lineTo(128, 124);
    ctx.lineTo(140, 108);
    ctx.fill();

    // Render requested product icons & quantities
    ctx.font = 'bold 24px "Fredoka", Arial, sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const orderKeys = Object.keys(order);
    const summary = orderKeys.map(k => {
      const prod = window.GAME_PRODUCTS[k];
      return `${prod ? prod.icon : '📦'}x${order[k]}`;
    }).join(' ');

    ctx.fillText(summary || 'Beli Produk', 128, 58);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.8, 0.9, 1);
    return sprite;
  }

  // --- FLOATING +Rp CASH PARTICLES ---
  spawnFloatingCash(amount, worldPos) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.font = '900 48px "Fredoka", Arial, sans-serif';
    ctx.fillStyle = '#16a34a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.fillText(`+${window.formatRupiah(amount)}`, 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(2.4, 0.6, 1);
    sprite.position.copy(worldPos || new THREE.Vector3(0, 2.5, 2));

    this.scene.add(sprite);
    this.floatingTexts.push({
      sprite,
      life: 1.0,
      vy: 1.8
    });
  }

  // --- CAMERA CONTROLS & PRESETS ---
  updateCameraPosition() {
    const x = Math.cos(this.camAngle) * Math.cos(this.camElevation) * (this.baseDist * this.zoomLevel);
    const z = Math.sin(this.camAngle) * Math.cos(this.camElevation) * (this.baseDist * this.zoomLevel);
    const y = Math.sin(this.camElevation) * (this.baseDist * this.zoomLevel);

    this.camera.position.set(
      this.cameraTarget.x + x,
      this.cameraTarget.y + y,
      this.cameraTarget.z + z
    );
    this.camera.lookAt(this.cameraTarget);
  }

  getMinZoom() {
    return 0.4;
  }

  getMaxZoom() {
    // Di HP (layar vertikal/portrait atau lebar < 768px), izinkan zoom out hingga 3.4x
    // agar terlihat seluas dan sejauh di PC tanpa terpotong
    const isMobile = window.innerWidth < 768 || (this.camera && this.camera.aspect < 1.0);
    return isMobile ? 3.4 : 2.4;
  }

  setCameraPreset(presetName) {
    const isMobile = window.innerWidth < 768 || (this.camera && this.camera.aspect < 1.0);
    if (presetName === 'front') {
      this.camAngle = Math.PI / 3.4;
      this.camElevation = Math.PI / 4.0;
      this.zoomLevel = isMobile ? 1.4 : 1.0;
      this.cameraTarget.set(0, 1.2, 0.5);
    } else if (presetName === 'counter') {
      this.camAngle = Math.PI / 3.2;
      this.camElevation = Math.PI / 4.8;
      this.zoomLevel = isMobile ? 0.9 : 0.65;
      this.cameraTarget.set(0, 1.2, 2.0);
    } else if (presetName === 'top') {
      this.camAngle = Math.PI / 3.4;
      this.camElevation = Math.PI / 2.3;
      this.zoomLevel = isMobile ? 1.5 : 1.0;
      this.cameraTarget.set(0, 1.0, 0);
    }
    this.updateCameraPosition();
  }

  zoomIn() {
    const step = window.innerWidth < 768 ? 0.2 : 0.15;
    this.zoomLevel = Math.max(this.getMinZoom(), this.zoomLevel - step);
    this.updateCameraPosition();
  }

  zoomOut() {
    const step = window.innerWidth < 768 ? 0.25 : 0.15;
    this.zoomLevel = Math.min(this.getMaxZoom(), this.zoomLevel + step);
    this.updateCameraPosition();
  }

  rotateCamera(dir = 1) {
    this.camAngle += (Math.PI / 8) * dir;
    this.updateCameraPosition();
  }

  // --- TOUCH & MOUSE INTERACTION ---
  setupInteractions() {
    const el = this.container;

    // Mouse Drag / Orbit
    el.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.prevPointerPos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.prevPointerPos.x;
      const dy = e.clientY - this.prevPointerPos.y;

      this.camAngle += dx * 0.005;
      this.camElevation = Math.max(0.15, Math.min(Math.PI / 2.2, this.camElevation - dy * 0.004));
      this.updateCameraPosition();

      this.prevPointerPos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Mouse Wheel Zoom
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.deltaY > 0) this.zoomOut();
      else this.zoomIn();
    }, { passive: false });

    // Touch Support (Single finger rotate, two fingers pinch-to-zoom)
    el.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.prevPointerPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        this.isDragging = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this.touchStartDist = Math.hypot(dx, dy);
      }
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.isDragging) {
        const dx = e.touches[0].clientX - this.prevPointerPos.x;
        const dy = e.touches[0].clientY - this.prevPointerPos.y;

        this.camAngle += dx * 0.007;
        this.camElevation = Math.max(0.15, Math.min(Math.PI / 2.2, this.camElevation - dy * 0.006));
        this.updateCameraPosition();

        this.prevPointerPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        if (this.touchStartDist > 0) {
          const delta = (this.touchStartDist - dist) * 0.005;
          this.zoomLevel = Math.max(this.getMinZoom(), Math.min(this.getMaxZoom(), this.zoomLevel + delta));
          this.updateCameraPosition();
        }
        this.touchStartDist = dist;
      }
    }, { passive: true });

    el.addEventListener('touchend', () => {
      this.isDragging = false;
      this.touchStartDist = 0;
    });
  }

  onWindowResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const aspect = width / height;
    this.camera.aspect = aspect;

    // Adaptasi FOV di HP portrait agar sudut pandang horizontal tidak menyempit
    if (aspect < 1.0) {
      this.camera.fov = Math.min(52, Math.max(38, 34 / Math.sqrt(aspect)));
    } else {
      this.camera.fov = 34;
    }

    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  // --- ANIMATION LOOP ---
  animate() {
    requestAnimationFrame(() => this.animate());
    const dt = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();

    // 1. Staff Idling Animation (Cute head bobbing)
    if (this.staffMesh && this.staffMesh.userData.head) {
      this.staffMesh.userData.head.position.y = 1.35 + Math.sin(elapsedTime * 3) * 0.03;
    }

    // 2. Customer AI & Movement
    this.customers3D.forEach((cust, id) => {
      const mesh = cust.mesh;
      const target = cust.targetPos;
      const dist = mesh.position.distanceTo(target);

      if (cust.state === 'walking_in' || cust.state === 'walking_out') {
        if (dist > 0.2) {
          const dir = new THREE.Vector3().subVectors(target, mesh.position).normalize();
          mesh.position.addScaledVector(dir, cust.speed * dt);
          mesh.lookAt(target.x, mesh.position.y, target.z);

          // Walk cycle: Swing legs & bob
          mesh.userData.walkPhase += dt * 12;
          const legAngle = Math.sin(mesh.userData.walkPhase) * 0.45;
          mesh.userData.legL.rotation.x = legAngle;
          mesh.userData.legR.rotation.x = -legAngle;
          mesh.position.y = 0.4 + Math.abs(Math.sin(mesh.userData.walkPhase)) * 0.06;
        } else {
          if (cust.state === 'walking_in') {
            cust.state = 'waiting';
            mesh.lookAt(0, mesh.position.y, 0.6); // Look at counter
            mesh.userData.legL.rotation.x = 0;
            mesh.userData.legR.rotation.x = 0;
          } else if (cust.state === 'walking_out') {
            // Delete customer mesh when left
            this.scene.remove(mesh);
            this.customers3D.delete(id);
          }
        }
      } else if (cust.state === 'waiting') {
        // Idle breathing & floating bubble bobbing
        mesh.userData.head.position.y = 1.35 + Math.sin(elapsedTime * 2.5) * 0.02;
        if (cust.bubble) {
          cust.bubble.position.y = 2.3 + Math.sin(elapsedTime * 3) * 0.08;
        }
      }
    });

    // 3. VIP Crown Idle Animation
    if (this.upgradeVisuals.vipLoyalty && this.upgradeVisuals.vipLoyalty.userData.crown) {
      const crown = this.upgradeVisuals.vipLoyalty.userData.crown;
      crown.rotation.y += dt * 1.5;
      crown.position.y = 2.6 + Math.sin(elapsedTime * 2.5) * 0.08;
    }

    // 4. Floating Cash Particles
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const item = this.floatingTexts[i];
      item.life -= dt;
      item.sprite.position.y += item.vy * dt;
      item.sprite.material.opacity = Math.max(0, item.life);
      if (item.life <= 0) {
        this.scene.remove(item.sprite);
        this.floatingTexts.splice(i, 1);
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.StoreScene3D = StoreScene3D;
